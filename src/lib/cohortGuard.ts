// §Reporting — SHARED small-cohort (small-cell) re-identification guard.
//
// This used to live only inside `selfTracking.ts`, which is why the CalOMS
// breakdowns sitting beside the engagement rollup on the same `/reporting`
// page shipped without one. The threshold and the honest labelling are a
// single concern, so they live in a single module and every aggregation that
// publishes cross-patient counts consumes it.
//
// ⚠️ REAL PRODUCTION CONSIDERATION, NOT A DEMO NICETY.
// At demo scale (10 patients) an aggregate like "3 lapses this week" is
// practically re-identifiable: staff who know the caseload can often infer
// who. Small-cell suppression is the standard control. For the demo the
// numbers are still computed and displayed with `belowMinimumCohort` surfaced;
// before production this must become hard suppression (return nulls) with a
// threshold agreed with compliance.
export const MIN_COHORT_SIZE = 11;

export interface CohortGuard {
  /** Denominator considered — a count, never a list of people. */
  cohortSize: number;
  /** The threshold in force, carried so the UI never hardcodes it. */
  minimumCohortSize: number;
  /** True when these numbers are NOT safe to publish as-is. */
  belowMinimumCohort: boolean;
}

/** The one place a cohort size becomes a publish/do-not-publish judgement. */
export function cohortGuard(cohortSize: number): CohortGuard {
  return {
    cohortSize,
    minimumCohortSize: MIN_COHORT_SIZE,
    belowMinimumCohort: cohortSize < MIN_COHORT_SIZE,
  };
}

export function belowMinimumCohort(cohortSize: number): boolean {
  return cohortSize < MIN_COHORT_SIZE;
}
