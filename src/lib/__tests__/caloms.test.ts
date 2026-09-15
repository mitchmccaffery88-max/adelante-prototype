// §Reporting Tier 2 — the structured CalOMS fields are only worth anything if
// they are genuinely queryable and never lose their provenance label.
import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import {
  calomsCompleteness,
  dischargeStatusBreakdown,
  justiceSelfReportCoverage,
  priorTreatmentBreakdown,
  substanceUseBreakdown,
} from "@/lib/calomsReporting";

const PID = "p1";

describe("CalOMS structured fields", () => {
  it("stores a typed substance-use profile that the caseload query can read", () => {
    AdelanteEHR.setSubstanceUseProfile(PID, {
      entries: [{ rank: "primary", substance: "heroin", route: "injection", frequency: "daily" }],
      source: "self_report",
    });
    const p = AdelanteEHR.getPatient(PID);
    expect(p?.calomsProfile?.substanceUse?.entries[0].substance).toBe("heroin");
    expect(p?.calomsProfile?.substanceUse?.recordedAt).toBeTruthy();
    const rows = substanceUseBreakdown();
    expect(rows.find((r) => r.key === "heroin")?.count).toBeGreaterThanOrEqual(1);
  });

  it("records prior treatment history as a coded bucket, not free text", () => {
    AdelanteEHR.setPriorTreatmentHistory(PID, {
      priorEpisodes: "five_plus",
      lastTreatmentType: "opioid_treatment_program",
      source: "internal",
    });
    expect(AdelanteEHR.getPatient(PID)?.calomsProfile?.priorTreatment?.priorEpisodes).toBe(
      "five_plus",
    );
    expect(priorTreatmentBreakdown().find((r) => r.key === "five_plus")?.count).toBe(1);
  });

  it("keeps discharges append-only, newest first", () => {
    AdelanteEHR.recordDischarge(PID, {
      status: "left_unsatisfactory",
      reason: "lost_contact",
      dischargedOn: "2026-01-10",
      source: "internal",
    });
    AdelanteEHR.recordDischarge(PID, {
      status: "completed_treatment",
      reason: "goals_met",
      dischargedOn: "2026-06-01",
      source: "internal",
    });
    const discharges = AdelanteEHR.getPatient(PID)?.calomsProfile?.discharges ?? [];
    expect(discharges).toHaveLength(2);
    expect(discharges[0].status).toBe("completed_treatment");
    expect(AdelanteEHR.currentDischarge(PID)?.reason).toBe("goals_met");
    expect(dischargeStatusBreakdown().find((r) => r.key === "completed_treatment")?.count).toBe(1);
  });

  it("never lets justice estimates claim staff verification", () => {
    AdelanteEHR.setJusticeSelfReport(PID, {
      arrestsPast12Months: 3,
      timeInCustodyMonths: 12,
      justiceReferralSource: "drug_court",
    });
    const j = AdelanteEHR.getPatient(PID)?.calomsProfile?.justice;
    expect(j?.source).toBe("self_report");
    // Even an explicit "internal" claim is coerced back — there is no feed.
    AdelanteEHR.setJusticeSelfReport(PID, { arrestsPast12Months: 1, source: "internal" as never });
    expect(AdelanteEHR.getPatient(PID)?.calomsProfile?.justice?.source).toBe("self_report");
    expect(justiceSelfReportCoverage().allSelfReported).toBe(true);
  });

  it("reports capture completeness over the real caseload", () => {
    const c = calomsCompleteness();
    expect(c.total).toBe(AdelanteEHR.listPatients().length);
    expect(c.substanceUse).toBeGreaterThan(0);
    expect(c.substanceUsePct).not.toBeNull();
  });

  it("does not duplicate employment or living arrangement", () => {
    const p = AdelanteEHR.getPatient(PID)!;
    expect(typeof p.needs.employment).toBe("boolean");
    expect(p.calomsProfile).not.toHaveProperty("employment");
    expect(p.calomsProfile).not.toHaveProperty("livingArrangement");
  });
});
