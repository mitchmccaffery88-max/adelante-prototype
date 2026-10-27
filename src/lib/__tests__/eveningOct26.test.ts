// 26 Oct evening (Mitch) decisions 1–6. Values asserted come from the decisions.
import { beforeEach, describe, expect, it } from "vitest";
import "@/lib/chartActions";
import { AdelanteEHR, resolveCrisisOwner } from "@/lib/ehr";
import { runAction } from "@/lib/actions/runAction";
import { PATIENT_ACTOR_ROLE } from "@/lib/patientBooking";
import { buildIntakePacket, intakePacketFor, listSignedCopies, patientSelfSignForm, revokeForm, sendForms, setChecked, signChecked } from "@/lib/consentForms";
import { consentGate, coordinatorNeed, COUNSELING_NEED } from "@/lib/consentGate";
import { patientGroupCatalog, requirementsFor, skipsCarePlanEligibility } from "@/lib/groupRequests";
import { runSignupCommand } from "@/lib/website/signupSafety";
import { signupActor } from "@/lib/website/signupStore";
import { intakeSafetyRows } from "@/lib/intakeTriage";
import { scanReferralFreeText } from "@/lib/website/publicReferral";
import { STAFF_ROSTER, hasRoleAssignment, type StaffRole } from "@/lib/roles";
import { availableSlots } from "@/lib/clinicianAvailability";
import { calendarIdFor, CARE_MANAGER_CALENDAR_ROLES } from "@/lib/careManagerCalendar";
import { addStaffMemberWithReason } from "@/lib/staffLifecycle";
import { _resetOnCall, addOnCallShift, onCallAt } from "@/lib/onCall";
import { ON_CALL_GAP } from "@/lib/onCallBoundary";

let n = 0;
function newPatient(extra: Record<string, unknown> = {}) {
  const p = AdelanteEHR.createPatient({ firstName: `Eve${n++}`, lastName: "Tester", programId: "TEST", ...extra } as never);
  AdelanteEHR.setCurrentPatientId(p.id);
  return p.id;
}
const patientActor = (pid: string) => ({ role: PATIENT_ACTOR_ROLE, staffId: pid, staffName: "Patient (self)" });
const selfSign = (pid: string, formKey: string, context = "forms") =>
  runAction("patient_consent_self_sign", patientActor(pid), AdelanteEHR.getPatient(pid), { args: [{ patientId: pid, formKey, typedName: "Eve Tester", attested: true, context }] });
const cat = (pid: string, c: string) => AdelanteEHR.isConsentCategoryAuthorized(pid, c as never);

describe("1. patient self-sign telehealth + group confidentiality", () => {
  it("telehealth self-sign unlocks the telehealth gate at once with a typed record", () => {
    const pid = newPatient();
    expect(cat(pid, "telehealth_services")).toBe(false);
    const r = selfSign(pid, "telehealth", "inline_gate");
    expect(r.ok).toBe(true);
    expect(cat(pid, "telehealth_services")).toBe(true);
    const typed = AdelanteEHR.listConsentRecords(pid).find((x) => x.consentType === "telehealth");
    expect(typed?.purposeCode).toBe("telehealth");
    expect(typed?.signedBy.relationship).toBe("patient");
  });
  it("group confidentiality self-sign unlocks group_confidentiality_ack", () => {
    const pid = newPatient();
    expect(selfSign(pid, "group").ok).toBe(true);
    expect(cat(pid, "group_confidentiality_ack")).toBe(true);
  });
  it("other forms are refused for self-sign", () => {
    const pid = newPatient();
    for (const k of ["hipaa", "po_release", "part2", "advocate_patient", "ai_recording"]) expect(selfSign(pid, k).ok).toBe(false);
  });
  it("only the current patient can self-sign", () => {
    const a = newPatient(); const b = newPatient();
    expect(() => patientSelfSignForm({ patientId: a, formKey: "telehealth", typedName: "Eve Tester", attested: true, context: "forms" })).toThrow();
    expect(AdelanteEHR.getCurrentPatientId()).toBe(b);
  });
  it("staff roles cannot run the self-sign action", () => {
    const pid = newPatient();
    const r = runAction("patient_consent_self_sign", { role: "therapist" as StaffRole, staffId: "s-th1" }, AdelanteEHR.getPatient(pid), { args: [{ patientId: pid, formKey: "telehealth", typedName: "X Y", attested: true, context: "forms" }] });
    expect(r.ok).toBe(false);
  });
  it("revoking re-locks the gate", () => {
    const pid = newPatient();
    selfSign(pid, "telehealth");
    revokeForm({ patientId: pid, formKey: "telehealth", by: "patient" });
    expect(cat(pid, "telehealth_services")).toBe(false);
  });
  it("audit is IDs only — the typed name is never in the action event", () => {
    const pid = newPatient();
    const r = selfSign(pid, "telehealth");
    expect(r.ok && JSON.stringify(r.event)).not.toContain("Eve Tester");
  });
});

