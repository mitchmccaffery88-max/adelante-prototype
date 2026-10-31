import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { withApprovedCredentialingOct27 } from "./credentialingOct27Approved";
const path = "src/components/__tests__/roleDashboardParity9c2.test.ts";
const from = "    const baseline = withApprovedChartSelectionOct29(path, withApprovedOpsWorkspaceB3b(path, withApprovedBillingB3b(path, withApprovedP3(path, old(path)))));";
const to = "    const priorBaseline = withApprovedChartSelectionOct29(path, withApprovedOpsWorkspaceB3b(path, withApprovedBillingB3b(path, withApprovedP3(path, old(path)))));\n    const baseline = path === \"src/routes/clinician.tsx\" ? withApprovedCredentialingOct27(path, priorBaseline) : priorBaseline;";
describe("Mitch approved R5 clinician harness baseline, exact-once", () => {
  it("changes only the approved baseline through the existing chain", () => {
    const current = readFileSync(path, "utf8");
    expect(current.split(to)).toHaveLength(2);
    const prior = current.replace(to, from);
    expect(withApprovedCredentialingOct27(path, prior)).toBe(current);
    expect(() => withApprovedCredentialingOct27(path, current)).toThrow("R5 harness prior source changed");
    expect(() => withApprovedCredentialingOct27(path, prior + "\n")).toThrow("R5 harness prior source changed");
  });
});
