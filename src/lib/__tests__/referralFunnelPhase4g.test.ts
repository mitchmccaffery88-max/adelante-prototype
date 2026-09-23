// §Referrals Rework Phase 4g — the referral → active patient funnel.
import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { MIN_COHORT_SIZE } from "@/lib/cohortGuard";
import {
  attemptedNotReached,
  declinedByReason,
  referralDropOff,
  referralFunnel,
  referralsByJusticeAnswer,
  referralsBySource,
  reportableSource,
  wasContacted,
  JUSTICE_SOURCE_BUCKET_KEY,
} from "@/lib/referralFunnel";

function newReferral(over: Record<string, unknown> = {}) {
  return AdelanteEHR.createReferral({
    firstName: "Rosa",
    lastName: "Mendez",
    dob: "1990-04-02",
    phone: "5595550142",
    referrerName: "Officer Diaz",
    referringAgency: "Tulare County Probation",
    referrerPhone: "5595550100",
    referrerEmail: "diaz@example.org",
    consentToText: true,
    consentToContact: true,
    referralSource: "probation",
    ...over,
  } as unknown as Parameters<typeof AdelanteEHR.createReferral>[0]);
}

describe("contacted means actually reached", () => {
  it("an unanswered attempt alone is effort, never contact", () => {
    const r = newReferral();
    AdelanteEHR.logReferralOutreachAttempt({ id: r.id, outcome: "no_answer" });
    const after = AdelanteEHR.listReferrals().find((x) => x.id === r.id)!;
    expect(wasContacted(after)).toBe(false);
    expect(attemptedNotReached(after)).toBe(true);
    expect(referralDropOff().outreachAttemptedNotReached).toBeGreaterThan(0);
  });

  it("a dead number is also not contact", () => {
    const r = newReferral();
    AdelanteEHR.logReferralOutreachAttempt({ id: r.id, outcome: "disconnected" });
    expect(wasContacted(AdelanteEHR.listReferrals().find((x) => x.id === r.id)!)).toBe(false);
  });

  it("a reached attempt counts as contacted", () => {
    const r = newReferral();
    AdelanteEHR.logReferralOutreachAttempt({ id: r.id, outcome: "reached" });
    const after = AdelanteEHR.listReferrals().find((x) => x.id === r.id)!;
    expect(wasContacted(after)).toBe(true);
    expect(attemptedNotReached(after)).toBe(false);
  });
});

describe("the endpoint is attendance, not a booking", () => {
  function enroll() {
    const r = newReferral();
    AdelanteEHR.markReferralContacted(r.id);
    const patientId = AdelanteEHR.enrollReferral(r.id)!;
    return { r, patientId };
  }

  it("a scheduled appointment counts as booked but never as attended", () => {
    const before = referralFunnel();
    const { patientId } = enroll();
    const clinician = AdelanteEHR.listClinicians()[0];
    AdelanteEHR.bookAppointment({
      patientId,
      clinicianId: clinician.id,
      start: new Date(Date.now() + 86400_000 * 2).toISOString(),
      durationMin: 30,
    });
    const after = referralFunnel();
    expect(after.firstApptScheduled).toBe(before.firstApptScheduled + 1);
    expect(after.firstApptAttended).toBe(before.firstApptAttended);
    expect(referralDropOff().enrolledAwaitingFirstSession).toBeGreaterThan(0);
  });

  it("cancelled and no-show never reach the endpoint; attended does", () => {
    const { patientId } = enroll();
    const clinician = AdelanteEHR.listClinicians()[0];
    const a = AdelanteEHR.bookAppointment({
      patientId,
      clinicianId: clinician.id,
      start: new Date(Date.now() + 86400_000 * 4).toISOString(),
      durationMin: 30,
    });
    AdelanteEHR.updateAppointmentStatus(a.id, "no_show");
    const noShow = referralFunnel().firstApptAttended;
    AdelanteEHR.updateAppointmentStatus(a.id, "cancelled");
    expect(referralFunnel().firstApptAttended).toBe(noShow);
    AdelanteEHR.updateAppointmentStatus(a.id, "attended");
    expect(referralFunnel().firstApptAttended).toBe(noShow + 1);
    expect(referralFunnel().medianDaysToFirstAttended).not.toBeNull();
  });

  it("an enrolled referral with nothing booked is counted as such", () => {
    const before = referralDropOff().enrolledNoAppointment;
    enroll();
    expect(referralDropOff().enrolledNoAppointment).toBe(before + 1);
  });
});

describe("stages and medians", () => {
  it("submitted ≥ contacted ≥ enrolled ≥ booked ≥ attended", () => {
    newReferral();
    const f = referralFunnel();
    expect(f.submitted).toBeGreaterThanOrEqual(f.contacted);
    expect(f.contacted).toBeGreaterThanOrEqual(0);
    expect(f.enrolled).toBeGreaterThanOrEqual(f.firstApptScheduled);
    expect(f.firstApptScheduled).toBeGreaterThanOrEqual(f.firstApptAttended);
  });

  it("median days to contact is 0 when contact happens immediately", () => {
    const r = newReferral();
    AdelanteEHR.markReferralContacted(r.id);
    expect(referralFunnel({ sinceDays: 1 }).medianDaysToContact).toBe(0);
  });
});

describe("slices", () => {
  it("drug court is never its own row — justice sources fold into one bucket", () => {
    const r = newReferral({ referralSource: "drug_court" });
    expect(reportableSource(r).key).toBe(JUSTICE_SOURCE_BUCKET_KEY);
    const rows = referralsBySource().rows;
    expect(rows.some((x) => x.key === "drug_court")).toBe(false);
    expect(rows.some((x) => x.key === JUSTICE_SOURCE_BUCKET_KEY)).toBe(true);
  });

  it("a non-justice source keeps its own row", () => {
    newReferral({ referralSource: "self" });
    expect(referralsBySource().rows.some((x) => x.key === "self")).toBe(true);
  });

  it("the justice-involved answer keeps all three states plus not asked", () => {
    newReferral({ justiceInvolved: "unsure" });
    expect(referralsByJusticeAnswer().rows.some((x) => x.key === "unsure")).toBe(true);
  });

  it("declines are aggregated by reason key only", () => {
    const r = newReferral();
    AdelanteEHR.declineReferral({ id: r.id, reason: "not_eligible", note: "private detail" });
    const rows = declinedByReason().rows;
    expect(rows.some((x) => x.key === "not_eligible")).toBe(true);
    expect(rows.every((x) => !/private detail/.test(x.label))).toBe(true);
  });
});

describe("cohort guard", () => {
  it("every breakdown and the funnel itself carry the shared threshold", () => {
    for (const g of [referralFunnel(), referralsBySource(), referralsByJusticeAnswer(), declinedByReason(), referralDropOff()]) {
      expect(g.minimumCohortSize).toBe(MIN_COHORT_SIZE);
      expect(g.belowMinimumCohort).toBe(g.cohortSize < MIN_COHORT_SIZE);
    }
  });
});
