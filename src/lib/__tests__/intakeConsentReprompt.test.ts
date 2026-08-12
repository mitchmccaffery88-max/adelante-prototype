// §Consent re-prompt safety — a second pass through intake must never
// downgrade a consent already on file.
import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "../ehr";

const patient = () => AdelanteEHR.listPatients()[0]!;

describe("intake re-entry does not downgrade existing consent", () => {
  it("keeps HIPAA + Part 2 consent when the re-prompt is skipped or declined", () => {
    const p = patient();
    AdelanteEHR.createConsentRecord({
      patientId: p.id,
      formType: "AB133",
      source: "test",
      signedByName: "Test Patient",
      attested: true,
      effectiveDate: "2020-01-01",
      sections: [{ category: "sud_treatment", authorized: true }],
      capturedBy: { staffName: "Luz Herrera", role: "ecm_provider" },
    });
    AdelanteEHR.completeIntake(p.id, { needs: p.needs, hipaa: true, part2Sud: true });
    expect(AdelanteEHR.isConsentCategoryAuthorized(p.id, "sud_treatment")).toBe(true);

    // Re-screen pass with an abandoned/declined consent step.
    AdelanteEHR.completeIntake(p.id, { needs: p.needs, hipaa: false, part2Sud: false });
    const after = AdelanteEHR.getPatient(p.id)!;
    expect(after.consents.hipaa).toBe(true);
    expect(after.consents.part2Sud).toBe(true);
    expect(AdelanteEHR.isConsentCategoryAuthorized(p.id, "sud_treatment")).toBe(true);
  });

  it("still records a first-time grant", () => {
    const p = AdelanteEHR.listPatients()[1]!;
    AdelanteEHR.completeIntake(p.id, { needs: p.needs, hipaa: true, part2Sud: true });
    expect(AdelanteEHR.getPatient(p.id)!.consents.hipaa).toBe(true);
  });
});
