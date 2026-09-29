import { AdelanteEHR, type Appointment } from "@/lib/ehr";
import { filterSudMedsForRole, roleSeesAsamSection } from "@/lib/asamReporting";
import { asamTaskRows } from "@/lib/asamReporting";
import { hieFollowUps } from "@/lib/hie";
import { isInFacilityTask, inFacilityEnabled } from "@/lib/inFacility";
import { myCaseload, myContactsDue, myPendingLabs, myPendingRefills, myPlanReviewsDue, screenerDueRows, staffAliases, type ActingIdentity } from "@/lib/myWork";
import { listUnsignedWork } from "@/lib/unsignedWork";
import { isPrescriberRole, STAFF_ROSTER, type StaffRole } from "@/lib/roles";

export type WorkspaceTileId = "schedule" | "actions" | "caseload" | "requests" | "coordinator";
export type ScheduleSegment = "up_next" | "in_progress" | "done" | "closed";
export type ActionGroup = "now" | "today" | "week";
export type WorkspaceActionKind = "closing" | "unsigned" | "cosign" | "refill" | "crisis" | "screener" | "asam" | "lab" | "plan" | "outside" | "switch" | "contact" | "task";
export interface WorkspaceActionRow {
  id: string;
  kind: WorkspaceActionKind;
  patientId: string;
  patientName: string;
  label: string;
  due: string;
  dueAt: string;
  group: ActionGroup;
  action: string;
  sourceId?: string;
}

const CARE_ROLES: readonly StaffRole[] = ["ecm_provider", "cf_care_manager", "peer_specialist", "community_health_worker"];
export const isCareRole = (role: StaffRole) => CARE_ROLES.includes(role);
export const isCoordinatorRole = (role: StaffRole) => role === "clinical_coordinator" || role === "sys_admin";

export function workspaceTileOrder(role: StaffRole): WorkspaceTileId[] {
  if (isCoordinatorRole(role)) return ["coordinator", "actions", "schedule"];
  if (isCareRole(role)) return ["actions", "caseload", "schedule", "requests"];
  return ["schedule", "actions", "caseload", "requests"];
}

export function scheduleSegments(appts: Appointment[], now = new Date()) {
  const sameDay = (iso: string) => new Date(iso).toDateString() === now.toDateString();
  const today = appts.filter((a) => sameDay(a.start)).sort((a, b) => a.start.localeCompare(b.start));
  return {
    up_next: today.filter((a) => a.status === "scheduled" && +new Date(a.start) + a.durationMin * 60000 > +now),
    in_progress: today.filter((a) => a.status === "checked_in"),
    done: today.filter((a) => a.status === "attended"),
    closed: today.filter((a) => ["cancelled", "no_show", "late_cancel", "rescheduled"].includes(a.status)),
  } satisfies Record<ScheduleSegment, Appointment[]>;
}

const groupFor = (iso: string, now: Date): ActionGroup => {
  const due = +new Date(iso);
  if (due <= +now) return "now";
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
  return due <= end ? "today" : "week";
};
const dueText = (iso: string, now: Date) => {
  const d = +new Date(iso) - +now;
  if (d <= 0) return "Due now";
  if (d < 86400000) return "Due today";
  return `Due ${new Date(iso).toLocaleDateString("en-US", { weekday: "short" })}`;
};

