// §Lesson-player Phase D — the NON-GOAL is the important assertion here: no
// lesson in the shipped catalog carries any of the new optional fields, so
// every one of the 180 lessons must render exactly as it did before.
import { describe, expect, it } from "vitest";
import { LIBRARY_ITEMS } from "@/lib/library";
import { RECOVERY_LESSONS } from "@/lib/recovery";
import { hasEnrichment, hasIfThen, usableStages } from "@/lib/lessonAuthoring";
import { resolveLearnStages } from "@/lib/lessonLearn";
import { DEFAULT_RATING_DIMENSIONS, dimensionsForLesson } from "@/lib/lessonRatings";

const LABELS = {
  happening: "What's happening",
  why: "Why it happens",
  canChange: "What can change",
  beforeMovingOn: "Before moving on",
};

describe("Phase D ships empty", () => {
  const all = [...LIBRARY_ITEMS, ...RECOVERY_LESSONS];

  it("covers the whole catalog", () => {
    expect(all.length).toBeGreaterThanOrEqual(170);
  });

  it("no shipped lesson has authored Phase D content", () => {
    const authored = all.filter(
      (l) =>
        hasEnrichment(l.enrichment) ||
        hasIfThen(l.ifThenPractice) ||
        usableStages(l.learnStages).length > 0 ||
        Boolean(l.ratingPrimary?.label?.trim()),
    );
    expect(authored.map((l) => l.id)).toEqual([]);
  });

  it("every shipped lesson still resolves to the single learn block", () => {
    for (const l of all) {
      expect(resolveLearnStages(l, LABELS)).toEqual([]);
    }
  });
});

describe("teaching-block resolution", () => {
  it("falls back to no stages when nothing is authored", () => {
    expect(resolveLearnStages({ learnBody: "one block" }, LABELS)).toEqual([]);
  });

  it("uses authored stages when present", () => {
    const stages = resolveLearnStages(
      {
        learnBody: "one block",
        learnStages: [
          { title: "A", body: "a body" },
          { title: "", body: "" },
          { title: "B", body: "b body" },
        ],
      },
      LABELS,
    );
    expect(stages).toEqual([
      { title: "A", body: "a body" },
      { title: "B", body: "b body" },
    ]);
  });

  it("prefers enrichment over stages and labels unheaded parts", () => {
    const stages = resolveLearnStages(
      {
        learnBody: "one block",
        learnStages: [{ title: "A", body: "a" }],
        enrichment: {
          happening: { body: "the body notices it first" },
          why: { headline: "Custom why", body: "because of X" },
          approach: "CBT",
          takeaway: "one line",
        },
      },
      LABELS,
    );
    expect(stages.map((s) => s.title)).toEqual([
      "What's happening",
      "Custom why",
      "Before moving on",
    ]);
    expect(stages[1]?.body).toContain("CBT");
  });
});

describe("if/then gating", () => {
  it("needs both sides", () => {
    expect(hasIfThen({ ifOptions: ["a"], thenOptions: [] })).toBe(false);
    expect(hasIfThen({ ifOptions: [" "], thenOptions: ["b"] })).toBe(false);
    expect(hasIfThen({ ifOptions: ["a"], thenOptions: ["b"] })).toBe(true);
  });

  it("survives malformed authored data", () => {
    expect(hasIfThen({ ifOptions: ["a"] } as never)).toBe(false);
  });
});

describe("rating override", () => {
  it("keeps the Phase C derivation when nothing is authored", () => {
    expect(dimensionsForLesson("I feel anxious")[0]?.id).toBe("calm");
    expect(dimensionsForLesson("")).toEqual(DEFAULT_RATING_DIMENSIONS);
  });

  it("an authored label wins over the derivation and keeps the shared pair", () => {
    const dims = dimensionsForLesson("I feel anxious", {
      label: "How loud the craving is",
      lowLabel: "Quiet",
      highLabel: "Loud",
      higherIsHarder: true,
    });
    expect(dims[0]).toMatchObject({
      label: "How loud the craving is",
      lowLabel: "Quiet",
      highLabel: "Loud",
      higherIsBetter: false,
    });
    expect(dims.slice(1)).toEqual(DEFAULT_RATING_DIMENSIONS);
  });

  it("a blank label does not count as authored", () => {
    expect(dimensionsForLesson("I feel anxious", { label: "   " })[0]?.id).toBe("calm");
  });
});
