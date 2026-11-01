import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import fixture from "./rescreenCadenceReconcileNov01.fixture.json";
import { withApprovedRescreenCadenceReconcileNov01 } from "./rescreenCadenceReconcileNov01Approved";
import { withApprovedCredentialingOct27 } from "./credentialingOct27Approved";
describe("R53 reconcile exact-once approval", () => {
  it.each(Object.keys(fixture))("%s exact apply, drift and reapplication refusal", path => {
    const a = fixture[path as keyof typeof fixture];
    expect(withApprovedRescreenCadenceReconcileNov01(path, a.priorSource)).toBe(a.updatedSource);
    expect(readFileSync(path, "utf8")).toBe(a.updatedSource);
    expect(() => withApprovedRescreenCadenceReconcileNov01(path, a.priorSource + "\n")).toThrow("prior source changed");
    expect(() => withApprovedRescreenCadenceReconcileNov01(path, a.updatedSource)).toThrow("prior source changed");
  });
  it("changes only the two action IDs", () => {
    const a = fixture["src/lib/__tests__/rescreenCadenceR53.test.ts"];
    expect(a.edits).toHaveLength(2);
    expect(a.priorSource.replaceAll("screener_item9_followup", "rescreen_cadence_automation")).toBe(a.updatedSource);
  });
  it("is chained after the finish re-pin in the credentialing chain", () => {
    const path = "src/lib/__tests__/rescreenCadenceR53.test.ts";
    expect(withApprovedCredentialingOct27(path, fixture[path].priorSource)).toBe(fixture[path].updatedSource);
  });
});
