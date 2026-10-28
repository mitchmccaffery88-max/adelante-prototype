import { AdelanteEHR } from "./ehr";
import { intakeState, canIntakeAct, type IntakeActor } from "./intakePhaseA";
import { intakeWindowActive } from "./chartAccessRules";
import { isRestricted } from "./chartAccess";

export function canReadIntakePacket(actor: IntakeActor, referralId: string, at = new Date()) {
  if (!canIntakeAct(actor, "completion")) return false;
  const r = AdelanteEHR.listReferrals().find(r => r.id === referralId);
  if (!r || r.status === "declined" || (r.enrolledPatientId && isRestricted(r.enrolledPatientId))) return false;
  const s = intakeState(referralId, actor);
  if (!s.completedAt) return true;
  const p = r.enrolledPatientId ? AdelanteEHR.getPatient(r.enrolledPatientId) : undefined;
  return !!p && intakeWindowActive(s.completedAt, at, p.facilityTimezone ?? "America/Los_Angeles");
}
export function readIntakeFollowupChecklist(actor: IntakeActor, referralId: string, at = new Date()) {
  if (!canReadIntakePacket(actor, referralId, at)) throw new Error("Intake follow-up read window has ended.");
  const s = intakeState(referralId, actor);
  return { referralId, checklist: s.checklist, completedAt: s.completedAt };
}
export function openIntakeFollowupChecklist(actor: IntakeActor, referralId: string) {
  const row = readIntakeFollowupChecklist(actor, referralId);
  const r = AdelanteEHR.listReferrals().find(r => r.id === referralId);
  AdelanteEHR._recordAudit({ category: "access", action: "record.viewed", patientId: r?.enrolledPatientId, actorId: actor.staffId, actorRole: actor.role, detail: { sectionId: "intake_checklist", kind: "open", referralId, simulated: true } });
  return row;
}