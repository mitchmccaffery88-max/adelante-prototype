// §Patient portal Build 2 — regression cover for the two new pure modules the
// home dashboard depends on. Both are deliberately store-free, so these tests
// pin the behaviour without touching the EHR or any gated surface.
import { describe, it, expect } from "vitest";
import { computeCheckInStreak, checkInStreakFrom, dayKey } from "@/lib/checkInStreak";
import { privateNudge } from "@/lib/privateNudge";

const NOW = new Date(2026, 4, 20, 10, 0, 0);
const K = (delta: number) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() + delta);
  return dayKey(d);
};

describe("check-in streak", () => {
  it("counts consecutive days ending today", () => {
    const s = computeCheckInStreak([K(0), K(-1), K(-2)], K(0));
    expect(s.days).toBe(3);
    expect(s.checkedInToday).toBe(true);
  });

  it("keeps a streak that ends yesterday (grace), without claiming today", () => {
    const s = computeCheckInStreak([K(-1), K(-2)], K(0));
    expect(s.days).toBe(2);
    expect(s.checkedInToday).toBe(false);
  });

  it("resets once a whole day is skipped", () => {
    expect(computeCheckInStreak([K(-2), K(-3)], K(0)).days).toBe(0);
  });

  it("folds dose self-reports and quick checks into the same day", () => {
    const s = checkInStreakFrom(
      {
        doseSelfReportDates: [K(0)],
        quickCheckCompletedAt: [new Date(NOW).toISOString(), new Date(2026, 4, 19, 9).toISOString()],
      },
      NOW,
    );
    expect(s.days).toBe(2);
    expect(s.contributingDays).toEqual([K(0), K(-1)]);
  });
});

describe("private nudge", () => {
  const base = {
    streakDays: 3,
    checkedInToday: true,
    medsUnmarkedToday: 0,
    medsScheduledToday: 0,
    openObligations: 0,
    checkInDaysLast14: 3,
  };

  it("stays quiet about medication when nothing is scheduled", () => {
    const n = privateNudge({ ...base, medsScheduledToday: 0, medsUnmarkedToday: 0 });
    expect(n?.id).not.toBe("meds-unmarked");
  });

  it("notices a fully unmarked medication day without scoring it", () => {
    const n = privateNudge({ ...base, medsScheduledToday: 2, medsUnmarkedToday: 2 });
    expect(n?.id).toBe("meds-unmarked");
    expect(n?.text).not.toMatch(/\b(score|risk|missed \d+ of)\b/i);
  });

  it("returns at most one observation", () => {
    const n = privateNudge({
      ...base,
      medsScheduledToday: 2,
      medsUnmarkedToday: 1,
      openObligations: 4,
      daysSinceContact: 30,
    });
    expect(n).not.toBeNull();
    expect(typeof n?.text).toBe("string");
  });
});
