// §v3.0 Phase 4 expansion — CONSENT-CONDITIONAL Part 2 visibility for advocates.
//
// The rule under test: SUD group topics and appointment service-type labels are
// masked from an advocate by DEFAULT, and become visible ONLY when BOTH hold:
//   1. an ACTIVE `advocate_sud_disclosure` ConsentRecord for that patient, and
//   2. that advocate's own authorization link is valid (the existing gate).
// Neither alone is sufficient, and the write-side mask never lifts.
import { describe, expect, it } from "vitest";
import { AdelanteEHR, type ConsentCategory, type GroupCategory } from "../ehr";
import {
  advocatePart2Masked,
  ADVOCATE_SUD_DISCLOSURE_CATEGORY,
  ADVOCATE_AUTHORIZATION_TYPES,
  type AdvocateAuthorizationType,
} from "../advocate";

function patientAt(i: number) {
  const list = AdelanteEHR.listPatients();
  return list[i % list.length]!;
}

function eligible(patientId: string) {
  AdelanteEHR.setGroupEligibility({
    patientId,
    reason: "placeholder criteria",
    curriculumNeedTag: "placeholder-tag",
    role: "therapist",
    actor: "test",
  });
}

const SUD_TOPIC = "Placeholder SUD relapse-prevention topic";

function sudGroupFor(patientId: string) {
  const clinician = AdelanteEHR.listClinicians()[0]!;
  const g = AdelanteEHR.createGroupSession({
    topic: SUD_TOPIC,
    category: "sud_clinical_preauth" as GroupCategory,
    facilitatorId: clinician.id,
    serviceType: "therapy_group",
    modality: "in_person",
    start: new Date(Date.now() + 86400000).toISOString(),
    durationMin: 60,
    capacity: 8,
    recurrence: { kind: "weekly", daysOfWeek: [new Date().getDay()] },
    createdBy: "test",
  });
  eligible(patientId);
  AdelanteEHR.enrollInGroup({ sessionId: g.id, patientId, enrolledBy: "test" });
  return g;
}

function appointmentFor(patientId: string) {
  const clinician = AdelanteEHR.listClinicians()[0]!;
  return AdelanteEHR.bookAppointment({
    patientId,
    clinicianId: clinician.id,
    start: new Date(Date.now() + 3 * 86400000 + Math.random() * 60000).toISOString(),
    durationMin: 50,
    serviceType: "therapy_individual",
    modality: "video",
  });
}

function connected(patientId: string, type: AdvocateAuthorizationType = "hipaa_authorization") {
  const link = AdelanteEHR.createAdvocateInvitation({
    patientId,
    advocateName: "Rosa Ibarra",
    relationship: "Sister",
    invitationSentTo: "rosa@example.org",
    invitationChannel: "email",
    designatedBy: { actor: "patient", name: "Test Patient" },
  });
  AdelanteEHR.claimAdvocateInvitation({
    code: link.invitationCode,
    authorizationType: type,
    attestedName: "Rosa Ibarra",
  });
  return AdelanteEHR.getAdvocateLink(link.id)!;
}

/** Capture the placeholder Part 2 disclosure authorization for a patient. */
function signSudDisclosure(patientId: string, authorized = true) {
  const sections: { category: ConsentCategory; authorized: boolean }[] = [
    { category: ADVOCATE_SUD_DISCLOSURE_CATEGORY, authorized },
  ];
  return AdelanteEHR.createConsentRecord({
    patientId,
    formType: "NonAB133",
    source: "placeholder — pending Christi's DHCS-sourced language",
    signedByName: "Test Patient",
    attested: true,
    effectiveDate: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    sections,
    capturedBy: { staffName: "Test", role: "therapist" },
  });
}

function labels(linkId: string) {
  return AdelanteEHR.advocateSchedule(linkId).items.map((i) => i.label);
}

describe("the policy predicate itself", () => {
  it("stays masked by default for every authorization type (regression)", () => {
    expect(advocatePart2Masked()).toBe(true);
    for (const t of ADVOCATE_AUTHORIZATION_TYPES) expect(advocatePart2Masked(t.key)).toBe(true);
  });

  it("requires BOTH facts — neither alone lifts the mask", () => {
    for (const t of ADVOCATE_AUTHORIZATION_TYPES) {
      expect(
        advocatePart2Masked(t.key, { linkValid: true, sudDisclosureConsentActive: false }),
      ).toBe(true);
      expect(
        advocatePart2Masked(t.key, { linkValid: false, sudDisclosureConsentActive: true }),
      ).toBe(true);
      expect(
        advocatePart2Masked(t.key, { linkValid: true, sudDisclosureConsentActive: true }),
      ).toBe(false);
    }
  });
});

