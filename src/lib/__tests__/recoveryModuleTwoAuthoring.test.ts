// §Content-authoring pass Batch 2 — Module 2 authoring + anti-templating guard.
import { describe, expect, it } from "vitest";
import { liveLessonsInModule } from "@/lib/contentCatalog";
import { originalityErrors } from "@/lib/contentOriginality";
import { getContentEntry } from "@/lib/contentPublishing";
import { RECOVERY_LESSON_TYPE } from "@/lib/contentTypes";
import { FINDING_MY_PEOPLE_FIELDS } from "@/lib/recovery.findingMyPeople.authored";

const lessons = () => liveLessonsInModule("finding-my-people");

describe("Module 2 'Finding My People' is really authored, not templated", () => {
  it("still has its ten lessons in order", () => {
    expect(lessons()).toHaveLength(10);
    expect(lessons().map((l) => l.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("passes the real quality gate on every lesson", () => {
    for (const l of lessons()) {
      expect(
        originalityErrors("recovery_lesson", structuredClone(l) as unknown as Record<string, unknown>),
        `${l.id} failed the originality gate`,
      ).toEqual([]);
    }
  });

  it("passes the same validation the admin form enforces", () => {
    for (const l of lessons()) {
      expect(
        RECOVERY_LESSON_TYPE.validate(structuredClone(l) as unknown as Record<string, unknown>),
        `${l.id} failed validate()`,
      ).toEqual([]);
    }
  });

  it("carries no remaining instance of the measured filler strings", () => {
    for (const l of lessons()) {
      expect(l.adelQuestion).not.toBe("What part of this feels hardest for you?");
      expect(l.adelReflection).not.toMatch(/^Adel can help you go deeper on/);
      expect(l.checkIn).not.toMatch(/^Right now, how much is/);
    }
  });

  it("gives each lesson its own check-in, question and reflection", () => {
    const l = lessons();
    for (const key of ["checkIn", "adelQuestion", "adelReflection"] as const) {
      expect(new Set(l.map((x) => x[key])).size, `${key} repeats inside the module`).toBe(l.length);
    }
  });

  it("shares no tool-flow option set between two lessons", () => {
    const l = lessons();
    for (const key of ["warningSigns", "supportPeople", "todayActions"] as const) {
      const sets = l.map((x) => JSON.stringify(x.toolFlow[key]));
      expect(new Set(sets).size, `${key} is shared between lessons`).toBe(l.length);
    }
  });

  it("ships as PUBLISHED overrides authored by Cathy, not baseline edits", () => {
    for (const f of FINDING_MY_PEOPLE_FIELDS) {
      const entry = getContentEntry("recovery_lesson", f.lessonId);
      expect(entry?.status).toBe("published");
      expect(entry?.revisions[0]?.by).toBe("Cathy");
      expect(entry?.overridesBaseline).toBe(true);
    }
  });
});
