// §Referrals Rework Phase 4f — post-enrollment handoff.
import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import {
  firstAttendedAppointment,
  needsSetup,
  postEnrollmentGaps,
  postEnrollmentStaleness,
  POST_ENROLLMENT_STALENESS_DRAFT,
} from "@/lib/postEnrollment";

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

describe("first session is an attendance milestone", () => {
  it("a scheduled-only appointment does not count; marking it attended does", () => {
    const patientId = AdelanteEHR.enrollReferral(newReferral().id)!;
    const clinician = AdelanteEHR.listClinicians()[0];
    const start = new Date(Date.now() + 86400_000 * 3).toISOString();
    const appt = AdelanteEHR.bookAppointment({
      patientId,
      clinicianId: clinician.id,
      start,
      durationMin: 30,
    });
    expect(firstAttendedAppointment(patientId)).toBeUndefined();
    expect(postEnrollmentGaps(AdelanteEHR.getPatient(patientId)!)).toContain("first_session");

    AdelanteEHR.updateAppointmentStatus(appt.id, "attended");
    expect(firstAttendedAppointment(patientId)?.id).toBe(appt.id);
    expect(postEnrollmentGaps(AdelanteEHR.getPatient(patientId)!)).not.toContain("first_session");
  });

  it("a cancelled or no-showed appointment never counts", () => {
    const patientId = AdelanteEHR.enrollReferral(newReferral().id)!;
    const clinician = AdelanteEHR.listClinicians()[0];
    const a = AdelanteEHR.bookAppointment({
      patientId,
      clinicianId: clinician.id,
      start: new Date(Date.now() + 86400_000 * 5).toISOString(),
      durationMin: 30,
    });
    AdelanteEHR.updateAppointmentStatus(a.id, "no_show");
    expect(firstAttendedAppointment(patientId)).toBeUndefined();
    AdelanteEHR.updateAppointmentStatus(a.id, "cancelled");
    expect(firstAttendedAppointment(patientId)).toBeUndefined();
  });
});

describe("clinician assignment writes a real assignment audit entry", () => {
  it("reassignPrimaryClinician appends an assignment event the timeline can find", () => {
    const patientId = AdelanteEHR.enrollReferral(newReferral().id)!;
    const [first, second] = AdelanteEHR.listClinicians();
    AdelanteEHR.reassignPrimaryClinician({ patientId, clinicianId: first.id });
    const events = AdelanteEHR.listAuditEvents({ patientId, category: "assignment" });
    expect(events.some((e) => /clinician/i.test(e.action))).toBe(true);
    // A real switch (there is now a previous provider) still writes the
    // continuity-of-care record alongside the new assignment entry.
    AdelanteEHR.reassignPrimaryClinician({ patientId, clinicianId: second.id });
    expect(
      AdelanteEHR.listAuditEvents({ patientId, category: "provider_switch" }).length,
    ).toBeGreaterThan(0);
    expect(
      AdelanteEHR.listAuditEvents({ patientId, category: "assignment" }).filter((e) =>
        /clinician/i.test(e.action),
      ).length,
    ).toBe(2);
  });
});

describe("enrollment creates a real setup task", () => {
  it("creates one pooled, unassigned task and never duplicates it", () => {
    const r = newReferral();
    const patientId = AdelanteEHR.enrollReferral(r.id)!;
    const tasks = AdelanteEHR.listCaseTasks().filter(
      (t) => t.patientId === patientId && t.origin === "referral_enrollment_setup",
    );
    expect(tasks.length).toBe(1);
    expect(tasks[0].assignedTo).toBe("");
    expect(tasks[0].allowedRoles?.length).toBeGreaterThan(0);
    expect(tasks[0].dedupeKey).toBe(`enrollment-setup:${r.id}`);

    AdelanteEHR.enrollReferral(r.id);
    expect(
      AdelanteEHR.listCaseTasks().filter(
        (t) => t.patientId === patientId && t.origin === "referral_enrollment_setup",
      ).length,
    ).toBe(1);
  });
});

describe("post-enrollment staleness (draft thresholds)", () => {
  it("uses the earliest unmet step's own clock", () => {
    const patientId = AdelanteEHR.enrollReferral(newReferral().id)!;
    const p = AdelanteEHR.getPatient(patientId)!;
    const day = (n: number) => new Date(+new Date(p.enrolledAt!) + n * 86400_000);
    const t = POST_ENROLLMENT_STALENESS_DRAFT.case_manager;

    expect(postEnrollmentStaleness(p, day(0))?.step).toBe("case_manager");
    expect(postEnrollmentStaleness(p, day(0))?.state).toBe("fresh");
    expect(postEnrollmentStaleness(p, day(t.dueDays))?.state).toBe("due");
    expect(postEnrollmentStaleness(p, day(t.overdueDays))?.state).toBe("overdue");
  });

  it("moves to the clinician clock once a case manager exists", () => {
    const patientId = AdelanteEHR.enrollReferral(newReferral().id)!;
    AdelanteEHR.assignCaseManager({ patientId, caseManagerId: "cm1" });
    const p = AdelanteEHR.getPatient(patientId)!;
    const s = postEnrollmentStaleness(p, new Date(+new Date(p.enrolledAt!) + 4 * 86400_000));
    expect(s?.step).toBe("clinician");
    // 4 days is past the case-manager due line but inside the clinician one.
    expect(s?.state).toBe("fresh");
  });

  it("no staleness once every step is met", () => {
    const patientId = AdelanteEHR.enrollReferral(newReferral().id)!;
    const clinician = AdelanteEHR.listClinicians()[0];
    AdelanteEHR.assignCaseManager({ patientId, caseManagerId: "cm1" });
    AdelanteEHR.reassignPrimaryClinician({ patientId, clinicianId: clinician.id });
    const p = AdelanteEHR.getPatient(patientId)!;
    p.intakeCompletedAt = new Date().toISOString();
    const a = AdelanteEHR.bookAppointment({
      patientId,
      clinicianId: clinician.id,
      start: new Date(Date.now() + 86400_000 * 9).toISOString(),
      durationMin: 30,
    });
    AdelanteEHR.updateAppointmentStatus(a.id, "attended");
    expect(needsSetup(AdelanteEHR.getPatient(patientId)!)).toBe(false);
    expect(postEnrollmentStaleness(AdelanteEHR.getPatient(patientId)!)).toBeUndefined();
  });
});
