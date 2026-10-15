// @vitest-environment jsdom
import "@/lib/contentCatalog";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/staff/confirm-dialog";
import { runAction } from "@/lib/actions/runAction";
import { AdelanteEHR } from "@/lib/ehr";
import { contentType } from "@/lib/contentTypes";
import {
  getContentEntry, publishedContent, saveContentDraft, seedPublishedContent, submitContentForReview,
} from "@/lib/contentPublishing";

const actor = { role: "clinical_coordinator" as const, staffId: "s-cc2", name: "Cathy" };
const who = { role: actor.role, staffId: actor.staffId };
afterEach(cleanup);

function Host({ onConfirm }: { onConfirm: (reason: string) => boolean }) {
  const [open, setOpen] = useState(false);
  return <ConfirmDialog open={open} onOpenChange={setOpen} title="Withdraw this content?" description="Patients stop seeing it." confirmLabel="Withdraw content" keepLabel="Keep content" requireReason onConfirm={onConfirm}
    trigger={<button type="button">Open withdraw</button>} />;
}

describe("8c-1 pending coverage", () => {
  it("Escape closes without running the action and returns focus to the trigger", async () => {
    const action = vi.fn(() => true);
    render(<Host onConfirm={action} />);
    const trigger = screen.getByRole("button", { name: "Open withdraw" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Keep content" }));
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(action).not.toHaveBeenCalled();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("integrity refusal keeps the dialog open, content live and writes no success event", async () => {
    const id = "8c1-guarded-lesson";
    seedPublishedContent({ typeId: "library_lesson", id, body: { id, title: "Guarded" }, actor, atISO: "2026-10-01T00:00:00Z" });
    seedPublishedContent({ typeId: "journey", id: "8c1-guard-journey", body: { id: "8c1-guard-journey", title: "J", steps: [{ type: "library_lesson", id }] }, actor, atISO: "2026-10-01T00:00:00Z" });
    const before = AdelanteEHR.listAuditEvents({}).map((x) => x.id);
    render(<Host onConfirm={(note) => runAction("content_withdraw", who, undefined, { args: [{ typeId: "library_lesson", id, actor, note }] }).ok} />);
    fireEvent.click(screen.getByRole("button", { name: "Open withdraw" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Editorial revision needed" } });
    fireEvent.click(screen.getByRole("button", { name: "Withdraw content" }));
    await waitFor(() => expect((screen.getByRole("button", { name: "Withdraw content" }) as HTMLButtonElement).disabled).toBe(false));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(publishedContent("library_lesson", id)).toBeDefined();
    expect(AdelanteEHR.listAuditEvents({}).filter((x) => !before.includes(x.id) && x.action === "action.succeeded")).toHaveLength(0);
  });

  it("withdrawing an edited shipped item lets the shipped baseline reappear", () => {
    const desc = contentType("library_lesson");
    const id = desc.baselineIds()[0]!;
    const baseline = desc.baselineBody(id)!;
    seedPublishedContent({ typeId: "library_lesson", id, body: { ...baseline, title: "Edited live title" }, actor, atISO: "2026-10-01T00:00:00Z" });
    expect(publishedContent("library_lesson", id)?.title).toBe("Edited live title");
    const r = runAction("content_withdraw", who, undefined, { args: [{ typeId: "library_lesson", id, actor, note: "Editorial revision needed" }] });
    expect(r.ok, JSON.stringify(r)).toBe(true);
    expect(publishedContent("library_lesson", id)).toBeUndefined();
    expect(desc.baselineBody(id)?.title).toBe(baseline.title);
    expect(getContentEntry("library_lesson", id)?.revisions.at(-1)?.note).toBe("Editorial revision needed");
  });

  it("valid publish-review path publishes once with the reviewer's reason", () => {
    const id = "8c1-publish-review";
    saveContentDraft({ typeId: "library_lesson", id, body: { ...contentType("library_lesson").emptyBody(), id, title: id }, actor, note: "Draft fixture" });
    submitContentForReview({ typeId: "library_lesson", id, actor, note: "Ready" });
    const before = AdelanteEHR.listAuditEvents({}).map((x) => x.id);
    const r = runAction("content_publish", who, undefined, { args: [{ typeId: "library_lesson", id, actor, note: "Reviewed wording" }] });
    expect(r.ok, JSON.stringify(r)).toBe(true);
    expect(publishedContent("library_lesson", id)).toBeDefined();
    expect(getContentEntry("library_lesson", id)?.revisions.at(-1)?.note).toBe("Reviewed wording");
    expect(AdelanteEHR.listAuditEvents({}).filter((x) => !before.includes(x.id) && x.action === "action.succeeded" && x.detail?.actionId === "content_publish")).toHaveLength(1);
  });
});
