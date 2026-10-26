import { AdelanteEHR, effectiveConsentStatus, type Referral } from "./ehr";
import { canIntakeAct, assertIntakeActor, referralForIntake, intakeState, type IntakeActor } from "./intakePhaseA";
import { getStaffMember, hasRoleAssignment, STAFF_ROSTER, canAccess } from "./roles";
import { isRestricted, chartEntryFor } from "./chartAccess";
import { captureConsentRecord, uploadPaperConsent, TEMPLATE_FOR, type CaptureDraft } from "./consentCapture";
import { sendForms, listRequests, publishedForm, type FormKey } from "./consentForms";
import { registerIntakeConsentBoundary } from "./intakeConsentBoundary";
import { isPurposeCode, PURPOSE_LABEL, purposeCodeOf, type ConsentPurposeCode } from "./consentPurposes";
import { PART2_ELEMENT_KEYS, isPart2Type, type Part2Elements, type ConsentType } from "./consentRecordModel";

export const INTAKE_PHASE_B_DRAFT = "Draft — pending clinical sign-off";
export type IntakeBPermission = "paperwork_send" | "paperwork_capture" | "eligibility_request" | "sdoh_checklist" | "staging_import" | "packet_attach";
export function canIntakeB(actor: IntakeActor, permission: IntakeBPermission) {
  if ((permission === "staging_import" || permission === "packet_attach") && actor.role === "clinical_coordinator") {
    const s = getStaffMember(actor.staffId);
    return !!s && s.active !== false && hasRoleAssignment(s, actor.role);
  }
  return canIntakeAct(actor, "completion");
}
export function assertIntakeB(actor: IntakeActor, permission: IntakeBPermission, reason: string) {
  if (!canIntakeB(actor, permission)) throw new Error("Dedicated Intake permission required.");
  if (reason.trim().length < 3) throw new Error("Give a reason.");
}
export function intakeBReferral(actor: IntakeActor, id: string, permission: IntakeBPermission, reason: string, allowLocked = false) {
  assertIntakeB(actor, permission, reason);
  const r = referralForIntake(id, allowLocked);
  if (actor.role === "intake_coordinator" && intakeState(id, actor).completedAt) throw new Error("Active intake only.");
  return r;
}
function linked(actor: IntakeActor, id: string, permission: IntakeBPermission, reason: string) {
  // Capture must be reachable while program consent is missing, but never bypass a restricted/merged chart.
  const r = intakeBReferral(actor, id, permission, reason, true);
  const p = r.enrolledPatientId ? AdelanteEHR.getPatient(r.enrolledPatientId) : undefined;
  if (!p || p.mergedInto || isRestricted(p.id)) throw new Error("Confirmed unrestricted patient link required.");
  return { r, p };
}
export const INTAKE_FORMS = [
  { key: "hipaa", label: "Intake authorization / release of information", type: "hipaa_authorization", purposes: ["treatment", "care_coordination"] },
  { key: "telehealth", label: "Telehealth consent", type: "telehealth", purposes: ["telehealth"] },
  { key: "part2", label: "Part 2 intake / treatment consent", type: "part2_tpo_single", purposes: ["treatment"] },
  { key: "portal", label: "Portal intake form", type: "portal_reminder", purposes: ["care_coordination"] },
  { key: "sms", label: "Text reminder intake form", type: "sms_reminder", purposes: ["care_coordination"] },
] as const;
export type IntakeFormKey = (typeof INTAKE_FORMS)[number]["key"];
export function intakeForm(key: string) { const f = INTAKE_FORMS.find(x => x.key === key); if (!f) throw new Error("Intake form not allowed."); return f; }
export interface IntakeCaptureInput { formKey: IntakeFormKey; purposeCode: ConsentPurposeCode; note?: string; signer: string; relationship: "patient" | "guardian" | "proxy"; signedOn: string; expiresOn: string; attested: boolean; elements?: Part2Elements; fileName?: string; }
function dates(signedOn: string, expiresOn: string) {
  const today = new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(signedOn) || !Number.isFinite(Date.parse(signedOn)) || new Date(signedOn).toISOString().slice(0, 10) !== signedOn || signedOn > today) throw new Error("Actual signature date required; no future signatures.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresOn) || !Number.isFinite(Date.parse(expiresOn)) || new Date(expiresOn).toISOString().slice(0, 10) !== expiresOn || expiresOn <= today || expiresOn <= signedOn) throw new Error("Future expiration date required.");
}
function draftFor(patientId: string, input: IntakeCaptureInput): CaptureDraft {
  const f = intakeForm(input.formKey);
  if (!isPurposeCode(input.purposeCode) || !(f.purposes as readonly string[]).includes(input.purposeCode)) throw new Error("Choose the purpose appropriate to this intake form.");
  dates(input.signedOn, input.expiresOn);
  if (!input.attested || input.signer.trim().length < 2) throw new Error("Actual signer and signature attestation required.");
  if (isPart2Type(f.type) && !PART2_ELEMENT_KEYS.every(k => input.elements?.[k] === true)) throw new Error("Confirm every required Part 2 element.");
  return { patientId, consentType: f.type, recipients: [{ kind: "org", name: "Adelante", directoryRef: "adelante-program" }], purposeCode: input.purposeCode, purpose: PURPOSE_LABEL[input.purposeCode], items: [f.key === "part2" ? "Intake and treatment information" : f.label], effectiveDate: input.signedOn, expiresOn: input.expiresOn, ...(input.elements ? { part2Elements: { ...input.elements } } : {}) };
}
type BoundaryInput = { actor: { role: IntakeActor["role"]; staffId?: string; name: string }; intakeReferralId?: string; patientId?: string; formKeys?: FormKey[]; draft?: CaptureDraft; signedOn?: string; signer?: string; attested?: boolean; relationship?: IntakeCaptureInput["relationship"]; fileName?: string; method?: string; consentEvent?: string; advocateId?: string; now?: string; dueDays?: number };
registerIntakeConsentBoundary((raw, operation) => {
  const i = raw as BoundaryInput;
  const actor = { role: i.actor.role, staffId: i.actor.staffId };
  if (!i.intakeReferralId) throw new Error("Referral-only capture/send required.");
  const { p } = linked(actor, i.intakeReferralId, operation === "send" ? "paperwork_send" : "paperwork_capture", "Referral paperwork");
  if (operation === "send") {
    if (i.patientId !== p.id || i.advocateId || i.now || i.dueDays || !i.formKeys?.length || i.formKeys.some(k => !INTAKE_FORMS.some(f => f.key === k))) throw new Error("Intake forms for this linked patient only.");
    return;
  }
  const d = i.draft;
  const f = INTAKE_FORMS.find(x => x.type === d?.consentType);
  if (!d || !f || d.patientId !== p.id || i.consentEvent || (operation === "capture" && i.method !== "e_sign")) throw new Error("Intake capture only; no renewal, scope decisions or verbal substitution.");
  const expected = draftFor(p.id, { formKey: f.key, purposeCode: d.purposeCode as ConsentPurposeCode, signer: i.signer ?? "", relationship: i.relationship ?? "patient", signedOn: i.signedOn ?? "", expiresOn: d.expiresOn ?? "", attested: i.attested === true, elements: d.part2Elements });
  if (JSON.stringify(d) !== JSON.stringify(expected)) throw new Error("Fixed intake form terms only; no scope editing.");
});
export function sendIntakeForm(actor: IntakeActor, referralId: string, formKey: IntakeFormKey, reason: string) {
  const { p } = linked(actor, referralId, "paperwork_send", reason); intakeForm(formKey);
  const req = sendForms({ patientId: p.id, formKeys: [formKey], actor: { role: actor.role, staffId: actor.staffId, name: getStaffMember(actor.staffId)?.name ?? "Intake" }, intakeReferralId: referralId, packet: true });
  AdelanteEHR._emit(); return { referralId, requestId: req[0]?.id };
}
const captureNotes = new Map<string, string>();
export function captureIntakeForm(actor: IntakeActor, referralId: string, input: IntakeCaptureInput, reason: string) {
  const { p } = linked(actor, referralId, "paperwork_capture", reason);
  const draft = draftFor(p.id, input);
  if (!publishedForm(input.formKey)) throw new Error("Published intake template required.");
  const a = { role: actor.role, staffId: actor.staffId, name: getStaffMember(actor.staffId)?.name ?? "Intake" };
  const common = { draft, signer: input.signer, relationship: input.relationship, signedOn: input.signedOn, actor: a, intakeReferralId: referralId, attested: input.attested };
  const rec = input.fileName ? uploadPaperConsent({ ...common, fileName: input.fileName }) : captureConsentRecord({ ...common, method: "e_sign" });
  if (input.note?.trim()) captureNotes.set(rec.id, input.note.trim()); // administrative note, never gate/audit text
  AdelanteEHR._emit(); return { referralId, recordId: rec.id };
}
export type IntakeFormStatus = "Collected" | "Missing" | "Expired" | "Needs review";
export function intakeFormsStatus(actor: IntakeActor, referralId: string) {
  assertIntakeB(actor, "paperwork_capture", "Status projection");
  const r = referralForIntake(referralId, true);
  const pid = r.enrolledPatientId;
  return INTAKE_FORMS.map(f => {
    const records = pid ? AdelanteEHR.listConsentRecords(pid).filter(rec => rec.consentType === f.type && rec.recipients?.some(x => x.directoryRef === "adelante-program" || x.name === "Adelante")) : [];
    const rec = records.find(x => effectiveConsentStatus(x) === "active" && !x.revocation && !x.legacyUnverified && (f.purposes as readonly string[]).includes(purposeCodeOf(x) ?? ""));
    const latest = records[0];
    const status: IntakeFormStatus = rec ? "Collected" : latest && effectiveConsentStatus(latest) === "expired" ? "Expired" : latest ? "Needs review" : "Missing";
    return { key: f.key, label: f.label, status, date: (rec ?? latest)?.signature?.signedAt?.slice(0, 10), sentOn: pid ? listRequests(pid).find(x => x.formKey === f.key)?.sentAt.slice(0, 10) : undefined };
  });
}
type EligibilityRequest = { referralId: string; patientId: string; requestedAt: string; baselineIds: string[]; taskId: string; billingStaffId: string };
const eligibilityRequests = new Map<string, EligibilityRequest>();
export function requestIntakeEligibility(actor: IntakeActor, referralId: string, reason: string) {
  const { p } = linked(actor, referralId, "eligibility_request", reason);
  if (eligibilityRequests.has(referralId) && intakeCoverageResult(actor, referralId).status === "Pending") return { referralId, taskId: eligibilityRequests.get(referralId)?.taskId };
  const owner = STAFF_ROSTER.find(s => s.active !== false && hasRoleAssignment(s, "billing"));
  if (!owner) throw new Error("No active Billing owner; request not created.");
  const at = new Date().toISOString();
  const task = AdelanteEHR.createCaseTask({ patientId: p.id, assignedTo: owner.id, title: "Medi-Cal status check requested", detail: `Referral reference: ${referralId}`, dueDate: at.slice(0, 10), taskType: "intake_eligibility", source: "intake_referral", allowedRoles: ["billing", "billing_coordinator"], dedupeKey: `intake-eligibility:${referralId}` });
  if (!task) throw new Error("Billing task unavailable.");
  eligibilityRequests.set(referralId, { referralId, patientId: p.id, requestedAt: at, baselineIds: (p.coverage?.verifications ?? []).map(v => v.id), taskId: task.id, billingStaffId: owner.id });
  AdelanteEHR._emit(); return { referralId, taskId: task.id };
}
export function intakeCoverageResult(actor: IntakeActor, referralId: string): { status: "Active" | "Inactive" | "Pending" | "Not found"; checkedOn?: string } {
  assertIntakeB(actor, "eligibility_request", "Coverage projection");
  const r = referralForIntake(referralId, true);
  if (!r.enrolledPatientId || isRestricted(r.enrolledPatientId)) return { status: "Pending" };
  const req = eligibilityRequests.get(referralId); if (!req) return { status: "Pending" };
  const v = AdelanteEHR.getPatient(req.patientId)?.coverage?.verifications?.find(x => !req.baselineIds.includes(x.id) && !x.reportSource && x.channel !== "reported" && ["billing", "billing_coordinator"].includes(x.checkedByRole));
  if (!v) return { status: "Pending" };
  const status = v.electronic?.status === "active" || v.statusConfirmed === "active" ? "Active" : v.electronic?.status === "inactive" || ["suspended", "uninsured"].includes(v.statusConfirmed ?? "") ? "Inactive" : v.result === "not_found" ? "Not found" : "Pending";
  return { status, checkedOn: v.checkedAt.slice(0, 10) };
}
export function billingIntakeRequests(actor: IntakeActor) {
  const s = getStaffMember(actor.staffId);
  if (!s || s.active === false || !["billing", "billing_coordinator"].includes(actor.role) || !hasRoleAssignment(s, actor.role)) return [];
  return [...eligibilityRequests.values()].map(r => ({ referralId: r.referralId, patientId: r.patientId, requestedAt: r.requestedAt, taskId: r.taskId }));
}
export function careTeamCanRead(actor: IntakeActor, referral: Referral) {
  const pid = referral.enrolledPatientId; const staff = getStaffMember(actor.staffId);
  if (!pid || !staff || staff.active === false || !hasRoleAssignment(staff, actor.role) || !chartEntryFor(actor.role, pid).allowed) return false;
  const p = AdelanteEHR.getPatient(pid);
  return !!p && ((staff.caseManagerId && staff.caseManagerId === p.caseManagerId) || (staff.clinicianId && staff.clinicianId === p.primaryClinicianId)) && canAccess(actor.role, "sdoh", p).level !== "none";
}