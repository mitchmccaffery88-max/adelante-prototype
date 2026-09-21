import { describe, it, expect } from "vitest";
import { resolveVisitLink } from "@/lib/noteVisitLink";
import type { Appointment, ProgressNote } from "@/lib/ehr";

const appt = (over: Partial<Appointment> & { id: string; start: string }): Appointment =>
  ({
    patientId: "p1",
    clinicianId: "c1",
    status: "attended",
    durationMin: 30,
    ...over,
  }) as Appointment;

const note = (over: Partial<ProgressNote>): ProgressNote =>
  ({
    id: "n1",
    clinicianId: "c1",
    date: "2026-01-10T18:00:00.000Z",
    sessionType: "individual",
    subjective: "",
    objective: "",
    assessment: "",
    plan: "",
    ...over,
  }) as ProgressNote;

const NOTE_DATE = "2026-01-10T18:00:00.000Z";
const base = { patientId: "p1", authorId: "c1", noteDate: NOTE_DATE };

describe("note → visit link", () => {
  it("defaults to the single same-day attended visit of this author", () => {
    const r = resolveVisitLink([appt({ id: "a1", start: "2026-01-10T15:00:00.000Z" })], [], base);
    expect(r.defaultId).toBe("a1");
    expect(r.ambiguous).toBe(false);
  });

  it("does not guess when two same-day own visits exist", () => {
    const r = resolveVisitLink(
      [
        appt({ id: "a1", start: "2026-01-10T15:00:00.000Z" }),
        appt({ id: "a2", start: "2026-01-10T19:30:00.000Z" }),
      ],
      [],
      base,
    );
    expect(r.defaultId).toBeUndefined();
    expect(r.ambiguous).toBe(true);
    expect(r.candidates).toHaveLength(2);
  });

  it("offers but never defaults to another clinician's or another day's visit", () => {
    const r = resolveVisitLink(
      [
        appt({ id: "a1", start: "2026-01-10T15:00:00.000Z", clinicianId: "c2" }),
        appt({ id: "a2", start: "2026-01-04T15:00:00.000Z" }),
      ],
      [],
      base,
    );
    expect(r.defaultId).toBeUndefined();
    expect(r.ambiguous).toBe(false);
    expect(r.candidates.map((c) => c.appointment.id)).toEqual(["a1", "a2"]);
  });

  it("skips visits a note already documents and non-attended visits", () => {
    const r = resolveVisitLink(
      [
        appt({ id: "a1", start: "2026-01-10T15:00:00.000Z" }),
        appt({ id: "a2", start: "2026-01-10T16:00:00.000Z", status: "scheduled" }),
      ],
      [note({ appointmentId: "a1" })],
      base,
    );
    expect(r.candidates).toHaveLength(0);
    expect(r.defaultId).toBeUndefined();
  });
});
