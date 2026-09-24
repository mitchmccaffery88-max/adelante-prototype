// §Phase 7d — general-population programs, payer-specific rates, patient
// responsibility, manual payments, unrecorded-arrangement block.
import { describe, it, expect, beforeEach } from "vitest";
import { signClaimViaNote } from "@/test/claimSigning";
import { AdelanteEHR } from "@/lib/ehr";
import {
  AdelanteEHRExt,
  ARRANGEMENT_MISSING_MSG,
  PAYMENT_EXCEEDS_BALANCE,
  patientResponsibility,
} from "@/lib/ehr-ext";
import {
  BILLING_WRITE_REFUSED,
  PROGRAM_INACTIVE,
  addRate,
  generalPopulationProgram,
  rateFor,
  selectProgram,
} from "@/lib/rates";
import { setActingRole, setActingStaff, type StaffRole } from "@/lib/roles";

function actAs(role: string, staffId: string) {
  setActingStaff(staffId);
  setActingRole(role as StaffRole);
}
const audits = (action: string) => AdelanteEHR.listAuditEvents().filter((e) => e.action === action);

let slot = 0;
/** A fresh attended visit for a new patient with no Medi-Cal on file. */
function uninsuredClaim(opts: { fundingLane?: "private_pay" | "isl_non_medi_cal" | "bhsa" } = {}) {
  slot += 1;
  const p = AdelanteEHR.listPatients()[0]!;
  // New demo patient: clone minimal fields, no coverage.
  const patientId = `p7d-${slot}`;
  (AdelanteEHR.listPatients() as unknown[]);
  AdelanteEHR._testAddPatient?.({ ...p, id: patientId, coverage: undefined, paymentArrangement: undefined });
  const a = AdelanteEHR.bookAppointment({
    patientId,
    clinicianId: "c1",
    start: new Date(Date.now() - 86400_000 * (3 + slot)).toISOString(),
    durationMin: 50,
    allowPatientOverlap: true,
  });
  if (opts.fundingLane) (a as { fundingLane?: string }).fundingLane = opts.fundingLane;
  AdelanteEHR.updateAppointmentStatus(a.id, "attended");
  return { patientId, claim: AdelanteEHRExt.claimForEncounter(a.id)! };
}

describe("program mapping", () => {
  it("routes no-Medi-Cal to the arrangement, provisionally self-pay", () => {
    expect(selectProgram({ code: "90834", line: "mh", hasMediCal: false })).toBe("self_pay");
    expect(selectProgram({ code: "90834", line: "mh", hasMediCal: false, arrangement: "sliding_fee" })).toBe("sliding_fee");
    expect(selectProgram({ code: "H0038", line: "mh", hasMediCal: false })).toBe("calaim_ecm");
    expect(selectProgram({ code: "90834", line: "mh", hasMediCal: true, payer: "Health Net Medi-Cal" })).toBe("medi_cal_managed");
  });
  it("funding lane: ISL/BHSA → grant_isl; private pay → arrangement", () => {
    expect(generalPopulationProgram("isl_non_medi_cal", undefined)).toEqual({ program: "grant_isl", arrangementMissing: false });
    expect(generalPopulationProgram("bhsa", "self_pay")).toEqual({ program: "grant_isl", arrangementMissing: false });
    expect(generalPopulationProgram("private_pay", undefined)).toEqual({ program: "self_pay", arrangementMissing: true });
    expect(generalPopulationProgram("private_pay", "sliding_fee")).toEqual({ program: "sliding_fee", arrangementMissing: false });
    expect(generalPopulationProgram("medi_cal_ffs", undefined)).toBeUndefined();
  });
  it("an uninsured visit is priced at self-pay and flagged", () => {
    const { claim } = uninsuredClaim();
    expect(claim.program).toBe("self_pay");
    expect(claim.arrangementMissing).toBe(true);
    expect(claim.rateStatus).toBe("priced");
    expect(claim.patientPortionCents).toBe(claim.chargeCents);
  });
  it("a grant/ISL visit charges the patient nothing and is not flagged", () => {
    const { claim } = uninsuredClaim({ fundingLane: "isl_non_medi_cal" });
    expect(claim.program).toBe("grant_isl");
    expect(claim.arrangementMissing).toBeUndefined();
    expect(claim.patientPortionCents).toBe(0);
    expect(claim.payerPortionCents).toBe(claim.chargeCents);
  });
});

describe("payer-specific rates (commercial infrastructure)", () => {
  beforeEach(() => actAs("billing", "s-bill1"));
  it("prefers the payer-specific rate, falls back to program-wide", () => {
    expect(addRate({ code: "90834", program: "commercial", amountCents: 12000, effectiveFrom: "2026-01-01" }).ok).toBe(true);
    expect(addRate({ code: "90834", program: "commercial", amountCents: 14000, effectiveFrom: "2026-01-01", payerId: "acme" }).ok).toBe(true);
    expect(rateFor("90834", "commercial", "2026-06-01", "acme")?.amountCents).toBe(14000);
    expect(rateFor("90834", "commercial", "2026-06-01", "other")?.amountCents).toBe(12000);
    expect(rateFor("90834", "commercial", "2026-06-01")?.amountCents).toBe(12000);
    // Overlap is per payer.
    expect(addRate({ code: "90834", program: "commercial", amountCents: 1, effectiveFrom: "2026-02-01", payerId: "acme" }).ok).toBe(false);
  });
  it("commercial can't be chosen for a claim", () => {
    const { claim } = uninsuredClaim();
    expect(AdelanteEHRExt.correctClaim(claim.id, { program: "commercial" }, "try")).toEqual({ ok: false, error: PROGRAM_INACTIVE });
  });
});

