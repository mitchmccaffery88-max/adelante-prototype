// §C0–C5 content center: seeds, baseline verification, verify-stamps-managed,
// CMS-created resources, sign-off + Spanish rule, tag-driven suggestions,
// live picker, deep links, auto-complete, coverage.
import { describe, expect, it } from "vitest";
import "@/lib/contentCatalog";
import "@/lib/contentTags";
import {
  BASELINE_VERIFIER,
  BASELINE_VERIFICATION_SKIPPED,
  getResource,
  isResourceVerified,
  listResources,
  verifyResource,
} from "@/lib/communityResources";
import {
  getContentEntry,
  listContent,
  publishContent,
  saveContentDraft,
  submitContentForReview,
} from "@/lib/contentPublishing";
import { contentType } from "@/lib/contentTypes";
import { publishBlocker } from "@/lib/contentGovernance";
import {
  contentCoverage,
  lessonsForCategories,
  suggestContentForPatient,
  taggedCatalog,
} from "@/lib/contentTags";
import {
  activityById,
  addStructuredGoal,
  assignToGoal,
  getStructuredPlan,
  planActivities,
  planSuggestions,
} from "@/lib/structuredCarePlan";
import { AdelanteEHR } from "@/lib/ehr";
import { completeLibraryItem } from "@/lib/engagement";

const AUTHOR = { staffId: "s-cc2", name: "Cathy", role: "clinical_coordinator" as const };
const PMHNP = { staffId: "s-th3", name: "Anita Brooks", role: "pmhnp" as const };
const THERAPIST = { name: "Marisol", role: "therapist" as const };

describe("C0 seeds load on any entry path", () => {
  it("authored lessons are managed and have titles", () => {
    const lib = listContent("library_lesson");
    const ss = lib.find((e) => e.id === "ss-finding-my-footing");
    expect(ss).toBeDefined();
    const d = contentType("library_lesson");
    const title = d.titleOf(ss!.body).startsWith("(") ? d.titleOf(d.baselineBody(ss!.id)!) : d.titleOf(ss!.body);
    expect(title).toBe("Finding My Footing");
  });
});

describe("C1 resources", () => {
  it("baseline verification recorded on every listing with full facts", () => {
    const all = listResources();
    const verified = all.filter(isResourceVerified);
    expect(verified.length).toBe(all.length - BASELINE_VERIFICATION_SKIPPED.length);
    const r = verified[0]!;
    expect(r.verification?.verifiedBy).toBe(BASELINE_VERIFIER.name);
    expect(r.verification?.note).toBe("Baseline — final audit before official launch");
    expect(r.verification?.verifiedAt.slice(0, 10)).toBe("2026-10-08");
  });

  it("Verify stamps the managed revision and never overwrites CMS edits", () => {
    const id = listResources()[0]!.id;
    const entry = getContentEntry("community_resource", id)!;
    saveContentDraft({
      typeId: "community_resource",
      id,
      body: { ...entry.body, description: "CMS-edited description" },
      actor: AUTHOR,
    });
    const res = verifyResource({
      resourceId: id,
      actorStaffId: AUTHOR.staffId,
      actorName: AUTHOR.name,
      actorRole: AUTHOR.role,
      confirmedAddress: true,
      confirmedPhone: true,
      confirmedHours: true,
    });
    expect(res.ok).toBe(true);
    const after = getContentEntry("community_resource", id)!;
    expect(after.publishedBody?.["description"]).toBe("CMS-edited description");
  });

  it("a resource created in the center can be verified and referred to", () => {
    const id = "res_cms_new_housing";
    saveContentDraft({
      typeId: "community_resource",
      id,
      body: { id, name: "New Housing Desk", categoryId: "housing", description: "Help", address: "1 Main St, Visalia", phone: "559-555-0100", hours: "Mon–Fri 9–5" },
      actor: AUTHOR,
    });
    expect(listResources("housing").some((r) => r.id === id)).toBe(true);
    const res = verifyResource({ resourceId: id, actorName: AUTHOR.name, actorStaffId: AUTHOR.staffId, actorRole: AUTHOR.role, confirmedAddress: true, confirmedPhone: true, confirmedHours: true });
    expect(res.ok).toBe(true);
    expect(isResourceVerified(getResource(id)!)).toBe(true);
  });
});

