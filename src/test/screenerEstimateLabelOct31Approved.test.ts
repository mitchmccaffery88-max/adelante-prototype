import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import fixture from "./screenerEstimateLabelOct31.fixture.json";
import { withApprovedScreenerEstimateLabelOct31 } from "./screenerEstimateLabelOct31Approved";
import { withApprovedCredentialingOct27 } from "./credentialingOct27Approved";

describe("Mitch approved estimate label exact-once re-pin", () => {
  it("applies exactly and matches the final chained result", () => {
    expect(withApprovedScreenerEstimateLabelOct31(fixture.path, fixture.prior)).toBe(fixture.updated);
    expect(withApprovedCredentialingOct27(fixture.path, fixture.prior)).toBe(fixture.updated);
    expect(readFileSync(fixture.path, "utf8")).toBe(fixture.updated);
  });
  it("refuses prior-source drift", () => {
    expect(() => withApprovedScreenerEstimateLabelOct31(fixture.path, fixture.prior + "\n")).toThrow("Estimate label prior source changed");
  });
  it("refuses reapplication", () => {
    expect(() => withApprovedScreenerEstimateLabelOct31(fixture.path, fixture.updated)).toThrow("Estimate label prior source changed");
  });
});
