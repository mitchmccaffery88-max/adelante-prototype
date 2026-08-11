// §Group sessions — occurrence documentation, consent gating, nav discoverability.
import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "../ehr";
import { canAccess, noteGateClass } from "../roles";
import { STAFF_NAV } from "../navSections";
import { noteExportGate } from "../notePdf";


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


const patients = () => AdelanteEHR.listPatients();

function makeGroup() {
  const clinician = AdelanteEHR.listClinicians()[0]!;
  const g = AdelanteEHR.createGroupSession({
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
  return g;
}

describe("group session documentation", () => {
  it("3 present attendees produce 3 individualized notes plus 1 shared group note", () => {
    const g = makeGroup();
    const three = patients().slice(0, 3);
    for (const p of three)
      enrollEligible(g.id, p.id);
    const start = AdelanteEHR.groupOccurrenceStarts(g.id, 1)[0]!;
    AdelanteEHR.recordGroupAttendance(
      g.id,
      start,
      three.map((p) => ({ patientId: p.id, status: "present" as const })),
      "test",
    );
    const res = AdelanteEHR.documentGroupOccurrence({
      sessionId: g.id,
      occurrenceStart: start,
      facilitatorId: g.facilitatorId,
      topicCovered: "Coping skills",
      groupProcess: "Members engaged.",
      perAttendee: Object.fromEntries(three.map((p) => [p.id, `${p.firstName} participated.`])),
      actor: "test",
    });
    expect(res.attendeeNoteIds).toHaveLength(3);
    expect(res.occurrence.sharedNote).toBeTruthy();
    for (const p of three) {
      const notes = (AdelanteEHR.getPatient(p.id)?.progressNotes ?? []).filter((n) => n.category === "group");
      expect(notes.length).toBeGreaterThan(0);
      expect(notes.some((n) => n.groupRef?.billingEligible)).toBe(true);
    }
  });

  it("refuses to document without every present attendee individualized", () => {
    const g = makeGroup();
    const two = patients().slice(0, 2);
    for (const p of two)
      enrollEligible(g.id, p.id);
    const start = AdelanteEHR.groupOccurrenceStarts(g.id, 1)[0]!;
    AdelanteEHR.recordGroupAttendance(
      g.id,
      start,
      two.map((p) => ({ patientId: p.id, status: "present" as const })),
      "test",
    );
    expect(() =>
      AdelanteEHR.documentGroupOccurrence({
        sessionId: g.id,
        occurrenceStart: start,
        facilitatorId: g.facilitatorId,
        topicCovered: "t",
        groupProcess: "p",
        perAttendee: { [two[0]!.id]: "only one" },
        actor: "test",
      }),
    ).toThrow();
  });
});

describe("group notes reuse the same masking/consent gate as other notes", () => {
  it("routes group notes to the group_notes record class", () => {
    expect(noteGateClass({ category: "group" })).toBe("group_notes");
    expect(noteGateClass({ category: "sud" })).toBe("screeners_sud");
  });

  it("locks group notes for a role without group access", () => {
    const p = patients()[0]!;
    const blocked = canAccess("credentialing_coordinator", "group_notes", p);
    expect(blocked.locked).toBe(true);
    const gate = noteExportGate(
      {
        id: "n-test",
        patientId: p.id,
        clinicianId: "c1",
        date: new Date().toISOString(),
        sessionType: "group",
        subjective: "x",
        objective: "",
        assessment: "",
        plan: "",
        category: "group",
        status: "signed",
        signedAt: new Date().toISOString(),
        signedBy: "Facilitator",
      } as never,
      "credentialing_coordinator",
      p,
    );
    expect(gate.allowed).toBe(false);
  });
});

describe("nav discoverability + RBAC", () => {
  const item = STAFF_NAV.find((i) => i.to === "/group-sessions");

  it("is registered in the staff nav", () => {
    expect(item).toBeTruthy();
  });

  it("is hidden for a role without group_sessions access", () => {
    expect(canAccess("credentialing_coordinator", "group_sessions").level).toBe("none");
    expect(canAccess("therapist", "group_sessions").level).toBe("write");
  });
});

describe("recurrence editing regenerates future occurrences without rewriting history", () => {
  it("keeps attended occurrences and drops unused future ones", () => {
    const g = makeGroup();
    const p = patients()[0]!;
    enrollEligible(g.id, p.id);
    const starts = AdelanteEHR.groupOccurrenceStarts(g.id, 3);
    // Attendance taken on the first upcoming occurrence.
    AdelanteEHR.recordGroupAttendance(
      g.id,
      starts[0]!,
      [{ patientId: p.id, status: "present" as const }],
      "test",
    );
    // A future occurrence materialized but never used.
    AdelanteEHR.recordGroupAttendance(g.id, starts[2]!, [], "test");
    const unused = AdelanteEHR.getGroupOccurrence(g.id, starts[2]!);
    if (unused) {
      unused.attendance = [];
      unused.attendanceRecordedAt = undefined;
    }

    const other = (new Date(g.start).getDay() + 3) % 7;
    AdelanteEHR.updateGroupRecurrence(g.id, { kind: "weekly", daysOfWeek: [other] }, "test");

    expect(AdelanteEHR.getGroupOccurrence(g.id, starts[0]!)?.attendance).toHaveLength(1);
    expect(AdelanteEHR.getGroupOccurrence(g.id, starts[2]!)).toBeUndefined();
    expect(AdelanteEHR.getGroupSession(g.id)?.recurrence.daysOfWeek).toEqual([other]);
  });
});

describe("occurrence status reporting", () => {
  it("counts notes owed using the documentation rule", async () => {
    const { occurrenceOwedAttendees, occurrenceStatus } = await import("../groupMetrics");
    const g = makeGroup();
    const two = patients().slice(0, 2);
    for (const p of two)
      enrollEligible(g.id, p.id);
    const start = AdelanteEHR.groupOccurrenceStarts(g.id, 1)[0]!;
    AdelanteEHR.recordGroupAttendance(
      g.id,
      start,
      two.map((p) => ({ patientId: p.id, status: "present" as const })),
      "test",
    );
    let s = occurrenceStatus(g.id, start);
    expect(s.attendanceRecorded).toBe(true);
    expect(s.present).toBe(2);
    expect(s.notesOwed).toBe(2);
    expect(occurrenceOwedAttendees(g.id, start)).toHaveLength(2);

    AdelanteEHR.documentGroupOccurrence({
      sessionId: g.id,
      occurrenceStart: start,
      facilitatorId: g.facilitatorId,
      topicCovered: "t",
      groupProcess: "p",
      perAttendee: Object.fromEntries(two.map((p) => [p.id, "participated"])),
      actor: "test",
    });
    s = occurrenceStatus(g.id, start);
    expect(s.notesOwed).toBe(0);
    expect(s.notesComplete).toBe(2);
  });
});

// §Group notes — category-aware access. Retiring `group_participation`
// briefly pointed EVERY group note at `sud_treatment`; only the SUD clinical
// category is genuine Part 2 content.
describe("group note access is category-aware", () => {
  // Same resolution the chart and the PDF export use: noteGateClass() then
  // canAccess(). No parallel check.
  function resolve(note: Parameters<typeof noteGateClass>[0], role: Parameters<typeof canAccess>[0], patient: ReturnType<typeof AdelanteEHR.getPatient>) {
    const cls = noteGateClass(note);
    return cls ? canAccess(role, cls, patient) : { level: "read" as const, locked: false };
  }

  function documentedNoteFor(category: "sud_clinical_preauth" | "skills_education" | "open_psychoeducational") {
    const clinician = AdelanteEHR.listClinicians()[0]!;
    const g = AdelanteEHR.createGroupSession({
      topic: "placeholder topic",
      facilitatorId: clinician.id,
      serviceType: "therapy_group",
      modality: "in_person",
      category,
      start: new Date(Date.now() + 86400000).toISOString(),
      durationMin: 60,
      capacity: 8,
      recurrence: { kind: "weekly", daysOfWeek: [new Date().getDay()] },
      createdBy: "test",
    });
    const two = patients().slice(0, 2);
    for (const p of two) enrollEligible(g.id, p.id);
    const start = AdelanteEHR.groupOccurrenceStarts(g.id, 1)[0]!;
    AdelanteEHR.recordGroupAttendance(
      g.id,
      start,
      two.map((p) => ({ patientId: p.id, status: "present" as const })),
      "test",
    );
    AdelanteEHR.documentGroupOccurrence({
      sessionId: g.id,
      occurrenceStart: start,
      facilitatorId: g.facilitatorId,
      topicCovered: "t",
      groupProcess: "p",
      perAttendee: Object.fromEntries(two.map((p) => [p.id, "participated"])),
      actor: "test",
    });
    const patient = AdelanteEHR.getPatient(two[0]!.id)!;
    const note = (patient.progressNotes ?? []).filter((n) => n.groupRef?.sessionId === g.id).at(-1)!;
    return { note, patient };
  }

  // A role that is consent_gated for group_notes and holds NO sud_treatment
  // consent for this patient.
  const GATED_ROLE = "peer_specialist" as const;

  it("does NOT gate skills_education notes on SUD consent (positive access)", () => {
    const { note, patient } = documentedNoteFor("skills_education");
    expect(note.groupRef?.category).toBe("skills_education");
    expect(noteGateClass(note)).toBeUndefined();
    const gate = resolve(note, GATED_ROLE, patient);
    expect(gate.locked).toBe(false);
    expect(gate.level).not.toBe("none");
  });

  it("does NOT gate open_psychoeducational notes on SUD consent", () => {
    const { note, patient } = documentedNoteFor("open_psychoeducational");
    expect(noteGateClass(note)).toBeUndefined();
    expect(resolve(note, GATED_ROLE, patient).locked).toBe(false);
  });

  it("still gates sud_clinical_preauth group notes when SUD consent is absent", () => {
    const { note, patient } = documentedNoteFor("sud_clinical_preauth");
    expect(noteGateClass(note)).toBe("group_notes");
    const hasConsent = AdelanteEHR.isConsentCategoryAuthorized(patient.id, "sud_treatment");
    const gate = resolve(note, GATED_ROLE, patient);
    expect(gate.locked).toBe(!hasConsent);
    // And with no patient at all (no consent resolvable) it is always locked.
    expect(canAccess(GATED_ROLE, "group_notes", undefined).locked).toBe(true);
  });

  it("keeps the conservative Part 2 gate for an unstamped legacy group note", () => {
    expect(noteGateClass({ category: "group" })).toBe("group_notes");
  });
});