describe("6. standard Part 2 TPO consent at intake", () => {
  it("is offered to every population and never required", () => {
    for (const pw of ["general", "reentry", "sud", "reentry_sud"] as const) {
      const item = intakePacketFor(pw).find((i) => i.key === "part2_standard");
      expect(item?.required).toBe(false);
    }
  });
  it("self-sign is refused outside the intake packet", () => {
    const pid = newPatient();
    expect(selfSign(pid, "part2_standard", "forms").ok).toBe(false);
    expect(selfSign(pid, "part2_standard", "intake_packet").ok).toBe(false); // no packet yet
  });
  it("a non-packet staff send cannot be self-signed in the portal", () => {
    const pid = newPatient();
    sendForms({ patientId: pid, formKeys: ["part2_standard"], actor: { role: "therapist", name: "Dr. T", staffId: "s-th1" } });
    setChecked(pid, "part2_standard", true);
    expect(() => signChecked({ patientId: pid, signerName: "Eve Tester", typedName: "Eve Tester" })).toThrow();
  });
  it("packet signature: typed part2_tpo_single, purpose tpo, no expiry, unlocks treatment only; revocation re-locks", () => {
    const pid = newPatient();
    buildIntakePacket(pid);
    expect(selfSign(pid, "part2_standard", "intake_packet").ok).toBe(true);
    const rec = AdelanteEHR.listConsentRecords(pid).find((x) => x.consentType === "part2_tpo_single");
    expect(rec?.purposeCode).toBe("tpo");
    expect(rec?.expirationDate).toBeUndefined();
    expect(rec?.recipients?.map((r) => r.directoryRef)).toEqual(["adelante-program", "class:treating_providers", "class:payers", "class:hie", "class:program_operations"]);
    expect(cat(pid, "sud_treatment")).toBe(true);
    // Not substitutable for coordinator, counseling notes, legal or criminal-justice consent.
    expect(consentGate(pid, coordinatorNeed(), () => false)).toBe(false);
    expect(consentGate(pid, COUNSELING_NEED, () => false)).toBe(false);
    expect(cat(pid, "legal_part2_disclosure")).toBe(false);
    expect(cat(pid, "po_voluntary_coordination")).toBe(false);
    revokeForm({ patientId: pid, formKey: "part2_standard", by: "patient" });
    expect(cat(pid, "sud_treatment")).toBe(false);
    expect(listSignedCopies(pid).some((c) => c.copy.formKey === "part2_standard" && c.ended?.reason === "revoked")).toBe(true);
  });
});

describe("2. open, non-billable groups skip care-plan eligibility", () => {
  const facilitator = () => AdelanteEHR.listClinicians()[0].id;
  const mk = (topic: string, billable: boolean, joinRule: "open" | "care_team_approval") => AdelanteEHR.createGroupSession({ topic, description: "t", facilitatorId: facilitator(), serviceType: "therapy_group", modality: "in_person", category: "skills_education", start: new Date(Date.now() + 5 * 86400000).toISOString(), durationMin: 60, capacity: 10, recurrence: { kind: "weekly", daysOfWeek: [1] }, createdBy: "Test", joinRule, audiences: [], groupType: "skills_open", billable, language: "both" } as never);
  it("open non-billable: no care-plan item, patient joins directly", () => {
    const g = mk("Evening walk", false, "open");
    expect(skipsCarePlanEligibility(g)).toBe(true);
    expect(requirementsFor(g)).not.toContain("group_eligibility");
    const pid = newPatient();
    expect(AdelanteEHR.isGroupEligible(pid)).toBe(false);
    const row = patientGroupCatalog(pid).find((r) => r.group.id === g.id);
    expect(row?.action).toBe("join");
    const r = runAction("patient_group_join", patientActor(pid), AdelanteEHR.getPatient(pid), { args: [patientActor(pid), pid, g.id] });
    expect(r.ok).toBe(true);
  });
  it("billable open and care-team-approval groups keep the care-plan gate", () => {
    expect(requirementsFor(mk("Billable open", true, "open"))).toContain("group_eligibility");
    expect(requirementsFor(mk("Approval group", false, "care_team_approval"))).toContain("group_eligibility");
  });
});

describe("3. safety scan of sign-up and public referral free text", () => {
  it("sign-up crisis answer never blocks, flags safety, Intake sees only the label, no text in audits", () => {
    const start = runSignupCommand(signupActor, { operation: "start" });
    const r = runSignupCommand(signupActor, { operation: "save", sessionId: start.sessionId, draft: { firstName: "Ana", lastName: "Safe", dob: "1990-01-01", phone: "5595550199", preferredLanguage: "en", credentialKind: "password", helperName: "I want to kill myself" } as never });
    expect(r.outcome).toBe("saved");
    expect(r.safety).toBe(true);
    const rows = intakeSafetyRows({ role: "intake_coordinator", staffId: STAFF_ROSTER.find((s) => hasRoleAssignment(s, "intake_coordinator"))?.id });
    const row = rows.find((x) => x.sourceId === start.sessionId);
    expect(row?.label).toBe("Needs clinical triage now");
    expect(JSON.stringify(row)).not.toContain("kill");
    expect(JSON.stringify(AdelanteEHR.listAuditEvents({}))).not.toContain("I want to kill myself");
  });
  it("public referral free text with crisis language routes to triage", () => {
    const ref = AdelanteEHR.createReferral({ firstName: "Rae", lastName: "Ref", phone: "5595550123", referralSource: "family", channel: "public" } as never);
    expect(scanReferralFreeText(ref.id, { address: "no reason to live anymore" })).toBe(true);
    expect(scanReferralFreeText(ref.id + "x", { firstName: "Kill" })).toBe(false);
  });
});

