// §Group sessions — single-occurrence cancel/reschedule + the PHI data gate.
import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "../ehr";
import { occurrenceStatuses, owedAttendeesForRole } from "../groupMetrics";


function enrollEligible(sessionId: string, patientId: string) {
  makeEligible(patientId);
  return AdelanteEHR.enrollInGroup({ sessionId, patientId, enrolledBy: "test" });
}

// §Group sessions — every enrollment path now requires the care-plan
// eligibility gate, so tests must set it first.
function makeEligible(patientId: string) {
  AdelanteEHR.setGroupEligibility({
    patientId,
    reason: "placeholder criteria",
    role: "therapist",
    actor: "test",
  });
}


function makeGroup() {
  const clinician = AdelanteEHR.listClinicians()[0]!;
  return AdelanteEHR.createGroupSession({
    topic: "Relapse prevention (placeholder topic)",
    facilitatorId: clinician.id,
    serviceType: "therapy_group",
    modality: "in_person",
    start: new Date(Date.now() + 86400000).toISOString(),
    durationMin: 60,
    capacity: 8,
    recurrence: { kind: "weekly", daysOfWeek: [new Date().getDay()] },
    createdBy: "test",
  });
}

describe("cancelling one future occurrence", () => {
  it("removes only that meeting and leaves the recurrence pattern alone", () => {
    const g = makeGroup();
    const starts = AdelanteEHR.groupOccurrenceStarts(g.id, 3);
    AdelanteEHR.cancelGroupOccurrence(g.id, starts[1]!, "facilitator out", "test");
    const after = AdelanteEHR.groupOccurrenceStarts(g.id, 3);
    expect(after).not.toContain(starts[1]);
    expect(after).toContain(starts[0]);
    expect(AdelanteEHR.getGroupSession(g.id)?.recurrence.daysOfWeek).toEqual([
      new Date().getDay(),
    ]);
  });

  it("requires a reason", () => {
    const g = makeGroup();
    const start = AdelanteEHR.groupOccurrenceStarts(g.id, 1)[0]!;
    expect(() => AdelanteEHR.cancelGroupOccurrence(g.id, start, "  ", "test")).toThrow();
  });

  it("BLOCKS cancelling an occurrence that already has attendance", () => {
    const g = makeGroup();
    const p = AdelanteEHR.listPatients()[0]!;
    enrollEligible(g.id, p.id);
    const start = AdelanteEHR.groupOccurrenceStarts(g.id, 1)[0]!;
    AdelanteEHR.recordGroupAttendance(
      g.id,
      start,
      [{ patientId: p.id, status: "present" }],
      "test",
    );
    expect(() => AdelanteEHR.cancelGroupOccurrence(g.id, start, "out", "test")).toThrow(
      /attendance or notes/i,
    );
    // Attendance survived untouched.
    expect(AdelanteEHR.getGroupOccurrence(g.id, start)?.attendance).toHaveLength(1);
    expect(AdelanteEHR.getGroupOccurrence(g.id, start)?.status).not.toBe("cancelled");
  });

  it("BLOCKS changing a past occurrence", () => {
    const g = makeGroup();
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(() => AdelanteEHR.cancelGroupOccurrence(g.id, past, "out", "test")).toThrow(/past/i);
  });
});

describe("rescheduling one future occurrence", () => {
  it("moves the meeting to the new time without touching the pattern", () => {
    const g = makeGroup();
    const starts = AdelanteEHR.groupOccurrenceStarts(g.id, 3);
    const moved = new Date(Date.parse(starts[1]!) + 2 * 3600000).toISOString();
    AdelanteEHR.rescheduleGroupOccurrence(g.id, starts[1]!, moved, "room conflict", "test");
    const after = AdelanteEHR.groupOccurrenceStarts(g.id, 4);
    expect(after).toContain(moved);
    expect(after).not.toContain(starts[1]);
    expect(AdelanteEHR.getGroupSession(g.id)?.recurrence.kind).toBe("weekly");
  });

  it("BLOCKS rescheduling an occurrence with notes already documented", () => {
    const g = makeGroup();
    const p = AdelanteEHR.listPatients()[1]!;
    enrollEligible(g.id, p.id);
    const start = AdelanteEHR.groupOccurrenceStarts(g.id, 1)[0]!;
    AdelanteEHR.recordGroupAttendance(
      g.id,
      start,
      [{ patientId: p.id, status: "present" }],
      "test",
    );
    AdelanteEHR.documentGroupOccurrence({
      sessionId: g.id,
      occurrenceStart: start,
      facilitatorId: g.facilitatorId,
      topicCovered: "t",
      groupProcess: "p",
      perAttendee: { [p.id]: "participated" },
      actor: "test",
    });
    const later = new Date(Date.parse(start) + 3600000).toISOString();
    expect(() =>
      AdelanteEHR.rescheduleGroupOccurrence(g.id, start, later, "moving", "test"),
    ).toThrow();
    expect(Object.keys(AdelanteEHR.getGroupOccurrence(g.id, start)!.attendeeNoteIds)).toHaveLength(
      1,
    );
  });

  it("refuses a past new time and a duplicate slot", () => {
    const g = makeGroup();
    const starts = AdelanteEHR.groupOccurrenceStarts(g.id, 3);
    expect(() =>
      AdelanteEHR.rescheduleGroupOccurrence(g.id, starts[1]!, "2000-01-01T00:00:00.000Z", "x", "t"),
    ).toThrow(/future/i);
    AdelanteEHR.recordGroupAttendance(g.id, starts[2]!, [], "test");
    expect(() =>
      AdelanteEHR.rescheduleGroupOccurrence(g.id, starts[1]!, starts[2]!, "x", "t"),
    ).toThrow(/already exists/i);
  });
});

describe("PHI gate on occurrence status — enforced in the DATA layer", () => {
  it("never hands attendee identities to a role without group_notes access", () => {
    const g = makeGroup();
    const two = AdelanteEHR.listPatients().slice(0, 2);
    for (const p of two)
      enrollEligible(g.id, p.id);
    const start = AdelanteEHR.groupOccurrenceStarts(g.id, 1)[0]!;
    AdelanteEHR.recordGroupAttendance(
      g.id,
      start,
      two.map((p) => ({ patientId: p.id, status: "present" as const })),
      "test",
    );

    // A role WITH access sees who owes a note.
    const allowed = owedAttendeesForRole("therapist", g.id, start);
    expect(allowed.allowed).toBe(true);
    expect(allowed.attendees).toHaveLength(2);

    // A role WITHOUT group_notes access receives nothing identifiable.
    const denied = owedAttendeesForRole("credentialing_coordinator", g.id, start);
    expect(denied.allowed).toBe(false);
    expect(denied.attendees).toEqual([]);
    const serialized = JSON.stringify(denied);
    for (const p of two) {
      expect(serialized).not.toContain(p.id);
      expect(serialized).not.toContain(p.firstName);
      expect(serialized).not.toContain(p.lastName);
    }

    // The aggregate status a lower-gated role may read carries counts only.
    const statuses = JSON.stringify(occurrenceStatuses(g.id, 6));
    for (const p of two) {
      expect(statuses).not.toContain(p.id);
      expect(statuses).not.toContain(p.lastName);
    }
  });
});
