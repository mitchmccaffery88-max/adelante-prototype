// §QA 5-state pass — a person can never become their own advocate.
import { describe, it, expect } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";

function invite(patientId: string) {
  return AdelanteEHR.createAdvocateInvitation({
    patientId,
    advocateName: "Self Claimer",
    relationship: "Self",
    invitationSentTo: "self@example.org",
    invitationChannel: "email",
    designatedBy: { actor: "patient", name: "Test Patient" },
  });
}

describe("self-referential advocate claim", () => {
  it("refuses a claim made from the same patient's own session", () => {
    const patientId = AdelanteEHR.listPatients()[0]!.id;
    const link = invite(patientId);
    expect(() =>
      AdelanteEHR.claimAdvocateInvitation({
        code: link.invitationCode,
        authorizationType: "family_participation",
        attestedName: "Self Claimer",
        actingPatientId: patientId,
      }),
    ).toThrow(/can't be your own advocate/i);
    expect(AdelanteEHR.getAdvocateLink(link.id)!.status).not.toBe("active");
  });

  it("allows the dual-role case: own record plus advocacy for someone else", () => {
    const [a, b] = AdelanteEHR.listPatients();
    const link = invite(b!.id);
    const claimed = AdelanteEHR.claimAdvocateInvitation({
      code: link.invitationCode,
      authorizationType: "family_participation",
      attestedName: "Self Claimer",
      actingPatientId: a!.id,
    });
    expect(claimed.status).toBe("active");
  });
});
