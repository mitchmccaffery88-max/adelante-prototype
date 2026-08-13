// §Advocate Build 2 — identity banner effective access, history masking, and
// which tiers may act on the schedule. These assert the gates, not the pixels.
import { describe, it, expect } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { activateAhcdForTest } from "./helpers/ahcdTestActivation";

let n = 0;

function link(authorizationType: "ahcd" | "hipaa_authorization" | "conservatorship") {
  const patient = AdelanteEHR.createPatient({ firstName: "Bea", lastName: `Build2_${++n}` });
  const invite = AdelanteEHR.createAdvocateInvitation({
    patientId: patient.id,
    advocateName: "Rosa Ibarra",
    relationship: "Sister",
    invitationSentTo: `rosa-b2-${n}@example.org`,
    invitationChannel: "email",
    designatedBy: { actor: "patient", name: "Test Patient" },
  });
  AdelanteEHR.claimAdvocateInvitation({
    code: invite.invitationCode,
    authorizationType,
    attestedName: "Rosa Ibarra",
  });
  if (authorizationType === "conservatorship") {
    // Conservator access is inert until certified court documents are verified.
    AdelanteEHR.recordAdvocateConservatorshipDocs(invite.id, {
      verifiedBy: "Val Ortiz, CF Care Manager",
      courtOrderRef: `TCSC-${n}`,
    });
  }
  return { patientId: patient.id, linkId: invite.id, firstName: patient.firstName };
}

describe("identity banner — effective access, not link existence", () => {
  it("withholds the patient's name for an AHCD link before clinician activation", () => {
    const { linkId } = link("ahcd");
    const before = AdelanteEHR.advocatePatientIdentity(linkId);
    expect(before.allowed).toBe(false);
    expect(before.firstName).toBeUndefined();
    expect(before.denyReason).toBe("ahcd_not_activated");
  });

  it("releases the first name once the determination is activated", () => {
    const { linkId, firstName } = link("ahcd");
    activateAhcdForTest(linkId);
    const after = AdelanteEHR.advocatePatientIdentity(linkId);
    expect(after.allowed).toBe(true);
    expect(after.firstName).toBe(firstName);
  });

  it("never returns a name for a revoked link", () => {
    const { linkId } = link("conservatorship");
    AdelanteEHR.revokeAdvocateLink(linkId, "patient", "No longer needed.");
    const view = AdelanteEHR.advocatePatientIdentity(linkId);
    expect(view.allowed).toBe(false);
    expect(view.firstName).toBeUndefined();
  });
});

describe("schedule write access by tier", () => {
  it("a HIPAA-only advocate is read-only", () => {
    const { linkId } = link("hipaa_authorization");
    expect(AdelanteEHR.advocateCanActOnSchedule(linkId)).toBe(false);
  });

  it("a conservator may act", () => {
    const { linkId } = link("conservatorship");
    expect(AdelanteEHR.advocateCanActOnSchedule(linkId)).toBe(true);
  });

  it("an unactivated AHCD advocate may not act even though the tier would allow it", () => {
    const { linkId } = link("ahcd");
    expect(AdelanteEHR.advocateCanActOnSchedule(linkId)).toBe(false);
    expect(() => AdelanteEHR.advocateRsvpAppointment(linkId, "appt_missing", "yes")).toThrow();
  });
});

describe("appointment history masking", () => {
  it("is denied outright when access is not effective", () => {
    const { linkId } = link("ahcd");
    const history = AdelanteEHR.advocateScheduleHistory(linkId);
    expect(history.allowed).toBe(false);
    expect(history.items).toEqual([]);
  });

  it("returns only the minimal DTO fields — no clinical content", () => {
    const { linkId } = link("conservatorship");
    const history = AdelanteEHR.advocateScheduleHistory(linkId);
    expect(history.allowed).toBe(true);
    for (const item of history.items) {
      expect(Object.keys(item).sort()).toEqual(
        expect.arrayContaining(["durationMin", "id", "kind", "label", "start", "status"]),
      );
      for (const key of Object.keys(item))
        expect(
          ["kind", "id", "start", "durationMin", "label", "status", "modality", "locationName"],
        ).toContain(key);
    }
  });
});
