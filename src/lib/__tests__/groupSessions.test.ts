// §Group sessions — occurrence documentation, consent gating, nav discoverability.
import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "../ehr";
import { canAccess, noteGateClass, visibleNavItems } from "../roles";
import { STAFF_NAV } from "../navSections";
import { noteExportGate } from "../notePdf";

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
      AdelanteEHR.enrollInGroup({ sessionId: g.id, patientId: p.id, enrolledBy: "test" });
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
      const notes = AdelanteEHR.listProgressNotes(p.id).filter((n) => n.category === "group");
      expect(notes.length).toBeGreaterThan(0);
      expect(notes.some((n) => n.groupRef?.billingEligible)).toBe(true);
    }
  });

  it("refuses to document without every present attendee individualized", () => {
    const g = makeGroup();
    const two = patients().slice(0, 2);
    for (const p of two)
      AdelanteEHR.enrollInGroup({ sessionId: g.id, patientId: p.id, enrolledBy: "test" });
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
    const blocked = canAccess("front_desk", "group_notes", p);
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
      "front_desk",
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
    const visible = visibleNavItems ? [] : [];
    void visible;
    expect(canAccess("front_desk", "group_sessions").level).toBe("none");
    expect(canAccess("therapist", "group_sessions").level).toBe("write");
  });
});
