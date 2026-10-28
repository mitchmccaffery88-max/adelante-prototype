import "@/test/freezeClock";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { AdelanteEHRExt } from "@/lib/ehr-ext";
import { setActingStaff } from "@/lib/roles";
import { buildBillingLifecycleScenario } from "@/lib/billingLifecycleScenario";
import { billingWorkspace } from "@/lib/billingWorkspace";
import { laneFor } from "@/lib/billingLane";
import { billingAppointments, billingPatients, billingClaims, billingOpsWorkspace, billingCoverageRows, billingClaimInput, billingLaneFor, billingBlockedAttempts } from "@/lib/billingProjection";
import { withApprovedConsentB2 } from "@/test/consentB2Approved";
// 26 Oct signup change (Mitch): enrollReferral websiteSignup option — signup/reset/review additions only.
import { withApprovedCredentialingOct27 } from "@/test/credentialingOct27Approved";

const claimKeys = "id encounterId patientId clinicianId state updatedAt serviceDate serviceCode program programSource codeSource unitsSource units minutes rateId rateCentsPerUnit rateStatus chargeCents noRateReason denialReason taxonomy supervisingStaffId arrangementMissing payerId copayCents deductibleCents coinsuranceBps payerPortionCents patientPortionCents patientPaidCents patientBalanceCents overpaidReview voidBlocked history duplicateReview patientPayments billingReviewFlag billingSignature documentationBlock billingBlock".split(" ");
const paymentKeys = "id amountCents receivedOn method reference recordedById recordedByName recordedByRole recordedAt voidedAt voidedById voidedByName voidReason".split(" ");
const keys = (v: object) => Object.keys(v).sort();
const forbidden = /^(diagnoses|screenerHistory|asamAssessments|asamTaskId|progressNotes|notes|medications|sdoh|caloms|moodCheckIns|carePlan|carePlans|noteId|statementKey|statementVersion|authorName|attendees|topic)$/;
function assertPrivateFree(value: unknown) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    expect(key).not.toMatch(forbidden);
    assertPrivateFree(child);
  }
}
function lists(ws: ReturnType<typeof billingWorkspace>) {
  return {
    blocked: ws.blocked.map(b => [b.claim.id, b.claim.patientId, b.reason]),
    ready: ws.ready.map(c => [c.id, c.patientId]),
    eligibilityDue: ws.eligibilityDue.map(r => r.patientId),
    paymentsToPost: ws.paymentsToPost.map(c => [c.id, c.patientId]),
    holds: ws.holds.map(c => [c.id, c.patientId]),
    counts: [ws.blocked.length, ws.ready.length, ws.eligibilityDue.length, ws.paymentsToPost.length, ws.holds.length],
  };
}

describe("B3b pinned-clock billing privacy and workspace parity", () => {
  for (const seed of ["default", "B3a"] as const) {
    it(`${seed}: both billing roles retain every workspace list ID, order, count, reason and lane`, () => {
      if (seed === "B3a") buildBillingLifecycleScenario();
      for (const [id, role] of [["s-bill1", "billing"], ["s-bc1", "billing_coordinator"]] as const) {
        setActingStaff(id, role);
        const raw = billingWorkspace(role);
        const safe = billingOpsWorkspace(role, billingClaims());
        expect(lists(safe)).toEqual(lists(raw));
        expect(raw.eligibilityDue.length).toBeGreaterThan(0);
        const appts = billingAppointments();
        const patients = billingPatients();
        for (const claim of billingClaims()) {
          const appt = appts.find(a => a.id === claim.encounterId);
          const patient = patients.find(p => p.id === claim.patientId);
          expect(billingLaneFor({ claim, appt, patient })).toBe(laneFor({ claim, appt: AdelanteEHR.listAppointments().find(a => a.id === claim.encounterId), patient: AdelanteEHR.getPatient(claim.patientId) }));
        }
        assertPrivateFree(safe);
      }
    });
  }
  it("all billing surfaces receive exact allowlists, including nested financial reconciliation", () => {
    buildBillingLifecycleScenario();
    setActingStaff("s-bill1", "billing");
    for (const p of billingPatients()) {
      expect(keys(p)).toEqual(["id", "programId", "firstName", "lastName", "paymentArrangement", ...(p.coverage ? ["coverage"] : [])].sort());
      expect(p.firstName).toBe("");
      expect(p.lastName).toBe("");
      if (p.coverage) {
        expect(keys(p.coverage)).toEqual("status verified coverageType otherPlanName plans".split(" ").sort());
        for (const plan of p.coverage.plans ?? []) expect(keys(plan)).toEqual("id payer plan memberId from to source managedCarePlanId managedCarePlanName aidCode shareOfCostCents planNotOnList".split(" ").sort());
      }
    }
    for (const a of billingAppointments()) expect(keys(a)).toEqual("id patientId clinicianId start durationMin status fundingLane serviceType modality locationId chargeCents islReason".split(" ").sort());
    for (const c of billingClaims()) {
      expect(keys(c)).toEqual(claimKeys.sort());
      const raw = AdelanteEHRExt.listClaims().find(r => r.id === c.id);
      if (!raw) throw new Error("Missing raw claim");
      expect(billingClaimInput(raw)).toEqual(c);
      for (const h of c.history) expect(keys(h)).toEqual(["at", "state"]);
      for (const [index, payment] of (c.patientPayments ?? []).entries()) {
        expect(keys(payment)).toEqual(paymentKeys.sort());
        for (const key of paymentKeys) expect(payment[key as keyof typeof payment]).toEqual(raw.patientPayments?.[index]?.[key as keyof typeof payment]);
      }
      if ("billingSignature" in c && typeof c.billingSignature === "object") expect(keys(c.billingSignature)).toEqual(["cosign", "signedAt", "signerName"]);
    }
    for (const row of billingCoverageRows()) expect(keys(row)).toEqual("patientId programId county coverageStatus verified cinOnFile activePlanPayer daysSinceCheck state name openFollowUps".split(" ").sort());
    assertPrivateFree([billingPatients(), billingAppointments(), billingClaims(), billingBlockedAttempts(), billingCoverageRows()]);
  });
  for (const [id, role] of [["s-th1", "therapist"], ["s-admin1", "sys_admin"]] as const) {
    it(`${role}: pinned-clock selectors, workspace and shared clinical sources are unchanged`, () => {
      setActingStaff(id, role);
      expect(billingPatients()).toEqual(AdelanteEHR.listPatients());
      expect(billingAppointments()).toEqual(AdelanteEHR.listAppointments());
      expect(billingClaims()).toEqual(AdelanteEHRExt.listClaims());
      const raw = AdelanteEHRExt.listClaims();
      expect(billingOpsWorkspace(role, raw)).toEqual(billingWorkspace(role, raw));
      if (!raw[0]) throw new Error("Missing claim");
      expect(billingClaimInput(raw[0])).toBe(raw[0]);
      for (const path of ["src/routes/clinician.tsx", "src/routes/admin.tsx", "src/lib/ehr.ts", "src/lib/ehr-ext.ts", "src/lib/roles.ts", "src/lib/chartAccess.ts", "src/lib/countyReporting.ts"]) {
        expect(readFileSync(path, "utf8")).toBe(withApprovedCredentialingOct27(path, withApprovedConsentB2(path, execFileSync("git", ["show", `b1d3c414:${path}`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }))));
      }
    });
  }
});