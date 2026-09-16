// The small-cohort guard is now one shared utility, and the CalOMS rollups
// carry it exactly the way the engagement rollup does.
import { describe, expect, it } from "vitest";
import { MIN_COHORT_SIZE, cohortGuard, belowMinimumCohort } from "@/lib/cohortGuard";
import { engagementProjection } from "@/lib/engagementReporting";
import { AdelanteEHR } from "@/lib/ehr";
import {
  dischargeStatusBreakdown,
  justiceSelfReportCoverage,
  priorTreatmentBreakdown,
  substanceUseBreakdown,
} from "@/lib/calomsReporting";

describe("shared cohort guard", () => {
  it("is the same threshold the engagement rollup publishes", () => {
    expect(engagementProjection().selfTracking.minimumCohortSize).toBe(MIN_COHORT_SIZE);
  });

  it("flags below the threshold and clears at or above it", () => {
    expect(belowMinimumCohort(MIN_COHORT_SIZE - 1)).toBe(true);
    expect(cohortGuard(MIN_COHORT_SIZE).belowMinimumCohort).toBe(false);
    expect(cohortGuard(3)).toEqual({
      cohortSize: 3,
      minimumCohortSize: MIN_COHORT_SIZE,
      belowMinimumCohort: true,
    });
  });
});

describe("CalOMS breakdowns carry the guard", () => {
  const small = AdelanteEHR.listPatients().slice(0, 2);

  it("flags a small caseload on every distribution", () => {
    for (const b of [
      substanceUseBreakdown(small),
      priorTreatmentBreakdown(small),
      dischargeStatusBreakdown(small),
    ]) {
      expect(b.cohortSize).toBe(small.length);
      expect(b.minimumCohortSize).toBe(MIN_COHORT_SIZE);
      expect(b.belowMinimumCohort).toBe(true);
      expect(Array.isArray(b.rows)).toBe(true);
    }
    const j = justiceSelfReportCoverage(small);
    expect(j.belowMinimumCohort).toBe(true);
    expect(j.cohortSize).toBe(small.length);
  });

  it("clears the flag once the cohort reaches the threshold", () => {
    const big = Array.from({ length: MIN_COHORT_SIZE }, () => AdelanteEHR.listPatients()[0]!);
    expect(substanceUseBreakdown(big).belowMinimumCohort).toBe(false);
    expect(justiceSelfReportCoverage(big).belowMinimumCohort).toBe(false);
  });
});
