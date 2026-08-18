// §Adelante Journey sync Build 3 — Module 1 authoring + editorial-quality guard.
import { describe, expect, it } from "vitest";
import { liveLessonsInModule, liveRecoveryLessons } from "@/lib/contentCatalog";
import { contentEntry } from "@/lib/contentPublishing";
import { RECOVERY_LESSON_TYPE } from "@/lib/contentTypes";
import { AUTHORED_FIRST_DAYS_OUT_LESSONS } from "@/lib/recovery.firstDaysOut.authored";
import { PORTED_RECOVERY_LESSONS } from "@/lib/recovery.ported";

const sentences = (t: string) =>
  t
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

describe("Module 1 reaches ten lessons through the content lifecycle", () => {
  it("shows ten lessons in 'My First Days Out'", () => {
    expect(liveLessonsInModule("first-days-out")).toHaveLength(10);
  });

  it("orders 1..10 with no gaps or collisions", () => {
    expect(liveLessonsInModule("first-days-out").map((l) => l.order)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
  });

  it("carries the five new lessons as PUBLISHED managed content, not hardcoded baseline", () => {
    for (const l of AUTHORED_FIRST_DAYS_OUT_LESSONS) {
      const entry = contentEntry("recovery_lesson", l.id);
      expect(entry?.status).toBe("published");
      expect(entry?.revisions[0]?.by).toBe("Cathy");
      expect(entry?.overridesBaseline).toBe(false);
    }
  });

  it("passes the same validation the admin form enforces", () => {
    for (const l of AUTHORED_FIRST_DAYS_OUT_LESSONS) {
      expect(
        RECOVERY_LESSON_TYPE.validate(structuredClone(l) as unknown as Record<string, unknown>),
      ).toEqual([]);
    }
  });

  it("keeps the module's post-release population gate on every new lesson", () => {
    for (const l of AUTHORED_FIRST_DAYS_OUT_LESSONS)
      expect(l.populations).toEqual(["pre_release_ji", "post_release_ji"]);
  });
});

describe("editorial quality — no generator artifacts survive", () => {
  it("never repeats a sentence inside one teaching block", () => {
    for (const l of liveRecoveryLessons()) {
      const s = sentences(l.learnBody);
      expect(new Set(s).size, `${l.id} repeats a sentence`).toBe(s.length);
    }
  });

  it("gives every lesson its own teaching headline and closing insight", () => {
    const lessons = PORTED_RECOVERY_LESSONS;
    expect(new Set(lessons.map((l) => l.learnTitle)).size).toBe(lessons.length);
    expect(new Set(lessons.map((l) => l.insight)).size).toBe(lessons.length);
  });

  it("gives decision feedback that is unique per choice and never reused across lessons", () => {
    const all: string[] = [];
    for (const l of liveRecoveryLessons()) {
      if (l.activity.kind !== "decision") continue;
      const fb = l.activity.choices.map((c) => c.feedback);
      expect(new Set(fb).size, `${l.id} reuses feedback between choices`).toBe(fb.length);
      all.push(...fb);
    }
    expect(new Set(all).size).toBe(all.length);
  });
});
