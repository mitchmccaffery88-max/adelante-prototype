import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import fixture from "./browserTriagePart4Oct31.fixture.json";
import { withApprovedBrowserTriagePart4Oct31 } from "./browserTriagePart4Oct31Approved";

describe("Mitch's Part 4 exact-once Today fixture approval", () => {
  it("applies the exact final chain and refuses drift and reapplication", () => {
    expect(withApprovedBrowserTriagePart4Oct31(fixture.path, fixture.prior)).toBe(fixture.replacement);
    expect(readFileSync(fixture.path, "utf8")).toBe(fixture.replacement);
    expect(() => withApprovedBrowserTriagePart4Oct31(fixture.path, fixture.prior + "\n")).toThrow("Browser triage Part 4 prior source changed");
    expect(() => withApprovedBrowserTriagePart4Oct31(fixture.path, fixture.replacement)).toThrow("Browser triage Part 4 prior source changed");
  });
});
