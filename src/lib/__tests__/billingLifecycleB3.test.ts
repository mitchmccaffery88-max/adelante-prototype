import "@/test/freezeClock";
import { describe, expect, it, vi } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { AdelanteEHRExt } from "@/lib/ehr-ext";
import { BILLING_LIFECYCLE_KEYS, buildBillingLifecycleScenario, loadBillingLifecycleScenario } from "@/lib/billingLifecycleScenario";
import { medicalNecessityGate } from "@/lib/dmcOdsReadiness";
import { getBillingCode, unitsFor } from "@/lib/rates";

describe("B3a opt-in billing lifecycle", () => {
  it("uses public creators and stable keys, with rate-derived charges and repeatable states", () => {
    const create = vi.spyOn(AdelanteEHR, "createPatient");
    const book = vi.spyOn(AdelanteEHR, "bookAppointment");
    const attend = vi.spyOn(AdelanteEHR, "markAppointmentAttended");
    const transition = vi.spyOn(AdelanteEHRExt, "transitionClaim");
    const actionAudit = vi.spyOn(AdelanteEHR, "recordActionEvent");
    const before = AdelanteEHR.listPatients().length;
    const first = buildBillingLifecycleScenario();
    const second = buildBillingLifecycleScenario();
    expect(AdelanteEHR.listPatients().length - before).toBe(14);
    expect(create).toHaveBeenCalledTimes(14);
    expect(book).toHaveBeenCalledTimes(14);
    expect(attend).toHaveBeenCalledTimes(14);
    expect(transition).toHaveBeenCalled();
    expect(actionAudit.mock.calls.filter(([event]) => event.detail?.["storeFn"] === "saveAsamDraft").length).toBe(2);
    expect(actionAudit.mock.calls.filter(([event]) => event.detail?.["storeFn"] === "signAsam").length).toBe(2);
    expect(actionAudit.mock.calls.filter(([event]) => event.detail?.["storeFn"] === "cosignAsam").length).toBe(2);
    const states = ["paid", "submitted", "denied", "generated", "documented", "generated", "generated"];
    for (const [index, key] of BILLING_LIFECYCLE_KEYS.entries()) {
      const a = AdelanteEHRExt.listClaims().find(c => c.id === first[key].claimId);
      const b = AdelanteEHRExt.listClaims().find(c => c.id === second[key].claimId);
      if (!a || !b) throw new Error("Missing scenario claim");
      const code = getBillingCode(a.serviceCode ?? "");
      if (!code) throw new Error("Missing rate-table code");
      expect(a.units).toBe(unitsFor(code, 45));
      expect(a.chargeCents).toBe((a.rateCentsPerUnit ?? 0) * (a.units ?? 0));
      expect(a.chargeCents).toBeGreaterThan(0);
      expect(b.chargeCents).toBe(a.chargeCents);
      expect(a.state).toBe(states[index]);
      expect(b.state).toBe(a.state);
      expect(first[key].patientId).not.toBe(second[key].patientId);
      expect(AdelanteEHR.getPatient(a.patientId)?.dob).toBe("");
      expect(AdelanteEHR.getPatient(a.patientId)?.cin).toBeUndefined();
    }
    const receipt = AdelanteEHRExt.listClaims().find(c => c.id === first.receipt_balance.claimId);
    expect(receipt?.patientBalanceCents).toBe(8250);
    expect(receipt?.patientPaidCents).toBe(8250);
    const paid = AdelanteEHRExt.listClaims().find(c => c.id === first.paid.claimId);
    expect(paid?.patientBalanceCents).toBe(0);
    const dmc = AdelanteEHRExt.listClaims().find(c => c.id === first.dmc_ods.claimId);
    if (!dmc) throw new Error("Missing documentation-ready claim");
    expect(medicalNecessityGate(dmc)).toMatchObject({ applies: true, ok: true });
    expect(AdelanteEHR.getPatient(dmc.patientId)?.asamAssessments?.[0]).toMatchObject({ status: "signed", diagnosisCodes: ["F15.20"], cosignedById: "s-th1" });
    vi.restoreAllMocks();
  });

  it("reloads the existing cohort rather than adding records", () => {
    const first = loadBillingLifecycleScenario();
    const count = AdelanteEHR.listPatients().length;
    expect(loadBillingLifecycleScenario()).toBe(first);
    expect(AdelanteEHR.listPatients().length).toBe(count);
  });
});