describe("advocate schedule — consent-conditional Part 2 visibility", () => {
  it("masks SUD group topics and service types WITHOUT the consent category", () => {
    const p = patientAt(3);
    sudGroupFor(p.id);
    appointmentFor(p.id);
    const link = connected(p.id);
    const out = labels(link.id);
    expect(out).toContain("Group session");
    expect(out).toContain("Appointment");
    expect(out.join("|")).not.toContain(SUD_TOPIC);
  });

  it("reveals both once the consent category is active for that patient", () => {
    const p = patientAt(4);
    sudGroupFor(p.id);
    appointmentFor(p.id);
    const link = connected(p.id);
    expect(labels(link.id).join("|")).not.toContain(SUD_TOPIC);
    signSudDisclosure(p.id);
    const out = labels(link.id);
    expect(out.join("|")).toContain(SUD_TOPIC);
    expect(out).toContain("Talk with a counselor");
  });

  it("is scoped to the consenting patient — a different patient stays masked", () => {
    const consenting = patientAt(5);
    const other = patientAt(6);
    sudGroupFor(consenting.id);
    sudGroupFor(other.id);
    const linkA = connected(consenting.id);
    const linkB = connected(other.id);
    signSudDisclosure(consenting.id);
    expect(labels(linkA.id).join("|")).toContain(SUD_TOPIC);
    expect(labels(linkB.id).join("|")).not.toContain(SUD_TOPIC);
  });

  it("still requires a VALID link — consent alone grants nothing", () => {
    const p = patientAt(7);
    sudGroupFor(p.id);
    signSudDisclosure(p.id);
    // Invited but never claimed: no access at all, consent notwithstanding.
    const invited = AdelanteEHR.createAdvocateInvitation({
      patientId: p.id,
      advocateName: "Unclaimed Advocate",
      relationship: "Cousin",
      invitationSentTo: "nobody@example.org",
      invitationChannel: "email",
      designatedBy: { actor: "patient", name: "Test Patient" },
    });
    const denied = AdelanteEHR.advocateSchedule(invited.id);
    expect(denied.allowed).toBe(false);
    expect(denied.items).toHaveLength(0);

    // Revoking a previously-valid link re-masks immediately.
    const link = connected(p.id);
    expect(labels(link.id).join("|")).toContain(SUD_TOPIC);
    AdelanteEHR.revokeAdvocateLink(link.id, "test", "test revocation");
    expect(AdelanteEHR.advocateSchedule(link.id).allowed).toBe(false);
  });

  it("re-masks when the consent record is revoked (live, not cached)", () => {
    const p = patientAt(8);
    sudGroupFor(p.id);
    const link = connected(p.id);
    const rec = signSudDisclosure(p.id);
    expect(labels(link.id).join("|")).toContain(SUD_TOPIC);
    AdelanteEHR.revokeConsentRecord(rec.id, {
      reason: "patient revoked",
      revokedBy: "Test",
      role: "therapist",
    });
    expect(labels(link.id).join("|")).not.toContain(SUD_TOPIC);
  });

  it("an unauthorized (declined) section does not count as consent", () => {
    const p = patientAt(9);
    sudGroupFor(p.id);
    const link = connected(p.id);
    signSudDisclosure(p.id, false);
    expect(labels(link.id).join("|")).not.toContain(SUD_TOPIC);
  });
});

describe("write-side protection is unaffected by the new consent", () => {
  it("an advocate still cannot inject SUD text, even with the consent active", () => {
    const p = patientAt(10);
    const link = connected(p.id);
    signSudDisclosure(p.id);
    const coord = AdelanteEHR.advocateAddCoordinationNeed(link.id, {
      need: "Ride to methadone clinic",
    });
    expect(coord.ok).toBe(false);
    const comment = AdelanteEHR.advocateAddCarePlanComment(link.id, {
      section: "housing",
      text: "Needs a sober living bed after detox",
    });
    expect(comment.ok).toBe(false);
  });
});
