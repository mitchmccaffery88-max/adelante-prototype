import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import fixture from "./rescreenTileFollowupNov01.fixture.json";
import { withApprovedRescreenTileFollowupNov01 } from "./rescreenTileFollowupNov01Approved";
import { withApprovedCredentialingOct27 } from "./credentialingOct27Approved";
import superseding from "./rescreenTileActorNov01.fixture.json";

describe("R53 tile follow-up exact-once approval", () => {
  it.each(Object.keys(fixture))("%s exact apply, final chain, drift and reapplication refusal", path => {
    const a = fixture[path as keyof typeof fixture];
    expect(withApprovedRescreenTileFollowupNov01(path, a.priorSource)).toBe(a.updatedSource);
    // Standing OK (superseded anchor): a later approved re-pin (1 Nov 15:16 CT) supersedes this file; verify the immutable fixture handoff.
    const later = superseding[path as keyof typeof superseding];
    if (later) expect(later.priorSource).toBe(a.updatedSource);
    expect(withApprovedCredentialingOct27(path, a.priorSource)).toBe(readFileSync(path, "utf8"));
    if (!later) expect(readFileSync(path, "utf8")).toBe(a.updatedSource);
    expect(() => withApprovedRescreenTileFollowupNov01(path, a.priorSource + "\n")).toThrow("prior source changed");
    expect(() => withApprovedRescreenTileFollowupNov01(path, a.updatedSource)).toThrow("prior source changed");
  });
  it("is chained directly after the original tile approval", () => {
    expect(readFileSync("src/test/credentialingOct27Approved.ts", "utf8")).toContain("return withApprovedRescreenTileFollowupNov01(path, withApprovedRescreenTileNov01(path,");
  });
  it("changes only approved existing test wording", () => {
    const a = fixture["src/lib/__tests__/rescreenDashboardR53p2.test.ts"];
    expect(a.edits).toHaveLength(4);
    expect(a.priorSource.replace("shows Due, Overdue N days and Requested N days ago", "shows Due, Due N days ago and Requested by staff N days ago").replace('"Overdue 3 days"', '"Due 3 days ago"').replace('"Requested 2 days ago"', '"Requested by staff 2 days ago"').replace('"Requested today"', '"Requested by staff 0 days ago"')).toBe(a.updatedSource);
  });
  it("leaves unrelated files untouched", () => expect(withApprovedRescreenTileFollowupNov01("src/lib/roles.ts", "unchanged")).toBe("unchanged"));
});