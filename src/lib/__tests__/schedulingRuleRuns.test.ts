// §EHR audit Phase 1c — dry-run preview, per-task execution log, run history,
// and the single execution gate (scheduling_rules write).
import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";

const ADMIN = "Christi Ruiz";

function makeRule() {
  return AdelanteEHR.saveSchedulingRule(
    {
      key: `k_${Math.random().toString(36).slice(2, 8)}`,
      label: "Preview rule",
      taskType: "coordination",
      match: { activeProblemCategory: "mental_health" },
      cadenceMinutes: 1440,
      priority: "routine",
    },
    ADMIN,
    "clinical_coordinator",
  );
}

describe("scheduling rule preview + execution log", () => {
  it("previews the exact patients a run would create tasks for, then matches the run", () => {
    const rule = makeRule();
    const before = AdelanteEHR.previewSchedulingRules().rules.find((r) => r.ruleId === rule.id)!;
    expect(before.wouldCreate.length).toBeGreaterThan(0);
    expect(before.wouldCreate.every((p) => p.patientName.trim().length > 0)).toBe(true);
    expect(before.skipped.length).toBe(0);

    const run = AdelanteEHR.runSchedulingRulesNow(ADMIN, "clinical_coordinator");
    expect(run.results.find((r) => r.ruleKey === rule.key)!.tasksCreated).toBe(
      before.wouldCreate.length,
    );
  });

  it("moves patients into 'skipped' once the cadence window blocks them", () => {
    const rule = makeRule();
    AdelanteEHR.runSchedulingRulesNow(ADMIN, "clinical_coordinator");
    const after = AdelanteEHR.previewSchedulingRules().rules.find((r) => r.ruleId === rule.id)!;
    expect(after.wouldCreate.length).toBe(0);
    expect(after.skipped.length).toBeGreaterThan(0);
    expect(after.skipped[0].reason).toBe("cadence_window");
  });

  it("writes one audit row per generated task and exposes run history", () => {
    const rule = makeRule();
    const run = AdelanteEHR.runSchedulingRulesNow(ADMIN, "clinical_coordinator");
    const perTask = AdelanteEHR.listAuditEvents({}).filter(
      (e) =>
        e.action === "scheduling_rule_task_created" &&
        (e.detail as { runId?: string })?.runId === run.runId,
    );
    expect(perTask.length).toBe(run.total);
    expect(perTask.every((e) => !!e.patientId)).toBe(true);

    const history = AdelanteEHR.listSchedulingRuleRuns(10);
    const entry = history.find((h) => h.runId === run.runId)!;
    expect(entry.total).toBe(run.total);
    expect(entry.tasks.length).toBe(run.total);
    expect(entry.tasks.some((t) => t.ruleKey === rule.key)).toBe(true);
    expect(entry.actorId).toBe(ADMIN);
  });

  it("only roles with scheduling_rules write may execute", () => {
    expect(() => AdelanteEHR.runSchedulingRulesNow(ADMIN, "pmhnp")).toThrow(/can't run/i);
    expect(() => AdelanteEHR.runSchedulingRulesNow(ADMIN, "peer_specialist")).toThrow(/can't run/i);
    expect(() => AdelanteEHR.runSchedulingRulesNow(ADMIN, "sys_admin")).not.toThrow();
  });
});
