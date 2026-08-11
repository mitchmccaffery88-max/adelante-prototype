// §Group sessions — multi-facilitator minutes, designated rendering provider,
// and DHCS same-day multiple-group claiming.
import { describe, expect, it } from "vitest";
import { AdelanteEHR, type GroupCategory } from "../ehr";
import { AdelanteEHRExt } from "../ehr-ext";

function eligible(patientId: string) {
  AdelanteEHR.setGroupEligibility({
    patientId,
    reason: "placeholder criteria",
    curriculumNeedTag: "placeholder-tag",
    role: "therapist",
    actor: "test",
  });
}

function makeGroup(category: GroupCategory, coFacilitatorIds?: string[], startOffsetMin = 0) {
  const [a] = AdelanteEHR.listClinicians();
  // Anchor to 09:00 local TOMORROW so a same-day second occurrence (+180 min)
  // never rolls over midnight when the suite happens to run late in the day.
  const start = new Date(Date.now() + 86400000);
  start.setHours(9, 0, 0, 0);
  start.setMinutes(start.getMinutes() + startOffsetMin);
  return AdelanteEHR.createGroupSession({
    topic: "Multi-facilitator group",
    category,
    facilitatorId: a!.id,
    coFacilitatorIds,
    serviceType: "therapy_group",
    modality: "in_person",
    start: start.toISOString(),
    durationMin: 60,
    capacity: 8,
    recurrence: { kind: "none" },
    createdBy: "test",
  });
}

function roster(n: number) {
  const list = AdelanteEHR.listPatients().slice(0, n);
  for (const p of list) eligible(p.id);
  return list;
}

describe("multi-facilitator minutes", () => {
  it("records INDEPENDENT minutes per facilitator and renders both on every attendee note", () => {
    const [a, b] = AdelanteEHR.listClinicians();
    const g = makeGroup("skills_education", [b!.id]);
    const people = roster(2);
    for (const p of people)
      AdelanteEHR.enrollInGroup({ sessionId: g.id, patientId: p.id, enrolledBy: "test" });
    const start = AdelanteEHR.groupOccurrenceStarts(g.id, 1)[0]!;
    AdelanteEHR.recordGroupAttendance(
      g.id,
      start,
      people.map((p) => ({ patientId: p.id, status: "present" as const })),
      "test",
    );
    AdelanteEHR.documentGroupOccurrence({
      sessionId: g.id,
      occurrenceStart: start,
      facilitatorId: g.facilitatorId,
      topicCovered: "t",
      groupProcess: "pr",
      facilitators: [
        { staffId: a!.id, role: "primary", minutes: 60, involvement: "Led the group" },
        { staffId: b!.id, role: "co", minutes: 25, involvement: "Co-regulation support" },
      ],
      perAttendee: Object.fromEntries(people.map((p) => [p.id, "participated"])),
      actor: "test",
    });
    const occ = AdelanteEHR.getGroupOccurrence(g.id, start)!;
    // Two distinct durations survive on ONE occurrence — no combined field.
    expect(occ.facilitators?.map((f) => f.minutes)).toEqual([60, 25]);

    for (const p of people) {
      const note = (AdelanteEHR.getPatient(p.id)?.progressNotes ?? []).find(
        (n) => n.id === occ.attendeeNoteIds[p.id],
      )!;
      expect(note.groupRef?.facilitators).toHaveLength(2);
      expect(note.groupRef?.facilitators?.find((f) => f.staffId === a!.id)?.minutes).toBe(60);
      expect(note.groupRef?.facilitators?.find((f) => f.staffId === b!.id)?.minutes).toBe(25);
      expect(note.objective).toContain(a!.name);
      expect(note.objective).toContain(b!.name);
      expect(note.objective).toContain("60 min");
      expect(note.objective).toContain("25 min");
      expect(note.objective).toContain("Co-regulation support");
    }
  });

  it("rejects a facilitator with no recorded minutes", () => {
    const [a, b] = AdelanteEHR.listClinicians();
    const g = makeGroup("skills_education", [b!.id]);
    const people = roster(2);
    for (const p of people)
      AdelanteEHR.enrollInGroup({ sessionId: g.id, patientId: p.id, enrolledBy: "test" });
    const start = AdelanteEHR.groupOccurrenceStarts(g.id, 1)[0]!;
    AdelanteEHR.recordGroupAttendance(
      g.id,
      start,
      people.map((p) => ({ patientId: p.id, status: "present" as const })),
      "test",
    );
    expect(() =>
      AdelanteEHR.documentGroupOccurrence({
        sessionId: g.id,
        occurrenceStart: start,
        facilitatorId: g.facilitatorId,
        topicCovered: "t",
        groupProcess: "pr",
        facilitators: [
          { staffId: a!.id, role: "primary", minutes: 60, involvement: "" },
          { staffId: b!.id, role: "co", minutes: 0, involvement: "" },
        ],
        perAttendee: Object.fromEntries(people.map((p) => [p.id, "x"])),
        actor: "test",
      }),
    ).toThrow(/minutes/i);
  });
});

