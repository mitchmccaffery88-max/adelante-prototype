// 29 Oct (Mitch, Draft — pending billing/compliance review with Christi).
import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { resolveFundingSourceFrom, seriesOccurrences, SERIES_DRAFT, type FundingCoverageSpan, FUNDING_FLAG_LABEL, SLIDING_SCALE_FEE_LABEL } from "@/lib/fundingSource";
import { evaluateCredentialing, credentialingReasonLabel, type ClinicianCredentialing } from "@/lib/credentialing";
import { APPOINTMENT_KEYS, projectBillingAppointment } from "@/lib/billingProjection";
import { groupSessionFundingReview } from "@/lib/groupFunding";
import { loadCoverageMixScenario } from "@/lib/coverageMixScenario";
import { CHART_ACTIONS } from "@/lib/chartActions";
import { STAFF_ROLES } from "@/lib/roles";
import { canOverrideFundingSource } from "@/lib/fundingSource";
import { canScheduleRole } from "@/lib/bookingRights";

const DOS = "2030-06-15";
const at = (d: number) => new Date(Date.now() + d * 86400000).toISOString();
const mcp: FundingCoverageSpan = { id: "s-mcp", payer: "Health Net Medi-Cal", from: "2020-01-01", planType: "medi_cal_mcp" };
const ffs: FundingCoverageSpan = { id: "s-ffs", payer: "Medi-Cal FFS", from: "2020-01-01" };
const comm: FundingCoverageSpan = { id: "s-com", payer: "Demo PPO", from: "2020-01-01", planType: "commercial" };
const r = (serviceType: string, tag: never, coverage: FundingCoverageSpan[], extra: object = {}) => resolveFundingSourceFrom({ serviceType, dateOfService: DOS, coverage, tag, ...extra });

describe("resolveFundingSource (Draft)", () => {
  it("routes each Draft tag", () => {
    expect(r("therapy_individual", "smhs_or_nsmhs" as never, [mcp]).source).toBe("medi_cal_mcp");
    expect(r("therapy_individual", "smhs_or_nsmhs" as never, [ffs]).source).toBe("medi_cal_ffs");
    expect(r("med_management", "nsmhs" as never, [mcp]).source).toBe("medi_cal_mcp");
    expect(r("sud_counseling", "county_dmc_ods" as never, [mcp])).toMatchObject({ source: "county_dmc_ods", payerKey: "Tulare County DMC-ODS" });
    expect(r("controlled_med_moud", "county_dmc_ods" as never, [mcp]).flags).toContain("delivery_system_review");
    expect(r("care_coordination", "non_billable" as never, [mcp]).source).toBe("non_billable");
    expect(r("peer_support", "county_peer" as never, [mcp]).source).toBe("non_billable"); // county opt-in not confirmed
    expect(r("case_management", "ecm_mcp" as never, [mcp], { ecmEnrolled: true }).source).toBe("medi_cal_mcp");
    expect(r("case_management", "ecm_mcp" as never, [mcp]).source).toBe("non_billable");
  });
  it("uses the dated clinician SMHS determination, never inference", () => {
    const smhs = { meets: true, determinedAt: "2030-01-01", determinedBy: "x" };
    expect(r("therapy_individual", "smhs_or_nsmhs" as never, [mcp], { smhs })).toMatchObject({ source: "county_mhp", payerKey: "Tulare County MHP" });
    expect(r("therapy_individual", "smhs_or_nsmhs" as never, [mcp], { smhs: { ...smhs, determinedAt: "2031-01-01" } }).source).toBe("medi_cal_mcp");
    expect(r("med_management", "nsmhs" as never, [mcp], { smhs }).source).toBe("medi_cal_mcp");
  });
  it("Medi-Cal is payer of last resort, with a COB flag", () => {
    const res = r("therapy_individual", "smhs_or_nsmhs" as never, [{ ...mcp, order: "primary" }, comm]);
    expect(res).toMatchObject({ source: "commercial", coverageId: "s-com" });
    expect(res.flags).toContain("cob_review");
    expect(FUNDING_FLAG_LABEL.cob_review).toBe("Coordination of benefits — review");
    expect(r("therapy_individual", "smhs_or_nsmhs" as never, [{ id: "m", payer: "Medicare", from: "2020-01-01" }]).flags).toContain("medicare_review");
  });
  it("missing coverage: private pay when chosen, grant when funded, otherwise needs review", () => {
    expect(r("therapy_individual", "smhs_or_nsmhs" as never, [], { paymentArrangement: "self_pay" }).source).toBe("private_pay");
    expect(r("therapy_individual", "smhs_or_nsmhs" as never, [], { paymentArrangement: "grant_isl" }).source).toBe("grant_or_county_funded");
    const none = r("therapy_individual", "smhs_or_nsmhs" as never, []);
    expect(none.source).toBeUndefined();
    expect(none.reason).toBe("Coverage — needs review");
    expect(SLIDING_SCALE_FEE_LABEL).toBe("Fee: per sliding scale (Draft — tiers pending)");
  });
  it("every catalog entry carries a Draft delivery-system tag", () => {
    for (const s of AdelanteEHR.listServiceTypes()) expect(s.deliverySystemDraft.tag).toBeTruthy();
  });
});

