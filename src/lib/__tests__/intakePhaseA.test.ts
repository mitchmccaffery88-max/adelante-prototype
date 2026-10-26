import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "../ehr";
import { AdelanteEHRExt } from "../ehr-ext";
import { canAccess, STAFF_ROSTER, hasRoleAssignment } from "../roles";
import { runAction } from "../actions/runAction";
import { bookFirstVisit, assignIntakeTeam, markIntakeComplete, firstVisitSlots, intakeAppointmentDetail, requestIntakeGroup, FIRST_VISITS, type FirstVisitKind } from "../intakePhaseA";
import { escalateIntakeSafety, registerIntakeSafetySource, preChartTodayTasks, preChartTriageDetail, intakeSafetyRows, linkPreChartTriage } from "../intakeTriage";
import { workspaceActionRows } from "../clinicianWorkspace";
import { captureTypedConsent, ADELANTE_PROGRAM } from "@/test/typedConsentCapture";
import { runSignupCommand, signupActor } from "../website/signupStore";
const actor = { role: "intake_coordinator" as const, staffId: "s-admin1", staffName: "Intake" };
const clinical = { role: "clinical_coordinator" as const, staffId: "s-cc1", staffName: "Priya" };
let count = 0;
function referral(link = true, kinds: FirstVisitKind[] = Object.keys(FIRST_VISITS) as FirstVisitKind[]) {
  const n = ++count;
  const r = AdelanteEHR.createReferral({ firstName: `IntakeTest${n}`, lastName: "PhaseA", dob: "1990-04-12", email: `intake-a-${n}@example.invalid`, referralSource: "other", referrerName: "Test", consentToContact: false, channel: "public", intakeServices: { source: "referral", kinds } });
  if (link) AdelanteEHR.enrollReferral(r.id, { websiteSignup: true });
  return r;
}
function pid(r: ReturnType<typeof referral>) { if (!r.enrolledPatientId) throw new Error("Missing fixture link"); return r.enrolledPatientId; }
function calendar(kind: FirstVisitKind) {
  const config = FIRST_VISITS[kind]; const id = `phase-a-calendar-${kind}`; const staffId = `phase-a-staff-${kind}`;
  if (!STAFF_ROSTER.some(s => s.id === staffId)) STAFF_ROSTER.push({ id: staffId, name: staffId, role: config.roles[0], clinicianId: id });
  AdelanteEHR.registerClinician({ id, name: id, credential: kind === "mat_intake" || kind === "psych_evaluation" ? "PMHNP" : "LCSW", mediCalCredentialed: true, mediCalStatus: "active", services: [config.service], locationIds: ["loc-visalia"] });
  for (const weekday of [1, 2, 3, 4, 5] as const) AdelanteEHRExt.upsertAvailabilityBlock({ clinicianId: id, weekday, start: "09:00", end: "17:00", modality: "hybrid", locationId: "loc-visalia", careTypes: [config.service] });
  return id;
}
describe("26 Oct Phase A — first visit boundary", () => {
  it.each(Object.keys(FIRST_VISITS) as FirstVisitKind[])("books indicated %s with the real Intake actor; adjacent chart/details stay denied", kind => {
    const r = referral(); const id = calendar(kind); const slot = firstVisitSlots(r.id, kind, actor, "in_person").find(s => s.clinicianId === id); if (!slot) throw new Error("Expected available fixture slot");
    const result = runAction<{ id: string }>("intake_first_visit_book", actor, undefined, { args: [actor, r.id, { kind, clinicianId: id, start: slot.start, modality: "in_person", locationId: "loc-visalia" }, "First intake contact"] });
    expect(result.ok).toBe(true); if (!result.ok) throw new Error(result.reason);
    const appt = AdelanteEHR.listAppointments().find(a => a.id === result.value.id);
    expect(appt?.bookedBy).toEqual({ id: "s-admin1", role: "intake_coordinator" });
    expect(appt?.intakeFirstVisit).toEqual({ referralId: r.id, kind });
    expect(() => bookFirstVisit(actor, r.id, { kind, clinicianId: id, start: slot.start, modality: "in_person", locationId: "loc-visalia" }, "Again")).toThrow(/already exists/);
    expect(canAccess(actor.role, "therapy_notes").level).toBe("none");
    expect(canAccess(actor.role, "sud_treatment").locked).toBe(true);
    expect(intakeAppointmentDetail(actor, r.id, "other-appointment")).toMatchObject({ restricted: true, reason: expect.stringContaining("Restricted") });
    expect(() => AdelanteEHR.staffRescheduleAppointment(result.value.id, slot.start, { id: actor.staffId, name: "Intake", role: actor.role })).toThrow();
  });
  it("refuses non-indicated services, unlinked people and direct generic bookings", () => {
    const r = referral(true, ["assessment"]); const id = calendar("mat_intake");
    expect(() => bookFirstVisit(actor, r.id, { kind: "mat_intake", clinicianId: id, start: "2090-01-01T17:00:00Z", modality: "in_person", locationId: "loc-visalia" }, "Not indicated")).toThrow(/not indicated/);
    expect(() => bookFirstVisit(actor, referral(false).id, { kind: "assessment", clinicianId: id, start: "2090-01-01T17:00:00Z", modality: "video" }, "No link")).toThrow(/confirmed patient link/);
    expect(() => AdelanteEHR.bookAppointment({ patientId: pid(r), clinicianId: id, start: "2090-01-01T17:00:00Z", durationMin: 30, serviceType: "med_management", modality: "video", bookedBy: { id: actor.staffId, role: actor.role } })).toThrow(/Referral-only/);
  });
  it("preserves telehealth consent and unavailable-slot/location checks", () => {
    const r = referral(); const id = calendar("assessment"); const slot = firstVisitSlots(r.id, "assessment", actor, "video").find(s => s.clinicianId === id); if (!slot) throw new Error("Slot missing");
    expect(() => bookFirstVisit(actor, r.id, { kind: "assessment", clinicianId: id, start: slot.start, modality: "video" }, "Video visit")).toThrow(/telehealth consent/);
    expect(() => bookFirstVisit(actor, r.id, { kind: "assessment", clinicianId: id, start: slot.start, modality: "in_person", locationId: "wrong" }, "Visit")).toThrow(/location/);
    expect(() => bookFirstVisit(actor, r.id, { kind: "assessment", clinicianId: id, start: "2090-01-01T03:13:00Z", modality: "in_person", locationId: "loc-visalia" }, "Visit")).toThrow(/slot/);
    captureTypedConsent(pid(r), { type: "telehealth", recipient: ADELANTE_PROGRAM, purpose: "telehealth" });
    const booked = bookFirstVisit(actor, r.id, { kind: "assessment", clinicianId: id, start: slot.start, modality: "video" }, "Consented video visit");
    expect(booked.status).toBe("scheduled");
  });
  it("does not offer an active clinician who does not provide the indicated service", () => {
    const r = referral(); const id = calendar("assessment");
    AdelanteEHR.registerClinician({ id: "phase-a-wrong-service", name: "Wrong service", credential: "LCSW", mediCalCredentialed: true, mediCalStatus: "active", services: ["therapy_individual"] });
    STAFF_ROSTER.push({ id: "phase-a-wrong-service-staff", name: "Wrong service", role: "therapist", clinicianId: "phase-a-wrong-service" });
    AdelanteEHRExt.upsertAvailabilityBlock({ clinicianId: "phase-a-wrong-service", weekday: 2, start: "09:00", end: "17:00", modality: "hybrid", locationId: "loc-visalia", careTypes: ["intake"] });
    const slots = firstVisitSlots(r.id, "assessment", actor, "in_person");
    expect(slots.some(s => s.clinicianId === id)).toBe(true);
    expect(slots.some(s => s.clinicianId === "phase-a-wrong-service")).toBe(false);
  });
  it("a conflict keeps the other visit's clinician and details restricted", () => {
    const r = referral(); const id = calendar("assessment");
    const slot = firstVisitSlots(r.id, "assessment", actor, "in_person").find(s => s.clinicianId === id);
    if (!slot) throw new Error("Slot missing");
    AdelanteEHR.bookAppointment({ patientId: pid(r), clinicianId: "c2", start: slot.start, durationMin: 60, serviceType: "therapy_individual", modality: "in_person", locationId: "loc-visalia" });
    expect(() => bookFirstVisit(actor, r.id, { kind: "assessment", clinicianId: id, start: slot.start, modality: "in_person", locationId: "loc-visalia" }, "First visit")).toThrow("That time is unavailable. Restricted — other appointment details are not available to Intake.");
  });
  it("group request is attributed on behalf, pending clinical approval and creates a Today task", () => {
    const r = referral(); const g = AdelanteEHR.listGroupSessions().find(g => g.category === "skills_education"); if (!g) throw new Error("Group missing");
    const result = requestIntakeGroup(actor, r.id, g.id, "2026-10-27", "Group requested");
    expect(result.status).toBe("pending");
    expect(AdelanteEHR.listGroupJoinRequests({ patientId: pid(r) }).find(x => x.id === result.id)).toMatchObject({ requestedBy: { staffId: actor.staffId, role: actor.role }, onBehalfOfPatient: true });
    expect(AdelanteEHR.groupsForPatient(pid(r)).some(x => x.id === g.id)).toBe(false);
    expect(() => AdelanteEHR.approveGroupJoinRequest(result.id, { id: actor.staffId, name: "Intake", role: actor.role })).toThrow();
    expect(() => AdelanteEHR.approveGroupJoinRequest(result.id, { id: "s-cm2", name: "Care manager", role: "ecm_provider" })).toThrow(/Clinical approval/);
    expect(AdelanteEHR.listCaseTasks().some(t => t.dedupeKey?.includes(`group:${result.id}`))).toBe(true);
  });
});
describe("26 Oct Phase A — administrative completion and assignment", () => {
  it("assigns only two initial fields, routes Today tasks, completes only administrative state and refuses later reassignment", () => {
    const r = referral(); const p = AdelanteEHR.getPatient(pid(r)); if (!p) throw new Error("Missing patient");
    const before = JSON.parse(JSON.stringify(p));
    assignIntakeTeam(actor, r.id, "care_manager", "s-cm2", "2026-10-27", "Initial assignment");
    assignIntakeTeam(actor, r.id, "clinician", "s-th2", "2026-10-27", "Initial assignment");
    expect(p.caseManagerId).toBe("cm1"); expect(p.primaryClinicianId).toBe("c2");
    for (const field of ["needs", "progressNotes", "consents", "carePlan", "intakeComplete"] as const) expect(p[field as keyof typeof p]).toEqual(before[field]);
    expect(workspaceActionRows({ actor: { role: "therapist", staffId: "s-th2", staffName: "James Okafor", clinicianId: "c2" }, needsClosing: [] }).some(t => t.patientId === p.id && t.label === "New patient assigned — first contact due by 2026-10-27")).toBe(true);
    markIntakeComplete(actor, r.id, { identity_link_checked: true, contact_checked: true, packet_received: true, handoff_ready: true }, "Administrative completion");
    expect(() => assignIntakeTeam(actor, r.id, "clinician", "s-th1", "2026-10-28", "Later")).toThrow(/reassign/);
    expect(canAccess(actor.role, "demographics").level).toBe("none"); expect(canAccess(actor.role, "care_plan").level).toBe("none");
  });
  it("refuses inactive and wrong-role targets and incomplete checklist", () => {
    const r = referral(); STAFF_ROSTER.push({ id: "intake-inactive-target", name: "Inactive", role: "therapist", clinicianId: "c1", active: false });
    expect(() => assignIntakeTeam(actor, r.id, "clinician", "intake-inactive-target", "2026-10-27", "Assign")).toThrow(/Active/);
    expect(() => assignIntakeTeam(actor, r.id, "care_manager", "s-th2", "2026-10-27", "Assign")).toThrow(/required role/);
    expect(() => markIntakeComplete(actor, r.id, { identity_link_checked: false, contact_checked: true, packet_received: true, handoff_ready: true }, "Finish")).toThrow(/checklist/);
  });
});
describe("26 Oct Phase A — safety ownership and restricted receipts", () => {
  it.each(["amber", "red"] as const)("unlinked %s routes a source-keyed real task to its assigned tier owner", tier => {
    const r = referral(false);
    registerIntakeSafetySource(clinical, { tier, careManagerStaffId: "s-cm2", clinicianStaffId: "s-th2", source: { kind: "referral", id: r.id, field: "safety_flag", trigger: "reported_safety_flag" } }, "Recorded flag");
    const before = AdelanteEHR.listPatients().length; const receipt = escalateIntakeSafety(actor, "referral", r.id, "Escalate");
    expect(receipt.ownerRole).toBe(tier === "amber" ? "ecm_provider" : "therapist");
    expect(AdelanteEHR.listPatients()).toHaveLength(before);
    expect(preChartTodayTasks({ role: "therapist", staffId: "s-th2" }).some(t => t.id === receipt.id)).toBe(true);
    expect(preChartTodayTasks({ role: "ecm_provider", staffId: "s-cm2" }).some(t => t.id === receipt.id)).toBe(tier === "amber");
    expect(preChartTriageDetail({ role: "ecm_provider", staffId: "s-cm2" }, receipt.id)).toMatchObject({ restricted: true });
    expect(preChartTriageDetail(actor, receipt.id)).toMatchObject({ restricted: true });
  });
  it("a real signup source escalates without a chart and keeps draft answers out of the receipt", () => {
    const s = runSignupCommand(signupActor, { operation: "start" });
    registerIntakeSafetySource(clinical, { tier: "red", source: { kind: "signup", id: s.sessionId, field: "helper_safety_flag", trigger: "reported_safety_flag", text: "Private helper source" } }, "Observed safety flag");
    const before = AdelanteEHR.listPatients().length;
    const receipt = escalateIntakeSafety(actor, "signup", s.sessionId, "Escalate");
    expect(AdelanteEHR.listPatients()).toHaveLength(before); expect(JSON.stringify(receipt)).not.toContain("Private helper source");
    expect(preChartTodayTasks(clinical).some(t => t.id === receipt.id)).toBe(true);
  });
  it.each(["amber", "red"] as const)("linked %s creates owner task, clinician summary/red queue, receipt only", tier => {
    const r = referral(); assignIntakeTeam(actor, r.id, "care_manager", "s-cm2", "2026-10-27", "Assign"); assignIntakeTeam(actor, r.id, "clinician", "s-th2", "2026-10-27", "Assign");
    registerIntakeSafetySource(clinical, { tier, patientId: pid(r), source: { kind: "referral", id: r.id, field: "referrer_flag", trigger: "reported_safety_flag", text: "Sensitive source" } }, "Safety reported");
    const before = AdelanteEHR.listPatients().length; const receipt = escalateIntakeSafety(actor, "referral", r.id, "Escalate recorded flag");
    expect(receipt.ownerRole).toBe(tier === "amber" ? "ecm_provider" : "therapist");
    expect(JSON.stringify(receipt)).not.toContain("Sensitive source");
    expect(AdelanteEHR.listPatients().length).toBe(before);
    expect(AdelanteEHR.listCaseTasks().find(t => t.dedupeKey === `intake-triage:referral:${r.id}`)?.assignedTo).toBe(tier === "amber" ? "cm1" : "s-th2");
    expect(preChartTriageDetail(actor, receipt.id)).toMatchObject({ restricted: true, reason: "Restricted — clinical triage only." });
    expect(intakeSafetyRows(actor).find(x => x.sourceId === r.id)?.receipt?.id).toBe(receipt.id);
    expect(AdelanteEHR.getPatient(pid(r))?.crisisEscalations?.some(x => x.ownerStaffId === (tier === "amber" ? "s-cm2" : "s-th2"))).toBe(true);
  });
  it("unlinked source creates a real coordinator triage task, no fake chart, then links only the confirmed referral", () => {
    const r = referral(false); registerIntakeSafetySource(clinical, { tier: "red", source: { kind: "referral", id: r.id, field: "safety_flag", trigger: "reported_safety_flag" } }, "Reported");
    const before = AdelanteEHR.listPatients().length; const receipt = escalateIntakeSafety(actor, "referral", r.id, "Escalate");
    expect(receipt.ownerName).toBe("Clinical coordinator queue"); expect(receipt.gap).toContain("No on-call");
    expect(AdelanteEHR.listPatients().length).toBe(before); expect(preChartTodayTasks(clinical).find(x => x.id === receipt.id)?.patientId).toBeUndefined();
    AdelanteEHR.enrollReferral(r.id, { websiteSignup: true }); linkPreChartTriage(clinical, "referral", r.id, pid(r), "Identity-confirmed link");
    expect(preChartTodayTasks(clinical).find(x => x.id === receipt.id)?.patientId).toBe(pid(r));
  });
  it("unlinked message has coordinator task and protected source; Intake cannot invent a flag", () => {
    const m = AdelanteEHR.createCommunityInquiry({ body: "Protected safety source", contact: "test@example.invalid", contactKind: "email", crisisFlagged: true }); if (!m) throw new Error("Missing inquiry");
    const receipt = escalateIntakeSafety(actor, "message", m.id, "Recorded message flag");
    expect(preChartTodayTasks(clinical).some(t => t.id === receipt.id)).toBe(true);
    expect(preChartTriageDetail(clinical, receipt.id)).toMatchObject({ restricted: true, reason: expect.stringContaining("Part 2") });
    expect(() => escalateIntakeSafety(actor, "referral", "missing", "Invented")).toThrow(/No recorded/);
    expect(() => registerIntakeSafetySource(actor, { tier: "red", source: { kind: "signup", id: "missing", field: "text", trigger: "reported_safety_flag" } }, "Invented")).toThrow(/Clinical/);
  });
});