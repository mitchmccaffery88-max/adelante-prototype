import { describe, it, expect } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { isJusticeInvolved } from "@/lib/justiceInvolvement";
import { inReentryWindow } from "@/lib/structuredCarePlan";
import { recommendationsFor } from "@/lib/seeking";
import { resolvePopulation } from "@/lib/population";

const recent = new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10);

describe("justice-involvement gate", () => {
  it("a release date alone does not open reentry features", () => {
    const p = AdelanteEHR.createPatient({ firstName: "Gate", lastName: "No" });
    AdelanteEHR.setCoverage(p.id, { justiceInvolvement: "no" } as never);
    const rec = { ...AdelanteEHR.getPatient(p.id)!, releaseDate: recent };
    expect(isJusticeInvolved(rec)).toBe(false);
    expect(inReentryWindow(rec)).toBe(false);
    expect(recommendationsFor(rec).some((r) => r.id === "first-days-out" || r.id === "obligations")).toBe(false);
  });

  it("'prefer not to say' is not justice-involved and not a reentry population", () => {
    const p = AdelanteEHR.createPatient({ firstName: "Gate", lastName: "Prefer" });
    AdelanteEHR.setCoverage(p.id, { justiceInvolvement: "prefer_not" } as never);
    expect(isJusticeInvolved(AdelanteEHR.getPatient(p.id))).toBe(false);
    expect(resolvePopulation(p.id).track).toBe("general_population");
  });

  it("'yes' with a recent release opens the reentry window", () => {
    const p = AdelanteEHR.createPatient({ firstName: "Gate", lastName: "Yes" });
    AdelanteEHR.setCoverage(p.id, { justiceInvolvement: "yes" } as never);
    const rec = { ...AdelanteEHR.getPatient(p.id)!, releaseDate: recent };
    expect(inReentryWindow(rec)).toBe(true);
    expect(recommendationsFor(rec).some((r) => r.id === "obligations")).toBe(true);
  });
});