export function workspaceActionRows(input: {
  actor: ActingIdentity & { role: StaffRole };
  needsClosing: Appointment[];
  now?: Date;
}): WorkspaceActionRow[] {
  const { actor, needsClosing } = input;
  const now = input.now ?? new Date();
  const patients = AdelanteEHR.listPatients();
  const mine = myCaseload(actor);
  const mineIds = new Set(mine.map((p) => p.id));
  const aliases = staffAliases(actor);
  const rows: WorkspaceActionRow[] = [];
  const push = (row: Omit<WorkspaceActionRow, "group" | "due">) => rows.push({ ...row, group: groupFor(row.dueAt, now), due: dueText(row.dueAt, now) });
  for (const a of needsClosing) {
    const p = patients.find((x) => x.id === a.patientId);
    push({ id: `closing:${a.id}`, kind: "closing", patientId: a.patientId, patientName: p ? `${p.firstName} ${p.lastName}` : "Patient", label: a.status === "attended" ? "Visit needs a note" : "Past visit needs closing", dueAt: new Date(+new Date(a.start) + a.durationMin * 60000).toISOString(), action: a.status === "attended" ? "Write note" : "Mark attended" });
  }
  for (const u of listUnsignedWork({ authorId: actor.clinicianId ?? actor.staffId })) {
    if (u.kind === "undocumented_encounter" && needsClosing.some((a) => a.id === u.id)) continue;
    push({ id: `unsigned:${u.id}`, kind: "unsigned", patientId: u.patient.id, patientName: `${u.patient.firstName} ${u.patient.lastName}`, label: u.kind === "draft_note" ? "Unsigned note" : "Visit needs a note", dueAt: u.date, action: u.kind === "draft_note" ? "Review note" : "Write note", sourceId: u.kind === "draft_note" ? u.id : undefined });
  }
  for (const { patient, note } of AdelanteEHR.listNotesAwaitingCosign().filter(({ note }) => !note.cosignOwnerOverrideId || aliases.has(note.cosignOwnerOverrideId)))
    if (mineIds.has(patient.id) || (!!note.cosignOwnerOverrideId && aliases.has(note.cosignOwnerOverrideId))) push({ id: `cosign:${note.id}`, kind: "cosign", patientId: patient.id, patientName: `${patient.firstName} ${patient.lastName}`, label: "Cosign note", dueAt: note.signedAt ?? note.date, action: "Review" });
  for (const r of myPendingRefills(actor)) {
    const patient = AdelanteEHR.getPatient(r.patientId);
    if (!patient || filterSudMedsForRole([{ medicationName: r.refill.medicationName }], actor.role, patient).visible.length === 0) continue;
    push({ id: `refill:${r.refill.id}`, kind: "refill", patientId: r.patientId, patientName: r.patientName, label: `Refill — ${r.refill.medicationName}`, dueAt: r.refill.requestedAt, action: "Review refill" });
  }
  for (const c of AdelanteEHR.listOpenCrisisEscalations().filter(({ patient }) => mineIds.has(patient.id)))
    push({ id: `crisis:${c.escalation.id}`, kind: "crisis", patientId: c.patient.id, patientName: `${c.patient.firstName} ${c.patient.lastName}`, label: "Crisis follow-up", dueAt: c.escalation.lastTriggeredAt ?? c.escalation.triggeredAt, action: "Open crisis" });
  for (const r of screenerDueRows(mine, { role: actor.role }))
    push({ id: `screener:${r.patientId}:${r.screenerKey}`, kind: "screener", patientId: r.patientId, patientName: r.patientName, label: `${r.screenerKey.toUpperCase()} re-screen`, dueAt: now.toISOString(), action: r.taskAlreadySent ? "Open chart" : "Send re-screen", sourceId: r.screenerKey });
  for (const r of asamTaskRows(actor.role, now) ?? []) {
    if (!mineIds.has(r.patientId)) continue;
    push({ id: `asam:${r.taskId}`, kind: "asam", patientId: r.patientId, patientName: r.patientName, label: "ASAM assessment", dueAt: r.dueDate, action: "Open ASAM", sourceId: r.taskId });
  }
  for (const r of myPendingLabs(actor, actor.role))
    push({ id: `lab:${r.id}`, kind: "lab", patientId: r.patientId, patientName: r.patientName, label: `${r.label} result`, dueAt: r.dueAt, action: "Review lab" });
  for (const r of myPlanReviewsDue(actor, now))
    push({ id: `plan:${r.patientId}`, kind: "plan", patientId: r.patientId, patientName: r.patientName, label: "Care plan review", dueAt: r.dueAt, action: "Review plan" });
  for (const r of hieFollowUps([...mineIds], actor.role)) {
    const p = AdelanteEHR.getPatient(r.encounter.patientId);
    push({ id: `outside:${r.draft.id}`, kind: "outside", patientId: r.encounter.patientId, patientName: p ? `${p.firstName} ${p.lastName}` : "Patient", label: "Outside event follow-up", dueAt: r.encounter.at, action: "Review event" });
  }
  for (const s of actor.clinicianId ? AdelanteEHR.listProviderSwitches({ clinicianId: actor.clinicianId, role: "outgoing", status: "pending_review" }) : []) {
    const p = AdelanteEHR.getPatient(s.patientId);
    push({ id: `switch:${s.id}`, kind: "switch", patientId: s.patientId, patientName: p ? `${p.firstName} ${p.lastName}` : "Patient", label: "Provider switch review", dueAt: s.createdAt, action: "Review" });
  }
  if (isCareRole(actor.role)) for (const r of myContactsDue(actor.staffId, now))
    push({ id: `contact:${r.patient.id}`, kind: "contact", patientId: r.patient.id, patientName: `${r.patient.firstName} ${r.patient.lastName}`, label: "Contact due", dueAt: now.toISOString(), action: "Log contact" });
  for (const t of AdelanteEHR.listCaseTasks().filter((t) => t.status !== "done" && (!t.snoozedUntil || +new Date(t.snoozedUntil) <= +now) && (aliases.has(t.assignedTo) || mineIds.has(t.patientId)) && (inFacilityEnabled() || !isInFacilityTask(t)))) {
    const p = AdelanteEHR.getPatient(t.patientId);
    if ((t.taskType === "asam_assessment" || t.taskType === "asam_needed") && (!p || !roleSeesAsamSection(actor.role, p))) continue;
    if (t.allowedRoles?.length && !t.allowedRoles.includes(actor.role)) continue;
    push({ id: `task:${t.id}`, kind: "task", patientId: t.patientId, patientName: p ? `${p.firstName} ${p.lastName}` : "Patient", label: t.title, dueAt: t.dueDate, action: "Open task", sourceId: t.id });
  }
  const priority = isPrescriberRole(actor.role) ? ["refill", "crisis"] : isCareRole(actor.role) ? ["contact", "crisis"] : ["crisis"];
  return rows.filter((r, i, all) => all.findIndex((x) => x.id === r.id) === i).sort((a, b) => {
    const ai = priority.indexOf(a.kind), bi = priority.indexOf(b.kind);
    if (ai !== bi) return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    return a.dueAt.localeCompare(b.dueAt);
  });
}

