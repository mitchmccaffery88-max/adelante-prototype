import { describe, expect, it } from "vitest";
import {
  buildWeeklyReflectionPrompt,
  computeWeeklyRecap,
  recapIsEmpty,
  weeklyRecapFacts,
} from "@/lib/weeklyRecap";
import { dayKey } from "@/lib/checkInStreak";

const NOW = new Date(2026, 7, 12, 10, 0, 0);
const K = (d: number) => dayKey(new Date(NOW.getTime() + d * 86_400_000));
const day = (k: string, scheduled: number, selfTaken: number, unmarked: number) => ({
  dateKey: k,
  scheduled,
  chartedGiven: 0,
  selfTaken,
  unmarked,
  conflicts: 0,
});

const base = {
  doseSelfReportDates: [] as string[],
  quickCheckCompletedAt: [] as string[],
  dailyCheckInDayKeys: [] as string[],
  adherence: [] as ReturnType<typeof day>[],
  engagement: { lessonsCompleted: 0, recoveryLessonsCompleted: 0, exercisesCompleted: 0 },
};

describe("weekly recap stats", () => {
  it("counts distinct check-in days inside the 7-day window only", () => {
    const s = computeWeeklyRecap(
      {
        ...base,
        doseSelfReportDates: [K(0), K(-1)],
        dailyCheckInDayKeys: [K(-1), K(-3)],
        quickCheckCompletedAt: [new Date(NOW.getTime() - 20 * 86_400_000).toISOString()],
      },
      NOW,
    );
    expect(s.checkInDays).toBe(3);
    expect(s.weekEndKey).toBe(K(0));
  });

  it("omits medication entirely when nothing is scheduled", () => {
    expect(computeWeeklyRecap(base, NOW).medication).toBeUndefined();
  });

  it("sums real scheduled slots and patient-marked doses", () => {
    const s = computeWeeklyRecap(
      { ...base, adherence: [day(K(0), 2, 2, 0), day(K(-1), 2, 1, 1)] },
      NOW,
    );
    expect(s.medication).toEqual({ scheduled: 4, selfMarkedTaken: 3, unmarked: 1 });
  });

  it("never claims weekly lesson counts, only totals plus activity", () => {
    const s = computeWeeklyRecap(
      {
        ...base,
        engagement: {
          lessonsCompleted: 4,
          recoveryLessonsCompleted: 1,
          exercisesCompleted: 2,
          lastActivityAt: new Date(NOW.getTime() - 86_400_000).toISOString(),
        },
      },
      NOW,
    );
    expect(s.learning.weeklyCountsAvailable).toBe(false);
    expect(s.learning.activeThisWeek).toBe(true);
    expect(s.learning.lessonsCompletedTotal).toBe(4);
  });

  it("treats a fully quiet week as empty", () => {
    expect(recapIsEmpty(computeWeeklyRecap(base, NOW))).toBe(true);
  });
});

describe("reflection prompt grounding", () => {
  const stats = computeWeeklyRecap(
    { ...base, doseSelfReportDates: [K(0)], adherence: [day(K(0), 2, 1, 1)] },
    NOW,
  );

  it("passes only numeric facts", () => {
    const facts = weeklyRecapFacts(stats).join(" ");
    expect(facts).toContain("1 of 7");
    expect(facts).toContain("Doses the member marked as taken: 1");
    expect(facts).not.toMatch(/craving|slip|lapse|emotion|AUDIT|DAST|PHQ/i);
  });

  it("tells the model medication is absent rather than leaving it open", () => {
    expect(weeklyRecapFacts(computeWeeklyRecap(base, NOW)).join(" ")).toContain(
      "Do not mention medication",
    );
  });

  it("forbids invention, clinical language and word-count creep", () => {
    const p = buildWeeklyReflectionPrompt(stats);
    expect(p).toMatch(/Invent NOTHING/);
    expect(p).toMatch(/60 words maximum/);
    expect(p).toMatch(/"elevated"/);
    expect(p).toMatch(/never state a weekly lesson count|Do not claim any lessons/);
    expect(p).toMatch(/no ACTION line/i);
  });
});
