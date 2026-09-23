import { it, expect } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { searchPatients } from "@/lib/patientSearch";
it("cin", () => {
  const ps = AdelanteEHR.listPatients();
  console.log(ps.slice(0, 6).map((p) => [p.id, p.firstName, p.cin]));
  console.log(searchPatients(ps, "70010001A").map((r) => [r.patient.id, r.matchedOn]));
  expect(true).toBe(true);
});
