import { signClaimViaNote } from "@/test/claimSigning";
// §Phase 7c — effective-dated rate table, billing code units, claim pricing.
import { describe, it, expect, beforeEach } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { AdelanteEHRExt, claimUnitLabel } from "@/lib/ehr-ext";
import {
  BILLING_WRITE_REFUSED,
  addRate,
  endDateRate,
  getBillingCode,
  listBillingCodes,
  listRates,
  rateFor,
  selectProgram,
  unitsFor,
  upsertBillingCode,
  type BillingCode,
} from "@/lib/rates";
import { setActingRole, setActingStaff, type StaffRole } from "@/lib/roles";

function actAs(role: string, staffId: string) {
  setActingStaff(staffId);
  setActingRole(role as StaffRole);
}
const audits = (action: string) => AdelanteEHR.listAuditEvents().filter((e) => e.action === action);

let slot = 0;
function freshClaim(durationMin = 30) {
  const c = AdelanteEHR.listClinicians()[0]!;
  const patientId = AdelanteEHR.listPatients()[0]!.id;
  slot += 1;
  const a = AdelanteEHR.bookAppointment({
    patientId,
    clinicianId: c.id,
    start: new Date(Date.now() + 86400_000 * (200 + slot)).toISOString(),
    durationMin,
  });
  AdelanteEHR.updateAppointmentStatus(a.id, "attended");
  return AdelanteEHRExt.claimForEncounter(a.id)!;
}

const per15: BillingCode = { code: "X", description: "x", unitType: "per_minutes", unitMinutes: 15, roundingRule: "half_plus", draft: false };

describe("units", () => {
  it("per-15-minute codes count a unit once more than half is delivered (7 vs 8)", () => {
    expect(unitsFor(per15, 7)).toBe(0);
    expect(unitsFor(per15, 8)).toBe(1);
    expect(unitsFor(per15, 22)).toBe(1);
    expect(unitsFor(per15, 23)).toBe(2);
    expect(unitsFor(per15, 60)).toBe(4);
  });
  it("whole-units-only never rounds up", () => {
    expect(unitsFor({ ...per15, roundingRule: "whole_units" }, 29)).toBe(1);
  });
  it("per-encounter codes are always one unit", () => {
    expect(unitsFor(getBillingCode("90834")!, 5)).toBe(1);
    expect(unitsFor(getBillingCode("90834")!, 90)).toBe(1);
  });
  it("seeds the default-mapping codes as drafts with real unit types", () => {
    expect(getBillingCode("H0004")).toMatchObject({ unitType: "per_minutes", unitMinutes: 15, draft: true });
    expect(getBillingCode("H0001")!.unitType).toBe("per_encounter");
    expect(getBillingCode("G0019")!.needsReview).toBeTruthy();
    expect(listBillingCodes().every((c) => c.draft || c.updatedBy !== "seed")).toBe(true);
  });
});

