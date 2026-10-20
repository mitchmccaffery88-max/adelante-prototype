import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronRight, LockKeyhole } from "lucide-react";
import { useStaffDensity } from "@/components/StaffDensity";
import { chartStatus, SINGLE_COLOR, TARGET_COLOR, type ChartStatus } from "@/lib/chartTheme";
import { MIN_COHORT_SIZE } from "@/lib/cohortGuard";
import type { KpiSparkline } from "@/lib/kpiSparkline";
import { Button } from "./button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

// Deliberately no patient/name/record props or arbitrary prop forwarding.
export interface StatTileProps {
  label: string;
  value: number | null;
  formattedValue?: string;
  unit?: "count" | "percent";
  personal?: boolean;
  /** Not a count of people (configuration, catalog or code counts): exempt like personal work. */
  nonPatient?: boolean;
  /** Optional test id on the tile itself. */
  tileTestId?: string;
  cohortSize?: number;
  comparison?: string;
  status?: ChartStatus;
  basis?: string;
  sparkline?: KpiSparkline | null;
  target?: number;
  targetConfirmed?: boolean;
  onDrillDown?: () => void;
  noDetail?: ReactNode;
  numberTestId?: string;
  children?: ReactNode;
}

const statusClasses: Record<ChartStatus, string> = {
  good: "text-chart-good", warning: "text-chart-warning",
  serious: "text-chart-serious", critical: "text-chart-critical",
};
const PRIVACY_TEXT = "Hidden to protect privacy (fewer than 11)";

function Sparkline({ series, target, targetConfirmed }: { series: KpiSparkline; target?: number; targetConfirmed?: boolean }) {
  const measured = series.points.flatMap((p, index) => p.value == null ? [] : [{ index, value: p.value }]);
  if (!measured.length) return null;
  const values = measured.map((p) => p.value);
  if (target != null) values.push(target);
  const low = Math.min(...values, 0);
  const high = Math.max(...values, 100);
  const x = (i: number) => 8 + i * 224 / Math.max(1, series.points.length - 1);
  const y = (v: number) => 54 - (v - low) / Math.max(1, high - low) * 44;
  let previous = false;
  const path = series.points.map((p, i) => {
    if (p.value == null) { previous = false; return ""; }
    const segment = `${previous ? "L" : "M"}${x(i)},${y(p.value)}`;
    previous = true;
    return segment;
  }).join(" ");
  const last = measured[measured.length - 1];
  return <figure className="min-w-0" aria-label={`Trend, ${series.caption}`}>
    <svg viewBox="0 0 240 64" className="h-16 w-full" role="img" aria-label={`Weekly measurements, ${series.caption}; gaps are unmeasured or privacy protected`}>
      {target != null && <line x1="8" x2="232" y1={y(target)} y2={y(target)} stroke={TARGET_COLOR} strokeWidth="2" strokeDasharray="6 4" />}
      <path d={path} fill="none" stroke={SINGLE_COLOR} strokeWidth="2" />
      {last && <circle cx={x(last.index)} cy={y(last.value)} r="3" fill={SINGLE_COLOR} />}
    </svg>
    <figcaption className="text-sm text-muted-foreground">{series.caption}{target != null ? ` · ${targetConfirmed ? "Target" : "Draft target"}` : ""}</figcaption>
  </figure>;
}

export function StatTile({ label, value, formattedValue, unit = "count", personal = false, nonPatient = false, tileTestId, cohortSize,
  comparison, status, basis, sparkline, target, targetConfirmed, onDrillDown, noDetail, numberTestId, children }: StatTileProps) {
  const ref = useRef<HTMLElement>(null);
  const staff = useStaffDensity() === "compact";
  const [member, setMember] = useState(true);
  useEffect(() => {
    setMember(Boolean(ref.current?.closest(".member-comfortable, .member-overlay, .patient-theme, [data-audience='patient'], [data-audience='member']")));
  }, [staff]);
  const missing = value == null || !Number.isFinite(value);
  const suppressed = !missing && !personal && !nonPatient && (cohortSize != null ? cohortSize < MIN_COHORT_SIZE : unit === "count" && value < MIN_COHORT_SIZE);
  const state = !missing && !suppressed && status ? chartStatus(status) : null;
  const Icon = state?.icon;
  const number = missing ? "No live metric yet" : suppressed ? "<11" : formattedValue ?? `${value}${unit === "percent" ? "%" : ""}`;
  return <article ref={ref} className="min-w-0 rounded-md border border-border bg-card p-4 shadow-sm" data-stat-tile data-testid={tileTestId} data-suppressed={suppressed ? "yes" : "no"} data-personal={personal ? "yes" : "no"}>
    <p className="text-base font-medium text-foreground">{label}</p>
    <div className="mt-2 flex min-h-10 items-center gap-2">
      <p className={missing ? "text-lg font-semibold text-foreground" : "text-3xl font-bold text-foreground"} data-testid={numberTestId}>{number}</p>
      {suppressed && <TooltipProvider><Tooltip><TooltipTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={PRIVACY_TEXT}><LockKeyhole className="h-4 w-4" aria-hidden /></Button>
      </TooltipTrigger><TooltipContent className="text-sm">{PRIVACY_TEXT}</TooltipContent></Tooltip></TooltipProvider>}
    </div>
    {comparison && <p className="mt-1 text-sm text-muted-foreground">{comparison}</p>}
    {state && Icon && <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-foreground" data-chart-status={status} data-status-color={staff && !member ? "staff" : "neutral"}>
      <Icon className={`h-4 w-4 shrink-0 ${staff && !member && status ? statusClasses[status] : "text-foreground"}`} aria-hidden />{state.word}
    </p>}
    {!missing && !suppressed && basis && <p className="mt-1 text-sm text-muted-foreground">{basis}</p>}
    {children}
    {!missing && !suppressed && sparkline && <div className="mt-3"><Sparkline series={sparkline} target={target} targetConfirmed={targetConfirmed} /></div>}
    <div className="mt-3">{onDrillDown ? <Button size="sm" variant="outline" onClick={onDrillDown}>Details <ChevronRight className="ml-1 h-4 w-4" aria-hidden /></Button> : noDetail}</div>
  </article>;
}