describe("patient responsibility", () => {
  it("per program", () => {
    expect(patientResponsibility("self_pay", 1000)).toEqual({ payerPortionCents: 0, patientPortionCents: 1000 });
    expect(patientResponsibility("sliding_fee", 500)).toEqual({ payerPortionCents: 0, patientPortionCents: 500 });
    expect(patientResponsibility("grant_isl", 1000)).toEqual({ payerPortionCents: 1000, patientPortionCents: 0 });
    expect(patientResponsibility("smhs", 1000)).toEqual({ payerPortionCents: 1000, patientPortionCents: 0 });
    expect(patientResponsibility("calaim_ecm", 1000)).toEqual({ payerPortionCents: 1000, patientPortionCents: 0 });
    // commercial infra: $20 copay + 20% coinsurance of the rest
    expect(patientResponsibility("commercial", 10000, { copayCents: 2000, coinsuranceBps: 2000 })).toEqual({
      payerPortionCents: 6400,
      patientPortionCents: 3600,
    });
  });
});

describe("unrecorded arrangement", () => {
  beforeEach(() => actAs("billing", "s-bill1"));
  it("blocks Ready until set; setting it re-prices and clears the flag, audited", () => {
    const { patientId, claim } = uninsuredClaim();
    signClaimViaNote(claim);
    actAs("billing", "s-bill1");
    expect(AdelanteEHRExt.transitionClaim(claim.id, "coded")).toEqual({ ok: true });
    expect(AdelanteEHRExt.transitionClaim(claim.id, "generated")).toEqual({ ok: false, error: ARRANGEMENT_MISSING_MSG });
    const selfPay = AdelanteEHRExt.claimForEncounter(claim.encounterId)!.chargeCents!;
    const r = AdelanteEHRExt.setPaymentArrangement(patientId, "sliding_fee");
    expect(r.ok && r.repriced).toContain(claim.id);
    const after = AdelanteEHRExt.claimForEncounter(claim.encounterId)!;
    expect(after.program).toBe("sliding_fee");
    expect(after.arrangementMissing).toBeUndefined();
    expect(after.chargeCents).toBe(Math.round(selfPay / 2));
    expect(audits("payment_arrangement_set").some((e) => e.patientId === patientId)).toBe(true);
    expect(audits("claim_repriced_for_arrangement").some((e) => e.detail?.["claimId"] === claim.id)).toBe(true);
    expect(AdelanteEHRExt.transitionClaim(claim.id, "generated")).toEqual({ ok: true });
  });
  it("Sys Admin can't set the arrangement", () => {
    const { patientId } = uninsuredClaim();
    actAs("sys_admin", "s-admin1");
    expect(AdelanteEHRExt.setPaymentArrangement(patientId, "self_pay")).toEqual({ ok: false, error: BILLING_WRITE_REFUSED });
  });
});

describe("manual patient payments", () => {
  beforeEach(() => actAs("billing_coordinator", "s-bc1"));
  it("reduce the balance; overpay and card numbers refused; void restores; audited", () => {
    const { claim } = uninsuredClaim();
    const owed = claim.patientBalanceCents!;
    const ok = AdelanteEHRExt.recordPatientPayment({ claimId: claim.id, amountCents: 1000, receivedOn: "2026-09-20", method: "cash", reference: "R-12" });
    expect(ok.ok).toBe(true);
    let c = AdelanteEHRExt.claimForEncounter(claim.encounterId)!;
    expect(c.patientBalanceCents).toBe(owed - 1000);
    expect(
      AdelanteEHRExt.recordPatientPayment({ claimId: claim.id, amountCents: owed, receivedOn: "2026-09-20", method: "check" }),
    ).toEqual({ ok: false, error: PAYMENT_EXCEEDS_BALANCE });
    const card = AdelanteEHRExt.recordPatientPayment({ claimId: claim.id, amountCents: 100, receivedOn: "2026-09-20", method: "card_external", reference: "4111 1111 1111 1111" });
    expect(card.ok).toBe(false);
    expect(audits("patient_payment_recorded").some((e) => e.detail?.["claimId"] === claim.id)).toBe(true);
    const payId = ok.ok ? ok.payment.id : "";
    expect(AdelanteEHRExt.voidPatientPayment(claim.id, payId, " ").ok).toBe(false);
    expect(AdelanteEHRExt.voidPatientPayment(claim.id, payId, "entered twice")).toEqual({ ok: true });
    c = AdelanteEHRExt.claimForEncounter(claim.encounterId)!;
    expect(c.patientBalanceCents).toBe(owed);
  });
  it("grant/ISL claims have nothing to collect", () => {
    const { claim } = uninsuredClaim({ fundingLane: "bhsa" });
    expect(AdelanteEHRExt.recordPatientPayment({ claimId: claim.id, amountCents: 100, receivedOn: "2026-09-20", method: "cash" }).ok).toBe(false);
  });
  it("Sys Admin is refused and nothing changes", () => {
    const { claim } = uninsuredClaim();
    actAs("sys_admin", "s-admin1");
    expect(
      AdelanteEHRExt.recordPatientPayment({ claimId: claim.id, amountCents: 100, receivedOn: "2026-09-20", method: "cash" }),
    ).toEqual({ ok: false, error: BILLING_WRITE_REFUSED });
    expect(AdelanteEHRExt.claimForEncounter(claim.encounterId)!.patientPayments ?? []).toHaveLength(0);
  });
});
