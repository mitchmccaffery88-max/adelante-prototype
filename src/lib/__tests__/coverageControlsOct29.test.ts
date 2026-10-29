import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { STAFF_ROLES, staffForRole } from "@/lib/roles";
import { runAction } from "@/lib/actions/runAction";
import { chartEntryFor, openChartWithReason } from "@/lib/chartAccess";
import { getStructuredPlan, canRecordSmhsDetermination, setSmhsDetermination } from "@/lib/structuredCarePlan";
import { canOverrideFundingSource } from "@/lib/fundingSource";
import { intakeFundingAppointments } from "@/lib/fundingAppointmentView";
import { loadCoverageMixScenario } from "@/lib/coverageMixScenario";

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
    const audit = AdelanteEHR.listAuditEvents().filter(e => e.action === "plan_smhs_determination_set" && e.patientId === patientId).at(-1);
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
});