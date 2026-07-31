// §Population health — KPI vs Target section.
//
// One row per admin-configured target. Rows whose metric has no live source
// render "No live metric yet" instead of a zero, and are not clickable —
// there is nothing behind them to drill into.
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import type { KpiTarget } from "@/lib/ehr";
import { ChevronRight, Target } from "lucide-react";

const STATUS_STYLE: Record<string, string> = {
  met: "bg-emerald-100 text-emerald-800",
  near: "bg-amber-100 text-amber-800",
  missed: "bg-red-100 text-red-800",
  no_metric: "bg-muted text-muted-foreground",
};

export function KpiVsTargetSection({
  targets,
  metrics,
  onDrillDown,
}: {
  targets: KpiTarget[];
  metrics: LiveMetricMap;
  onDrillDown: (metricKey: MetricKey) => void;
}) {
  const [showGaps, setShowGaps] = useState(true);

  if (targets.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        No KPI targets configured yet.
      </Card>
    );
  }

  return (
    <Card className="divide-y p-0">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-teal" />
          <h2 className="font-display text-lg text-navy">KPI vs target</h2>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setShowGaps((v) => !v)}>
          {showGaps ? "Hide data gaps" : "Show data gaps"}
        </Button>
      </div>

      {targets.map((t) => {
        const key = t.metricKey as MetricKey;
        const metric = metrics[key];
        const evaluation = evaluateTarget(metric, t.targetValue);
        const drillable = metricSupportsDrillDown(key) && evaluation.status !== "no_metric";
        const gapReason = METRICS_WITHOUT_SOURCE[key];
        return (
          <div
            key={t.id}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            data-metric-key={t.metricKey}
            data-metric-status={evaluation.status}
          >
            <div className="min-w-[220px]">
              <p className="text-sm font-medium text-navy">
                {METRIC_KEY_LABELS[key] ?? t.label}
              </p>
              <p className="text-xs text-muted-foreground">
                Target {formatTargetValue(t.targetValue, t.unit)}
                {t.source ? ` · ${t.source}` : ""}
                {t.effectiveMonth ? ` · from ${t.effectiveMonth}` : ""}
              </p>
              {showGaps && evaluation.status === "no_metric" && gapReason && (
                <p className="mt-1 max-w-md text-xs italic text-muted-foreground">{gapReason}</p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="font-display text-xl text-navy" data-testid={`metric-${t.metricKey}`}>
                  {evaluation.status === "no_metric" ? "—" : formatMetric(metric)}
                </p>
                {metric?.basis && evaluation.status !== "no_metric" && (
                  <p className="text-[11px] text-muted-foreground">{metric.basis}</p>
                )}
              </div>
              <Badge className={STATUS_STYLE[evaluation.status]}>
                {evaluation.status === "no_metric" ? "No live metric yet" : evaluation.label}
              </Badge>
              {drillable ? (
                <Button size="sm" variant="outline" onClick={() => onDrillDown(key)}>
                  Details <ChevronRight className="ml-1 h-3 w-3" />
                </Button>
              ) : (
                <span className="w-[86px]" />
              )}
            </div>
          </div>
        );
      })}
    </Card>
  );
}
