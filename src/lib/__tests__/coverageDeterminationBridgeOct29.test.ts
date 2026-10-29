import { afterEach, describe, expect, it } from "vitest";
import { AdelanteEHR } from "../ehr";
import { runAction } from "../actions/runAction";
import { createCoverageRequest, billingRunCoverageCheck, billingCoverageDetail, determinedFundingFacts } from "../coverageRequests";
import { resolveFundingSource } from "../fundingSource";
import { configureEligibilityAdapter, resetEligibilityAdapterConfig } from "../eligibility/coverageConfig";
import { registerCoverageAdapter } from "../eligibility/coverageAdapters";

const actor = { role: "billing" as const, staffId: "s-bill1" };
const reason = "coverage_updated";
let seq = 0;
function patient() {
  const p = AdelanteEHR.createPatient({ firstName: "Fictional", lastName: `Bridge${++seq}`, matchSource: "seed" });
  return p;
}
function call(id: string, ...args: unknown[]) {
  const result = runAction(id, actor, undefined, { args: [actor, ...args, reason], auditReason: reason });
  expect(result.ok).toBe(true);
  return result;
}
afterEach(() => resetEligibilityAdapterConfig());
describe("coverage determinations feed the single funding resolver", () => {
  it("uses acknowledged self-pay, not a separate payment choice", () => {
    const p = patient();
    const key = `bridge:self:${p.id}`;
    createCoverageRequest({ key, patientId: p.id, path: "self_pay", actor });
    call("billing_coverage_self_pay", key, { feeScheduleId: "self_pay_standard", acknowledged: true });
    expect(resolveFundingSource(p.id, "therapy_individual", new Date().toISOString()).source).toBe("private_pay");
    expect(resolveFundingSource(p.id, "therapy_individual", "2020-01-01").source).toBeUndefined();
  });
  it("uses Billing order, COB, effective dates, and no financial payload", async () => {
    const p = patient();
    registerCoverageAdapter({ channel: "external_billing", simulated: true, check: async () => ({ outcome: "active", channel: "external_billing", simulated: true, effectiveFrom: "2020-01-01", effectiveTo: "2035-01-01", financial: { copayCents: 123 } }) });
    configureEligibilityAdapter({ selected: "external_billing" });
    for (const [suffix, path, payerId] of [["mc", "medi_cal", "medi-cal-ffs"], ["com", "private", "commercial-other"], ["med", "medicare", "medicare-original"]] as const) {
      const key = `bridge:${suffix}:${p.id}`;
      createCoverageRequest({ key, patientId: p.id, path, actor });
      await billingRunCoverageCheck(actor, key, { payerId }, reason);
    }
    const current = billingCoverageDetail(actor, p.id);
    const medicare = current.find(d => d.path === "medicare");
    if (!medicare) throw new Error("Missing Medicare fixture");
    call("billing_coverage_order", p.id, [medicare.id, ...current.filter(d => d.id !== medicare.id).map(d => d.id)], "");
    const result = resolveFundingSource(p.id, "therapy_individual", new Date().toISOString());
    expect(result).toMatchObject({ source: "medicare", coverageId: medicare.id });
    expect(result.flags).toContain("cob_review");
    expect(result.flags).toContain("medicare_review");
    expect(JSON.stringify(determinedFundingFacts(p.id, new Date().toISOString()))).not.toMatch(/financial|copay|memberId|cobNote/);
    expect(resolveFundingSource(p.id, "therapy_individual", "2036-01-01").source).toBeUndefined();
    expect(resolveFundingSource(p.id, "care_coordination", "2036-01-01").source).toBe("non_billable");
  });
});