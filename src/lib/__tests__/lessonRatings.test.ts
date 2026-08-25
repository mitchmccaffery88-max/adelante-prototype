// §Lesson-player Phase C — derived dimensions, delta polarity, recommends.
import { describe, expect, it } from "vitest";
import {
  DEFAULT_RATING_DIMENSIONS,
  deltaVerdict,
  dimensionsForLesson,
} from "../lessonRatings";
import { recommendsForLibraryItem, recommendsForRecoveryLesson } from "../lessonRecommends";
import { LIBRARY_ITEMS } from "../library";
import { RECOVERY_LESSONS } from "../recovery";

describe("rating dimensions", () => {
  it("falls back to the shared default pair with no check-in signal", () => {
    expect(dimensionsForLesson()).toEqual(DEFAULT_RATING_DIMENSIONS);
    expect(dimensionsForLesson("Take a breath before you start.")).toEqual(
      DEFAULT_RATING_DIMENSIONS,
    );
  });

  it("derives a primary dimension from the lesson's own check-in words", () => {
    const dims = dimensionsForLesson("Are cravings hitting hard today?");
    expect(dims[0]?.id).toBe("urge");
    expect(dims).toHaveLength(3);
    expect(dimensionsForLesson("Feeling alone since you got out?")[0]?.id).toBe("connected");
  });
});

describe("delta polarity", () => {
  const confidence = DEFAULT_RATING_DIMENSIONS[0]!; // higherIsBetter
  const distress = DEFAULT_RATING_DIMENSIONS[1]!; // lower is the good outcome

  it("reads a rise as good only when higher is better", () => {
    expect(deltaVerdict(confidence, 2, 4)).toBe("better");
    expect(deltaVerdict(distress, 2, 4)).toBe("worse");
    expect(deltaVerdict(distress, 4, 2)).toBe("better");
    expect(deltaVerdict(confidence, 3, 3)).toBe("same");
    expect(deltaVerdict(confidence, undefined, 3)).toBe("incomplete");
  });
});

describe("recommendation chips", () => {
  it("point at real existing content for every lesson", () => {
    const libIds = new Set(LIBRARY_ITEMS.map((i) => i.id));
    const recIds = new Set(RECOVERY_LESSONS.map((l) => l.id));
    for (const item of LIBRARY_ITEMS) {
      const recs = recommendsForLibraryItem(item);
      expect(recs.length).toBeGreaterThan(0);
      expect(recs.length).toBeLessThanOrEqual(3);
      for (const r of recs) {
        expect(r.label.length).toBeGreaterThan(0);
        if (r.search["item"]) expect(libIds.has(r.search["item"])).toBe(true);
        if (r.search["lesson"]) expect(recIds.has(r.search["lesson"])).toBe(true);
        expect(r.search["item"]).not.toBe(item.id);
      }
    }
    for (const lesson of RECOVERY_LESSONS) {
      const recs = recommendsForRecoveryLesson(lesson);
      expect(recs.length).toBeLessThanOrEqual(3);
      for (const r of recs) {
        if (r.search["item"]) expect(libIds.has(r.search["item"])).toBe(true);
        if (r.search["lesson"]) expect(recIds.has(r.search["lesson"])).toBe(true);
        expect(r.search["lesson"]).not.toBe(lesson.id);
      }
    }
  });
});
