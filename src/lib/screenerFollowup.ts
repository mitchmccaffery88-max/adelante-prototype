// §R5 (30 Oct, Draft — pending clinical sign-off) — neutral clinician task
// when a member was shown PHQ-9 item 9 and left it blank. Runs only through
// the registry entry `screener_item9_followup` as the non-staff system actor.
// Task text is neutral; it never repeats answers or scores.
import { AdelanteEHR, type CaseTask } from "./ehr";
import type { StaffRole } from "./roles";
import { STAFF_ROSTER } from "./roles";
import { ITEM9_UNANSWERED_TASK_DETAIL, ITEM9_UNANSWERED_TASK_TITLE } from "./screenerCompleteness";

export const SCREENER_FOLLOWUP_ACTOR_ROLE = "system_screener_followup" as StaffRole;
export const SCREENER_FOLLOWUP_ACTOR_LABEL = "System (screener follow-up)";
export const screenerFollowupActor = {
  role: SCREENER_FOLLOWUP_ACTOR_ROLE,
  staffId: "system-screener-followup",
  staffName: SCREENER_FOLLOWUP_ACTOR_LABEL,
};

/** Owner: the primary clinician's staff account, else the case manager. */
function owner(patientId: string): string | undefined {
  const p = AdelanteEHR.getPatient(patientId);
  if (!p) return undefined;
  const clin = p.primaryClinicianId
    ? STAFF_ROSTER.find((m) => (m.id === p.primaryClinicianId || m.clinicianId === p.primaryClinicianId) && m.active !== false)
    : undefined;
  return clin?.id ?? p.caseManagerId;
}

export function createItem9FollowupTask(input: { patientId: string; completedAt: string }): CaseTask {
  const assignedTo = owner(input.patientId);
  if (!assignedTo) throw new Error("No care team member to assign this to.");
  return AdelanteEHR.createCaseTask({
    patientId: input.patientId,
    assignedTo,
    title: ITEM9_UNANSWERED_TASK_TITLE,
    detail: ITEM9_UNANSWERED_TASK_DETAIL,
    dueDate: new Date().toISOString().slice(0, 10),
    origin: "screener_flag",
    dedupeKey: `screener-item9-unanswered:${input.patientId}:${input.completedAt}`,
  }) as CaseTask;
}
