import { describe, it } from "vitest";
import { AdelanteEHR } from "../ehr";
describe("x", () => { it("y", () => {
  for (const p of AdelanteEHR.listPatients().slice(0,5))
    console.log(p.id, AdelanteEHR.isConsentCategoryAuthorized(p.id, "sud_treatment"));
}); });
