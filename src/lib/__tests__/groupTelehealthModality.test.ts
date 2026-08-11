// §Group sessions — occurrence modality, per-member telehealth consent gate,
// optional confidentiality acknowledgment, and roster privacy.
import { describe, expect, it } from "vitest";
import {
  AdelanteEHR,
  GROUP_CONFIDENTIALITY_CATEGORY,
  TELEHEALTH_CONSENT_CATEGORY,
  TELEHEALTH_DISCLOSURE_ELEMENTS,
  type ConsentCategory,
} from "../ehr";

const patients = () => AdelanteEHR.listPatients();

function makeEligible(patientId: string) {
  AdelanteEHR.setGroupEligibility({
    patientId,
    reason: "placeholder criteria",
    role: "therapist",
    actor: "test",
  });
}

function grantConsent(patientId: string, category: ConsentCategory) {
  return AdelanteEHR.createConsentRecord({
    patientId,
    formType: "NonAB133",
    source: "test",
    signedByName: "Test Patient",
    attested: true,
    effectiveDate: "2020-01-01",
    sections: [{ category, authorized: true }],
    capturedBy: { staffName: "Luz Herrera", role: "ecm_provider" },
  });
}

function makeGroup() {
  const clinician = AdelanteEHR.listClinicians()[0]!;
  return AdelanteEHR.createGroupSession({
    topic: "Skills group (placeholder topic)",
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

function seatTwo() {
  const g = makeGroup();
  const two = patients().slice(0, 2);
  for (const p of two) {
    makeEligible(p.id);
    AdelanteEHR.enrollInGroup({ sessionId: g.id, patientId: p.id, enrolledBy: "test" });
  }
  const start = AdelanteEHR.groupOccurrenceStarts(g.id, 1)[0]!;
  AdelanteEHR.recordGroupAttendance(
    g.id,
    start,
    two.map((p) => ({ patientId: p.id, status: "present" as const })),
    "test",
  );
  return { g, two, start };
}

const doc = (g: { id: string; facilitatorId: string }, start: string, ids: string[], modality?: "in_person" | "video" | "audio_only") =>
  AdelanteEHR.documentGroupOccurrence({
    sessionId: g.id,
    occurrenceStart: start,
    facilitatorId: g.facilitatorId,
    topicCovered: "t",
    groupProcess: "p",
    perAttendee: Object.fromEntries(ids.map((id) => [id, "participated"])),
    ...(modality ? { modality } : {}),
    actor: "test",
  });

describe("telehealth consent gate on virtual occurrences", () => {
  it("refuses to document a video occurrence for a member without telehealth consent", () => {
    const { g, two, start } = seatTwo();
    expect(() => doc(g, start, two.map((p) => p.id), "video")).toThrow(/Telehealth consent/i);
  });

  it("refuses audio-only the same way, and is per-member (one consented, one not)", () => {
    const { g, two, start } = seatTwo();
    grantConsent(two[0]!.id, TELEHEALTH_CONSENT_CATEGORY);
    const gate = AdelanteEHR.groupOccurrenceConsentGate(g.id, start);
    expect(gate.virtual).toBe(false); // not yet set to a virtual modality
    AdelanteEHR.setGroupOccurrenceModality(g.id, start, "audio_only", "test");
    const gate2 = AdelanteEHR.groupOccurrenceConsentGate(g.id, start);
    expect(gate2.virtual).toBe(true);
    expect(gate2.blocked.map((b) => b.patientId)).toEqual([two[1]!.id]);
    expect(() => doc(g, start, two.map((p) => p.id))).toThrow(/Telehealth consent/i);
  });

  it("documents a virtual occurrence once every present member has consent, stamping modality", () => {
    const { g, two, start } = seatTwo();
    for (const p of two) grantConsent(p.id, TELEHEALTH_CONSENT_CATEGORY);
    const res = doc(g, start, two.map((p) => p.id), "video");
    expect(res.attendeeNoteIds).toHaveLength(2);
    for (const p of two) {
      const note = (AdelanteEHR.getPatient(p.id)?.progressNotes ?? []).find(
        (n) => n.groupRef?.sessionId === g.id && n.groupRef.occurrenceStart === start,
      );
      expect(note?.groupRef?.modality).toBe("video");
      expect(note?.objective).toContain("video");
    }
  });

  it("leaves in-person occurrences completely unaffected by telehealth consent status", () => {
    const { g, two, start } = seatTwo();
    const gate = AdelanteEHR.groupOccurrenceConsentGate(g.id, start);
    expect(gate.modality).toBe("in_person");
    expect(gate.blocked).toEqual([]);
    const res = doc(g, start, two.map((p) => p.id), "in_person");
    expect(res.attendeeNoteIds).toHaveLength(2);
  });

  it("presents the four required DHCS disclosure elements", () => {
    expect(TELEHEALTH_DISCLOSURE_ELEMENTS.map((e) => e.key).sort()).toEqual([
      "limitations",
      "right_to_in_person",
      "transportation_benefits",
      "voluntary_revocable",
    ]);
  });
});

describe("group confidentiality acknowledgment is optional and off by default", () => {
  it("defaults off and never blocks", () => {
    expect(AdelanteEHR.isGroupConfidentialityAckRequired()).toBe(false);
    const { g, two, start } = seatTwo();
    expect(doc(g, start, two.map((p) => p.id)).attendeeNoteIds).toHaveLength(2);
  });

  it("blocks only once a county turns it on, and clears when acknowledged", () => {
    const { g, two, start } = seatTwo();
    AdelanteEHR.setGroupConfidentialityAckRequired(true, "test");
    expect(() => doc(g, start, two.map((p) => p.id))).toThrow(/confidentiality/i);
    for (const p of two) grantConsent(p.id, GROUP_CONFIDENTIALITY_CATEGORY);
    expect(doc(g, start, two.map((p) => p.id)).attendeeNoteIds).toHaveLength(2);
    AdelanteEHR.setGroupConfidentialityAckRequired(false, "test");
  });
});

describe("roster privacy — no attendee ever learns who else attended", () => {
  it("keeps other attendees out of each attendee's own note and patient-facing views", () => {
    const { g, two, start } = seatTwo();
    doc(g, start, two.map((p) => p.id));
    for (const p of two) {
      const others = two.filter((o) => o.id !== p.id);
      const notes = (AdelanteEHR.getPatient(p.id)?.progressNotes ?? []).filter(
        (n) => n.groupRef?.sessionId === g.id,
      );
      const serialized = JSON.stringify(notes);
      for (const o of others) {
        expect(serialized).not.toContain(o.id);
        expect(serialized).not.toContain(o.firstName);
        expect(serialized).not.toContain(o.lastName);
      }
      // Patient-facing surfaces: "Your groups" + open groups + occurrence times.
      const facing = JSON.stringify({
        mine: AdelanteEHR.groupsForPatient(p.id),
        open: AdelanteEHR.openGroupsForPatient(p.id),
        starts: AdelanteEHR.groupOccurrenceStarts(g.id, 4),
      });
      for (const o of others) {
        expect(facing).not.toContain(o.id);
        expect(facing).not.toContain(o.lastName);
      }
    }
    // The roster snapshot itself is provider-level only — it lives on the
    // shared group note, never on an attendee's ProgressNote.
    const occ = AdelanteEHR.getGroupOccurrence(g.id, start)!;
    expect(occ.sharedNote?.rosterSnapshot).toHaveLength(2);
    for (const p of two) {
      const note = (AdelanteEHR.getPatient(p.id)?.progressNotes ?? []).find(
        (n) => n.groupRef?.occurrenceStart === start,
      )!;
      expect(JSON.stringify(note)).not.toContain("rosterSnapshot");
    }
  });
});
