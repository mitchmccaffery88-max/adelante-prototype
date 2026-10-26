import { afterEach, describe, expect, it } from "vitest";
import { AdelanteEHR } from "../ehr";
import { runAction } from "../actions/runAction";
import { CHART_ACTIONS } from "../chartActions";
import { canAccess } from "../roles";
import { intakeCoveragePath, intakeCoverageResult, careTeamRequestCoverage, careTeamCoverage } from "../intakePhaseB";
import { billingCoverageDetail, coverageProjection, sweepCoverageReverification, patientCoverageSummary, billingRunCoverageCheck } from "../coverageRequests";
import { COVERAGE_PATHS, configureEligibilityAdapter, getAdapterConfig, resetEligibilityAdapterConfig, setSlidingTable, getSlidingTable, slidingTierFor, nextCheckDate, setPayers, listPayers, type CoveragePath } from "../eligibility/coverageConfig";
import { registerCoverageAdapter, selectedAdapter, PAYER_UNREACHABLE } from "../eligibility/coverageAdapters";

const intake = { role: "intake_coordinator" as const, staffId: "s-admin1" };
const billing = { role: "billing" as const, staffId: "s-bill1" };
const R = "Coverage fixture reason";
let n = 0;
function referral() {
  const r = AdelanteEHR.createReferral({ firstName: "Cov", lastName: `Path${++n}`, dob: "1988-02-03", email: `cov-${n}@example.invalid`, referrerName: "Test", referralSource: "other", consentToContact: false, channel: "public", intakeServices: { source: "referral", kinds: ["assessment"] } });
  AdelanteEHR.enrollReferral(r.id, { websiteSignup: true });
  return AdelanteEHR.listReferrals().find((x) => x.id === r.id)!;
}
const request = (id: string, path: CoveragePath, programId?: string) => runAction("intake_eligibility_request", intake, undefined, { args: [intake, id, R, path, programId], auditReason: R });
const bill = (id: string, ...args: unknown[]) => runAction(id, billing, undefined, { args: [billing, ...args, R], auditReason: R });
const FORBIDDEN = ["memberId", "groupNumber", "financial", "income", "annualIncomeCents", "tierId", "feeScheduleId", "screening", "cobNote", "billing", "transactionRef", "verifications"];
const taskFor = (id: string) => AdelanteEHR.listCaseTasks().find((t) => t.dedupeKey === `intake-eligibility:${id}`);

afterEach(() => resetEligibilityAdapterConfig());

