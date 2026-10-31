import { createHash } from "node:crypto";
// Mitch approved 31 Oct, 08:28 CT. Draft — pending clinical sign-off.
// Clinician-only full consent-approved input; all inventories and assertions remain unchanged.
const PATH = "src/components/__tests__/roleDashboardParity9c2.test.ts";
const APPROVED = {
  "prior": "d9964af90d04b462ec3211ea33332aa4e2c0a87f7fcdb2ab18c8727fee5a3c55",
  "updated": "d92699c301cb50db71b05b4124fdee939ef1374b59c20e958f8107680661ac74",
  "anchor": "    const baseline = path === \"src/routes/clinician.tsx\" ? withApprovedCredentialingOct27(path, priorBaseline) : priorBaseline;",
  "replacement": "    const baseline = path === \"src/routes/clinician.tsx\" ? withApprovedCredentialingOct27(path, withApprovedConsentB2(path, old(path))) : priorBaseline;"
};
export function withApprovedScreenerHarnessInputOct31(path: string, source: string): string {
  if (path !== PATH) return source;
  const hash = (text: string) => createHash("sha256").update(text).digest("hex");
  if (hash(source) !== APPROVED.prior) throw new Error(`R5 harness input prior source changed: ${path}`);
  if (source.split(APPROVED.anchor).length !== 2) throw new Error(`R5 harness input anchor not exactly once: ${path}`);
  const updated = source.replace(APPROVED.anchor, () => APPROVED.replacement);
  if (hash(updated) !== APPROVED.updated) throw new Error(`R5 harness input replacement changed: ${path}`);
  return updated;
}
