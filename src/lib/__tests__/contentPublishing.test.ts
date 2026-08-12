// §Content Management admin tooling — the rules that make publishing real.
import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetContent,
  approveAndPublishContent,
  canAuthorContent,
  canPublishContent,
  contentReviewQueue,
  getContentEntry,
  hasUnpublishedChanges,
  isContentLive,
  returnContentForChanges,
  saveContentDraft,
  submitContentForReview,
} from "@/lib/contentPublishing";
import { LIBRARY_LESSON_TYPE } from "@/lib/contentTypes";
import { liveLibraryItem, liveLibraryItems } from "@/lib/contentCatalog";
import { LIBRARY_ITEMS } from "@/lib/library";

const AUTHOR = { staffId: "s-peer1", name: "Peer", role: "peer_specialist" as const };
const APPROVER = { staffId: "s-cc2", name: "Cathy", role: "clinical_coordinator" as const };

function draftBody(id: string) {
  return {
    ...LIBRARY_LESSON_TYPE.emptyBody(),
    id,
    title: "Sleep reset",
    minutes: 6,
    order: 99,
    problem: "I lie awake and then everything feels worse the next day.",
    learnTitle: "Sleep is a skill, not a switch",
    learnBody: "Winding down at the same time each night is what makes sleep come.",
    activity: {
      kind: "checklist",
      prompt: "Which wind-down cue could you try tonight?",
      items: ["Phone in the other room", "Lights down at 9", "Shower before bed"],
    },
    adelReflection: "Rest is not a reward for a good day. It is how you get one.",
    adelQuestion: "What time would you like to be in bed tonight?",
    insight: "One cue, same time, every night.",
    action: "Pick one wind-down cue for tonight.",
    toolkitLabel: "My wind-down cue",
  };
}

