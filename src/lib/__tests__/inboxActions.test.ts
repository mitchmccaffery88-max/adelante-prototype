import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import "@/lib/demoInboxSeed";
import {
  PROTECTED_TASK_TITLE,
  assignInboxItem,
  assignableStaff,
  canHandleItem,
  claimInboxItem,
  getItemState,
  inboxItemLabel,
  listInboxRows,
  makeTaskFromInboxItem,
  markInboxItemDone,
  reopenInboxItem,
} from "@/lib/inboxActions";
import { roleSeesAsamSection } from "@/lib/asamReporting";

const reyes = { id: "s-th1", name: "Dr. Marisol Reyes", role: "therapist" as const };
const luz = { id: "s-cm1", name: "Luz Herrera", role: "ecm_provider" as const };
const deneen = { id: "s-bc1", name: "Deneen Ford", role: "billing_coordinator" as const };

function audit(action: string) {
  return AdelanteEHR.listAuditEvents({}).filter((e) => e.action === action);
}

describe("inbox actions", () => {
  it("seeds claimed, assigned, done, task and billing items", () => {
    const rows = listInboxRows(reyes);
    expect(rows.some((r) => r.state.ownerName === reyes.name && !r.state.assignedBy)).toBe(true);
    expect(rows.some((r) => r.state.status === "done")).toBe(true);
    expect(rows.some((r) => r.state.taskId)).toBe(true);
    expect(listInboxRows(deneen, { billingOnly: true }).length).toBeGreaterThanOrEqual(2);
  });

  it("claim, done, reopen are audited", () => {
    const row = listInboxRows(reyes).find((r) => r.state.status === "open" && !r.state.ownerId)!;
    claimInboxItem(row.key, reyes);
    markInboxItemDone(row.key, "ok", reyes);
    expect(getItemState(row.key).status).toBe("done");
    reopenInboxItem(row.key, reyes);
    expect(getItemState(row.key).status).toBe("open");
    for (const a of ["inbox_item_claimed", "inbox_item_done", "inbox_item_reopened", "inbox_item_assigned", "inbox_item_task_created"])
      expect(audit(a).length).toBeGreaterThan(0);
  });

  it("protected item: Part 2-restricted role can't see, claim or be assigned; task text generic", () => {
    const prot = listInboxRows(reyes).find((r) => r.category === "protected_task")!;
    expect(canHandleItem(prot.key, "ecm_provider")).toBe(false);
    expect(assignableStaff(prot.key).some((s) => s.role === "ecm_provider")).toBe(false);
    expect(() => assignInboxItem(prot.key, luz.id, "", reyes)).toThrow();
    expect(() => claimInboxItem(prot.key, luz)).toThrow();
    expect(listInboxRows(luz).some((r) => r.key === prot.key)).toBe(false);
    expect(inboxItemLabel(prot.key).title).toBe("Protected item");
    const t = AdelanteEHR.caseTasksForCM(reyes.id).find((x) => x.dedupeKey === `inbox:${prot.key}`)!;
    expect(t.title).toBe(PROTECTED_TASK_TITLE);
    expect(t.detail ?? "").not.toMatch(/ASAM|substance|SUD/i);
  });

  it("new task from a plain item links back via dedupe key", () => {
    const row = listInboxRows(reyes).find((r) => r.category !== "protected_task" && !r.state.taskId && r.kind === "notification")!;
    const t = makeTaskFromInboxItem(row.key, { ownerId: reyes.id, dueDate: "2026-10-01" }, reyes);
    expect(t.dedupeKey).toBe(`inbox:${row.key}`);
  });

  it("billing feed wording is billing-safe", () => {
    const rows = listInboxRows(deneen, { billingOnly: true });
    for (const r of rows) expect(inboxItemLabel(r.key).body ?? "").not.toMatch(/ASAM|substance|SUD|alcohol|opioid/i);
  });

  it("CalOMS section uses the same gate as ASAM", () => {
    const marcus = AdelanteEHR.getPatient("p3")!;
    expect(roleSeesAsamSection("ecm_provider", marcus)).toBe(false);
    expect(roleSeesAsamSection("cf_care_manager", marcus)).toBe(false);
  });
});
