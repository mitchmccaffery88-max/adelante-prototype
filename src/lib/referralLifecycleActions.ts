// 27 Oct (Mitch) — lifecycle actions. Draft — pending EHR/Admin audit.
//
// Every function here is the store target of one CHART_ACTIONS entry and is
// only ever reached through runAction (role check + one action audit). Each
// re-checks the same gate the button reads, so button and store cannot
// disagree. Existing store writers (`logReferralOutreachAttempt`,
// `markReferralContacted`, `enrollReferral`, `declineReferral`) are reused —
// no parallel store, no new record-class grants.
import { AdelanteEHR, type Referral } from "./ehr";
import { getStaffMember, staffForRole, STAFF_ROSTER, type StaffRole } from "./roles";
import { REFERRAL_DISPOSITION_ROLES, canPerformReferralAction } from "./referralActions";
import type { ReferralOutreachOutcome } from "./referralOutreach";
import { identityEvidence } from "./careLifecycle";
import { firstAttendedAppointment, nextScheduledAppointment } from "./postEnrollment";
import { _setDidntStart, didntStartCareFor, DIDNT_START_REASONS, type DidntStartReason } from "./lifecycleState";

export type LifecycleActor = { role: StaffRole; staffId?: string; staffName?: string };

// ---------------------------------------------------------------- gates

/** Mitch 27 Oct: peers may log outreach (contact) but never enroll or close. */
export function canLogReferralContact(role: StaffRole): boolean {
  return canPerformReferralAction(role, "contact") || role === "peer_specialist";
}
/** Intake may enroll (with identity evidence); existing disposition roles unchanged. */
export function canEnrollReferral(role: StaffRole): boolean {
  return REFERRAL_DISPOSITION_ROLES.includes(role) || role === "intake_coordinator";
}
export const INTAKE_CLOSE_REASONS = ["duplicate", "unable_to_reach"] as const;
/** Close is separate from enroll: Intake only duplicate / unable_to_reach. */
export function canCloseReferral(role: StaffRole, reason?: string): boolean {
  if (REFERRAL_DISPOSITION_ROLES.includes(role)) return true;
  if (role !== "intake_coordinator") return false;
  return reason === undefined || (INTAKE_CLOSE_REASONS as readonly string[]).includes(reason);
}
export function canConfirmReferralIdentity(role: StaffRole): boolean {
  return canEnrollReferral(role);
}
export function canMarkDidntStart(actor: LifecycleActor, patientId: string, reason?: string): boolean {
  const p = AdelanteEHR.getPatient(patientId);
  if (!p) return false;
  if (actor.role === "clinical_coordinator") return true;
  if ((actor.role === "ecm_provider" || actor.role === "cf_care_manager") && !!actor.staffId && p.caseManagerId === actor.staffId) return true;
  return actor.role === "intake_coordinator" && (reason === undefined || reason === "unable_to_reach");
}

export const CONTACT_DENIED = "Logging outreach is for Intake, peer specialists and care-coordination staff.";
export const ENROLL_DENIED = "Enrolling is for Intake, ECM providers, reentry care managers and clinical coordinators.";
export const CLOSE_DENIED = "Closing this referral is for ECM providers, reentry care managers and clinical coordinators. Intake can close only duplicates or people we couldn't reach.";
export const IDENTITY_NEEDED = "Confirm identity first: a matched code, a verified sign-in, an identity-review decision or a staff-confirmed record.";
export const DIDNT_START_DENIED = "Recorded by the assigned care manager or the clinical coordinator. Intake can record only 'Couldn't reach'.";

function referralOf(id: string): Referral {
  const r = AdelanteEHR.listReferrals().find((x) => x.id === id);
  if (!r) throw new Error("Referral unavailable.");
  return r;
}
function needReason(reason: string) {
  if (!reason || reason.trim().length < 3) throw new Error("Give a reason.");
}

// ---------------------------------------------------------------- referral actions

export function lifecycleLogOutreach(actor: LifecycleActor, referralId: string, outcome: ReferralOutreachOutcome, reason: string, note?: string) {
  if (!canLogReferralContact(actor.role)) throw new Error(CONTACT_DENIED);
  needReason(reason);
  const r = referralOf(referralId);
  if (!["submitted", "contacted"].includes(r.status)) throw new Error("This referral is closed.");
  AdelanteEHR.logReferralOutreachAttempt(referralId, { outcome, note });
  return { referralId };
}

export function lifecycleMarkContacted(actor: LifecycleActor, referralId: string, reason: string) {
  if (!canLogReferralContact(actor.role)) throw new Error(CONTACT_DENIED);
  needReason(reason);
  AdelanteEHR.markReferralContacted(referralId);
  return { referralId };
}

