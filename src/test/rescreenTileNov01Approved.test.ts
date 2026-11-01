import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import fixture from "./rescreenTileNov01.fixture.json";
import { withApprovedRescreenTileNov01 } from "./rescreenTileNov01Approved";
describe("R53 part 2 tile exact-once approval", () => {
  it.each(Object.keys(fixture))("%s exact apply, drift and reapplication refusal", path => {
    const a = fixture[path as keyof typeof fixture];
    expect(withApprovedRescreenTileNov01(path, a.priorSource)).toBe(a.updatedSource);
    expect(readFileSync(path, "utf8")).toBe(a.updatedSource);
    expect(() => withApprovedRescreenTileNov01(path, a.priorSource + "\n")).toThrow("prior source changed");
    expect(() => withApprovedRescreenTileNov01(path, a.updatedSource)).toThrow("prior source changed");
  });
  it("leaves other files untouched", () => expect(withApprovedRescreenTileNov01("src/lib/ehr.ts", "x")).toBe("x"));
  it("is chained last, after the R53 reconcile re-pin", () => {
    const chain = readFileSync("src/test/credentialingOct27Approved.ts", "utf8");
    expect(chain).toContain("return withApprovedRescreenTileNov01(path, withApprovedRescreenCadenceReconcileNov01(path,");
  });
});
