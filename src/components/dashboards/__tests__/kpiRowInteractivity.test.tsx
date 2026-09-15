// @vitest-environment jsdom
// §Reporting Redesign Tier 1 — KPI row interactivity must read as intentional.

//
// Before this pass, non-drillable rows rendered an invisible spacer, so a row
// with no record-level detail looked identical to one whose button had failed
// to render. Every row now declares itself either way.
import { beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, within } from "@testing-library/react";
import { KpiVsTargetSection } from "../KpiVsTargetSection";
import { METRIC_KEYS, type LiveMetricMap, type MetricKey } from "@/lib/dashboardMetrics";
import type { KpiTarget } from "@/lib/ehr";

const metrics: LiveMetricMap = {
  mar_compliance_pct: { value: 91, unit: "percent", higherIsBetter: true, basis: "9 of 10" },
  unsigned_notes_count: { value: 3, unit: "count", higherIsBetter: false },
  overdue_task_count: { value: 2, unit: "count", higherIsBetter: false },
  group_attendance_rate_pct: { value: 80, unit: "percent", higherIsBetter: true },
  controlled_count_discrepancies: { value: null, unit: "count", higherIsBetter: false },
  open_kites_count: { value: null, unit: "count", higherIsBetter: false },
  ncchc_intake_screening_pct: { value: null, unit: "percent", higherIsBetter: true },
  ncchc_health_assessment_pct: { value: null, unit: "percent", higherIsBetter: true },
  ncchc_chronic_care_pct: { value: null, unit: "percent", higherIsBetter: true },
  ncchc_grievance_response_pct: { value: null, unit: "percent", higherIsBetter: true },
};

const targets: KpiTarget[] = METRIC_KEYS.map((key: MetricKey, i) => ({
  id: `t-${i}`,
  metricKey: key,
  label: key,
  targetValue: 90,
  unit: metrics[key].unit,
})) as unknown as KpiTarget[];

describe("KPI row interactivity", () => {
  beforeEach(() => cleanup());

  it("gives every row an explicit drillable flag — none are ambiguous", () => {
    const { container } = render(
      <KpiVsTargetSection targets={targets} metrics={metrics} onDrillDown={() => {}} />,
    );
    const rows = container.querySelectorAll("[data-metric-key]");
    expect(rows).toHaveLength(METRIC_KEYS.length);
    rows.forEach((r) => {
      expect(["yes", "no"]).toContain(r.getAttribute("data-metric-drillable"));
    });
  });

  it("renders a visible reason instead of a blank spacer on non-drillable rows", () => {
    const { container } = render(
      <KpiVsTargetSection targets={targets} metrics={metrics} onDrillDown={() => {}} />,
    );
    const nonDrillable = container.querySelectorAll('[data-metric-drillable="no"]');
    expect(nonDrillable.length).toBeGreaterThan(0);
    nonDrillable.forEach((r) => {
      const key = r.getAttribute("data-metric-key");
      const marker = within(r as HTMLElement).getByTestId(`no-detail-${key}`);
      expect(marker.textContent ?? "").toMatch(/No (record-level detail|source to drill into)/);
    });
  });

  it("still offers Details on every row that has record-level data", () => {
    const { container } = render(
      <KpiVsTargetSection targets={targets} metrics={metrics} onDrillDown={() => {}} />,
    );
    const drillable = container.querySelectorAll('[data-metric-drillable="yes"]');
    expect(drillable.length).toBe(4);
    drillable.forEach((r) => {
      expect(r.querySelector("button")).not.toBeNull();
    });
  });

  it("labels each row with how the reporting period applies to it", () => {
    const { container } = render(
      <KpiVsTargetSection
        targets={targets}
        metrics={metrics}
        period="7"
        onDrillDown={() => {}}
      />,
    );
    const mar = container.querySelector('[data-metric-key="mar_compliance_pct"]');
    expect(mar?.textContent).toContain("Last 7 days");
    const notes = container.querySelector('[data-metric-key="unsigned_notes_count"]');
    expect(notes?.textContent).toContain("As of now");
  });
});
