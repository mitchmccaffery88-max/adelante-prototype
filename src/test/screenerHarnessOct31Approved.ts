import { createHash } from "node:crypto";
// Mitch approved 31 Oct. Draft — pending clinical sign-off.
// Clinician baseline only; every binding assertion and other baseline stays unchanged.
const PATH = "src/components/__tests__/roleDashboardParity9c2.test.ts";
const APPROVED = {
  "prior": "95e18d762a6fb8cfd41a4ba642a917de764905cdc28d292c78f9df698a0063ac",
  "updated": "d9964af90d04b462ec3211ea33332aa4e2c0a87f7fcdb2ab18c8727fee5a3c55",
  "from": "    const baseline = withApprovedChartSelectionOct29(path, withApprovedOpsWorkspaceB3b(path, withApprovedBillingB3b(path, withApprovedP3(path, old(path)))));",
  "to": "    const priorBaseline = withApprovedChartSelectionOct29(path, withApprovedOpsWorkspaceB3b(path, withApprovedBillingB3b(path, withApprovedP3(path, old(path)))));\n    const baseline = path === \"src/routes/clinician.tsx\" ? withApprovedCredentialingOct27(path, priorBaseline) : priorBaseline;"
};
export function withApprovedScreenerHarnessOct31(path: string, source: string): string {
  if (path !== PATH) return source;
  const hash = (text: string) => createHash("sha256").update(text).digest("hex");
  if (hash(source) !== APPROVED.prior) throw new Error(`R5 harness prior source changed: ${path}`);
  if (source.split(APPROVED.from).length !== 2) throw new Error(`R5 harness anchor not exactly once: ${path}`);
  const updated = source.replace(APPROVED.from, () => APPROVED.to);
  if (hash(updated) !== APPROVED.updated) throw new Error(`R5 harness replacement changed: ${path}`);
  return updated;
}