describe("4. every care manager has a bookable calendar", () => {
  it("each active care manager (primary or additional role) has open slots", () => {
    const cms = STAFF_ROSTER.filter((s) => s.active !== false && CARE_MANAGER_CALENDAR_ROLES.some((r) => hasRoleAssignment(s, r)));
    expect(cms.length).toBeGreaterThan(3);
    for (const s of cms) {
      const id = calendarIdFor(s);
      expect(id, s.id).toBeTruthy();
      const service = hasRoleAssignment(s, "peer_specialist") && !hasRoleAssignment(s, "ecm_provider") && !hasRoleAssignment(s, "cf_care_manager") ? "peer_support" : "case_management";
      expect(availableSlots(id!, { serviceType: service as never, modality: "video", stepMin: 60 }).length, s.id).toBeGreaterThan(0);
    }
  });
  it("a care manager added through the audited path starts with hours", () => {
    const m = addStaffMemberWithReason({ role: "sys_admin", staffId: "s-admin1" } as never, { id: "s-cm-new", name: "New CM", role: "ecm_provider" } as never, "New hire");
    expect(calendarIdFor(m)).toBe("s-cm-new");
    expect(availableSlots("s-cm-new", { serviceType: "case_management", modality: "video", stepMin: 60 }).length).toBeGreaterThan(0);
  });
});

describe("5. on-call duty schedule", () => {
  beforeEach(() => _resetOnCall());
  const admin = { role: "clinical_coordinator" as StaffRole, staffId: "s-cc1" };
  const clinician = () => STAFF_ROSTER.find((s) => s.role === "therapist" && s.active !== false)!;
  it("in range: an unassigned patient's crisis goes to the on-call clinician", () => {
    const now = Date.now();
    addOnCallShift(admin, { staffId: clinician().id, start: new Date(now - 3600000).toISOString(), end: new Date(now + 3600000).toISOString() }, "Weekend cover");
    const pid = newPatient();
    expect(resolveCrisisOwner(AdelanteEHR.getPatient(pid)!, "clinical")?.id).toBe(clinician().id);
    const row = AdelanteEHR.flagCrisis(pid, "Test", "Test flag", { category: "clinical" });
    expect(row.ownerStaffId).toBe(clinician().id);
    expect(row.ownerGap).toBeUndefined();
  });
  it("out of range: falls back to the coordinator pool with the visible notice", () => {
    const now = Date.now();
    addOnCallShift(admin, { staffId: clinician().id, start: new Date(now + 86400000).toISOString(), end: new Date(now + 2 * 86400000).toISOString() }, "Next week");
    expect(onCallAt(new Date(now))).toBeUndefined();
    const pid = newPatient();
    const row = AdelanteEHR.flagCrisis(pid, "Test", "Test flag", { category: "clinical" });
    expect(row.ownerLane).toBe("pool");
    expect(row.ownerGap).toBe(ON_CALL_GAP);
    expect(ON_CALL_GAP).toBe("No on-call clinician set — sent to the clinical coordinator");
  });
  it("handoff from the on-call clinician is audited", () => {
    const now = Date.now();
    const c = clinician();
    addOnCallShift(admin, { staffId: c.id, start: new Date(now - 3600000).toISOString(), end: new Date(now + 3600000).toISOString() }, "Cover");
    const pid = newPatient();
    const row = AdelanteEHR.flagCrisis(pid, "Test", "Test flag", { category: "clinical" });
    const to = STAFF_ROSTER.find((s) => s.role === "pmhnp" && s.active !== false)!;
    AdelanteEHR.handOffCrisisEscalation(pid, row.id, { toStaffId: to.id, reason: "Shift ended", byStaffId: c.id, byName: c.name, byRole: c.role });
    expect(AdelanteEHR.listAuditEvents({ category: "clinical" }).some((e) => e.action === "crisis_owner_handoff" && (e.detail as { escalationId?: string }).escalationId === row.id)).toBe(true);
  });
  it("only coordinator/sys_admin may schedule, only licensed clinicians may carry duty", () => {
    const r = runAction("on_call_shift_add", { role: "therapist" as StaffRole, staffId: "s-th1" }, undefined, { args: [{ role: "therapist", staffId: "s-th1" }, { staffId: clinician().id, start: new Date().toISOString(), end: new Date(Date.now() + 3600000).toISOString() }, "x reason"] });
    expect(r.ok).toBe(false);
    const peer = STAFF_ROSTER.find((s) => s.role === "peer_specialist")!;
    expect(() => addOnCallShift(admin, { staffId: peer.id, start: new Date().toISOString(), end: new Date(Date.now() + 3600000).toISOString() }, "Cover")).toThrow();
  });
});