export function attentionCaseload(actor: ActingIdentity & { role: StaffRole }, rows: WorkspaceActionRow[]) {
  const byPatient = new Map<string, WorkspaceActionRow[]>();
  for (const r of rows) byPatient.set(r.patientId, [...(byPatient.get(r.patientId) ?? []), r]);
  return myCaseload(actor).map((patient) => ({ patient, reasons: byPatient.get(patient.id) ?? [] })).sort((a, b) => b.reasons.length - a.reasons.length || a.patient.lastName.localeCompare(b.patient.lastName));
}

/** Part 2-safe closed loop: operational copy only, with a stable dedupe key. */
export function notifyNeedsClosing(actor: ActingIdentity & { role: StaffRole }, visits: Appointment[], now = new Date()) {
  for (const a of visits) {
    const end = +new Date(a.start) + a.durationMin * 60000;
    AdelanteEHR.notify({ recipientStaffId: actor.staffId, category: "task_assigned", subject: "Visit needs closing", body: "A past visit needs a status or note. Open your workspace.", patientId: a.patientId, linkRoute: "/clinician", dedupeKey: `needs-closing:${a.id}` });
    if (+now - end < 86400000) continue;
    const supervisor = STAFF_ROSTER.find((s) => s.id === STAFF_ROSTER.find((s) => s.id === actor.staffId)?.supervisedBy);
    if (supervisor) AdelanteEHR.notify({ recipientStaffId: supervisor.id, category: "task_assigned", subject: "Visit remains open", body: "A supervised clinician has a visit still open after 24 hours.", patientId: a.patientId, linkRoute: "/clinician", dedupeKey: `needs-closing-escalated:${a.id}` });
    else AdelanteEHR.notify({ recipientRole: "clinical_coordinator", category: "task_assigned", subject: "Visit remains open", body: "A clinician visit is still open after 24 hours.", patientId: a.patientId, linkRoute: "/clinician", dedupeKey: `needs-closing-escalated:${a.id}` });
  }
}
