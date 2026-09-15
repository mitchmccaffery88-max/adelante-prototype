// §Reporting Redesign Tier 1 — period selector honesty contract.
//
// These lock in the two claims the UI makes: the windowed metrics genuinely
// recompute when the window changes, and every metric declares a period
// behaviour so nothing can silently ignore the selector.
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PERIOD,
  METRIC_PERIOD_BEHAVIOR,
  parsePeriod,
  periodDays,
  periodNoteFor,
  POINT_IN_TIME_REASON,
  REPORTING_PERIODS,
} from "../reportingPeriods";
import { computeLiveMetrics, METRIC_KEYS } from "../dashboardMetrics";

describe("reporting period vocabulary", () => {
  it("falls back to the default for junk input", () => {
    expect(parsePeriod(undefined)).toBe(DEFAULT_PERIOD);
    expect(parsePeriod("nonsense")).toBe(DEFAULT_PERIOD);
    expect(parsePeriod("9999")).toBe(DEFAULT_PERIOD);
    expect(parsePeriod("7")).toBe("7");
  });

  it("maps every offered period to a real day count", () => {
    for (const p of REPORTING_PERIODS) {
      expect(periodDays(p.key)).toBe(p.days);
      expect(p.days).toBeGreaterThan(0);
    }
  });

  it("declares a period behaviour for every metric key", () => {
    for (const key of METRIC_KEYS) {
      expect(METRIC_PERIOD_BEHAVIOR[key]).toBeDefined();
    }
  });

  it("gives every point-in-time metric a written reason", () => {
    for (const key of METRIC_KEYS) {
      if (METRIC_PERIOD_BEHAVIOR[key] === "point_in_time") {
        expect(POINT_IN_TIME_REASON[key]).toBeTruthy();
      }
    }
  });

  it("labels windowed metrics with the period and backlogs with 'As of now'", () => {
    expect(periodNoteFor("mar_compliance_pct", "7")).toBe("Last 7 days");
    expect(periodNoteFor("unsigned_notes_count", "7")).toBe("As of now");
    expect(periodNoteFor("open_kites_count", "7")).toBe("No source");
  });
});

describe("computeLiveMetrics honours the window", () => {
  it("names the window only when there is nothing charted in it", () => {
    // The period label is rendered by the UI, so the basis stays window-free
    // when it has real numbers to report and only spells the window out when
    // it has to explain an empty result.
    const empty = computeLiveMetrics(new Date("1990-01-01T00:00:00Z"), 7);
    expect(empty.mar_compliance_pct.basis).toBe("No doses charted in the last 7 days");
    expect(empty.mar_compliance_pct.value).toBeNull();
  });

  it("leaves the point-in-time backlogs identical across windows", () => {
    const short = computeLiveMetrics(new Date(), 7);
    const long = computeLiveMetrics(new Date(), 365);
    expect(short.unsigned_notes_count.value).toBe(long.unsigned_notes_count.value);
    expect(short.overdue_task_count.value).toBe(long.overdue_task_count.value);
  });

  it("never widens a window into a larger charted denominator than the long one", () => {
    // A shorter window is a strict subset, so its sample can never exceed the
    // longer window's. Guards against an off-by-one that would invert the filter.
    const short = computeLiveMetrics(new Date(), 7);
    const long = computeLiveMetrics(new Date(), 365);
    const n = (b?: string) => Number((b ?? "").match(/of (\d+) charted/)?.[1] ?? 0);
    expect(n(short.mar_compliance_pct.basis)).toBeLessThanOrEqual(
      n(long.mar_compliance_pct.basis),
    );
  });
});
