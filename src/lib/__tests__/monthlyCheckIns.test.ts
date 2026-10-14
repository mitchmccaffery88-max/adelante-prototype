import { describe, expect, it } from "vitest";
import { monthlyCheckInCount } from "@/lib/checkInStreak";

describe("monthly check-in presentation", () => {
  it("deduplicates real sources and excludes earlier months and future dates", () => {
    expect(monthlyCheckInCount({ doseSelfReportDates: ["2026-10-01", "2026-09-30", "2026-10-31"], dailyCheckInDayKeys: ["2026-10-01", "2026-10-02"], quickCheckCompletedAt: ["2026-10-03T18:00:00Z", "invalid"] }, new Date("2026-10-14T18:00:00Z"), "America/Los_Angeles")).toBe(3);
  });
  it("uses the facility month rather than UTC and never resets a monthly total after a skipped day", () => {
    const sources = { doseSelfReportDates: ["2026-09-01"], quickCheckCompletedAt: ["2026-10-01T01:00:00Z"] };
    expect(monthlyCheckInCount(sources, new Date("2026-10-01T02:00:00Z"), "America/Los_Angeles")).toBe(2);
    expect(monthlyCheckInCount(sources, new Date("2026-10-03T18:00:00Z"), "America/Los_Angeles")).toBe(0);
  });
});