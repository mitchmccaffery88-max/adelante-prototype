import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { withApprovedBrowserTriageOct30 } from "./browserTriageOct30Approved";

// Approval ledger verification, not a visual snapshot or product-rule test.
describe("Mitch's exact-once browser triage approvals", () => {
  const paths = ["adelBrief", "adelHistory", "consentAuditB2", "consentCaptureB2", "consentLifecycleB2", "crossRole", "group2Pathways", "quickActionsMenu", "staffShell8a1", "access", "staffRosterCredentialTables8b2", "staffTables8b1"];
  for (const name of paths) {
    it(`rejects a second re-pin of ${name}`, () => {
      const path = `e2e/${name}.spec.ts`;
      const current = readFileSync(path, "utf8");
      expect(() => withApprovedBrowserTriageOct30(path, current)).toThrow("Browser triage prior source changed");
    });
  }
});