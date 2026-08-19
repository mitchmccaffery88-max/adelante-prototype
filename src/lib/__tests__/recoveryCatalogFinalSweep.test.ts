// §Content-authoring pass Batch 8 — FINAL catalog-wide sweep across all eight
// Recovery Journey modules (80 lessons). Closes the content-authoring project:
// no filler patterns, no shared tool-flow option sets and no shared
// activity-choice sets ANYWHERE in the live catalog, not just within a module.
import { describe, expect, it } from "vitest";
import { liveRecoveryModules, liveLessonsInModule } from "@/lib/contentCatalog";
import { originalityErrors } from "@/lib/contentOriginality";

const AUTHORED_MODULES = [
  "first-days-out",
  "finding-my-people",
  "understanding-my-addiction",
  "changing-my-everyday-life",
  "healing-my-relationships",
  "building-a-life-that-works",
  "when-recovery-gets-hard",
  "becoming-someone-new",
];

const allLessons = () => AUTHORED_MODULES.flatMap((id) => liveLessonsInModule(id));

describe("Recovery Journey catalog — final content-authoring sweep", () => {
  it("covers all eight authored modules and eighty lessons", () => {
    const ids = liveRecoveryModules().map((m) => m.id);
    for (const id of AUTHORED_MODULES) expect(ids).toContain(id);
    expect(allLessons()).toHaveLength(80);
  });

  it("has zero remaining instances of the original filler patterns", () => {
    for (const l of allLessons()) {
      expect(l.checkIn, l.id).not.toMatch(/^Right now, how much is/);
      expect(l.adelReflection, l.id).not.toMatch(/^Adel can help you go deeper on/);
      expect(l.adelQuestion, l.id).not.toBe("What part of this feels hardest for you?");
    }
  });

  it("passes the real quality gate on every one of the eighty lessons", () => {
    for (const l of allLessons()) {
      expect(
        originalityErrors("recovery_lesson", structuredClone(l) as unknown as Record<string, unknown>),
        `${l.id} failed the originality gate`,
      ).toEqual([]);
    }
  });

  it("shares no tool-flow option set across the entire catalog", () => {
    const lessons = allLessons();
    for (const key of ["warningSigns", "supportPeople", "todayActions"] as const) {
      const sets = lessons.map((l) => JSON.stringify(l.toolFlow[key]));
      expect(new Set(sets).size, `${key} repeats somewhere in the catalog`).toBe(lessons.length);
    }
  });

  it("shares no activity-choice set across the entire catalog", () => {
    const sets = allLessons().map((l) =>
      l.activity.kind === "decision" ? JSON.stringify(l.activity.choices.map((c) => c.label)) : l.id,
    );
    expect(new Set(sets).size, "two lessons offer the identical choice set").toBe(sets.length);
  });

  it("asks no 1-10 scale question anywhere in the catalog", () => {
    for (const l of allLessons()) {
      for (const text of [l.checkIn, l.adelQuestion]) {
        expect(text, `${l.id} uses a scale question`).not.toMatch(/\b1\s*(-|–|to)\s*10\b|scale of \d/i);
      }
    }
  });
});