const base = (over: Partial<ClinicianCredentialing> = {}): ClinicianCredentialing => ({
  staffId: "s-th1", clinicianId: "c1",
  license: { licenseType: "LCSW", number: "L", state: "CA", verifiedAt: "2020-01-01", expiresAt: "2040-01-01", method: "manual" },
  exclusionChecks: (["oig", "sam_gov", "medi_cal_suspended"] as const).map((list) => ({ list, checkedAt: "2030-06-01", result: "clear" as const, nextDueAt: "2030-07-01" })),
  enrollments: [{ payer: "Tulare County MHP", serviceType: "*", status: "active" }],
  documentStatus: "on_file", ...over,
});
const q = (fundingSource: never, payer?: string, over: object = {}) => ({ payer, serviceType: "therapy_individual", dateOfService: DOS, asOf: DOS, fundingSource, ...over });

describe("what gets checked, by funding source", () => {
  it("private pay checks license, supervision and exclusion but never enrollment", () => {
    expect(evaluateCredentialing(base({ enrollments: [] }), q("private_pay" as never))).toEqual({ ok: true });
    expect(evaluateCredentialing(base({ license: { ...base().license!, expiresAt: "2030-01-01" } }), q("private_pay" as never))).toEqual({ ok: false, reasons: ["license_expired"] });
    const ex = evaluateCredentialing(base({ exclusionChecks: [] }), q("private_pay" as never));
    expect(ex.ok ? [] : ex.reasons).toContain("exclusion_check_overdue");
    expect(credentialingReasonLabel("exclusion_check_overdue", "private_pay")).toContain("Adelante policy (Draft)");
    const reg = base({ license: undefined, registration: { registrationType: "ASW", number: "R", verifiedAt: "2020-01-01", expiresAt: "2040-01-01" } });
    const res = evaluateCredentialing({ ...reg, staffId: "s-tr1" }, q("private_pay" as never));
    expect(res.ok ? [] : res.reasons).toEqual(["supervision_missing"]);
  });
  it("commercial out-of-network flags without blocking; Medicare flags for review", () => {
    expect(evaluateCredentialing(base(), q("commercial" as never, "Demo PPO"))).toEqual({ ok: true, flags: ["out_of_network_review"] });
    expect(evaluateCredentialing(base(), q("medicare" as never, "Medicare"))).toEqual({ ok: true, flags: ["medicare_review"] });
  });
  it("a Medi-Cal service routed to the county MHP checks MHP enrollment, not the plan's", () => {
    expect(evaluateCredentialing(base(), q("county_mhp" as never, "Tulare County MHP"))).toEqual({ ok: true });
    const planOnly = base({ enrollments: [{ payer: "Health Net Medi-Cal", serviceType: "*", status: "active" }] });
    expect(evaluateCredentialing(planOnly, q("county_mhp" as never, "Tulare County MHP"))).toEqual({ ok: false, reasons: ["payer_not_enrolled"] });
  });
  it("non-billable gets no credential check", () => {
    expect(evaluateCredentialing(undefined, q("non_billable" as never))).toEqual({ ok: true });
  });
  it("peer, CHW and ECM credentials are checked only when billable", () => {
    const peer = base({ staffId: "s-peer1", license: undefined, enrollments: [] });
    expect(evaluateCredentialing(peer, q("non_billable" as never))).toEqual({ ok: true });
    expect(evaluateCredentialing(peer, q("county_mhp" as never, "Tulare County MHP"))).toEqual({ ok: false, reasons: ["peer_certification_missing", "supervising_provider_missing"] });
    const certified = { ...peer, peerCertification: { number: "P", issuingBody: "Demo board", expiresAt: "2031-01-01" }, supervisingProviderStaffId: "s-th1" };
    expect(evaluateCredentialing(certified, q("county_mhp" as never, "Tulare County MHP"))).toEqual({ ok: true });
    const chw = base({ staffId: "s-chw1", license: undefined, enrollments: [] });
    expect(evaluateCredentialing(chw, q("medi_cal_mcp" as never, "Health Net Medi-Cal"))).toEqual({ ok: false, reasons: ["chw_qualification_missing", "supervising_provider_missing"] });
    const ecm = base({ staffId: "s-cm1", license: undefined, enrollments: [], ecmTraining: { attestedAt: "2030-01-01" } });
    expect(evaluateCredentialing(ecm, q("medi_cal_mcp" as never, "Health Net Medi-Cal"))).toEqual({ ok: true });
    expect(evaluateCredentialing(ecm, q("medi_cal_mcp" as never, "Anthem Blue Cross Medi-Cal"))).toEqual({ ok: false, reasons: ["ecm_contract_missing"] });
  });
});

