// Phase 9b — shared chart theme (Adelante chart palette, approved Oct 19).
// Presentation only: never reads records, roles or permissions.
import { CircleCheck, AlertTriangle, CircleAlert, ShieldAlert, type LucideIcon } from "lucide-react";

export const SERIES_TOKENS = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `var(--chart-${n})`) as readonly string[];
export const MAX_SERIES = 8;
export const OTHER_COLOR = "var(--chart-other)";
export const SINGLE_COLOR = "var(--chart-single)";
export const TARGET_COLOR = "var(--chart-target)";
export const TARGET_LABEL = "Draft target";
export const SEQUENTIAL_TOKENS = [1, 2, 3, 4, 5, 6, 7].map((n) => `var(--chart-seq-${n})`) as readonly string[];
export const DIVERGING = { low: "var(--chart-8)", mid: "var(--chart-div-mid)", high: "var(--chart-1)" } as const;

/**
 * Stable color per entity key: the color follows the entity, not its rank or
 * the current filter. `universe` is the full, unfiltered list of entity keys
 * in their canonical order; the first 8 keep slots 1..8, the rest are "Other".
 */
export function seriesColorFor(key: string, universe: readonly string[]): string {
  const canonical = [...new Set(universe)];
  const i = canonical.indexOf(key);
  return i >= 0 && i < MAX_SERIES ? SERIES_TOKENS[i] : OTHER_COLOR;
}

/** Map entity keys to colors; anything past slot 8 collapses to "Other". */
export function seriesColors(visible: readonly string[], universe: readonly string[]) {
  return visible.map((key) => {
    const color = seriesColorFor(key, universe);
    return { key, color, isOther: color === OTHER_COLOR };
  });
}

export type ChartStatus = "good" | "warning" | "serious" | "critical";
export interface ChartStatusStyle { color: string; icon: LucideIcon; word: string }

const STATUS: Record<ChartStatus, ChartStatusStyle> = {
  good: { color: "var(--chart-good)", icon: CircleCheck, word: "Met" },
  warning: { color: "var(--chart-warning)", icon: CircleAlert, word: "Close" },
  serious: { color: "var(--chart-serious)", icon: AlertTriangle, word: "Below target" },
  critical: { color: "var(--chart-critical)", icon: ShieldAlert, word: "Critical" },
};

/**
 * Status color for staff/admin charts and tiles ONLY (never a series, never
 * patient screens). Always returns icon + word so color never stands alone.
 */
export function chartStatus(status: ChartStatus, word?: string): ChartStatusStyle {
  const base = STATUS[status];
  return { ...base, word: word?.trim() ? word : base.word };
}

/** Recharts defaults. Text uses ink tokens, never a series color. */
export const chartDefaults = {
  line: { strokeWidth: 2, type: "monotone" as const, dot: false, activeDot: { r: 4 } },
  /** Mark only the final point of a line. */
  endDot: (lastIndex: number, color: string) =>
    (props: { cx?: number; cy?: number; index?: number }) =>
      props.index === lastIndex && props.cx != null && props.cy != null
        ? { type: "circle", cx: props.cx, cy: props.cy, r: 4, fill: color, stroke: color }
        : null,
  bar: { radius: [4, 4, 0, 0] as [number, number, number, number], barGap: 2, barCategoryGap: 2 },
  grid: { stroke: "var(--chart-grid)", strokeWidth: 1, vertical: false },
  axis: { stroke: "var(--chart-axis)", tick: { fill: "var(--ink-muted)", fontSize: 14 }, tickLine: false },
  target: { stroke: TARGET_COLOR, strokeWidth: 2, strokeDasharray: "6 4", label: TARGET_LABEL },
  tooltip: {
    contentStyle: { background: "var(--surface)", border: "1px solid var(--line-strong)", color: "var(--ink)", fontSize: 14 },
    labelStyle: { color: "var(--ink)" },
    itemStyle: { color: "var(--ink)" },
  },
  /** Legend for 2+ series; direct labels for up to 4. */
  showLegend: (seriesCount: number) => seriesCount >= 2,
  showDirectLabels: (seriesCount: number) => seriesCount >= 1 && seriesCount <= 4,
  yAxisCount: 1,
} as const;

/** Exact tooltip value — never rounded for display. */
export const exactValue = (v: unknown) => (v == null ? "—" : String(v));
