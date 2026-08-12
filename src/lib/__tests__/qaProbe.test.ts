import { describe, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { resolvePopulation } from "@/lib/population";

describe("qa probe", () => {
  it("lists patients + tracks", () => {
    for (const p of AdelanteEHR.listPatients()) {
      const r = resolvePopulation(p.id);
      console.log(p.id, p.firstName, p.lastName, "intake:", !!p.intakeCompletedAt, "|", r.track, "|", r.basis, "| provisional:", r.provisional);
    }
    console.log("current:", AdelanteEHR.getCurrentPatientId());
    console.log("advocateLinks:", JSON.stringify((AdelanteEHR as any).listAdvocateLinks?.("p1") ?? "n/a"));
  });
});
