import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { withApprovedBillingB3b } from "@/test/billingB3bApproved";
import { withApprovedOpsWorkspaceB3b } from "@/test/opsWorkspaceB3bApproved";
import { withApprovedBillingWorkspaceB3b } from "@/test/billingWorkspaceB3bApproved";
import { withApprovedP3 } from "@/test/privacyP3Approved";
import { withApprovedConsentB2 } from "@/test/consentB2Approved";
// 26 Oct signup change (Mitch): enrollReferral websiteSignup option — signup/reset/review additions only.
import { withApprovedSignupOct26 } from "@/test/signupOct26Approved";

const rollback = "aff263ff1aa707d68994b7f175f83aa9d09306fd";
const files = ["src/routes/clinician.tsx", "src/routes/case-manager.tsx", "src/routes/billing.tsx", "src/routes/admin.tsx", "src/routes/quality-compliance.tsx", "src/components/clinician/WorkspaceDashboard.tsx", "src/components/tasks/TaskQueueCard.tsx", "src/components/ops/OpsWorkspace.tsx"];
const old = (path: string) => execFileSync("git", ["show", `${rollback}:${path}`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const printer = ts.createPrinter({ removeComments: true });
function inventory(source: string) {
  const ast = ts.createSourceFile("home.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const records: string[] = [];
  const expressions: string[] = [];
  const print = (node: ts.Node) => printer.printNode(ts.EmitHint.Unspecified, node, ast);
  const visit = (node: ts.Node) => {
    if (ts.isJsxAttribute(node) && /^(data-testid|testId|tileTestId|value|formattedValue|cohortSize|personal|nonPatient|comparison|basis|n|counts|source|rows|onClick|onSelect|onOpenPatient|onDrillDown)$/.test(node.name.getText(ast))) records.push(print(node));
    // Existing non-JSX selectors/state/calculations are the exact rollback expressions.
    if (ts.isVariableDeclaration(node) && node.initializer && !ts.isParenthesizedExpression(node.initializer) && !ts.isJsxElement(node.initializer) && !ts.isJsxSelfClosingElement(node.initializer)) expressions.push(print(node));
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return { records: records.sort(), expressions: expressions.sort() };
}

describe("9c-2 unchanged values, IDs and handlers against rollback", () => {
  it.each(files)("%s preserves existing bindings", path => {
    // 26 Oct Phase A: one clinical-only triage row host in the existing Today tile; all prior bindings pinned.
    const baseline = withApprovedOpsWorkspaceB3b(path, withApprovedBillingB3b(path, withApprovedP3(path, old(path))));
    const from = 'return <div className="space-y-4">{!secondary &&';
    const expected = path === "src/components/clinician/WorkspaceDashboard.tsx" ? baseline.replace(from, 'return <div className="space-y-4">{!secondary && <PreChartTriageRows actor={actor} />}{!secondary &&') : path === "src/components/tasks/TaskQueueCard.tsx" ? baseline.replace("      {summary}", "      {summary}\n      <PreChartTriageRows actor={viewer} />") : baseline;
    if (path === "src/components/tasks/TaskQueueCard.tsx") expect(baseline.split("      {summary}")).toHaveLength(2);
    if (path === "src/components/clinician/WorkspaceDashboard.tsx") expect(baseline.split(from)).toHaveLength(2);
    expect(inventory(readFileSync(path, "utf8"))).toEqual(inventory(expected));
  });
  it.each(["src/lib/roles.ts", "src/lib/chartAccess.ts", "src/lib/navGuard.ts", "src/lib/clinicianWorkspace.ts", "src/lib/billingWorkspace.ts", "src/lib/ehr.ts", "src/lib/ehr-ext.ts", "src/lib/asamReporting.ts", "src/lib/complianceMonitoring.ts", "src/components/ui/stat-tile.tsx", "src/components/billing/BillingStatusSummary.tsx"])("%s keeps selector/access/suppression behavior byte-identical", path => {
    expect(readFileSync(path, "utf8")).toBe(withApprovedSignupOct26(path, withApprovedConsentB2(path, withApprovedBillingWorkspaceB3b(path, withApprovedP3(path, old(path))))));
  });
});
