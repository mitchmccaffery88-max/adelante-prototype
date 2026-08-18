import { describe, expect, it } from "vitest";
import {
  RECOVERY_ES_REVIEW,
  recoveryContentEs,
  recoveryModuleEn,
  recoveryModuleEs,
  recoveryUiEn,
  recoveryUiEs,
} from "@/lib/i18n.recovery";
import { RECOVERY_MODULES, lessonsInModule, moduleProgress } from "@/lib/recovery";

describe("recovery Spanish scaffolding", () => {
  it("translates every UI string in both directions", () => {
    for (const k of Object.keys(recoveryUiEn)) {
      expect(recoveryUiEs[k as keyof typeof recoveryUiEn], k).toBeTruthy();
    }
    expect(Object.keys(recoveryUiEs).sort()).toEqual(Object.keys(recoveryUiEn).sort());
  });

  it("has a real name, mission and subtitle in Spanish for all 9 modules", () => {
    expect(RECOVERY_MODULES).toHaveLength(9);
    for (const m of RECOVERY_MODULES) {
      for (const field of ["name", "mission", "subtitle"] as const) {
        const key = `rec.mod.${m.id}.${field}` as keyof typeof recoveryModuleEn;
        expect(recoveryModuleEn[key], key).toBe(m[field]);
        expect(recoveryModuleEs[key], key).toBeTruthy();
        expect(recoveryModuleEs[key], key).not.toBe(m[field]);
      }
    }
  });

  it("covers every real Module 1 lesson's title, prose and tool-flow options", () => {
    const lessons = lessonsInModule("first-days-out");
    expect(lessons.length).toBeGreaterThan(0);
    for (const l of lessons) {
      for (const f of [
        "title",
        "problem",
        "checkIn",
        "learnTitle",
        "learnBody",
        "adelReflection",
        "adelQuestion",
        "insight",
        "toolkitLabel",
      ] as const) {
        expect(recoveryContentEs[`rec.${l.id}.${f}`], `${l.id}.${f}`).toBeTruthy();
      }
      l.toolFlow.warningSigns.forEach((_, i) =>
        expect(recoveryContentEs[`rec.${l.id}.warn.${i}`]).toBeTruthy(),
      );
      l.toolFlow.supportPeople.forEach((_, i) =>
        expect(recoveryContentEs[`rec.${l.id}.sup.${i}`]).toBeTruthy(),
      );
      l.toolFlow.todayActions.forEach((_, i) =>
        expect(recoveryContentEs[`rec.${l.id}.todo.${i}`]).toBeTruthy(),
      );
    }
  });

  it("keeps lesson-body Spanish flagged as pending human review", () => {
    // Same discipline as `verified: false` content elsewhere — nothing about
    // the recovery prose may quietly read as final.
    expect(RECOVERY_ES_REVIEW.reviewed).toBe(false);
    expect(RECOVERY_ES_REVIEW.reviewedBy).toBeUndefined();
  });

  it("reports a real zero lesson count for content-pending modules", () => {
    for (const m of RECOVERY_MODULES.filter((x) => x.contentPending)) {
      const prog = moduleProgress(m.id, []);
      expect(prog.total).toBe(0);
      expect(prog.completed).toBe(0);
    }
    const one = moduleProgress("first-days-out", ["fdo-first-72-hours"]);
    expect(one.total).toBe(5);
    expect(one.completed).toBe(1);
    expect(one.pct).toBe(20);
  });
});
