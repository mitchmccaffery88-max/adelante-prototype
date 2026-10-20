// §Population health — KPI vs Target section.
//
// One row per admin-configured target. Two honesty rules hold here:
//  1. A metric with no live source renders "No live metric yet", never a 0.
//  2. Every row declares its interactivity explicitly. Rows with record-level
//     detail get a Details button; rows without get a visible, reasoned
//     "No record-level detail" state instead of an invisible spacer, so the
//     difference reads as intentional rather than as a broken button.
import { useState } from "react";
import { StatTile } from "@/components/ui/stat-tile";
import { Button } from "@/components/ui/button";
import {
  evaluateTarget,
  formatMetric,
  formatTargetValue,
  METRIC_KEY_LABELS,
  metricSupportsDrillDown,
  type LiveMetricMap,
  type MetricKey,
} from "@/lib/dashboardMetrics";
import { METRICS_WITHOUT_SOURCE } from "@/lib/dashboardMetrics";
import {
  METRIC_PERIOD_BEHAVIOR,
  POINT_IN_TIME_REASON,
  periodNoteFor,
  DEFAULT_PERIOD,
  type ReportingPeriodKey,
} from "@/lib/reportingPeriods";
import { useEhr, type KpiTarget } from "@/lib/ehr";
import { liveKpiSparkline } from "@/lib/kpiSparkline";
import { Clock, Minus, Target } from "lucide-react";
import type { ChartStatus } from "@/lib/chartTheme";

const STATUS: Record<string, ChartStatus | undefined> = {
  met: "good", near: "warning", missed: "serious", no_metric: undefined,
};

export function KpiVsTargetSection({
  targets,
  metrics,
  onDrillDown,
  period = DEFAULT_PERIOD,
}: {
  targets: KpiTarget[];
  metrics: LiveMetricMap;
  onDrillDown: (metricKey: MetricKey) => void;
  period?: ReportingPeriodKey;
}) {
  const [showGaps, setShowGaps] = useState(true);
  const sparklines = useEhr(() => Object.fromEntries(targets.map((t) =>
    [t.metricKey, liveKpiSparkline(t.metricKey as MetricKey)],
  )));

  if (targets.length === 0) {
    return (
      <section className="py-6 text-center text-sm text-muted-foreground">
        No KPI targets configured yet.
      </section>
    );
  }


  return (
    <section aria-label="KPI vs target" data-testid="kpi-vs-target" className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-path" />
          <h2 className="text-lg font-bold text-foreground">KPI vs target</h2>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setShowGaps((v) => !v)}>
          {showGaps ? "Hide data gaps" : "Show data gaps"}
        </Button>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {targets.map((t) => {
        const key = t.metricKey as MetricKey;
        const metric = metrics[key];
        const evaluation = evaluateTarget(metric, t.targetValue);
        const drillable = metricSupportsDrillDown(key) && evaluation.status !== "no_metric";
        const gapReason = METRICS_WITHOUT_SOURCE[key];
        const behavior = METRIC_PERIOD_BEHAVIOR[key];
        const pointReason = POINT_IN_TIME_REASON[key];
        // Why this row has no Details button. Always a real reason, never a
        // silent gap.
        const noDetailReason =
          evaluation.status === "no_metric"
            ? "No source to drill into"
            : "No record-level detail for this measure";
        return (
          <div
            key={t.id}
            className="min-w-0"
            data-metric-key={t.metricKey}
            data-metric-status={evaluation.status}
            data-metric-drillable={drillable ? "yes" : "no"}
            data-metric-period-behavior={behavior}
          >
            <StatTile
              label={METRIC_KEY_LABELS[key] ?? t.label}
              value={metric?.value ?? null}
              formattedValue={formatMetric(metric)}
              unit={metric?.unit ?? t.unit}
              comparison={`Draft target ${formatTargetValue(t.targetValue, t.unit)}${t.source ? ` · ${t.source}` : ""}${t.effectiveMonth ? ` · from ${t.effectiveMonth}` : ""}`}
              status={STATUS[evaluation.status]}
              basis={metric?.basis}
              numberTestId={`metric-${t.metricKey}`}
              sparkline={sparklines[key]}
              target={t.targetValue}
              onDrillDown={drillable ? () => onDrillDown(key) : undefined}
              noDetail={<span
                className="inline-flex items-center gap-1 rounded-sm border border-dashed border-border px-2 py-1 text-sm text-muted-foreground"
                data-testid={`no-detail-${t.metricKey}`} title={noDetailReason}
              ><Minus className="h-4 w-4 shrink-0" aria-hidden />{noDetailReason}</span>}
            >
              <p className="mt-2 inline-flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" aria-hidden />
                {periodNoteFor(key, period)}
              </p>
              {showGaps && behavior === "point_in_time" && pointReason && (
                <p className="mt-1 text-sm italic text-muted-foreground">{pointReason}</p>
              )}
              {showGaps && evaluation.status === "no_metric" && gapReason && (
                <p className="mt-1 text-sm italic text-muted-foreground">{gapReason}</p>
              )}
            </StatTile>
          </div>
        );
      })}
      </div>
    </section>
  );
}
