// §Content-authoring pass Batch 7 — Module 7 authoring + anti-templating guard,
// plus the NEW activity-choice check (the gap Batch 6 surfaced).
import { describe, expect, it } from "vitest";
import { liveLessonsInModule } from "@/lib/contentCatalog";
import { originalityErrors } from "@/lib/contentOriginality";
import { getContentEntry } from "@/lib/contentPublishing";
import { RECOVERY_LESSON_TYPE } from "@/lib/contentTypes";
import { WHEN_RECOVERY_GETS_HARD_FIELDS } from "@/lib/recovery.whenRecoveryGetsHard.authored";

const lessons = () => liveLessonsInModule("when-recovery-gets-hard");

describe("Module 7 'When Recovery Gets Hard' is really authored, not templated", () => {
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

  it("shares no single tool-flow OPTION across every lesson — the tail-collapse pattern", () => {
    const l = lessons();
    const tails = l.map((x) => JSON.stringify(x.toolFlow.todayActions.slice(1)));
    expect(new Set(tails).size, "todayActions are distinct only in the first entry").toBe(l.length);
  });

  it("ships as PUBLISHED overrides authored by Cathy, not baseline edits", () => {
    for (const f of WHEN_RECOVERY_GETS_HARD_FIELDS) {
      const entry = getContentEntry("recovery_lesson", f.lessonId);
      expect(entry?.status).toBe("published");
      expect(entry?.revisions[0]?.by).toBe("Cathy");
      expect(entry?.overridesBaseline).toBe(true);
    }
  });
});

describe("Module 7 decision activities offer real per-lesson choices", () => {
  it("shares no activity-choice set between two lessons", () => {
    const sets = lessons().map((l) =>
      l.activity.kind === "decision" ? JSON.stringify(l.activity.choices.map((c) => c.label)) : l.id,
    );
    expect(new Set(sets).size, "two lessons offer the identical choice set").toBe(sets.length);
  });

  it("no longer offers the four labels all ten lessons shared", () => {
    const shared = ["Call my sponsor immediately", "Leave and go somewhere safe", "Open my relapse prevention plan", "Get to a meeting today"];
    for (const l of lessons()) {
      if (l.activity.kind !== "decision") continue;
      for (const c of l.activity.choices) {
        expect(shared, `${l.id} still offers the templated choice "${c.label}"`).not.toContain(c.label);
      }
    }
  });

  it("keeps four choices with real feedback on every decision activity", () => {
    for (const l of lessons()) {
      if (l.activity.kind !== "decision") continue;
      expect(l.activity.choices.length, `${l.id}`).toBe(4);
      for (const c of l.activity.choices) expect(c.feedback.length).toBeGreaterThan(40);
    }
  });
});

describe("Module 7 keeps the established voice and format", () => {
  it("asks no 1-10 scale questions", () => {
    for (const l of lessons()) {
      for (const text of [l.checkIn, l.adelQuestion]) {
        expect(text, `${l.id} uses a scale question`).not.toMatch(/\b1\s*(-|–|to)\s*10\b|on a scale/i);
      }
    }
  });

  it("keeps the teaching content the editorial pass already approved", () => {
    for (const l of lessons()) {
      expect(l.learnBody.length).toBeGreaterThan(80);
      expect(l.insight.trim()).toBeTruthy();
    }
  });
});
