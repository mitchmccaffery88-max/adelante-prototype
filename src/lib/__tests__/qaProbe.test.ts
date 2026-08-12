import { describe, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { resolvePopulation } from "@/lib/population";
describe("qa probe", () => {
  it("tracks", () => {
    for (const p of AdelanteEHR.listPatients()) {
      const r = resolvePopulation(p.id);
      console.log("TRACK", p.id, p.firstName, r.track, "|", r.basis);
    }
  });
});
