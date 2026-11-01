import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import fixture from "./rescreenTileActorNov01.fixture.json";
import { withApprovedRescreenTileActorNov01 } from "./rescreenTileActorNov01Approved";
import { withApprovedCredentialingOct27 } from "./credentialingOct27Approved";

const P = "src/lib/__tests__/rescreenDashboardR53p2.test.ts";

describe("R53 tile actor type fix exact-once approval", () => {
  it("exact apply, final chain, drift and reapplication refusal", () => {
    const a = fixture[P];
    expect(withApprovedRescreenTileActorNov01(P, a.priorSource)).toBe(a.updatedSource);
    expect(readFileSync(P, "utf8")).toBe(a.updatedSource);
    expect(() => withApprovedRescreenTileActorNov01(P, a.priorSource + "\n")).toThrow("prior source changed");
    expect(() => withApprovedRescreenTileActorNov01(P, a.updatedSource)).toThrow("prior source changed");
  });
  it("final chain from the follow-up output reaches the current file", () => {
    const prior = JSON.parse(readFileSync("src/test/rescreenTileFollowupNov01.fixture.json", "utf8"))[P];
    expect(withApprovedCredentialingOct27(P, prior.priorSource)).toBe(readFileSync(P, "utf8"));
  });
  it("removes only the actor name property", () => {
    const a = fixture[P];
    expect(a.edits).toEqual([["{ role: therapist.role, staffId: therapist.id, name: therapist.name }", "{ role: therapist.role, staffId: therapist.id }"]]);
    expect(a.priorSource.replace(", name: therapist.name }", " }")).toBe(a.updatedSource);
  });
  it("is chained directly after the follow-up approval", () => {
    expect(readFileSync("src/test/credentialingOct27Approved.ts", "utf8")).toContain("return withApprovedRescreenTileActorNov01(path, withApprovedRescreenTileFollowupNov01(path,");
  });
  it("leaves unrelated files untouched", () => expect(withApprovedRescreenTileActorNov01("src/lib/roles.ts", "unchanged")).toBe("unchanged"));
});
