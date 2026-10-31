import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { withApprovedScreenerHarnessInputOct31 } from "./screenerHarnessInputOct31Approved";
import { withApprovedCredentialingOct27 } from "./credentialingOct27Approved";
const path = "src/components/__tests__/roleDashboardParity9c2.test.ts";
const original = '    const baseline = withApprovedChartSelectionOct29(path, withApprovedOpsWorkspaceB3b(path, withApprovedBillingB3b(path, withApprovedP3(path, old(path)))));';
const prior = "    const baseline = path === \"src/routes/clinician.tsx\" ? withApprovedCredentialingOct27(path, priorBaseline) : priorBaseline;";
const approved = "    const baseline = path === \"src/routes/clinician.tsx\" ? withApprovedCredentialingOct27(path, withApprovedConsentB2(path, old(path))) : priorBaseline;";
function sources() {
  const current = readFileSync(path, "utf8");
  expect(current.split(approved)).toHaveLength(2);
  const previous = current.replace(approved, prior);
  const rollback = previous.replace('    const priorBaseline = withApprovedChartSelectionOct29(path, withApprovedOpsWorkspaceB3b(path, withApprovedBillingB3b(path, withApprovedP3(path, old(path)))));\n' + prior, original);
  return { current, previous, rollback };
}
describe("Mitch approved round 4b clinician input, exact-once", () => {
  it("applies the exact approved input after the unchanged earlier chain", () => {
    const { current, previous, rollback } = sources();
    expect(withApprovedScreenerHarnessInputOct31(path, previous)).toBe(current);
    expect(withApprovedCredentialingOct27(path, rollback)).toBe(current);
  });
  it("refuses prior-source drift", () => {
    const { previous } = sources();
    expect(() => withApprovedScreenerHarnessInputOct31(path, previous + "\n")).toThrow("R5 harness input prior source changed");
  });
  it("refuses reapplication", () => {
    const { current } = sources();
    expect(() => withApprovedScreenerHarnessInputOct31(path, current)).toThrow("R5 harness input prior source changed");
  });
});
