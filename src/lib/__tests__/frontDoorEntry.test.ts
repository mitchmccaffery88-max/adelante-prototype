import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";

function newPatient(lastName: string) {
  const p = AdelanteEHR.createPatient({ firstName: "Test", lastName });
  return p.id;
}

describe("front-door entry storage", () => {
  it("flags 'not sure' about an existing record for the Phase 2 lookup", () => {
    const id = newPatient("Unsure");
    AdelanteEHR.recordFrontDoorEntry(id, { existingCare: "unsure" });
    expect(AdelanteEHR.getFrontDoorEntry(id)?.recordLookupPending).toBe(true);

    const id2 = newPatient("Definite");
    AdelanteEHR.recordFrontDoorEntry(id2, { existingCare: "no" });
    expect(AdelanteEHR.getFrontDoorEntry(id2)?.recordLookupPending).toBe(false);
  });

  it("stores coverage type and justice involvement as independent fields", () => {
    const id = newPatient("MedicareJustice");
    AdelanteEHR.setCoverage(id, {
      status: "none_unsure",
      verified: "not_found",
      coverageType: "medicare",
      justiceInvolvement: "yes",
    });
    const cov = AdelanteEHR.getPatient(id)?.coverage;
    // The old single-bucket model could not represent this combination.
    expect(cov?.coverageType).toBe("medicare");
    expect(cov?.justiceInvolvement).toBe("yes");
  });

  it("keeps a private-pay, never-justice-involved combination intact", () => {
    const id = newPatient("PrivatePay");
    AdelanteEHR.setCoverage(id, {
      status: "other",
      verified: "not_found",
      coverageType: "private",
      justiceInvolvement: "no",
    });
    const cov = AdelanteEHR.getPatient(id)?.coverage;
    expect(cov?.coverageType).toBe("private");
    expect(cov?.justiceInvolvement).toBe("no");
  });
});