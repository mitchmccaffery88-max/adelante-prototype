// R5 follow-ups (30 Oct). Draft — pending clinical sign-off.
// Only the existing registry system actor creates this neutral follow-up.
import { AdelanteEHR, type CaseTask } from "./ehr";
import type { StaffRole, StaffMember } from "./roles";
import { STAFF_ROSTER } from "./roles";
import { onCallOwnerFor } from "./onCallBoundary";
import { ITEM9_UNANSWERED_TASK_DETAIL, ITEM9_UNANSWERED_TASK_TITLE } from "./screenerCompleteness";
export const SCREENER_FOLLOWUP_ACTOR_ROLE = "system_screener_followup" as StaffRole;
export const SCREENER_FOLLOWUP_ACTOR_LABEL = "System (screener follow-up)";
export const screenerFollowupActor = { role: SCREENER_FOLLOWUP_ACTOR_ROLE, staffId: "system-screener-followup", staffName: SCREENER_FOLLOWUP_ACTOR_LABEL };
const licensed = (m: StaffMember | undefined) => m?.active !== false && !!m && ["therapist", "pmhnp", "physician"].includes(m.role);
/** Draft — pending clinical sign-off: primary clinician → on-call → coordinator pool. */
export function followupOwner(primary: StaffMember | undefined, onCall: StaffMember | undefined): { assignedTo: string; allowedRoles: StaffRole[] } {
  const clinician = licensed(primary) ? primary : licensed(onCall) ? onCall : undefined;
  return clinician ? { assignedTo: clinician.id, allowedRoles: [clinician.role] } : { assignedTo: "", allowedRoles: ["clinical_coordinator"] };
}
/** Draft — pending clinical sign-off: booked contact in 7 days, otherwise 2 business days outreach. */
export function followupDue(now: Date, contacts: readonly { start: string; status: string }[]) {
  const next = contacts.filter((a) => ["scheduled", "checked_in"].includes(a.status) && +new Date(a.start) >= +now && +new Date(a.start) <= +now + 7 * 86400000)
    .sort((a, b) => a.start.localeCompare(b.start))[0];
  if (next) return { dueDate: next.start, taskType: "screening_followup" };
  const due = new Date(now); let days = 0;
  while (days < 2) { due.setUTCDate(due.getUTCDate() + 1); if (due.getUTCDay() !== 0 && due.getUTCDay() !== 6) days++; }
  return { dueDate: due.toISOString(), taskType: "screening_outreach" };
}
export function createItem9FollowupTask(input: { patientId: string; completedAt: string }): CaseTask | undefined {
  const p = AdelanteEHR.getPatient(input.patientId);
  if (!p) throw new Error("Patient not found.");
  const now = new Date(input.completedAt);
  const primary = STAFF_ROSTER.find((m) => !!p.primaryClinicianId && (m.id === p.primaryClinicianId || m.clinicianId === p.primaryClinicianId));
  return AdelanteEHR.createCaseTask({ patientId: p.id, ...followupOwner(primary, onCallOwnerFor(now)),
    ...followupDue(now, AdelanteEHR.listAppointments().filter((a) => a.patientId === p.id)),
    title: ITEM9_UNANSWERED_TASK_TITLE, detail: ITEM9_UNANSWERED_TASK_DETAIL,
    origin: "screener_flag", dedupeKey: `screener-item9-unanswered:${p.id}:${input.completedAt}` });
}
