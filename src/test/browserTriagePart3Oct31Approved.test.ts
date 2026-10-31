import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import fixtures from "./browserTriagePart3Oct31.fixture.json";
import { withApprovedBrowserTriagePart3Oct31 } from "./browserTriagePart3Oct31Approved";

describe("Mitch's Part 3 exact-once browser approvals", () => {
  for (const [path, fixture] of Object.entries(fixtures)) {
    it(`${path}: exact final chain, drift and reapplication refusal`, () => {
      expect(withApprovedBrowserTriagePart3Oct31(path, fixture.prior)).toBe(fixture.replacement);
      expect(readFileSync(path, "utf8")).toBe(fixture.replacement);
      expect(() => withApprovedBrowserTriagePart3Oct31(path, fixture.prior + "\n")).toThrow("Browser triage Part 3 prior source changed");
      expect(() => withApprovedBrowserTriagePart3Oct31(path, fixture.replacement)).toThrow("Browser triage Part 3 prior source changed");
    });
  }
});