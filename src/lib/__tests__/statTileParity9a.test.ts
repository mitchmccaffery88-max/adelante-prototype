import { execFileSync } from "node:child_process";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import * as ehr from "@/lib/ehr";
import * as groups from "@/lib/groupMetrics";
import { computeLiveMetrics, evaluateTarget, formatMetric, METRIC_KEYS } from "@/lib/dashboardMetrics";

// Execute the actual rollback selector source against the identical real
// store fixture, without reverting/stashing or maintaining a copied formula.
const rollback = "7c0e871520e0a2eb6b8a29ed604e4e2cefa385f3";
const source = execFileSync("git", ["show", `${rollback}:src/lib/dashboardMetrics.ts`], { encoding: "utf8" });
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const baseline: Record<string, any> = {};
new Function("exports", "require", compiled)(baseline, (name: string) => {
  if (name === "./ehr") return ehr;
  if (name === "./groupMetrics") return groups;
  throw new Error(`Unexpected rollback dependency ${name}`);
});

describe("Phase 9a rollback selector parity", () => {
  it.each([7, 30, 90, 365])("every converted scalar and status is identical for %s days", (days) => {
    const now = new Date("2026-10-20T12:00:00Z");
    const current = computeLiveMetrics(now, days);
    const old = baseline.computeLiveMetrics(now, days);
    for (const key of METRIC_KEYS) {
      expect(current[key]).toEqual(old[key]);
      expect(formatMetric(current[key])).toBe(baseline.formatMetric(old[key]));
    }
    for (const target of ehr.AdelanteEHR.listKpiTargets()) {
      const key = target.metricKey as keyof typeof current;
      expect(evaluateTarget(current[key], target.targetValue)).toEqual(baseline.evaluateTarget(old[key], target.targetValue));
    }
  });
});