describe("designated rendering provider", () => {
  it("defaults to the primary facilitator and is the ONLY provider on the claim", () => {
    const [a, b] = AdelanteEHR.listClinicians();
    const g = makeGroup("skills_education", [b!.id]);
    const people = roster(2);
    for (const p of people)
      AdelanteEHR.enrollInGroup({ sessionId: g.id, patientId: p.id, enrolledBy: "test" });
    const start = AdelanteEHR.groupOccurrenceStarts(g.id, 1)[0]!;
    AdelanteEHR.recordGroupAttendance(
      g.id,
      start,
      people.map((p) => ({ patientId: p.id, status: "present" as const })),
      "test",
    );
    AdelanteEHR.documentGroupOccurrence({
      sessionId: g.id,
      occurrenceStart: start,
      facilitatorId: g.facilitatorId,
      topicCovered: "t",
      groupProcess: "pr",
      facilitators: [
        { staffId: a!.id, role: "primary", minutes: 60, involvement: "Led" },
        { staffId: b!.id, role: "co", minutes: 20, involvement: "Support" },
      ],
      perAttendee: Object.fromEntries(people.map((p) => [p.id, "x"])),
      actor: "test",
    });
    expect(AdelanteEHR.groupRenderingProviderId(g.id, start)).toBe(a!.id);
    const occ = AdelanteEHR.getGroupOccurrence(g.id, start)!;
    const claims = people.map(
      (p) =>
        AdelanteEHRExt.upsertClaimFromGroupAttendee({
          sessionId: g.id,
          occurrenceStart: start,
          patientId: p.id,
          facilitatorId: g.facilitatorId,
          noteId: occ.attendeeNoteIds[p.id]!,
        })!,
    );
    // Co-facilitator time is documented but NEVER separately claimed.
    expect(claims.every((c) => c.clinicianId === a!.id)).toBe(true);
    expect(claims.some((c) => c.clinicianId === b!.id)).toBe(false);
  });

  it("can be changed, and the change is reflected on subsequent claims", () => {
    const [a, b] = AdelanteEHR.listClinicians();
    const g = makeGroup("skills_education", [b!.id]);
    const people = roster(2);
    for (const p of people)
      AdelanteEHR.enrollInGroup({ sessionId: g.id, patientId: p.id, enrolledBy: "test" });
    const start = AdelanteEHR.groupOccurrenceStarts(g.id, 1)[0]!;
    AdelanteEHR.recordGroupAttendance(
      g.id,
      start,
      people.map((p) => ({ patientId: p.id, status: "present" as const })),
      "test",
    );
    AdelanteEHR.documentGroupOccurrence({
      sessionId: g.id,
      occurrenceStart: start,
      facilitatorId: g.facilitatorId,
      topicCovered: "t",
      groupProcess: "pr",
      facilitators: [
        { staffId: a!.id, role: "primary", minutes: 60, involvement: "Led" },
        { staffId: b!.id, role: "co", minutes: 45, involvement: "Support" },
      ],
      perAttendee: Object.fromEntries(people.map((p) => [p.id, "x"])),
      actor: "test",
    });
    AdelanteEHR.setGroupRenderingProvider(g.id, start, b!.id, "test");
    expect(AdelanteEHR.groupRenderingProviderId(g.id, start)).toBe(b!.id);
    const occ = AdelanteEHR.getGroupOccurrence(g.id, start)!;
    const claim = AdelanteEHRExt.upsertClaimFromGroupAttendee({
      sessionId: g.id,
      occurrenceStart: start,
      patientId: people[0]!.id,
      facilitatorId: g.facilitatorId,
      noteId: occ.attendeeNoteIds[people[0]!.id]!,
    })!;
    expect(claim.clinicianId).toBe(b!.id);
    // A non-facilitator can never be the rendering provider.
    expect(() => AdelanteEHR.setGroupRenderingProvider(g.id, start, "not-a-facilitator", "test")).toThrow();
  });
});

describe("DHCS same-day multiple group claims", () => {
  it("produces two SEPARATE claims for two distinct same-day occurrences (same patient + provider + code)", () => {
    const [a] = AdelanteEHR.listClinicians();
    const people = roster(2);
    const g1 = makeGroup("skills_education", undefined, 0);
    const g2 = makeGroup("skills_education", undefined, 180);
    const made = [g1, g2].map((g) => {
      for (const p of people)
        AdelanteEHR.enrollInGroup({ sessionId: g.id, patientId: p.id, enrolledBy: "test" });
      const start = AdelanteEHR.groupOccurrenceStarts(g.id, 1)[0]!;
      AdelanteEHR.recordGroupAttendance(
        g.id,
        start,
        people.map((p) => ({ patientId: p.id, status: "present" as const })),
        "test",
      );
      AdelanteEHR.documentGroupOccurrence({
        sessionId: g.id,
        occurrenceStart: start,
        facilitatorId: g.facilitatorId,
        topicCovered: "t",
        groupProcess: "pr",
        perAttendee: Object.fromEntries(people.map((p) => [p.id, "x"])),
        actor: "test",
      });
      const occ = AdelanteEHR.getGroupOccurrence(g.id, start)!;
      return AdelanteEHRExt.upsertClaimFromGroupAttendee({
        sessionId: g.id,
        occurrenceStart: start,
        patientId: people[0]!.id,
        facilitatorId: g.facilitatorId,
        noteId: occ.attendeeNoteIds[people[0]!.id]!,
      })!;
    });
    const [c1, c2] = made;
    // Same calendar day, same beneficiary, same rendering provider, same code.
    expect(new Date(AdelanteEHR.groupOccurrenceStarts(g1.id, 1)[0]!).toDateString()).toBe(
      new Date(AdelanteEHR.groupOccurrenceStarts(g2.id, 1)[0]!).toDateString(),
    );
    expect(c1!.patientId).toBe(c2!.patientId);
    expect(c1!.clinicianId).toBe(a!.id);
    expect(c2!.clinicianId).toBe(a!.id);
    expect(c1!.serviceCode).toBe(c2!.serviceCode);
    // ...and yet two REAL, distinct claims — no collapse, no silent dedupe.
    expect(c1!.id).not.toBe(c2!.id);
    expect(c1!.encounterId).not.toBe(c2!.encounterId);
  });
});
