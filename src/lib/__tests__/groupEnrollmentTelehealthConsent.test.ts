// §Phase 6b — telehealth consent is checked at ENROLLMENT, not only at
// documentation time, and only when the patient would actually be asked to
// attend a virtual meeting. Also covers the virtual room / join link.
import { describe, expect, it } from "vitest";
import { AdelanteEHR, TELEHEALTH_CONSENT_CATEGORY } from "../ehr";

const THERAPIST = "test therapist";

function patientIds() {
  return AdelanteEHR.listPatients().map((p) => p.id);
}

function makeEligible(patientId: string) {
  AdelanteEHR.setGroupEligibility({
    patientId,
    reason: "placeholder criteria",
    role: "therapist",
    actor: THERAPIST,
  });
}

function grantTelehealthConsent(patientId: string) {
  AdelanteEHR.createConsentRecord({
    patientId,
    formType: "NonAB133",
    source: "test",
    signedByName: "Test Patient",
    attested: true,
    effectiveDate: "2020-01-01",
    sections: [{ category: TELEHEALTH_CONSENT_CATEGORY, authorized: true }],
    capturedBy: { staffName: "Luz Herrera", role: "ecm_provider" },
  });
}

function makeGroup(modality: "in_person" | "video") {
  const clinician = AdelanteEHR.listClinicians()[0]!;
  const start = new Date(Date.now() + 86400000);
  return AdelanteEHR.createGroupSession({
    topic: `Group (${modality})`,
    facilitatorId: clinician.id,
    serviceType: "therapy_group",
    modality,
    category: "skills_education",
    start: start.toISOString(),
    durationMin: 60,
    capacity: 8,
    recurrence: { kind: "none" },
    createdBy: THERAPIST,
  });
}

describe("telehealth consent at group enrollment", () => {
  it("blocks enrollment in a virtual group when the patient has no active consent", () => {
    const p = patientIds()[1]!;
    makeEligible(p);
    const g = makeGroup("video");
    expect(() =>
      AdelanteEHR.enrollInGroup({ sessionId: g.id, patientId: p, enrolledBy: THERAPIST }),
    ).toThrow(/telehealth consent/i);
  });

  it("allows the same enrollment once telehealth consent is on file", () => {
    const p = patientIds()[2]!;
    makeEligible(p);
    grantTelehealthConsent(p);
    const g = makeGroup("video");
    expect(
      AdelanteEHR.enrollInGroup({ sessionId: g.id, patientId: p, enrolledBy: THERAPIST }).patientId,
    ).toBe(p);
  });

  it("leaves in-person groups completely unaffected", () => {
    const p = patientIds()[3]!;
    makeEligible(p);
    const g = makeGroup("in_person");
    expect(
      AdelanteEHR.enrollInGroup({ sessionId: g.id, patientId: p, enrolledBy: THERAPIST }).patientId,
    ).toBe(p);
  });

  it("does not block a virtual-default group whose upcoming meeting is overridden to in person", () => {
    const p = patientIds()[3]!;
    makeEligible(p);
    const g = makeGroup("video");
    const start = AdelanteEHR.groupOccurrenceStarts(g.id, 1)[0]!;
    AdelanteEHR.setGroupOccurrenceModality(g.id, start, "in_person", THERAPIST);
    expect(AdelanteEHR.groupVirtualExposure(g.id).virtual).toBe(false);
    expect(
      AdelanteEHR.enrollInGroup({ sessionId: g.id, patientId: p, enrolledBy: THERAPIST }).patientId,
    ).toBe(p);
  });

  it("keeps virtual groups out of the patient's self-book list until consent exists", () => {
    const p = patientIds()[4] ?? patientIds()[1]!;
    makeEligible(p);
    const g = makeGroup("video");
    expect(AdelanteEHR.openGroupsForPatient(p).some((x) => x.id === g.id)).toBe(false);
    grantTelehealthConsent(p);
    expect(AdelanteEHR.openGroupsForPatient(p).some((x) => x.id === g.id)).toBe(true);
  });
});

describe("group virtual room / join link", () => {
  it("resolves the occurrence override before the group's standing link, and clears cleanly", () => {
    const g = makeGroup("video");
    const start = AdelanteEHR.groupOccurrenceStarts(g.id, 1)[0]!;
    expect(AdelanteEHR.groupJoinLink(g.id, start)).toBeUndefined();

    AdelanteEHR.setGroupVirtualRoom(g.id, "https://video.adelante.mock/room/standing", THERAPIST);
    expect(AdelanteEHR.groupJoinLink(g.id, start)?.joinUrl).toBe(
      "https://video.adelante.mock/room/standing",
    );

    AdelanteEHR.setGroupOccurrenceVirtualRoom(
      g.id,
      start,
      "https://video.adelante.mock/room/one-off",
      THERAPIST,
    );
    expect(AdelanteEHR.groupJoinLink(g.id, start)?.joinUrl).toBe(
      "https://video.adelante.mock/room/one-off",
    );

    AdelanteEHR.setGroupOccurrenceVirtualRoom(g.id, start, undefined, THERAPIST);
    expect(AdelanteEHR.groupJoinLink(g.id, start)?.joinUrl).toBe(
      "https://video.adelante.mock/room/standing",
    );
    AdelanteEHR.setGroupVirtualRoom(g.id, undefined, THERAPIST);
    expect(AdelanteEHR.groupJoinLink(g.id, start)).toBeUndefined();
  });
});