describe("groups with mixed payers", () => {
  it("flags only the affected member; a non-billable group never blocks", () => {
    const session = { id: "g", facilitatorId: "c1", serviceType: "therapy_group", start: at(7) };
    const resolve = (pid: string) => (pid === "a" ? { source: "county_mhp" as const, payerKey: "Tulare County MHP", flags: [] } : pid === "b" ? { source: "commercial" as const, payerKey: "Demo PPO", flags: [] } : { source: "private_pay" as const, flags: [] });
    const review = groupSessionFundingReview(session, ["a", "b", "c"], { resolve, asOf: new Date().toISOString() });
    expect(review.members.map((m) => [m.patientId, m.billingReview])).toEqual([["a", false], ["b", true], ["c", false]]);
    expect(review.facilitatorNote).toBe("Billing review needed for 1 member");
    expect(review.facilitatorNote).not.toMatch(/commercial|PPO|Medi-Cal/i);
    expect(groupSessionFundingReview({ ...session, billable: false }, ["a", "b"], { resolve }).flaggedCount).toBe(0);
  });
});

describe("recurring series (staff only)", () => {
  it("weekly/biweekly by count or end date, capped at the Draft maximum", () => {
    expect(SERIES_DRAFT.maxVisitsPerSeries).toBe(26);
    expect(seriesOccurrences({ firstStart: "2030-01-07T17:00:00Z", cadence: "weekly", count: 3 })).toEqual(["2030-01-07T17:00:00.000Z", "2030-01-14T17:00:00.000Z", "2030-01-21T17:00:00.000Z"]);
    expect(seriesOccurrences({ firstStart: "2030-01-07T17:00:00Z", cadence: "biweekly", endDate: "2030-02-04" })).toHaveLength(3);
    expect(seriesOccurrences({ firstStart: "2030-01-07T17:00:00Z", cadence: "weekly", endDate: "2031-12-31" })).toHaveLength(26);
  });
  it("books allowed occurrences, lists blocked ones, one audit row per occurrence", () => {
    // c3's DEA expires in 20 days (demo): weekly MOUD visits after that are blocked.
    const p = AdelanteEHR.listPatients().find((x) => x.id === "p1")!;
    const first = new Date(at(3)); first.setUTCHours(17, 0, 0, 0);
    const before = AdelanteEHR.listAuditEvents({ category: "clinical" }).filter((e) => e.action.startsWith("appointment_series_occurrence")).length;
    const res = AdelanteEHR.bookAppointmentSeries({ patientId: p.id, clinicianId: "c3", firstStart: first.toISOString(), cadence: "weekly", count: 6, durationMin: 30, serviceType: "controlled_med_moud", modality: "in_person", locationId: "loc-visalia", allowPatientOverlap: true, bookedBy: { id: "s-cc1", role: "clinical_coordinator" } });
    expect(res.booked.length + res.blocked.length).toBe(6);
    expect(res.blocked.length).toBeGreaterThan(0);
    expect(res.blocked.every((b) => b.start > at(19))).toBe(true);
    expect(res.blocked.some((b) => b.reason === "This clinician can't be booked for this service right now.")).toBe(true);
    expect(res.booked.every((a) => a.seriesId === res.seriesId)).toBe(true);
    const after = AdelanteEHR.listAuditEvents({ category: "clinical" }).filter((e) => e.action.startsWith("appointment_series_occurrence")).length;
    expect(after - before).toBe(6);
  });
  it("never patient self-scheduling", () => {
    expect(() => AdelanteEHR.bookAppointmentSeries({ patientId: "p1", clinicianId: "c1", firstStart: at(3), cadence: "weekly", count: 2, durationMin: 50, serviceType: "therapy_individual", source: "self_scheduled" })).toThrow();
    expect(() => AdelanteEHR.bookAppointmentSeries({ patientId: "p1", clinicianId: "c1", firstStart: at(3), cadence: "weekly", count: 2, durationMin: 50, serviceType: "therapy_individual", bookedBy: { id: "p1", role: "patient" } })).toThrow();
  });
});

