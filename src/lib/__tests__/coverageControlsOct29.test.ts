import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { STAFF_ROLES, staffForRole } from "@/lib/roles";
import { runAction } from "@/lib/actions/runAction";
import { chartEntryFor, openChartWithReason } from "@/lib/chartAccess";
import { getStructuredPlan, canRecordSmhsDetermination, setSmhsDetermination } from "@/lib/structuredCarePlan";
import { canOverrideFundingSource } from "@/lib/fundingSource";
import { intakeFundingAppointments } from "@/lib/fundingAppointmentView";
import { loadCoverageMixScenario } from "@/lib/coverageMixScenario";
import { firstVisitSlots, markIntakeComplete } from "@/lib/intakePhaseA";

describe("coverage controls — Draft 29 Oct", () => {
  it("only treating licensed clinicians may record SMHS; role alone is not treatment", () => {
    const patientId = loadCoverageMixScenario().patients.mcp_smhs;
    for (const { key: role } of STAFF_ROLES) {
      const staff = staffForRole(role)[0];
      const entry = chartEntryFor(role, staff?.id, patientId);
      expect(canRecordSmhsDetermination(patientId, { role, staffId: staff?.id })).toBe(["therapist", "pmhnp", "physician"].includes(role) && entry.ok && entry.directTreatment);
    }
    expect(canRecordSmhsDetermination(patientId, { role: "patient", staffId: patientId })).toBe(false);
    expect(canRecordSmhsDetermination(patientId, { role: "advocate", staffId: "adv" })).toBe(false);
    expect(() => setSmhsDetermination(patientId, { meets: true, determinedAt: "2026-10-29", reasonCode: "clinical_review" }, { name: "No identity", role: "therapist" })).toThrow("Only a treating clinician");
  });

  it("reason-only chart entry cannot become an SMHS write", () => {
    const patientId = loadCoverageMixScenario().patients.private_pay;
    openChartWithReason({ patientId, reasonCode: "covering_consult", actor: { role: "therapist", staffId: "s-th1" } });
    expect(canRecordSmhsDetermination(patientId, { role: "therapist", staffId: "s-th1" })).toBe(false);
  });

  it("requires actual calendar date and reason; one registry audit, no clinical answer in audits", () => {
    const patientId = loadCoverageMixScenario().patients.mcp_smhs;
    const actor = { role: "therapist" as const, staffId: "s-th1", name: "Marisol Reyes" };
    const input = { meets: false, determinedAt: "2026-10-29", reasonCode: "clinical_review" as const };
    expect(() => setSmhsDetermination(patientId, { ...input, reasonCode: "" as never }, actor)).toThrow();
    expect(() => setSmhsDetermination(patientId, { ...input, determinedAt: "2026-02-30" }, actor)).toThrow();
    const before = AdelanteEHR.listAuditEvents({ category: "action" }).length;
    const result = runAction("smhs_determination_set", actor, AdelanteEHR.getPatient(patientId), { via: "setSmhsDetermination", args: [patientId, input, actor] });
    expect(result.ok).toBe(true);
    expect(AdelanteEHR.listAuditEvents({ category: "action" }).length - before).toBe(1);
    expect(getStructuredPlan(patientId).smhsDetermination).toMatchObject({ meets: false, determinedAt: "2026-10-29" });
    const audit = AdelanteEHR.listAuditEvents().find(e => e.action === "plan_smhs_determination_set" && e.patientId === patientId && e.detail?.reasonCode === "clinical_review");
    expect(audit?.detail).toEqual({ reasonCode: "clinical_review", determinedAt: "2026-10-29" });
    expect(audit?.actorId).toBe("s-th1");
    expect(JSON.stringify(result.event.detail)).not.toContain('"meets"');
  });

  it("funding writes match Billing/Intake roles including adjacent patient/advocate denial", () => {
    const appointment = AdelanteEHR.listAppointments().find(a => a.status === "scheduled");
    if (!appointment) throw new Error("Missing appointment fixture");
    const beforeStatus = appointment.status;
    for (const { key: role } of STAFF_ROLES) {
      const staff = staffForRole(role)[0];
      const result = runAction("appointment_funding_set", { role, staffId: staff?.id }, undefined, { args: [appointment.id, { source: "private_pay", reasonCode: "coverage_updated", actorId: staff?.id, actorRole: role }] });
      expect(result.ok).toBe(canOverrideFundingSource(role));
    }
    for (const role of ["patient", "advocate"]) expect(() => AdelanteEHR.setAppointmentFundingSource(appointment.id, { source: "private_pay", reasonCode: "coverage_updated", actorId: "member", actorRole: role as never })).toThrow();
    expect(appointment.status).toBe(beforeStatus);
    expect(() => AdelanteEHR.setAppointmentFundingSource(appointment.id, { source: "private_pay", reasonCode: "" as never, actorId: "s-bill1", actorRole: "billing" })).toThrow();
  });

  it("Intake funding list stays empty for non-Intake roles and invalid/referral-less context", () => {
    for (const { key: role } of STAFF_ROLES) expect(intakeFundingAppointments({ role, staffId: staffForRole(role)[0]?.id }, "missing")).toEqual([]);
  });

  it("Intake sees only its active referral first-visit funding; handoff removes the editor", () => {
    const actor = { role: "intake_coordinator" as const, staffId: "s-admin1" };
    const seeded = runAction("intake_demo_seed", actor, undefined, { args: [actor] });
    expect(seeded.ok).toBe(true);
    const referral = AdelanteEHR.listReferrals().find(r => r.email === "phase-a-ready@example.invalid");
    if (!referral?.enrolledPatientId) throw new Error("Missing linked intake fixture");
    const slot = firstVisitSlots(referral.id, "care_manager", actor, "in_person").find(s => s.clinicianId === "s-cm2");
    if (!slot) throw new Error("Missing real care-manager slot");
    const booked = runAction<{ id: string }>("intake_first_visit_book", actor, undefined, { args: [actor, referral.id, { kind: "care_manager", clinicianId: slot.clinicianId, start: slot.start, modality: "in_person", locationId: "loc-visalia" }, "First contact"] });
    expect(booked.ok).toBe(true);
    if (!booked.ok) throw new Error(booked.reason);
    const views = intakeFundingAppointments(actor, referral.id);
    expect(views.map(a => a.id)).toEqual([booked.value.id]);
    expect(Object.keys(views[0]).sort()).toEqual(["fundingSource", "id", "start"]);
    const updated = runAction("appointment_funding_set", actor, undefined, { args: [booked.value.id, { source: "grant_or_county_funded", reasonCode: "program_enrollment", actorId: actor.staffId, actorRole: actor.role }] });
    expect(updated.ok).toBe(true);
    expect(intakeFundingAppointments(actor, referral.id)[0]?.fundingSource?.source).toBe("grant_or_county_funded");
    markIntakeComplete(actor, referral.id, { identity_link_checked: true, contact_checked: true, packet_received: true, handoff_ready: true }, "Ready to hand off");
    expect(intakeFundingAppointments(actor, referral.id)).toEqual([]);
  });
});