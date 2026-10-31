import { describe, expect, it } from "vitest";
import fixture from "./screenerHarnessOct31.fixture.json";
import { withApprovedScreenerHarnessOct31 } from "./screenerHarnessOct31Approved";
const path = "src/components/__tests__/roleDashboardParity9c2.test.ts";
const from = "    const baseline = withApprovedChartSelectionOct29(path, withApprovedOpsWorkspaceB3b(path, withApprovedBillingB3b(path, withApprovedP3(path, old(path)))));";
const to = "    const priorBaseline = withApprovedChartSelectionOct29(path, withApprovedOpsWorkspaceB3b(path, withApprovedBillingB3b(path, withApprovedP3(path, old(path)))));\n    const baseline = path === \"src/routes/clinician.tsx\" ? withApprovedCredentialingOct27(path, priorBaseline) : priorBaseline;";
describe("Mitch approved R5 clinician harness baseline, exact-once", () => {
  it("changes only the approved baseline through the existing chain", () => {
    const current = fixture.replacement;
    expect(current.split(to)).toHaveLength(2);
    const prior = fixture.prior;
    expect(prior.replace(from, to)).toBe(current);
    expect(withApprovedScreenerHarnessOct31(path, prior)).toBe(current);
    expect(() => withApprovedScreenerHarnessOct31(path, current)).toThrow("R5 harness prior source changed");
    expect(() => withApprovedScreenerHarnessOct31(path, prior + "\n")).toThrow("R5 harness prior source changed");
  });
});
