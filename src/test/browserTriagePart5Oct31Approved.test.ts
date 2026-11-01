import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import fixture from "./browserTriagePart5Oct31.fixture.json";
import { withApprovedBrowserTriagePart5Oct31 } from "./browserTriagePart5Oct31Approved";

describe("Mitch's Part 5 exact-once #20 host-navigation approval", () => {
  it("applies the exact final chain and refuses drift and reapplication", () => {
    expect(withApprovedBrowserTriagePart5Oct31(fixture.path, fixture.prior)).toBe(fixture.replacement);
    expect(readFileSync(fixture.path, "utf8")).toBe(fixture.replacement);
    expect(() => withApprovedBrowserTriagePart5Oct31(fixture.path, fixture.prior + "\n")).toThrow("Browser triage Part 5 prior source changed");
    expect(() => withApprovedBrowserTriagePart5Oct31(fixture.path, fixture.replacement)).toThrow("Browser triage Part 5 prior source changed");
  });
  it("leaves the Part 4 path to the earlier chain", () => {
    const p4 = JSON.parse(readFileSync("src/test/browserTriagePart4Oct31.fixture.json", "utf8"));
    expect(withApprovedBrowserTriagePart5Oct31(p4.path, p4.prior)).toBe(p4.replacement);
  });
});
