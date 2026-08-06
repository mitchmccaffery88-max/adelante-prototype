// §Group sessions — reporting helpers (claims linkage, admin activity, utilization).
import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "../ehr";
import {
  activeGroupSessions,
  enrolledPatientCount,
  groupAbsences,
  groupAttendanceRate,
  nextGroupOccurrenceForPatient,
  occurrencePeers,
  parseGroupEncounterId,
  weeklyGroupSeats,
} from "../groupMetrics";


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


function makeGroup(topic = "Relapse prevention (placeholder topic)") {
  const clinician = AdelanteEHR.listClinicians()[0]!;
  return AdelanteEHR.createGroupSession({
    topic,
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

describe("group encounter ids", () => {
  it("round-trips the patterned encounterId including colons in the ISO start", () => {
    const id = "group:gs_1:2026-02-01T10:00:00.000Z:pt_7";
    expect(parseGroupEncounterId(id)).toEqual({
      sessionId: "gs_1",
      occurrenceStart: "2026-02-01T10:00:00.000Z",
      patientId: "pt_7",
    });
  });

  it("ignores 1:1 encounter ids", () => {
    expect(parseGroupEncounterId("appt_123")).toBeNull();
  });
});

describe("group reporting", () => {
  it("counts rosters, seats, peers and attendance from live records", () => {
    const g = makeGroup();
    const three = AdelanteEHR.listPatients().slice(0, 3);
    for (const p of three)
      enrollEligible(g.id, p.id);

    expect(activeGroupSessions().some((x) => x.id === g.id)).toBe(true);
    expect(enrolledPatientCount()).toBeGreaterThanOrEqual(3);
    expect(weeklyGroupSeats().filter((s) => s.sessionId === g.id).length).toBeGreaterThanOrEqual(3);

    const next = nextGroupOccurrenceForPatient(three[0]!.id);
    expect(next?.sessionId).toBe(g.id);

    // Record attendance on a past occurrence so it falls inside the 30d window.
    const start = new Date(Date.now() - 86400000).toISOString();
    AdelanteEHR.recordGroupAttendance(
      g.id,
      start,
      [
        { patientId: three[0]!.id, status: "present" as const },
        { patientId: three[1]!.id, status: "late" as const },
        { patientId: three[2]!.id, status: "absent" as const },
      ],
      "test",
    );

    const peers = occurrencePeers({
      sessionId: g.id,
      occurrenceStart: start,
      patientId: three[0]!.id,
    });
    // Absent attendees are not "present with" anyone.
    expect(peers.map((p) => p.patientId)).toEqual([three[1]!.id]);

    const rate = groupAttendanceRate();
    expect(rate.pct).not.toBeNull();
    expect(rate.absent).toBeGreaterThanOrEqual(1);

    const abs = groupAbsences();
    expect(abs.some((r) => r.patientId === three[2]!.id && r.status === "absent")).toBe(true);
  });

  it("reports no live metric rather than 0% when the window has no attendance", () => {
    const rate = groupAttendanceRate(new Date("2000-01-01T00:00:00.000Z"));
    expect(rate.pct).toBeNull();
    expect(rate.denominator).toBe(0);
  });
});
