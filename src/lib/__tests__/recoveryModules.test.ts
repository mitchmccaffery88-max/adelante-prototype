import { describe, it, expect, beforeEach } from "vitest";
import {
  RECOVERY_MODULES,
  RECOVERY_LESSONS,
  TOOL_FLOW_LIMITS,
  lessonsInModule,
  moduleProgress,
} from "@/lib/recovery";
import {
  __resetEngagement,
  completeRecoveryLesson,
  completedRecoveryLessons,
  recoveryToolFlow,
  savedToolkitItems,
  engagementSummary,
} from "@/lib/engagement";

beforeEach(() => __resetEngagement());

describe("recovery module structure", () => {
  it("has the nine modules, in order, with real missions", () => {
    expect(RECOVERY_MODULES).toHaveLength(9);
    expect(RECOVERY_MODULES.map((m) => m.name)).toEqual([
      "My First Days Out",
      "Finding My People",
      "Understanding My Addiction",
      "Changing My Everyday Life",
      "Healing My Relationships",
      "Building a Life That Works",
      "When Recovery Gets Hard",
      "Becoming Someone New",
      "Living Recovery",
    ]);
    expect(RECOVERY_MODULES.every((m) => m.mission.length > 0)).toBe(true);
  });

  it("ships real lessons for every module, none flagged pending", () => {
    for (const mod of RECOVERY_MODULES) {
      expect(mod.contentPending).toBeUndefined();
      expect(lessonsInModule(mod.id).length).toBeGreaterThanOrEqual(5);
    }
    expect(new Set(RECOVERY_LESSONS.map((l) => l.id)).size).toBe(RECOVERY_LESSONS.length);
  });

  it("gives every lesson a complete 10-step schema with real tool flow", () => {
    for (const l of RECOVERY_LESSONS) {
      expect(l.problem && l.checkIn && l.learnTitle && l.learnBody).toBeTruthy();
      expect(l.adelReflection && l.adelQuestion && l.insight && l.toolkitLabel).toBeTruthy();
      expect(l.activity).toBeTruthy();
      expect(l.toolFlow.warningSigns.length).toBeGreaterThan(TOOL_FLOW_LIMITS.warningSigns);
      expect(l.toolFlow.supportPeople.length).toBeGreaterThan(TOOL_FLOW_LIMITS.supportPeople);
      expect(l.toolFlow.todayActions.length).toBeGreaterThan(1);
      expect(l.placeholder).toBeUndefined();
    }
  });

  it("gates module 1 to justice-involved tracks only", () => {
    expect(RECOVERY_MODULES[0]!.populations).toEqual(["pre_release_ji", "post_release_ji"]);
    expect(RECOVERY_MODULES.slice(1).every((m) => m.populations === undefined)).toBe(true);
  });
});

describe("recovery progress lives in engagement, structured and capped", () => {
  const lesson = RECOVERY_LESSONS[0]!;

  it("stores selections, enforces limits, and is idempotent", () => {
    const res = completeRecoveryLesson("p1", lesson.id, {
      warningSigns: [...lesson.toolFlow.warningSigns],
      supportPeople: [...lesson.toolFlow.supportPeople],
      todayAction: lesson.toolFlow.todayActions[0]!,
    });
    expect(res).toEqual({ completed: true, alreadyComplete: false });
    const flow = recoveryToolFlow("p1", lesson.id)!;
    expect(flow.warningSigns).toHaveLength(TOOL_FLOW_LIMITS.warningSigns);
    expect(flow.supportPeople).toHaveLength(TOOL_FLOW_LIMITS.supportPeople);
    expect(flow.todayAction).toBe(lesson.toolFlow.todayActions[0]);

    const again = completeRecoveryLesson("p1", lesson.id, { warningSigns: [] });
    expect(again.alreadyComplete).toBe(true);
    expect(completedRecoveryLessons("p1")).toEqual([lesson.id]);
    expect(recoveryToolFlow("p1", lesson.id)!.warningSigns).toEqual([]);
  });

  it("drops options that aren't in the lesson's real option set", () => {
    completeRecoveryLesson("p1", lesson.id, {
      warningSigns: ["not a real option"],
      todayAction: "made up",
    });
    const flow = recoveryToolFlow("p1", lesson.id)!;
    expect(flow.warningSigns).toEqual([]);
    expect(flow.todayAction).toBeUndefined();
  });

  it("saves the toolkit takeaway and counts into the engagement summary", () => {
    completeRecoveryLesson("p1", lesson.id, {});
    expect(savedToolkitItems("p1").map((t) => t.label)).toContain(lesson.toolkitLabel);
    expect(engagementSummary("p1").recoveryLessonsCompleted).toBe(1);
    expect(moduleProgress("first-days-out", completedRecoveryLessons("p1")).completed).toBe(1);
  });

  it("ignores unknown lesson ids", () => {
    expect(completeRecoveryLesson("p1", "nope", {})).toEqual({
      completed: false,
      alreadyComplete: false,
    });
  });
});
