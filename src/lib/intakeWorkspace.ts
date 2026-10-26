import { AdelanteEHR, type Referral } from "./ehr";
import { addStaffMember, getStaffMember, INTAKE_ROLE_PURPOSE } from "./roles";
export { INTAKE_ROLE_PURPOSE };
export const INTAKE_RESPONSIBILITIES = ["Referral triage and outreach", "Identity review", "Pre-release packets and demographic reconciliation", "Paperwork and consent collection", "Eligibility requests and billing handoff", "First appointments and group requests", "Intake completion and care-team handoff", "Escalate safety concerns for clinical triage"];
export function seedIntakeStaff() {
  if (!getStaffMember("s-intake1")) addStaffMember({role:"sys_admin",staffId:"s-admin1"}, {id:"s-intake1",name:"Intake Coordinator (demo)",role:"intake_coordinator"});
}
export function intakeLane(r: Referral) {
  if (r.status === "enrolled") return "Handed off";
  if (r.status === "submitted") return r.outreach?.attempts.length ? "Outreach in progress" : "New";
  return r.dob || r.cin ? "Ready to schedule" : "Waiting on paperwork";
}
export const intakeReferrals = () => AdelanteEHR.listReferrals().filter(r => r.status !== "declined");