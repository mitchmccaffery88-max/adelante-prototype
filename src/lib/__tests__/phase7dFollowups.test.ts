// §Phase 7d follow-ups — arrangement from the chart; honest Lane labels.
import { describe, it, expect } from "vitest";
import { AdelanteEHR, type Patient } from "@/lib/ehr";
import { AdelanteEHRExt } from "@/lib/ehr-ext";
import { BILLING_WRITE_REFUSED } from "@/lib/rates";
import { coverageKind, laneFor, LANE_LABEL } from "@/lib/billingLane";
import { setActingRole, setActingStaff, type StaffRole } from "@/lib/roles";

function actAs(role: string, staffId: string) {
  setActingStaff(staffId);
  setActingRole(role as StaffRole);
}
let n = 0;
function flaggedClaim() {
  n += 1;
  const patientId = AdelanteEHR.createPatient({ firstName: "Chart", lastName: `F-${n}` }).id;
  const a = AdelanteEHR.bookAppointment({
    patientId,
    clinicianId: "c1",
    start: new Date(Date.now() - 86400_000 * (20 + n)).toISOString(),
    durationMin: 50,
    allowPatientOverlap: true,
  });
  (a as { fundingLane?: string }).fundingLane = "private_pay";
  AdelanteEHR.updateAppointmentStatus(a.id, "attended");
  return { patientId, claimId: AdelanteEHRExt.claimForEncounter(a.id)!.id };
}
const claim = (id: string) => AdelanteEHRExt.listClaims().find((c) => c.id === id)!;

describe("payment arrangement from the chart", () => {
  it("can be recorded before any claim exists, with who and when", () => {
    actAs("billing", "s-bill1");
    const id = AdelanteEHR.createPatient({ firstName: "Pre", lastName: "Claim" }).id;
    const r = AdelanteEHRExt.setPaymentArrangement(id, "sliding_fee");
    expect(r.ok).toBe(true);
    const p = AdelanteEHR.getPatient(id)!;
    expect(p.paymentArrangement).toBe("sliding_fee");
    expect(p.paymentArrangementSetBy?.role).toBe("billing");
    expect(p.paymentArrangementSetBy?.name).toBeTruthy();
    expect(Date.parse(p.paymentArrangementSetBy!.at)).not.toBeNaN();
  });
  it("re-prices open claims and clears the flag, audited", () => {
    actAs("billing_coordinator", "s-bill1");
    const { patientId, claimId } = flaggedClaim();
    expect(claim(claimId).arrangementMissing).toBe(true);
    const r = AdelanteEHRExt.setPaymentArrangement(patientId, "sliding_fee");
    expect(r.ok && r.repriced).toContain(claimId);
    expect(claim(claimId).arrangementMissing).toBeFalsy();
    expect(claim(claimId).program).toBe("sliding_fee");
    expect(
      AdelanteEHR.listAuditEvents().some(
        (e) => e.action === "payment_arrangement_set" && e.patientId === patientId,
      ),
    ).toBe(true);
  });
  it("Sys Admin is refused and nothing changes", () => {
    const { patientId, claimId } = flaggedClaim();
    actAs("sys_admin", "s-bill1");
    const r = AdelanteEHRExt.setPaymentArrangement(patientId, "self_pay");
    expect(r).toEqual({ ok: false, error: BILLING_WRITE_REFUSED });
    expect(AdelanteEHR.getPatient(patientId)?.paymentArrangement).toBeUndefined();
    expect(claim(claimId).arrangementMissing).toBe(true);
  });
});

describe("lane label", () => {
  const pt = (coverage?: Partial<NonNullable<Patient["coverage"]>>, extra: Partial<Patient> = {}) =>
    ({ id: "x", coverage: coverage ? { status: "active", verified: "verified", ...coverage } : undefined, ...extra }) as Patient;

  it("uses the claim's program first", () => {
    for (const prog of ["dmc_ods", "smhs", "medi_cal_managed", "calaim_ecm", "self_pay", "sliding_fee", "grant_isl"] as const) {
      expect(laneFor({ claim: { program: prog }, patient: pt({}) })).toBe(prog);
    }
    expect(LANE_LABEL.grant_isl).toBe("Grant / ISL");
  });
  it("active coverage with no type is unknown, not Medi-Cal", () => {
    expect(coverageKind(pt({}))).toBe("unknown");
    expect(laneFor({ patient: pt({}) })).toBe("unknown");
    expect(LANE_LABEL.unknown).toBe("Coverage type unknown");
    expect(laneFor({ patient: undefined })).toBe("unknown");
  });
  it("reads the real coverage type and plan spans", () => {
    expect(laneFor({ patient: pt({ coverageType: "medi_cal" }) })).toBe("medi_cal_program_unset");
    expect(laneFor({ patient: pt({ coverageType: "private" }) })).toBe("private_insurance");
    expect(laneFor({ patient: pt({ coverageType: "medicare" }) })).toBe("medicare");
    expect(laneFor({ patient: pt({ coverageType: "self_pay" }, { paymentArrangement: "sliding_fee" }) })).toBe("sliding_fee");
    expect(
      laneFor({ patient: pt({ plans: [{ id: "a", payer: "Medi-Cal FFS", from: "2000-01-01", source: "staff_checked" }] }) }),
    ).toBe("medi_cal_program_unset");
  });
  it("Alicia S. (active, no type, no plan) reads unknown", () => {
    expect(laneFor({ patient: AdelanteEHR.getPatient("p4") })).not.toBe("medi_cal_managed");
  });
});