describe("26 Oct coverage paths — one request type, many paths", () => {
  const titles: Record<CoveragePath, string> = {
    medi_cal: "Medi-Cal status check requested",
    medicare: "Medicare coverage check requested",
    county_program: "County program coverage check requested",
    private: "Private insurance check requested",
    self_pay: "Self-pay acknowledgment requested",
    sliding_scale: "Sliding-scale screening requested",
    uninsured_apply: "Coverage check requested — uninsured",
    unknown: "Coverage path to determine",
  };
  it.each(COVERAGE_PATHS.map((p) => p.id))("%s creates the right Billing task and a Pending coverage-only projection", (path) => {
    const r = referral();
    expect(request(r.id, path, path === "county_program" ? "dmc_ods_county" : undefined).ok).toBe(true);
    const t = taskFor(r.id);
    expect(t?.title).toBe(titles[path]);
    expect(t?.allowedRoles).toEqual(["billing", "billing_coordinator"]);
    const p = intakeCoveragePath(intake, r.id);
    expect(p.status).toBe("Pending");
    expect(p.path).toBe(path);
    expect(Object.keys(p).every((k) => ["path", "pathLabel", "status", "checkedOn", "nextCheckOn", "notice"].includes(k))).toBe(true);
  });

  it("county program must come from the configured list", () => {
    const r = referral();
    expect(request(r.id, "county_program").ok).toBe(false);
    expect(request(r.id, "county_program", "not_a_program").ok).toBe(false);
    expect(request(r.id, "county_program", "realignment_ab109").ok).toBe(true);
    expect(intakeCoveragePath(intake, r.id).pathLabel).toBe("Realignment / AB 109");
  });

  it("uninsured path also creates a Medi-Cal application assistance task, then shows Application in progress", () => {
    const r = referral();
    request(r.id, "uninsured_apply");
    expect(AdelanteEHR.listCaseTasks().some((t) => t.title === "Medi-Cal application assistance" && t.dedupeKey === `coverage-application:${r.id}`)).toBe(true);
    expect(bill("billing_coverage_application", r.id).ok).toBe(true);
    expect(intakeCoverageResult(intake, r.id).status).toBe("Application in progress");
  });

  it("self-pay records acknowledgment + fee schedule without running a check", () => {
    const r = referral();
    request(r.id, "self_pay");
    expect(bill("billing_coverage_run", r.id, {}).ok).toBe(true); // runs, but the store refuses a path with no check
    expect(bill("billing_coverage_self_pay", r.id, { feeScheduleId: "self_pay_standard", acknowledged: false }).ok).toBe(false);
    expect(bill("billing_coverage_self_pay", r.id, { feeScheduleId: "self_pay_standard", acknowledged: true }).ok).toBe(true);
    const p = intakeCoveragePath(intake, r.id);
    expect(p.status).toBe("Self-pay");
    expect(p.nextCheckOn).toBeUndefined();
  });

  it("sliding-scale tier comes from the configurable table; income stays Billing-only", () => {
    const r = referral();
    request(r.id, "sliding_scale");
    const t = getSlidingTable();
    // household of 1 at exactly the poverty base → first tier (≤100%)
    const res = bill("billing_coverage_sliding", r.id, { householdSize: 1, annualIncomeCents: t.povertyBaseCents, documentation: "attested" });
    expect(res.ok && (res.value as { tierId: string }).tierId).toBe("tier_a");
    const p = intakeCoveragePath(intake, r.id);
    expect(p.status).toBe("Sliding scale — tier set");
    expect(JSON.stringify(p)).not.toMatch(/tier_a|Tier A|attested|\d{6,}/);
    for (const k of FORBIDDEN) expect(Object.keys(p)).not.toContain(k);
    expect(billingCoverageDetail(billing, r.enrolledPatientId!)[0]?.billing.screening?.annualIncomeCents).toBe(t.povertyBaseCents);
    expect(billingCoverageDetail(intake as never, r.enrolledPatientId!)).toEqual([]);
    // changing the table changes the tier — no code change
    setSlidingTable({ ...t, tiers: [{ id: "only", label: "Only", maxPercentOfPoverty: null }] });
    expect(slidingTierFor(1, t.povertyBaseCents).id).toBe("only");
    setSlidingTable(t);
    expect(slidingTierFor(4, 10_000_000_00).id).toBe("full_fee");
  });

  it("private details are Billing-collected; Intake projection shows no member ID or financial fields", async () => {
    const r = referral();
    request(r.id, "private");
    expect(runAction("billing_coverage_insurance", intake, undefined, { args: [intake, r.id, { payerId: "commercial-other", memberId: "M1", subscriberRelationship: "self" }, R] }).ok).toBe(false);
    expect(bill("billing_coverage_insurance", r.id, { payerId: "commercial-other", memberId: "MEMBER-777", groupNumber: "G-9", subscriberRelationship: "self" }).ok).toBe(true);
    registerCoverageAdapter({ channel: "external_billing", simulated: true, check: async () => ({ outcome: "active", channel: "external_billing", simulated: true, planName: "Plan", financial: { copayCents: 1, deductibleCents: 2, outOfPocketMaxCents: 3 } }) });
    configureEligibilityAdapter({ selected: "external_billing" });
    await billingRunCoverageCheck(billing, r.id, {}, R);
    const p = intakeCoveragePath(intake, r.id);
    expect(p.status).toBe("Active");
    expect(JSON.stringify(p)).not.toMatch(/MEMBER-777|G-9|copay|deductible/);
    expect(billingCoverageDetail(billing, r.enrolledPatientId!)[0]?.billing).toMatchObject({ memberId: "MEMBER-777", groupNumber: "G-9", financial: { copayCents: 1 } });
    expect(canAccess(intake.role, "eligibility").level).toBe("none");
    expect(canAccess(intake.role, "billing").level).toBe("none");
  });

  it("unknown path: Billing determines the real path", () => {
    const r = referral();
    request(r.id, "unknown");
    expect(runAction("billing_coverage_path", intake, undefined, { args: [intake, r.id, "self_pay", undefined, R] }).ok).toBe(false);
    expect(bill("billing_coverage_path", r.id, "self_pay", undefined).ok).toBe(true);
    expect(intakeCoveragePath(intake, r.id).pathLabel).toBe("Self-pay");
  });

  it("secondary coverage ordering is Billing-only and reorders primary/secondary", () => {
    const r = referral();
    const pid = r.enrolledPatientId!;
    request(r.id, "sliding_scale");
    bill("billing_coverage_sliding", r.id, { householdSize: 2, annualIncomeCents: 100, documentation: "received" });
    const ct = { role: "billing" as const, staffId: "s-bill1" };
    // a second (care-team style) request for the same person, processed as self-pay
    const key = `patient:${pid}`;
    const { createCoverageRequest } = require("../coverageRequests") as typeof import("../coverageRequests");
    createCoverageRequest({ key, patientId: pid, path: "self_pay", actor: ct });
    bill("billing_coverage_self_pay", key, { feeScheduleId: "self_pay_standard", acknowledged: true });
    const before = billingCoverageDetail(billing, pid);
    expect(before.map((d) => d.rank)).toEqual(["primary", "secondary"]);
    expect(before[0]?.path).toBe("sliding_scale");
    expect(runAction("billing_coverage_order", intake, undefined, { args: [intake, pid, before.map((d) => d.id).reverse(), "", R] }).ok).toBe(false);
    expect(bill("billing_coverage_order", pid, [before[0]!.id], "").ok).toBe(false); // must order every coverage
    expect(bill("billing_coverage_order", pid, before.map((d) => d.id).reverse(), "Secondary pays after primary EOB").ok).toBe(true);
    const after = billingCoverageDetail(billing, pid);
    expect(after[0]?.path).toBe("self_pay");
    expect(after[0]?.billing.cobNote).toBe("Secondary pays after primary EOB");
    expect(JSON.stringify(intakeCoveragePath(intake, r.id))).not.toContain("EOB");
  });

  it("re-verification tasks fire on the next-check date, once", async () => {
    const r = referral();
    request(r.id, "medi_cal");
    bill("billing_intake_check", r.id, { channel: "phone_county", result: "verified", statusConfirmed: "active" });
    const p = intakeCoveragePath(intake, r.id);
    expect(p.status).toBe("Active");
    expect(p.nextCheckOn).toBe(nextCheckDate("medi_cal", p.checkedOn!));
    const dayBefore = new Date(Date.parse(`${p.nextCheckOn}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
    const has = () => AdelanteEHR.listCaseTasks().filter((t) => t.dedupeKey === `coverage-recheck:${r.id}:${p.nextCheckOn}`);
    sweepCoverageReverification(dayBefore);
    expect(has()).toHaveLength(0);
    sweepCoverageReverification(p.nextCheckOn);
    sweepCoverageReverification(p.nextCheckOn);
    expect(has()).toHaveLength(1);
    expect(has()[0]?.allowedRoles).toEqual(["billing", "billing_coordinator"]);
  });

  it("cadence: monthly Medi-Cal, next plan year for commercial", () => {
    expect(nextCheckDate("medi_cal", "2026-10-26")).toBe("2026-11-26");
    expect(nextCheckDate("private", "2026-10-26", { payerId: "commercial-other" })).toBe("2027-01-01");
    expect(nextCheckDate("self_pay", "2026-10-26")).toBeUndefined();
  });

  it("clearinghouse is disabled/Simulated by default and switched on only by configuration with a BAA", async () => {
    expect(getAdapterConfig().selected).toBe("manual");
    expect(getAdapterConfig().clearinghouse.enabled).toBe(false);
    expect(CHART_ACTIONS.find((a) => a.id === "billing_coverage_run")?.simulated).toBe(true);
    configureEligibilityAdapter({ selected: "clearinghouse" });
    expect(() => selectedAdapter()).toThrow(/isn't contracted/);
    expect(() => configureEligibilityAdapter({ clearinghouse: { enabled: true, vendor: "Vendor" } })).toThrow(/BAA/);
    configureEligibilityAdapter({ clearinghouse: { enabled: true, vendor: "Vendor", baaOnFile: true } });
    const a = selectedAdapter();
    expect(a.channel).toBe("clearinghouse");
    expect(a.simulated).toBe(true);
    const r = referral();
    request(r.id, "medi_cal");
    const res = await billingRunCoverageCheck(billing, r.id, {}, R);
    expect(res.outcome).toBe("active");
    const ev = AdelanteEHR.listAuditEvents({ patientId: r.enrolledPatientId! }).find((e) => e.action === "coverage_check_run");
    expect(ev?.detail).toMatchObject({ channel: "clearinghouse", simulated: true, requestKey: r.id });
  });

  it("payer error/timeout → Pending with the manual notice and a Billing manual-check task", async () => {
    setPayers([...listPayers().filter((p) => p.kind !== "medi_cal"), { id: "sim-timeout", name: "Slow payer", kind: "commercial", clearinghouseSupported: true, active: true }]);
    configureEligibilityAdapter({ selected: "clearinghouse", clearinghouse: { enabled: true, vendor: "Vendor", baaOnFile: true } });
    const r = referral();
    request(r.id, "private");
    const res = await billingRunCoverageCheck(billing, r.id, { payerId: "sim-timeout" }, R);
    expect(res.notice).toBe(PAYER_UNREACHABLE);
    expect(intakeCoveragePath(intake, r.id)).toMatchObject({ status: "Pending", notice: PAYER_UNREACHABLE });
    expect(AdelanteEHR.listCaseTasks().some((t) => t.dedupeKey === `coverage-manual:${r.id}`)).toBe(true);
  });

  it("default manual adapter never invents a result", async () => {
    const r = referral();
    request(r.id, "medicare");
    const res = await billingRunCoverageCheck(billing, r.id, {}, R);
    expect(res.outcome).toBe("manual_required");
    expect(coverageProjection(r.id).status).toBe("Pending");
  });

  it("audits carry ids only", () => {
    const r = referral();
    request(r.id, "sliding_scale");
    bill("billing_coverage_sliding", r.id, { householdSize: 3, annualIncomeCents: 4_200_000, documentation: "received" });
    const evs = AdelanteEHR.listAuditEvents({ patientId: r.enrolledPatientId! }).filter((e) => e.action.startsWith("coverage_"));
    expect(evs.length).toBeGreaterThan(0);
    expect(JSON.stringify(evs)).not.toMatch(/4200000|received|householdSize/);
  });

  it("patient summary is plain language with no amounts (projection ready, not mounted)", () => {
    const r = referral();
    request(r.id, "sliding_scale");
    bill("billing_coverage_sliding", r.id, { householdSize: 2, annualIncomeCents: 100, documentation: "received" });
    expect(patientCoverageSummary(r.enrolledPatientId!)).toContain("Your coverage: Sliding scale — set up");
    expect(patientCoverageSummary(r.enrolledPatientId!, "es")).toContain("Tu cobertura: Escala móvil — lista");
  });

  it("care team request uses existing coverage access only; Intake and billing-only roles keep their lanes", () => {
    const role = (["ecm_provider", "cf_care_manager", "clinical_coordinator", "front_desk"] as const).find((x) => { const a = canAccess(x, "eligibility"); return a.level !== "none" && !a.locked; });
    const action = CHART_ACTIONS.find((a) => a.id === "care_coverage_request")!;
    expect(action.allowed(intake).state).toBe("hidden");
    expect(action.allowed(billing).state).toBe("hidden");
    if (!role) return; // no care-team role currently has coverage access
    expect(action.allowed({ role } as never).state).not.toBe("hidden");
    expect(() => careTeamRequestCoverage({ role: "intake_coordinator", staffId: "s-admin1" }, referral().enrolledPatientId!, "medi_cal", R)).toThrow();
    expect(careTeamCoverage(intake, referral().enrolledPatientId!)).toBeUndefined();
  });
});