describe("rate table", () => {
  beforeEach(() => actAs("billing", "s-bill1"));

  it("seeds placeholder rates only", () => {
    expect(listRates().filter((r) => r.createdBy === "seed").every((r) => r.placeholder)).toBe(true);
  });

  it("looks up by effective date, inclusive of both ends", () => {
    expect(addRate({ code: "H0006", program: "smhs", amountCents: 1000, effectiveFrom: "2030-01-01", effectiveTo: "2030-06-30" }).ok).toBe(true);
    expect(addRate({ code: "H0006", program: "smhs", amountCents: 1200, effectiveFrom: "2030-07-01" }).ok).toBe(true);
    expect(rateFor("H0006", "smhs", "2029-12-31")).toBeUndefined();
    expect(rateFor("H0006", "smhs", "2030-01-01")!.amountCents).toBe(1000);
    expect(rateFor("H0006", "smhs", "2030-06-30")!.amountCents).toBe(1000);
    expect(rateFor("H0006", "smhs", "2031-03-01")!.amountCents).toBe(1200);
  });

  it("rejects overlapping ranges for the same code and program", () => {
    addRate({ code: "H0001", program: "smhs", amountCents: 500, effectiveFrom: "2031-01-01", effectiveTo: "2031-12-31" });
    const r = addRate({ code: "H0001", program: "smhs", amountCents: 600, effectiveFrom: "2031-06-01" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Overlaps/);
    expect(addRate({ code: "H0001", program: "medi_cal_managed", amountCents: 600, effectiveFrom: "2031-06-01", effectiveTo: "2031-06-02" }).ok).toBe(true);
  });

  it("end-dates without editing anything else, and audits it", () => {
    const add = addRate({ code: "T1017", program: "dmc_ods", amountCents: 700, effectiveFrom: "2032-01-01" });
    if (!add.ok) throw new Error(add.error);
    expect(endDateRate(add.rate.id, "2032-02-01", "")).toMatchObject({ ok: false });
    const r = endDateRate(add.rate.id, "2032-03-31", "New fee schedule");
    expect(r.ok && r.rate).toMatchObject({ amountCents: 700, effectiveFrom: "2032-01-01", effectiveTo: "2032-03-31" });
    expect(audits("rate_added").some((e) => e.detail?.["rateId"] === add.rate.id)).toBe(true);
    expect(audits("rate_end_dated").some((e) => e.detail?.["rateId"] === add.rate.id)).toBe(true);
  });

  it("refuses Sys Admin at the data layer and changes nothing", () => {
    actAs("sys_admin", "s-admin1");
    const before = listRates().length;
    const codeBefore = getBillingCode("H0004");
    expect(addRate({ code: "H0004", program: "smhs", amountCents: 1, effectiveFrom: "2040-01-01" })).toEqual({ ok: false, error: BILLING_WRITE_REFUSED });
    expect(endDateRate(listRates()[0]!.id, "2040-01-01", "x")).toEqual({ ok: false, error: BILLING_WRITE_REFUSED });
    expect(upsertBillingCode({ code: "H0004", description: "hack", unitType: "per_encounter", roundingRule: "half_plus" })).toEqual({ ok: false, error: BILLING_WRITE_REFUSED });
    expect(listRates().length).toBe(before);
    expect(getBillingCode("H0004")).toEqual(codeBefore);
  });

  it("Billing Coordinator can edit a code's unit rule, audited", () => {
    actAs("billing_coordinator", "s-bc1");
    const r = upsertBillingCode({ code: "H2014", description: "Skills training, group", unitType: "per_minutes", unitMinutes: 15, roundingRule: "whole_units" });
    expect(r.ok).toBe(true);
    expect(getBillingCode("H2014")).toMatchObject({ roundingRule: "whole_units", draft: false });
    expect(audits("billing_code_updated").some((e) => e.detail?.["code"] === "H2014")).toBe(true);
  });
});

describe("program selection", () => {
  it("follows the approved order", () => {
    expect(selectProgram({ code: "H0038", line: "sud", hasMediCal: true })).toBe("calaim_ecm");
    expect(selectProgram({ code: "H0004", line: "sud", hasMediCal: false })).toBe("non_medi_cal");
    expect(selectProgram({ code: "H0004", line: "sud", hasMediCal: true, payer: "Tulare County MHP" })).toBe("dmc_ods");
    expect(selectProgram({ code: "90834", line: "mh", hasMediCal: true, payer: "Tulare County MHP" })).toBe("smhs");
    expect(selectProgram({ code: "90834", line: "mh", hasMediCal: true, payer: "Health Net Medi-Cal" })).toBe("medi_cal_managed");
  });
});

describe("claim pricing", () => {
  beforeEach(() => actAs("billing", "s-bill1"));

  it("gets a default code, program and schedule-estimated units at creation", () => {
    const c = freshClaim(45);
    expect(c.serviceCode).toBeTruthy();
    expect(c.codeSource).toBe("default");
    expect(c.program).toBeTruthy();
    expect(c.unitsSource).toBe("schedule");
    expect(claimUnitLabel(c)).toMatch(/estimated from schedule/);
  });

  it("amount = rate per unit × units", () => {
    const c = freshClaim(60);
    AdelanteEHRExt.correctClaim(c.id, { serviceCode: "H0004", program: "dmc_ods" }, "SUD visit");
    const after = AdelanteEHRExt.claimForEncounter(c.encounterId)!;
    expect(after.units).toBe(4);
    expect(after.chargeCents).toBe(after.rateCentsPerUnit! * 4);
    expect(after.rateId).toBeTruthy();
  });

  it("flags no rate on file, blocks Ready, and a new rate prices it", () => {
    const c = freshClaim();
    AdelanteEHRExt.correctClaim(c.id, { serviceCode: "H0001", program: "non_medi_cal" }, "ISL visit");
    let x = AdelanteEHRExt.claimForEncounter(c.encounterId)!;
    expect(x.rateStatus).toBe("no_rate");
    expect(x.chargeCents).toBeUndefined();
    signClaimViaNote(c);
    AdelanteEHRExt.transitionClaim(c.id, "coded");
    const blocked = AdelanteEHRExt.transitionClaim(c.id, "generated");
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error).toMatch(/No rate on file/);
    expect(addRate({ code: "H0001", program: "non_medi_cal", amountCents: 9000, effectiveFrom: "2026-01-01" }).ok).toBe(true);
    x = AdelanteEHRExt.claimForEncounter(c.encounterId)!;
    expect(x.rateStatus).toBe("priced");
    expect(x.chargeCents).toBe(9000);
    expect(AdelanteEHRExt.transitionClaim(c.id, "generated")).toEqual({ ok: true });
  });

  it("units correction needs a reason, re-prices, is audited, and Sys Admin is refused", () => {
    const c = freshClaim();
    AdelanteEHRExt.correctClaim(c.id, { serviceCode: "H0004", program: "dmc_ods" }, "SUD");
    expect(AdelanteEHRExt.correctClaim(c.id, { units: 3 }, "  ").ok).toBe(false);
    actAs("sys_admin", "s-admin1");
    expect(AdelanteEHRExt.correctClaim(c.id, { units: 3 }, "x")).toEqual({ ok: false, error: BILLING_WRITE_REFUSED });
    actAs("billing", "s-bill1");
    const r = AdelanteEHRExt.correctClaim(c.id, { units: 3 }, "Documented 45 minutes");
    expect(r.ok && r.claim).toMatchObject({ units: 3, unitsSource: "billing" });
    if (r.ok) expect(r.claim.chargeCents).toBe(r.claim.rateCentsPerUnit! * 3);
    expect(audits("claim_corrected").some((e) => e.detail?.["claimId"] === c.id)).toBe(true);
  });

  it("a later rate change never silently re-prices a priced claim", () => {
    const c = freshClaim(60);
    AdelanteEHRExt.correctClaim(c.id, { serviceCode: "H0004", program: "dmc_ods" }, "SUD");
    const before = AdelanteEHRExt.claimForEncounter(c.encounterId)!.chargeCents;
    const seed = listRates().find((r) => r.code === "H0004" && r.program === "dmc_ods" && !r.effectiveTo)!;
    const end = endDateRate(seed.id, "2020-01-01", "x", (id) => AdelanteEHRExt.latestPricedServiceDate(id));
    expect(end.ok).toBe(false);
    expect(AdelanteEHRExt.claimForEncounter(c.encounterId)!.chargeCents).toBe(before);
  });
});
