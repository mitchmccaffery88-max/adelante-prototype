import { describe, expect, it } from "vitest";
import { claimWeeklyProjection } from "@/lib/billingSparkline";

const now = new Date("2026-10-20T12:00:00Z");
const claim = (cents: number, h: [string, string][]) => ({ chargeCents: cents, history: h.map(([state, at]) => ({ state: state as never, at })) });
const claims = [
  claim(10000, [["submitted", "2026-10-19T12:00:00Z"], ["paid", "2026-10-20T11:00:00Z"]]),
  claim(5000, [["submitted", "2026-10-12T12:00:00Z"]]),
  claim(2500, [["submitted", "2026-10-13T12:00:00Z"], ["submitted", "2026-10-19T00:00:00Z"]]),
  claim(9999, [["submitted", "2026-10-21T12:00:00Z"]]),
  claim(7777, [["submitted", "2026-01-01T12:00:00Z"]]),
];

describe("9a-3 claim weekly projection", () => {
  it("submitted dollars per (start,end] week, first submit only, future/old excluded", () => {
    const s = claimWeeklyProjection("submitted", claims, now)!;
    expect(s.points).toHaveLength(12);
    expect(s.points[11].value).toBe(100);
    expect(s.points[10].value).toBe(75);
    expect(s.points.slice(0, 10).every((p) => p.value === null)).toBe(true);
  });
  it("paid week reflects paid date only", () => {
    const s = claimWeeklyProjection("paid", claims, now)!;
    expect(s.points[11].value).toBe(100);
    expect(s.points.slice(0, 11).every((p) => p.value === null)).toBe(true);
  });
  it("no dated history in window means no sparkline", () => {
    expect(claimWeeklyProjection("paid", [claim(1, [["submitted", "2026-10-19T00:00:00Z"]])], now)).toBeNull();
  });
  it("quiet weeks after the first dated entry are real zeros", () => {
    const s = claimWeeklyProjection("submitted", [claim(100, [["submitted", "2026-09-01T12:00:00Z"]]), claim(100, [["submitted", "2026-10-19T12:00:00Z"]])], now)!;
    expect(s.points.filter((p) => p.value === 0).length).toBeGreaterThan(0);
  });
});
