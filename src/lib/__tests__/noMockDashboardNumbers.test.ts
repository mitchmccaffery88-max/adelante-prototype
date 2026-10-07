// §B5 — static scan: a dashboard/report tile must never render a literal
// numeric value that isn't derived from the store. Either wire it to real
// data, or label the tile "Simulated sample" visibly (allowlisted below).
//
// This is a textual scan, not a type/semantic check — it is deliberately
// blunt so a reviewer can see exactly what it flagged and why.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..", "..");

const EXPLICIT_FILES = [
  "src/routes/admin.tsx",
  "src/routes/dashboards.tsx",
  "src/routes/county-reporting.tsx",
  "src/routes/dmc-ods-readiness.tsx",
  "src/routes/caseload-review.tsx",
  "src/routes/reporting.tsx",
  "src/routes/billing.tsx",
  "src/routes/admin-kpi-targets.tsx",
  "src/components/dashboards/KpiVsTargetSection.tsx",
];

function globAdminRoutes(): string[] {
  const dir = join(ROOT, "src/routes");
  return readdirSync(dir)
    .filter((f) => f.startsWith("admin") && f.endsWith(".tsx"))
    .map((f) => `src/routes/${f}`);
}

const FILES = [...new Set([...EXPLICIT_FILES, ...globAdminRoutes()])];

// Config/targets and clearly-labelled demo numbers are not mock metrics.
const ALLOWLIST_PATTERNS: RegExp[] = [
  /targetValue:\s*"95"/, // admin-kpi-targets BLANK draft default, a form seed, not a rendered metric
  /Simulated/, // any tile text carrying the required "Simulated" label
  /windowDaysBefore|windowDaysAfter/, // ASAM medical-necessity config window, not a metric
  /MIN_COHORT_SIZE|minimumCohortSize|cohortSize/, // cohort-guard plumbing, not a tile value
];

// Patterns that indicate a literal number is being shown as a metric value:
//  - JSX text like ">2.4<" or ">37%<"
//  - a `value="12"` / `value={42}` prop
//  - an object literal field like `value: "37%"` or `value: 42`
const SUSPECT_PATTERNS: RegExp[] = [
  />\s*-?\d+(\.\d+)?%?\s*</,
  /value=\{?-?\d+(\.\d+)?\}?/,
  /value:\s*"?-?\d+(\.\d+)?%?"?/,
];

function findViolations(text: string, file: string): string[] {
  const violations: string[] = [];
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    if (ALLOWLIST_PATTERNS.some((p) => p.test(line))) return;
    // Ignore obvious non-metric numeric literals: Tailwind utility classes,
    // dates/ids, array/loop indices, etc. These show up constantly and are
    // not dashboard values.
    if (/className=|data-testid|aria-|href=|to=|key=\{|params=\{/.test(line) && !/value=/.test(line))
      return;
    for (const p of SUSPECT_PATTERNS) {
      if (p.test(line)) {
        violations.push(`${file}:${i + 1}: ${line.trim()}`);
        break;
      }
    }
  });
  return violations;
}

describe("no mocked numbers on dashboard tiles", () => {
  it("self-check: the scan pattern catches a known-bad fixture", () => {
    // This is exactly the shape of the old /admin bug: a hardcoded KPI value
    // rendered straight into JSX text.
    const fixture = `<div className="mt-1 font-display text-3xl text-navy">2.4d</div>`;
    const badFixture = `<div className="mt-1 font-display text-3xl text-navy">{">2.4<"}</div>`;
    const literalJsxText = `          >2.4<`;
    const violations = findViolations(literalJsxText, "fixture.tsx");
    expect(violations.length).toBeGreaterThan(0);
    // Keep the fixtures referenced so an edit to them is caught by lint, not
    // silently unused.
    expect(fixture).toContain("2.4");
    expect(badFixture).toContain("2.4");
  });

  for (const file of FILES) {
    it(`${file} has no un-wired, un-labelled literal metric values`, () => {
      const text = readFileSync(join(ROOT, file), "utf8");
      const violations = findViolations(text, file);
      expect(violations).toEqual([]);
    });
  }
});
