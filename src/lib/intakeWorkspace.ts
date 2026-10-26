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
  if (r.status === "enrolled") return r.enrolledPatientId && intakeHandoffFor(r.enrolledPatientId) ? "Handed off" : "Ready to schedule";
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

const handoffs = new Map<string,{at:string;staffId:string;caseManagerId:string;clinicianId:string}>();
export const intakeHandoffFor = (patientId:string) => handoffs.get(patientId);
export function intakeCommand(actor: IdentityReviewActor, patientId:string, input:{operation:"eligibility"|"group"|"safety"|"handoff";reason:string;caseManagerId?:string;clinicianId?:string}) {
  if (actor.role !== "intake_coordinator" || !actor.staffId) throw new Error("Intake Coordinator required.");
  if (input.reason.trim().length < 3) throw new Error("Give a reason.");
  const patient=AdelanteEHR.getPatient(patientId);
  if (!patient || isRestricted(patientId)) throw new Error("Restricted account — authorized review required.");
  if (input.operation === "handoff") {
    const cm=AdelanteEHR.listCaseManagers().find(c=>c.id===input.caseManagerId);
    const clinician=AdelanteEHR.listClinicians().find(c=>c.id===input.clinicianId);
    if (!cm || !clinician) throw new Error("Choose the care manager and primary clinician.");
    if (!AdelanteEHR.appointmentsForPatient(patientId).some(a=>a.status === "scheduled" || a.status === "attended")) throw new Error("Schedule the first visit before handoff.");
    AdelanteEHR.assignCaseManager({patientId,caseManagerId:cm.id,actorId:actor.staffId});
    AdelanteEHR.reassignPrimaryClinician({patientId,clinicianId:clinician.id});
    handoffs.set(patientId,{at:new Date().toISOString(),staffId:actor.staffId,caseManagerId:cm.id,clinicianId:clinician.id});
    AdelanteEHR._recordAudit({category:"assignment",action:"intake_handed_off",patientId,actorId:actor.staffId,actorRole:actor.role,detail:{caseManagerId:cm.id,clinicianId:clinician.id}});
  } else if (input.operation === "safety") {
    AdelanteEHR.flagCrisis(patientId,actor.staffName ?? actor.staffId,"Needs clinical triage now");
  } else {
    const billing=input.operation === "eligibility";
    AdelanteEHR.createCaseTask({patientId,assignedTo:billing?"Billing":"Clinical coordinator",title:billing?"Check Medi-Cal eligibility":"Review group enrollment request",dueDate:new Date().toISOString().slice(0,10),allowedRoles:billing?["billing","billing_coordinator"]:["clinical_coordinator"],taskType:billing?"intake_eligibility_request":"intake_group_request",dedupeKey:`intake:${patientId}:${input.operation}`});
    AdelanteEHR._recordAudit({category:"clinical",action:billing?"intake_eligibility_requested":"intake_group_requested",patientId,actorRole:actor.role,actorId:actor.staffId,detail:{patientId}});
  }
  AdelanteEHR._emit();
}