export function lifecycleConfirmIdentity(actor: LifecycleActor, referralId: string, how: string, reason: string) {
  if (!canConfirmReferralIdentity(actor.role)) throw new Error(ENROLL_DENIED);
  needReason(reason);
  if (!how || how.trim().length < 3) throw new Error("Say how identity was confirmed.");
  const r = referralOf(referralId);
  if (r.status === "declined") throw new Error("This referral is closed.");
  r.identityConfirmedBy = { name: getStaffMember(actor.staffId)?.name ?? actor.staffName ?? "", role: actor.role, staffId: actor.staffId, at: new Date().toISOString(), how: how.trim().slice(0, 120) };
  AdelanteEHR._emit();
  return { referralId };
}

export function lifecycleEnrollReferral(actor: LifecycleActor, referralId: string, reason: string, opts?: { createAnyway?: { reason: string } }) {
  if (!canEnrollReferral(actor.role)) throw new Error(ENROLL_DENIED);
  needReason(reason);
  const r = referralOf(referralId);
  if (actor.role === "intake_coordinator" && !identityEvidence(r)) throw new Error(IDENTITY_NEEDED);
  const pid = AdelanteEHR.enrollReferral(referralId, opts?.createAnyway ? { createAnyway: { reason: opts.createAnyway.reason, actorId: actor.staffId, actorRole: actor.role } } : undefined);
  if (pid) ensureFirstCarePlanTask(pid);
  return { referralId, patientId: pid };
}

export function lifecycleCloseReferral(actor: LifecycleActor, referralId: string, input: { reason: string; note?: string }, reason: string) {
  if (!canCloseReferral(actor.role, input.reason)) throw new Error(CLOSE_DENIED);
  needReason(reason);
  AdelanteEHR.declineReferral(referralId, input);
  return { referralId };
}

// ---------------------------------------------------------------- first care plan task

/** Today task for an already-authorized clinician (or the coordinator queue) to draft the first plan after enrollment. */
export function ensureFirstCarePlanTask(patientId: string) {
  const p = AdelanteEHR.getPatient(patientId);
  if (!p) return undefined;
  const clinicianStaff = p.primaryClinicianId ? STAFF_ROSTER.find((s) => s.clinicianId === p.primaryClinicianId || s.id === p.primaryClinicianId) : undefined;
  const assignee = clinicianStaff?.id ?? staffForRole("clinical_coordinator")[0]?.id;
  if (!assignee) return undefined;
  const next = nextScheduledAppointment(patientId);
  const due = next ? next.start.slice(0, 10) : new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);
  return AdelanteEHR.createCaseTask({
    patientId,
    assignedTo: assignee,
    title: "Draft first care plan",
    detail: "Review the intake facts and suggestions in the care plan, then accept, edit or dismiss each. Draft — pending clinical sign-off.",
    dueDate: due,
    origin: "manual",
    taskType: "first_care_plan",
    dedupeKey: `first-care-plan:${patientId}`,
  });
}

// ---------------------------------------------------------------- didn't start care

export function markDidntStartCare(actor: LifecycleActor, patientId: string, input: { reason: DidntStartReason }, reason: string) {
  if (!DIDNT_START_REASONS.some((r) => r.key === input.reason)) throw new Error("Pick a reason.");
  if (!canMarkDidntStart(actor, patientId, input.reason)) throw new Error(DIDNT_START_DENIED);
  needReason(reason);
  const p = AdelanteEHR.getPatient(patientId);
  if (!p?.enrolledAt) throw new Error("Only an enrolled person can be marked this way.");
  if (firstAttendedAppointment(patientId)) throw new Error("Care has started — use discharge instead.");
  const cur = didntStartCareFor(patientId);
  if (cur && !cur.reopenedAt) throw new Error("Already recorded.");
  _setDidntStart({ patientId, reason: input.reason, at: new Date().toISOString(), byRole: actor.role, byStaffId: actor.staffId });
  AdelanteEHR._emit();
  return { patientId };
}

export function reopenDidntStartCare(actor: LifecycleActor, patientId: string, reason: string) {
  if (!canMarkDidntStart(actor, patientId)) throw new Error(DIDNT_START_DENIED);
  needReason(reason);
  const cur = didntStartCareFor(patientId);
  if (!cur || cur.reopenedAt) throw new Error("Nothing to reopen.");
  _setDidntStart({ ...cur, reopenedAt: new Date().toISOString(), reopenedByRole: actor.role });
  AdelanteEHR._emit();
  return { patientId };
}

// Intake facts reach the first-plan suggestions (non-Part-2 packet needs only).
import { setIntakeFactSuggestionSource } from "./structuredCarePlan";
import { clinicianPacketNeedFacts, NEED_LABEL } from "./intakePacket";
setIntakeFactSuggestionSource((pid) => clinicianPacketNeedFacts(pid).map((n) => ({ id: n.id, label: NEED_LABEL[n.kind].en, source: n.source })));
