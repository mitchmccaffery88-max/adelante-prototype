// §Access A3 — the bell and My work, linked. Draft — pending exec RBAC review.
//
// My work (Needs my action) holds the tasks. The bell holds updates, plus at
// most ONE pointer per task ("New task: …") addressed to the person whose
// task it is. When the task leaves My work (done, resolved, reassigned) the
// pointer is closed — read for everyone. Pointer text is neutral by kind:
// no patient name, drug, instrument, score or "Part 2".
import { AdelanteEHR } from "./ehr";
import { workspaceActionRows, type WorkspaceActionKind, type WorkspaceActionRow } from "./clinicianWorkspace";
import type { StaffRole } from "./roles";

export const POINTER_TEXT: Partial<Record<WorkspaceActionKind, { subject: string; link: string }>> = {
  continuity: { subject: "New task: Medication follow-up", link: "/clinician" },
  coverage: { subject: "New task: Coverage follow-up", link: "/coverage-release" },
  reassign_needed: { subject: "New task: Reassign needed", link: "/admin-staff" },
  content_review: { subject: "New task: Content past review date", link: "/admin-content" },
  content_waiting: { subject: "New task: Content review waiting", link: "/admin-content" },
  restricted_open: { subject: "New task: Restricted record opened", link: "/quality-compliance" },
  county_reminder: { subject: "New task: County report reminder", link: "/county-reporting" },
  escalation: { subject: "New task: Escalation follow-up", link: "/escalations" },
};
export const POINTER_BODY = "Open My work for details.";
/** Only MAT continuity and coverage escalations get pointers here; crisis has its own alerts. */
const isPointedEscalation = (r: WorkspaceActionRow) => r.kind !== "escalation" || /medication continuity|coverage/i.test(r.label);

export interface PointerActor { staffId: string; staffName: string; role: StaffRole; clinicianId?: string }

/** Make sure each open pointed task has one bell pointer for this person; close pointers whose task is gone. */
export function syncBellPointers(actor: PointerActor, now = new Date()): { created: number; closed: number } {
  const rows = workspaceActionRows({ actor, needsClosing: [], now }).filter((r) => POINTER_TEXT[r.kind] && isPointedEscalation(r));
  const live = new Set(rows.map((r) => r.id));
  let created = 0;
  for (const r of rows) {
    const t = POINTER_TEXT[r.kind]!;
    const before = AdelanteEHR.listNotifications().length;
    AdelanteEHR.notify({ recipientStaffId: actor.staffId, category: "task_assigned", kind: "task", taskKey: r.id, subject: t.subject, body: POINTER_BODY, linkRoute: t.link });
    if (AdelanteEHR.listNotifications().length > before) created++;
  }
  let closed = 0;
  for (const n of AdelanteEHR.listNotifications()) {
    if (n.closedAt || !n.taskKey || n.recipientStaffId !== actor.staffId) continue;
    const managed = !n.taskKey.startsWith("task:") && !n.taskKey.startsWith("reply:");
    const caseTaskDone = n.taskKey.startsWith("task:") && AdelanteEHR.listCaseTasks().find((t) => `task:${t.id}` === n.taskKey)?.status === "done";
    if ((managed && !live.has(n.taskKey)) || caseTaskDone) closed += AdelanteEHR.closeTaskPointer(n.taskKey);
  }
  return { created, closed };
}

export type BellFilter = "all" | "tasks" | "updates" | "mentions";
export function bellFilterMatch(kind: "task" | "update" | "mention" | undefined, f: BellFilter): boolean {
  const k = kind ?? "update";
  return f === "all" || (f === "tasks" && k === "task") || (f === "updates" && k === "update") || (f === "mentions" && k === "mention");
}
