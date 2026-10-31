import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import fixture from "./rescreenCadenceFinishOct31.fixture.json";
import { withApprovedRescreenCadenceFinishOct31 } from "./rescreenCadenceFinishOct31Approved";
import { withApprovedCredentialingOct27 } from "./credentialingOct27Approved";
import earlier from "./rescreenCadenceOct31.fixture.json";
describe("R53 finish exact-once approval", () => {
  it.each(Object.keys(fixture))("%s exact apply, drift and reapplication refusal", path => {
    const a = fixture[path as keyof typeof fixture];
    expect(withApprovedRescreenCadenceFinishOct31(path, a.priorSource)).toBe(a.updatedSource);
    expect(readFileSync(path, "utf8")).toBe(a.updatedSource);
    expect(() => withApprovedRescreenCadenceFinishOct31(path, a.priorSource + "\n")).toThrow("prior source changed");
    expect(() => withApprovedRescreenCadenceFinishOct31(path, a.updatedSource)).toThrow("prior source changed");
  });
  it("preserves pre-R53 item-9 entry including all store references byte-for-byte", () => {
    const prior = earlier["src/lib/chartActions.ts"].edits[0][0].split("\n").find(l => l.includes('id: "screener_item9_followup"'));
    const current = readFileSync("src/lib/chartActions.ts", "utf8").split("\n").find(l => l.includes('id: "screener_item9_followup"'));
    expect(prior).toBeDefined();
    expect(current).toBe(prior);
  });
  it("final credentialing chain applies the approved consent inventory change", () => {
    const path = "src/lib/__tests__/consentInventoryB2.test.ts";
    expect(withApprovedCredentialingOct27(path, fixture[path].priorSource)).toBe(fixture[path].updatedSource);
  });
});