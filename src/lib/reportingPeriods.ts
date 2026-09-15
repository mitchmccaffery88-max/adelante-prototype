// §Reporting Redesign Tier 1 — reporting period vocabulary.
//
// One honest rule, matching the existing "no live metric yet" discipline:
// a metric only responds to the period selector when the underlying records
// carry a real timestamp we can re-filter on client-side. Everything else is
// declared point-in-time (a current-state backlog, not a windowed measure) or
// sourceless. Nothing here pretends a number re-windowed when it did not.

import type { MetricKey } from "./dashboardMetrics";

export const REPORTING_PERIODS = [
  { key: "7", days: 7, label: "Last 7 days", short: "7d" },
  { key: "30", days: 30, label: "Last 30 days", short: "30d" },
  { key: "90", days: 90, label: "Last 90 days", short: "90d" },
  { key: "365", days: 365, label: "Last 12 months", short: "12mo" },
] as const;

export type ReportingPeriodKey = (typeof REPORTING_PERIODS)[number]["key"];

export const DEFAULT_PERIOD: ReportingPeriodKey = "30";

export function parsePeriod(value: unknown): ReportingPeriodKey {
  const s = String(value ?? "");
  return (REPORTING_PERIODS.find((p) => p.key === s)?.key ?? DEFAULT_PERIOD) as ReportingPeriodKey;
}

export function periodDays(key: ReportingPeriodKey): number {
  return REPORTING_PERIODS.find((p) => p.key === key)?.days ?? 30;
}

export function periodLabel(key: ReportingPeriodKey): string {
  return REPORTING_PERIODS.find((p) => p.key === key)?.label ?? "Last 30 days";
}

export function periodShort(key: ReportingPeriodKey): string {
  return REPORTING_PERIODS.find((p) => p.key === key)?.short ?? "30d";
}

/**
 * How a metric relates to the selected reporting period.
 * - `windowed`    — recomputed over the selected window from timestamped records.
 * - `point_in_time` — a current-state backlog. Re-windowing it would hide open
 *   work rather than measure a period, so the selector deliberately does not
 *   apply. The reason is shown in the UI.
 * - `no_source`   — no data source at all; already rendered as a gap.
 */
export type PeriodBehavior = "windowed" | "point_in_time" | "no_source";

export const METRIC_PERIOD_BEHAVIOR: Record<MetricKey, PeriodBehavior> = {
  mar_compliance_pct: "windowed",
  group_attendance_rate_pct: "windowed",
  unsigned_notes_count: "point_in_time",
  overdue_task_count: "point_in_time",
  controlled_count_discrepancies: "no_source",
  open_kites_count: "no_source",
  ncchc_intake_screening_pct: "no_source",
  ncchc_health_assessment_pct: "no_source",
  ncchc_chronic_care_pct: "no_source",
  ncchc_grievance_response_pct: "no_source",
};

export const POINT_IN_TIME_REASON: Partial<Record<MetricKey, string>> = {
  unsigned_notes_count:
    "Current backlog, not a period measure — every draft note is still open work today regardless of when it was written. Filtering it to a window would hide older unsigned notes, which is the opposite of what this row is for.",
  overdue_task_count:
    "Current backlog, not a period measure — a task overdue today stays overdue whatever window you pick. Row age is shown per record in the drill-down instead.",
};

/** Human sentence for the period chip next to a metric. */
export function periodNoteFor(key: MetricKey, period: ReportingPeriodKey): string {
  switch (METRIC_PERIOD_BEHAVIOR[key]) {
    case "windowed":
      return periodLabel(period);
    case "point_in_time":
      return "As of now";
    default:
      return "No source";
  }
}