describe("C4 sign-off rule", () => {
  const body = (meta: Record<string, unknown>) => ({ title: "x", meta });
  it("clinical / Part 2 need a clinical reviewer who isn't the author", () => {
    expect(publishBlocker({ typeId: "library_lesson", body: body({ clinical: true, esStatus: "reviewed" }), actorRole: "therapist", actorKey: "a", authorKey: "b" })).toMatch(/PMHNP/);
    expect(publishBlocker({ typeId: "library_lesson", body: body({ clinical: true, esStatus: "reviewed" }), actorRole: "pmhnp", actorKey: "a", authorKey: "a" })).toMatch(/isn't the author/);
    expect(publishBlocker({ typeId: "library_lesson", body: body({ clinical: true, esStatus: "reviewed" }), actorRole: "pmhnp", actorKey: "a", authorKey: "b" })).toBeUndefined();
    expect(publishBlocker({ typeId: "recovery_lesson", body: body({ esStatus: "reviewed" }), actorRole: "sys_admin", actorKey: "a" })).toMatch(/PMHNP/);
  });
  it("editorial publishes immediately; Spanish missing blocks unless a reason is given", () => {
    expect(publishBlocker({ typeId: "library_lesson", body: body({ esStatus: "reviewed" }), actorRole: "sys_admin", actorKey: "a", authorKey: "a" })).toBeUndefined();
    expect(publishBlocker({ typeId: "library_lesson", body: body({}), actorRole: "sys_admin", actorKey: "a" })).toMatch(/Spanish/);
    expect(publishBlocker({ typeId: "library_lesson", body: body({ spanishOverrideReason: "translator out" }), actorRole: "sys_admin", actorKey: "a" })).toBeUndefined();
  });
});

describe("C5 tags drive the care plan, Adel and SDOH", () => {
  const luis = () => AdelanteEHR.listPatients().find((p) => p.firstName === "Luis")!;

  it("a clinical housing lesson goes to review, a different reviewer approves, then it is suggested", () => {
    const id = "lib_housing_first_30";
    const base = { ...contentType("library_lesson").emptyBody(), id, categoryId: "back-on-feet", title: "Keeping Housing in the First 30 Days", minutes: 5, order: 99,
      problem: "Finding a place to stay.", learnTitle: "Steps", learnBody: "Call the housing desk.", toolkitLabel: "Housing steps",
      es: { title: "Mantener vivienda los primeros 30 días" },
      meta: { sdoh: ["housing"], stages: ["first_30"], clinical: true, esStatus: "reviewed" } };
    expect(saveContentDraft({ typeId: "library_lesson", id, body: base, actor: AUTHOR }).ok).toBe(true);
    expect(publishContent({ typeId: "library_lesson", id, actor: AUTHOR }).ok).toBe(false);
    expect(submitContentForReview({ typeId: "library_lesson", id, actor: AUTHOR }).ok).toBe(true);
    expect(publishContent({ typeId: "library_lesson", id, actor: PMHNP }).ok).toBe(true);

    expect(lessonsForCategories(["housing"]).some((t) => t.id === id)).toBe(true);
    expect(planActivities().some((a) => a.id === id && a.search?.["item"] === id)).toBe(true);
  });

  it("picker reads live content; old dangling ids resolve", () => {
    expect(planActivities().length).toBeGreaterThan(50);
    expect(activityById("behavioral-activation")?.id).toBe("ss-daily-rhythm");
    expect(activityById("reentry-journey")?.id).toBe("first-days-out");
  });

  it("finishing the lesson closes the assignment with a source", () => {
    const p = luis();
    const g = addStructuredGoal({ patientId: p.id, clinicalText: "Stable housing", measure: "Housed", owner: "patient" as never, actor: THERAPIST });
    const a = assignToGoal({ patientId: p.id, goalId: g.id, kind: "activity", activityId: "back-on-feet-housing", frequency: "once", actor: THERAPIST });
    completeLibraryItem(p.id, "back-on-feet-housing");
    const after = getStructuredPlan(p.id).assignments.find((x) => x.id === a.id)!;
    expect(after.completions.length).toBe(1);
    expect(after.completionSources?.[0]?.source).toBe("lesson_finished");
  });

  it("suggestions come from tags; non-SUD viewers never get Part 2 items", () => {
    const p = luis();
    const all = suggestContentForPatient(p.id, { seesPart2: false });
    expect(all.every((s) => !s.item.part2)).toBe(true);
    expect(planSuggestions(p.id).every((s) => !s.id.startsWith("gad7-box"))).toBe(true);
  });

  it("every recovery lesson is Part 2", () => {
    expect(taggedCatalog().filter((t) => t.typeId === "recovery_lesson").every((t) => t.part2)).toBe(true);
  });

  it("coverage view counts gaps", () => {
    const c = contentCoverage();
    expect(c.gapCount).toBe(
      c.needsWithoutLesson.length + c.needsWithoutResource.length + c.bandsWithoutLesson.length + c.stagesWithoutLesson.length + c.plansPointingAtMissing.length,
    );
    expect(c.needsWithoutLesson).not.toContain("housing");
  });
});
