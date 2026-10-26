// @vitest-environment jsdom
// Phase 9a-3 — billing tiles show the rollback numbers; exports untouched.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { BillingStatusList, BillingStatusStrip, billingStatusCounts } from "@/components/billing/BillingStatusSummary";
import { AdelanteEHRExt, claimBillingBucket } from "@/lib/ehr-ext";
import { exportClaimsCsv } from "@/lib/billingWorkspace";
import { withApprovedBillingWorkspaceB3b } from "@/test/billingWorkspaceB3bApproved";
import { withApprovedConsentB2 } from "@/test/consentB2Approved";
// 26 Oct signup change (Mitch): enrollReferral websiteSignup option — signup/reset/review additions only.
import { withApprovedSignupOct26 } from "@/test/signupOct26Approved";

const ROLLBACK = "7c834669d4f2811e28dac8b50090906873b9b8ad";
const old = (p: string) => execFileSync("git", ["show", `${ROLLBACK}:${p}`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const SELECTORS = ["src/lib/ehr-ext.ts", "src/lib/billingWorkspace.ts", "src/lib/countyReporting.ts", "src/lib/ehr.ts"];
const kpiBlock = (src: string) => src.slice(src.indexOf("const kpis = useMemo"), src.indexOf("}, [claims]);", src.indexOf("const kpis = useMemo")));

afterEach(cleanup);

describe("9a-3 billing selector and export parity", () => {
  it.each(SELECTORS)("%s is byte-identical to rollback", (p) => expect(readFileSync(p, "utf8")).toBe(withApprovedSignupOct26(p, withApprovedConsentB2(p, withApprovedBillingWorkspaceB3b(p, old(p))))));
  it("KPI dollar/count computation on /billing is byte-identical", () => {
    expect(kpiBlock(readFileSync("src/routes/billing.tsx", "utf8"))).toBe(kpiBlock(old("src/routes/billing.tsx")));
  });
  it("DOLLARS formatter and download code are byte-identical", () => {
    const cur = readFileSync("src/routes/billing.tsx", "utf8"); const was = old("src/routes/billing.tsx");
    const pick = (s: string, a: string) => s.slice(s.indexOf(a), s.indexOf("\n\n", s.indexOf(a)));
    expect(pick(cur, "const DOLLARS =")).toBe(pick(was, "const DOLLARS ="));
    expect(pick(cur, "function downloadIsl")).toBe(pick(was, "function downloadIsl"));
  });
  it("claims CSV export is stable and claim-level only", () => {
    const csv = exportClaimsCsv();
    expect(csv).toBe(exportClaimsCsv());
    expect(csv.split("\n")[0]).toBe('"claim_id","patient_program_id","service_date","service_code","units","program","status","charge_cents"');
  });
});

describe("9a-3 status summary renders every rollback count", () => {
  const counts = billingStatusCounts(AdelanteEHRExt.listClaims());
  it("counts equal a direct bucket tally", () => {
    const tally: Record<string, number> = {};
    for (const c of AdelanteEHRExt.listClaims()) tally[claimBillingBucket(c.state)] = (tally[claimBillingBucket(c.state)] ?? 0) + 1;
    for (const [k, v] of Object.entries(counts)) expect(v).toBe(tally[k] ?? 0);
  });
  it("list and strip show each count; denied keeps its Badge class", () => {
    const { container } = render(<><BillingStatusList counts={counts} mode={{ kind: "plain" }} /><BillingStatusStrip counts={counts} active="all" onSelect={() => {}} /></>);
    for (const [k, v] of Object.entries(counts)) {
      if (k === "denied") continue;
      const nodes = container.querySelectorAll(`[data-billing-count="${k}"]`);
      expect(nodes).toHaveLength(2);
      nodes.forEach((n) => expect(n.textContent).toBe(String(v)));
    }
    const denied = container.querySelectorAll(".bg-destructive\\/15.text-destructive");
    expect(denied).toHaveLength(2);
    denied.forEach((n) => expect(n.textContent).toBe(String(counts.denied)));
  });
});