describe("content publishing lifecycle", () => {
  beforeEach(() => __resetContent());

  it("splits authoring from approval along the existing RBAC lines", () => {
    expect(canAuthorContent("peer_specialist")).toBe(true);
    expect(canPublishContent("peer_specialist")).toBe(false);
    expect(canPublishContent("clinical_coordinator")).toBe(true);
    expect(canAuthorContent("billing")).toBe(false);
  });

  it("a draft is never patient-visible, and publishing makes it visible", () => {
    const id = "lib_sleep_reset";
    expect(saveContentDraft({ typeId: "library_lesson", id, body: draftBody(id), actor: AUTHOR }).ok).toBe(true);
    expect(liveLibraryItem(id)).toBeUndefined();

    expect(
      submitContentForReview({
        typeId: "library_lesson",
        id,
        actor: AUTHOR,
        validate: LIBRARY_LESSON_TYPE.validate,
      }).ok,
    ).toBe(true);
    expect(liveLibraryItem(id)).toBeUndefined();
    expect(contentReviewQueue().map((e) => e.id)).toContain(id);

    const pub = approveAndPublishContent({
      typeId: "library_lesson",
      id,
      actor: APPROVER,
      validate: LIBRARY_LESSON_TYPE.validate,
    });
    expect(pub.ok).toBe(true);
    expect(liveLibraryItem(id)?.title).toBe("Sleep reset");
    expect(liveLibraryItems().length).toBe(LIBRARY_ITEMS.length + 1);
  });

  it("refuses to publish incomplete content", () => {
    const id = "lib_thin";
    saveContentDraft({
      typeId: "library_lesson",
      id,
      body: { ...LIBRARY_LESSON_TYPE.emptyBody(), id },
      actor: AUTHOR,
    });
    const res = submitContentForReview({
      typeId: "library_lesson",
      id,
      actor: AUTHOR,
      validate: LIBRARY_LESSON_TYPE.validate,
    });
    expect(res.ok).toBe(false);
  });

  it("the submitter cannot approve their own submission", () => {
    const id = "lib_sleep_reset";
    saveContentDraft({ typeId: "library_lesson", id, body: draftBody(id), actor: APPROVER });
    submitContentForReview({
      typeId: "library_lesson",
      id,
      actor: APPROVER,
      validate: LIBRARY_LESSON_TYPE.validate,
    });
    const res = approveAndPublishContent({ typeId: "library_lesson", id, actor: APPROVER });
    expect(res.ok).toBe(false);
    expect(liveLibraryItem(id)).toBeUndefined();
  });

  it("an author cannot publish even after a valid submission", () => {
    const id = "lib_sleep_reset";
    saveContentDraft({ typeId: "library_lesson", id, body: draftBody(id), actor: AUTHOR });
    submitContentForReview({ typeId: "library_lesson", id, actor: AUTHOR, validate: LIBRARY_LESSON_TYPE.validate });
    expect(approveAndPublishContent({ typeId: "library_lesson", id, actor: AUTHOR }).ok).toBe(false);
  });

  it("editing a published lesson keeps serving the published snapshot", () => {
    const id = "lib_sleep_reset";
    saveContentDraft({ typeId: "library_lesson", id, body: draftBody(id), actor: AUTHOR });
    submitContentForReview({ typeId: "library_lesson", id, actor: AUTHOR, validate: LIBRARY_LESSON_TYPE.validate });
    approveAndPublishContent({ typeId: "library_lesson", id, actor: APPROVER });

    saveContentDraft({
      typeId: "library_lesson",
      id,
      body: { ...draftBody(id), title: "Sleep reset v2" },
      actor: AUTHOR,
    });
    // The working copy moved; patients did not.
    expect(liveLibraryItem(id)?.title).toBe("Sleep reset");
    const e = getContentEntry("library_lesson", id)!;
    expect(hasUnpublishedChanges(e)).toBe(true);
    // Still live on the OLD revision while the new one is being worked on.
    expect(isContentLive(e)).toBe(true);
    expect(e.status).toBe("draft");
    expect(e.publishedRev).toBe(3);

    submitContentForReview({ typeId: "library_lesson", id, actor: AUTHOR, validate: LIBRARY_LESSON_TYPE.validate });
    approveAndPublishContent({ typeId: "library_lesson", id, actor: APPROVER });
    expect(liveLibraryItem(id)?.title).toBe("Sleep reset v2");

    // Full snapshot history, not diffs — the old version is still recoverable.
    const after = getContentEntry("library_lesson", id)!;
    expect(after.revisions.find((r) => r.rev === 3)?.body["title"]).toBe("Sleep reset");
  });

  it("a returned entry needs a reason and goes back to draft", () => {
    const id = "lib_sleep_reset";
    saveContentDraft({ typeId: "library_lesson", id, body: draftBody(id), actor: AUTHOR });
    submitContentForReview({ typeId: "library_lesson", id, actor: AUTHOR, validate: LIBRARY_LESSON_TYPE.validate });
    expect(returnContentForChanges({ typeId: "library_lesson", id, actor: APPROVER }).ok).toBe(false);
    const res = returnContentForChanges({
      typeId: "library_lesson",
      id,
      actor: APPROVER,
      note: "The example names a real client.",
    });
    expect(res.ok).toBe(true);
    expect(getContentEntry("library_lesson", id)?.status).toBe("draft");
    expect(getContentEntry("library_lesson", id)?.returnedNote).toContain("real client");
  });

  it("an unpublished override never displaces the shipped baseline lesson", () => {
    const baseId = LIBRARY_ITEMS[0]!.id;
    const baseTitle = LIBRARY_ITEMS[0]!.title;
    const body = LIBRARY_LESSON_TYPE.baselineBody(baseId)!;
    saveContentDraft({
      typeId: "library_lesson",
      id: baseId,
      body: { ...body, title: "Rewritten but unapproved" },
      actor: AUTHOR,
      overridesBaseline: true,
    });
    expect(liveLibraryItem(baseId)?.title).toBe(baseTitle);
    expect(liveLibraryItems().length).toBe(LIBRARY_ITEMS.length);
  });
});