// §Engagement/Reporting Build 1 — cohort resolver + engagement projection.
import { describe, expect, it, beforeEach } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { resolveCohorts, PATIENT_TRACKS } from "@/lib/cohorts";
import { engagementProjection } from "@/lib/engagementReporting";
import {
  __resetEngagement,
  completeLibraryItem,
  completionTimeline,
} from "@/lib/engagement";
import { LIBRARY_ITEMS } from "@/lib/library";
import {
  __resetSelfTracking,
  MIN_COHORT_SIZE,
  recordLapse,
  selfTrackingAggregate,
  setRecoveryStartDate,
  startCravingLog,
} from "@/lib/selfTracking";

describe("cohort resolver", () => {
  it("covers every patient exactly once across the tracks", () => {
    const patients = AdelanteEHR.listPatients();
    const c = resolveCohorts();
    expect(c.total).toBe(patients.length);
    const summed = c.buckets.reduce((a, b) => a + b.count, 0);
    expect(summed).toBe(patients.length);
    expect(c.buckets.map((b) => b.track)).toEqual(PATIENT_TRACKS);
  });

  it("keeps provisional cases out of the confirmed count", () => {
    for (const b of resolveCohorts().buckets) {
      expect(b.confirmedCount).toBe(b.count - b.provisionalCount);
      expect(b.provisionalCount).toBeGreaterThanOrEqual(0);
    }
  });

  it("narrows to a caseload when ids are supplied", () => {
    const first = AdelanteEHR.listPatients()[0]!;
    const c = resolveCohorts([first.id]);
    expect(c.total).toBe(1);
    expect(c.byPatient[first.id]?.basis).toBeTruthy();
  });
});

describe("engagement projection", () => {
  beforeEach(() => {
    __resetEngagement();
    __resetSelfTracking();
  });

  it("reports honest empty state when nothing has been engaged with", () => {
    const p = engagementProjection();
    expect(p.hasAnyEngagementData).toBe(false);
    expect(p.overall.everEngaged).toBe(0);
    expect(p.overall.medianDaysSinceActivity).toBeNull();
    // Patients with no engagement row are still the denominator.
    expect(p.rows.length).toBe(resolveCohorts().total);
  });

  it("counts real completions and rolls them into the right cohort", () => {
    const patient = AdelanteEHR.listPatients()[0]!;
    const item = LIBRARY_ITEMS[0]!;
    completeLibraryItem(patient.id, item.id);

    const p = engagementProjection();
    expect(p.hasAnyEngagementData).toBe(true);
    expect(p.overall.totalLessonsCompleted).toBe(1);
    expect(p.overall.activeInWindow).toBe(1);
    const row = p.rows.find((r) => r.patientId === patient.id)!;
    const bucket = p.byTrack.find((c) => c.track === row.track)!;
    expect(bucket.totalLessonsCompleted).toBe(1);
  });

  it("exposes self-tracking only as population totals, with the small-cohort flag", () => {
    const [a, b] = AdelanteEHR.listPatients();
    startCravingLog(a!.id, 7);
    recordLapse(b!.id, { contributors: [], helpedBefore: [], nextStep: "message_care_team" });
    setRecoveryStartDate(a!.id, "2026-01-01");

    const p = engagementProjection();
    expect(p.selfTracking.cravingLogs).toBe(1);
    expect(p.selfTracking.lapses).toBe(1);
    expect(p.selfTracking.recoveryDateSet).toBe(1);
    expect(p.selfTracking.minimumCohortSize).toBe(MIN_COHORT_SIZE);
    // Demo cohort is small; the flag must be on rather than silently ignored.
    expect(p.selfTracking.belowMinimumCohort).toBe(p.cohorts.total < MIN_COHORT_SIZE);
    // No per-patient self-tracking leaks into the engagement rows.
    for (const row of p.rows) {
      expect(Object.keys(row)).not.toContain("lapses");
      expect(Object.keys(row)).not.toContain("cravingLogs");
    }
  });

  it("counts absent patients as zeros rather than dropping them", () => {
    const agg = selfTrackingAggregate(["nobody-1", "nobody-2"]);
    expect(agg.cohortSize).toBe(2);
    expect(agg.cravingLogs).toBe(0);
    expect(agg.recoveryDateSetRate).toBe(0);
  });
});

describe("per-lesson completion timestamps", () => {
  beforeEach(() => __resetEngagement());

  it("records one write-once timestamp per completed item", () => {
    const patient = AdelanteEHR.listPatients()[0]!;
    const [one, two] = LIBRARY_ITEMS;
    completeLibraryItem(patient.id, one!.id);
    completeLibraryItem(patient.id, two!.id);
    const first = completionTimeline(patient.id);
    expect(first.map((e) => e.itemId)).toEqual([one!.id, two!.id]);
    expect(first.every((e) => e.namespace === "library")).toBe(true);

    // Idempotent re-completion must not rewrite the original date.
    completeLibraryItem(patient.id, one!.id);
    const second = completionTimeline(patient.id);
    expect(second).toEqual(first);
  });
});
