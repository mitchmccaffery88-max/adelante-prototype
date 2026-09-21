// Patient-level double-booking guard + appointment provenance.
//
// Before this, `bookAppointment` only checked the CLINICIAN's calendar, so a
// patient could self-book straight over an appointment the pre-release team
// had arranged with someone else. These tests pin the real behavior.
import { describe, it, expect, beforeEach } from "vitest";
import { AdelanteEHR, APPOINTMENT_SOURCE_LABEL, type Appointment } from "@/lib/ehr";

const HOUR = 60 * 60 * 1000;

function futureStart(hoursAhead: number) {
  return new Date(Date.now() + hoursAhead * HOUR).toISOString();
}

function twoClinicians() {
  const list = AdelanteEHR.listClinicians().filter((c) => c.active !== false);
  expect(list.length).toBeGreaterThan(1);
  return [list[0]!, list[1]!] as const;
}

describe("patient-level booking conflict", () => {
  let patientId: string;

  beforeEach(() => {
    const p = AdelanteEHR.createPatient({
      firstName: "Conflict",
      lastName: "Test",
      dob: "1990-01-01",
    });
    patientId = p.id;
  });

  it("rejects an overlapping self-booking with a DIFFERENT clinician", () => {
    const [a, b] = twoClinicians();
    const start = futureStart(72);
    AdelanteEHR.bookAppointment({
      patientId,
      clinicianId: a.id,
      start,
      durationMin: 50,
      source: "pre_release",
    });

    expect(() =>
      AdelanteEHR.bookAppointment({
        patientId,
        clinicianId: b.id,
        start,
        durationMin: 50,
        source: "self_scheduled",
      }),
    ).toThrow(/already have an appointment/i);
  });

  it("rejects a partial overlap, not just an identical start", () => {
    const [a, b] = twoClinicians();
    AdelanteEHR.bookAppointment({
      patientId,
      clinicianId: a.id,
      start: futureStart(96),
      durationMin: 50,
      source: "staff_scheduled",
    });

    expect(() =>
      AdelanteEHR.bookAppointment({
        patientId,
        clinicianId: b.id,
        start: new Date(Date.now() + 96 * HOUR + 10 * 60 * 1000).toISOString(),
        durationMin: 30,
        source: "self_scheduled",
      }),
    ).toThrow(/already have an appointment/i);
  });

  it("allows a back-to-back, non-overlapping booking", () => {
    const [a, b] = twoClinicians();
    AdelanteEHR.bookAppointment({
      patientId,
      clinicianId: a.id,
      start: futureStart(120),
      durationMin: 50,
      source: "staff_scheduled",
    });
    const next = AdelanteEHR.bookAppointment({
      patientId,
      clinicianId: b.id,
      start: new Date(Date.now() + 120 * HOUR + 50 * 60 * 1000).toISOString(),
      durationMin: 30,
      source: "self_scheduled",
    });
    expect(next.id).toBeTruthy();
  });

  it("ignores cancelled appointments when checking the patient's calendar", () => {
    const [a, b] = twoClinicians();
    const start = futureStart(144);
    const first = AdelanteEHR.bookAppointment({
      patientId,
      clinicianId: a.id,
      start,
      durationMin: 50,
      source: "staff_scheduled",
    });
    AdelanteEHR.updateAppointmentStatus(first.id, "cancelled");

    const second = AdelanteEHR.bookAppointment({
      patientId,
      clinicianId: b.id,
      start,
      durationMin: 50,
      source: "self_scheduled",
    });
    expect(second.id).toBeTruthy();
  });

  it("lets a staff path deliberately overlap via allowPatientOverlap", () => {
    const [a, b] = twoClinicians();
    const start = futureStart(168);
    AdelanteEHR.bookAppointment({
      patientId,
      clinicianId: a.id,
      start,
      durationMin: 50,
      source: "staff_scheduled",
    });
    const paired = AdelanteEHR.bookAppointment({
      patientId,
      clinicianId: b.id,
      start,
      durationMin: 50,
      source: "staff_scheduled",
      allowPatientOverlap: true,
    });
    expect(paired.id).toBeTruthy();
  });

  it("still rejects a same-clinician conflict for a different patient", () => {
    const [a] = twoClinicians();
    const other = AdelanteEHR.createPatient({ firstName: "Other", lastName: "Person" });
    const start = futureStart(192);
    AdelanteEHR.bookAppointment({
      patientId,
      clinicianId: a.id,
      start,
      durationMin: 50,
      source: "staff_scheduled",
    });
    expect(() =>
      AdelanteEHR.bookAppointment({
        patientId: other.id,
        clinicianId: a.id,
        start,
        durationMin: 50,
        source: "self_scheduled",
      }),
    ).toThrow(/just taken/i);
  });

  it("blocks a reschedule that would land on the patient's other visit", () => {
    const [a, b] = twoClinicians();
    const anchor = futureStart(216);
    AdelanteEHR.bookAppointment({
      patientId,
      clinicianId: a.id,
      start: anchor,
      durationMin: 50,
      source: "pre_release",
    });
    const movable = AdelanteEHR.bookAppointment({
      patientId,
      clinicianId: b.id,
      start: futureStart(240),
      durationMin: 50,
      source: "self_scheduled",
    });
    expect(() => AdelanteEHR.rescheduleAppointment(movable.id, anchor)).toThrow(
      /already have an appointment/i,
    );
  });
});

describe("appointment provenance", () => {
  it("records the source passed by each creation path", () => {
    const p = AdelanteEHR.createPatient({ firstName: "Prov", lastName: "Test" });
    const [a] = twoClinicians();
    const appt = AdelanteEHR.bookAppointment({
      patientId: p.id,
      clinicianId: a.id,
      start: futureStart(300),
      durationMin: 50,
      source: "self_scheduled",
    });
    expect(appt.source).toBe("self_scheduled");
  });

  it("defaults to staff_scheduled when a caller does not say", () => {
    const p = AdelanteEHR.createPatient({ firstName: "Default", lastName: "Test" });
    const [a] = twoClinicians();
    const appt = AdelanteEHR.bookAppointment({
      patientId: p.id,
      clinicianId: a.id,
      start: futureStart(320),
      durationMin: 50,
    });
    expect(appt.source).toBe("staff_scheduled");
  });

  it("every seeded appointment carries a source", () => {
    const rows: Appointment[] = AdelanteEHR.listAppointments();
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(APPOINTMENT_SOURCE_LABEL[r.source]).toBeTruthy();
    }
  });
});