describe("billing projection and roles", () => {
  it("adds only the funding-source value; no note text, no clinical fields", () => {
    const a = { id: "x", patientId: "p", clinicianId: "c1", start: at(5), durationMin: 50, status: "scheduled", source: "staff_scheduled", notes: "secret note", fundingSource: { source: "commercial", flags: ["cob_review"], set: "resolved" } } as never;
    const b = projectBillingAppointment(a);
    expect(Object.keys(b).every((k) => (APPOINTMENT_KEYS as readonly string[]).includes(k))).toBe(true);
    expect(JSON.stringify(b)).not.toContain("secret note");
    expect(b.fundingSource).toEqual({ source: "commercial", flags: ["cob_review"], set: "resolved" });
  });
  it("booking stores the resolved source; only Billing/Intake change it, ids-only audit", () => {
    const appt = AdelanteEHR.listAppointments().find((x) => x.status === "scheduled" && x.fundingSource)!;
    expect(appt.fundingSource!.set).toBe("resolved");
    expect(() => AdelanteEHR.setAppointmentFundingSource(appt.id, { source: "private_pay", reasonCode: "payer_confirmed", actorId: "s-th1", actorRole: "therapist" })).toThrow();
    AdelanteEHR.setAppointmentFundingSource(appt.id, { source: "private_pay", reasonCode: "payer_confirmed", actorId: "s-bill1", actorRole: "billing" });
    const ev = AdelanteEHR.listAuditEvents({ category: "clinical" }).filter((e) => e.action === "appointment_funding_source_changed").at(-1)!;
    expect(Object.keys(ev.detail ?? {}).sort()).toEqual(["apptId", "from", "reasonCode", "to"]);
  });
  it("buttons match the store for all 18 roles", () => {
    expect(STAFF_ROLES.length).toBe(18);
    const find = (id: string) => CHART_ACTIONS.find((a) => a.id === id)!;
    for (const role of STAFF_ROLES) {
      const ctx = { role, staffId: "x" } as never;
      expect(find("appointment_funding_set").allowed(ctx, undefined as never).state === "allowed").toBe(canOverrideFundingSource(role));
      expect(find("schedule_visit_series").allowed(ctx, undefined as never).state === "allowed").toBe(canScheduleRole(role));
    }
  });
});

describe("demo scenario (opt-in)", () => {
  it("shows the mix through real creators", () => {
    const s = loadCoverageMixScenario();
    const src = (k: keyof typeof s.patients, svc: string) => AdelanteEHR.listServiceTypes() && resolveFor(s.patients[k], svc);
    expect(src("mcp_smhs", "therapy_individual")).toBe("county_mhp");
    expect(src("mcp_smhs", "med_management")).toBe("medi_cal_mcp");
    expect(src("dmc_ods_moud", "controlled_med_moud")).toBe("county_dmc_ods");
    expect(src("commercial_cob", "therapy_individual")).toBe("commercial");
    expect(src("private_pay", "therapy_individual")).toBe("private_pay");
    expect(src("grant_reentry", "therapy_individual")).toBe("grant_or_county_funded");
    expect(new Set(s.group.review.members.map((m) => m.source)).size).toBe(3);
  });
});

import { resolveFundingSource } from "@/lib/fundingSource";
function resolveFor(pid: string, svc: string) {
  return resolveFundingSource(pid, svc, new Date().toISOString()).source;
}
