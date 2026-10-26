import { AdelanteEHR, type Referral } from "./ehr";
import { getStaffMember, INTAKE_ROLE_PURPOSE } from "./roles";
import { runAction } from "./actions/runAction";
import { canActOnIdentityReview, type IdentityReviewActor } from "./identityReview";
import { isRestricted } from "./chartAccess";
import type { ReferralOutreachOutcome } from "./referralOutreach";
export { INTAKE_ROLE_PURPOSE };
export const INTAKE_RESPONSIBILITIES = ["Referral triage and outreach", "Identity review", "Pre-release packets and demographic reconciliation", "Paperwork and consent collection", "Eligibility requests and billing handoff", "First appointments and group requests", "Intake completion and care-team handoff", "Escalate safety concerns for clinical triage"];
export function seedIntakeStaff() {
  if (!getStaffMember("s-intake1")) runAction("staff_add", {role:"sys_admin",staffId:"s-admin1"}, undefined, {args:[{role:"sys_admin",staffId:"s-admin1"}, {id:"s-intake1",name:"Intake Coordinator (demo)",role:"intake_coordinator"}, "Initialize requested intake demo persona"]});
}
export function intakeLane(r: Referral) {
  if (r.status === "enrolled") return "Handed off";
  if (r.status === "submitted") return r.outreach?.attempts.length ? "Outreach in progress" : "New";
  return r.dob || r.cin ? "Ready to schedule" : "Waiting on paperwork";
}
export const intakeReferrals = () => AdelanteEHR.listReferrals().filter(r => r.status !== "declined");

export function intakeReferralRestricted(r: Referral): boolean {
  const pid = r.enrolledPatientId;
  return !!(pid && isRestricted(pid)) || !!(r.substanceUseNeed && (!pid || !AdelanteEHR.isConsentCategoryAuthorized(pid,"sud_treatment")));
}
export function intakeLogOutreach(actor: IdentityReviewActor, referralId: string, outcome: ReferralOutreachOutcome, reason: string) {
  if (actor.role !== "intake_coordinator" || !canActOnIdentityReview(actor)) throw new Error("Intake Coordinator required.");
  if (reason.trim().length < 3) throw new Error("Give a reason.");
  const r = intakeReferrals().find(r=>r.id===referralId);
  if (!r || intakeReferralRestricted(r)) throw new Error("Restricted referral — authorized intake consent required.");
  if (!["submitted","contacted"].includes(r.status)) throw new Error("This referral is closed.");
  AdelanteEHR.logReferralOutreachAttempt(referralId,{outcome});
}