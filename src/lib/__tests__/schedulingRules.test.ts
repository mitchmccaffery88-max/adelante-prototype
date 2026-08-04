// §Scheduling rule engine — CRUD validation, matching, and the cadence-window
// idempotency guarantee (the thing most likely to spam a worklist).
import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";

const ADMIN = "Christi Ruiz";

function makeRule(over: Partial<Parameters<typeof AdelanteEHR.saveSchedulingRule>[0]> = {}) {
  return AdelanteEHR.saveSchedulingRule(
    {
      key: `k_${Math.random().toString(36).slice(2, 8)}`,
      label: "Test rule",
      taskType: "coordination",
      match: { activeProblemCategory: "mental_health" },
      cadenceMinutes: 1440,
      priority: "routine",
      ...over,
    },
    ADMIN,
    "clinical_coordinator",
  );
}

describe("scheduling rule CRUD", () => {
  it("rejects a rule with no condition, bad cadence, or duplicate key", () => {
    expect(() => makeRule({ match: {} })).toThrow(/at least one condition/i);
    expect(() => makeRule({ cadenceMinutes: 0 })).toThrow(/at least 1 minute/i);
    const r = makeRule();
    expect(() => makeRule({ key: r.key })).toThrow(/already in use/i);
  });

  it("deactivates with a required reason and never deletes", () => {
    const r = makeRule();
    expect(() => AdelanteEHR.deactivateSchedulingRule(r.id, ADMIN, "  ")).toThrow(/reason is required/i);
    AdelanteEHR.deactivateSchedulingRule(r.id, ADMIN, "superseded");
    expect(AdelanteEHR.listSchedulingRules().some((x) => x.id === r.id)).toBe(false);
    expect(AdelanteEHR.listSchedulingRules(true).some((x) => x.id === r.id)).toBe(true);
    AdelanteEHR.reactivateSchedulingRule(r.id, ADMIN);
    expect(AdelanteEHR.listSchedulingRules().some((x) => x.id === r.id)).toBe(true);
  });
});

describe("rule execution", () => {
  const tasksFor = (ruleId: string) =>
    AdelanteEHR.listCaseTasks().filter((t) => t.sourceRuleId === ruleId);

  it("generates one task per matching patient and is idempotent within the cadence window", () => {
    const rule = makeRule({ cadenceMinutes: 1440 });
    const matches = AdelanteEHR.patientsMatchingRule(rule).length;
    expect(matches).toBeGreaterThan(0);

    const first = AdelanteEHR.runSchedulingRulesNow(ADMIN, "clinical_coordinator");
    expect(first.results.find((r) => r.ruleKey === rule.key)!.tasksCreated).toBe(matches);
    expect(tasksFor(rule.id).length).toBe(matches);

    // Second run inside the window creates nothing.
    const second = AdelanteEHR.runSchedulingRulesNow(ADMIN, "clinical_coordinator");
    expect(second.results.find((r) => r.ruleKey === rule.key)!.tasksCreated).toBe(0);
    expect(tasksFor(rule.id).length).toBe(matches);
  });

  it("a COMPLETED task still counts as generated this cycle", () => {
    const rule = makeRule({ cadenceMinutes: 1440 });
    AdelanteEHR.runSchedulingRulesNow(ADMIN, "clinical_coordinator");
    const made = tasksFor(rule.id);
    made.forEach((t) => AdelanteEHR.completeCaseTask(t.id));
    AdelanteEHR.runSchedulingRulesNow(ADMIN, "clinical_coordinator");
    expect(tasksFor(rule.id).length).toBe(made.length);
  });

  it("generates again once the cadence window has elapsed", () => {
    const rule = makeRule({ cadenceMinutes: 1 });
    AdelanteEHR.runSchedulingRulesNow(ADMIN, "clinical_coordinator");
    const before = tasksFor(rule.id);
    expect(before.length).toBeGreaterThan(0);
    // Age the generated rows past the 1-minute window.
    const old = new Date(Date.now() - 5 * 60_000).toISOString();
    before.forEach((t) => {
      (t as { createdAt: string }).createdAt = old;
    });
    AdelanteEHR.runSchedulingRulesNow(ADMIN, "clinical_coordinator");
    expect(tasksFor(rule.id).length).toBe(before.length * 2);
  });

  it("skips deactivated rules and tags generated tasks with the rule source", () => {
    const rule = makeRule();
    AdelanteEHR.deactivateSchedulingRule(rule.id, ADMIN, "paused");
    const res = AdelanteEHR.runSchedulingRulesNow(ADMIN, "clinical_coordinator");
    expect(res.results.some((r) => r.ruleKey === rule.key)).toBe(false);
    expect(tasksFor(rule.id).length).toBe(0);

    const live = makeRule({ priority: "urgent", taskType: "coordination" });
    AdelanteEHR.runSchedulingRulesNow(ADMIN, "clinical_coordinator");
    const t = tasksFor(live.id)[0];
    expect(t.source).toBe(`rule:${live.key}`);
    expect(t.priority).toBe("urgent");
    expect(t.taskType).toBe("coordination");
  });

  it("audits the whole run as one event", () => {
    makeRule();
    AdelanteEHR.runSchedulingRulesNow(ADMIN, "clinical_coordinator");
    const runs = AdelanteEHR.listAuditEvents({}).filter((e) => e.action === "scheduling_rules_run");
    expect(runs.length).toBeGreaterThan(0);
  });
});
