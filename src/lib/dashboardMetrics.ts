// §Population health dashboards — Phase 1 metric library.
//
// Pure logic + live computation over the existing in-memory store. The hard
// rule here is honesty: a metric with no real data source returns
// `{ value: null }` so the UI renders "no live metric yet" instead of a 0 that
// looks like a measured result. Nothing in this file invents a number.
//
// Labs/vitals-derived metrics are absent because those entities do not exist.
// Target schema when that gap is closed: `src/lib/labsVitalsScaffold.ts`.
import {
  AdelanteEHR,
  noteStatus,
  type CaseTask,
  type DoseAdministration,
  type Patient,
  type ProgressNote,
} from "./ehr";

export type MetricUnit = "percent" | "count";

export interface LiveMetric {
  /** null = no live data source wired for this key yet. */
  value: number | null;
  unit: MetricUnit;
  higherIsBetter: boolean;
  /** Short provenance string shown under the number. */
  basis?: string;
}

export type MetricKey =
  | "mar_compliance_pct"
  | "unsigned_notes_count"
  | "overdue_task_count"
  | "group_attendance_rate_pct"
  | "controlled_count_discrepancies"
  | "open_kites_count"
  | "ncchc_intake_screening_pct"
  | "ncchc_health_assessment_pct"
  | "ncchc_chronic_care_pct"
  | "ncchc_grievance_response_pct";

export type LiveMetricMap = Record<MetricKey, LiveMetric>;

export const METRIC_KEY_LABELS: Record<MetricKey, string> = {
  mar_compliance_pct: "MAR compliance (30 days)",
  unsigned_notes_count: "Unsigned notes",
  overdue_task_count: "Overdue tasks",
  group_attendance_rate_pct: "Group attendance rate (30 days)",
  controlled_count_discrepancies: "Controlled count discrepancies",
  open_kites_count: "Open kites",
  ncchc_intake_screening_pct: "NCCHC — intake screening within 24h",
  ncchc_health_assessment_pct: "NCCHC — health assessment within 14 days",
  ncchc_chronic_care_pct: "NCCHC — chronic care visits on schedule",
  ncchc_grievance_response_pct: "NCCHC — grievance response on time",
};

export const METRIC_KEYS = Object.keys(METRIC_KEY_LABELS) as MetricKey[];

/** Keys that intentionally have no data source in this pass. */
export const METRICS_WITHOUT_SOURCE: Record<MetricKey, string | undefined> = {
  mar_compliance_pct: undefined,
  unsigned_notes_count: undefined,
  overdue_task_count: undefined,
  group_attendance_rate_pct:
    "Computed only from occurrences where a facilitator actually took attendance; groups with no roster taken are excluded rather than counted as absences.",
  controlled_count_discrepancies:
    "ShiftCount records totals and a 2-person reconciliation signature, but has no discrepancy field — there is nothing to count.",
  open_kites_count: "Kites are out of scope; no kite record exists.",
  ncchc_intake_screening_pct: "NCCHC measures are on hold; no compliance record exists.",
  ncchc_health_assessment_pct: "NCCHC measures are on hold; no compliance record exists.",
  ncchc_chronic_care_pct: "NCCHC measures are on hold; no compliance record exists.",
  ncchc_grievance_response_pct: "NCCHC measures are on hold; no compliance record exists.",
};

export function formatMetric(metric: LiveMetric | undefined): string {
  if (!metric || metric.value === null || !Number.isFinite(metric.value)) return "—";
  if (metric.unit === "percent") {
    const rounded = Math.round(metric.value * 10) / 10;
    return `${rounded}%`;
  }
  return String(Math.round(metric.value));
}

export function formatTargetValue(value: number, unit: MetricUnit): string {
  return unit === "percent" ? `${Math.round(value * 10) / 10}%` : String(Math.round(value));
}

export type TargetStatus = "no_metric" | "met" | "near" | "missed";

export interface TargetEvaluation {
  status: TargetStatus;
  /** actual − target, signed. null when there is no live metric. */
  delta: number | null;
  label: string;
}

/**
 * Compare a live metric against a target. "near" is a 5%-of-target tolerance
 * band on the wrong side of the line, so a 91% against a 92% target reads as
 * close rather than as a hard miss.
 */
export function evaluateTarget(
  metric: LiveMetric | undefined,
  targetValue: number,
): TargetEvaluation {
  if (!metric || metric.value === null || !Number.isFinite(metric.value)) {
    return { status: "no_metric", delta: null, label: "No live metric yet" };
  }
  const delta = metric.value - targetValue;
  const met = metric.higherIsBetter ? delta >= 0 : delta <= 0;
  if (met) return { status: "met", delta, label: "Meeting target" };
  const tolerance = Math.abs(targetValue) * 0.05;
  const status: TargetStatus = Math.abs(delta) <= tolerance ? "near" : "missed";
  return {
    status,
    delta,
    label: status === "near" ? "Just off target" : "Off target",
  };
}

// ---------------------------------------------------------------------------
// Live computation
// ---------------------------------------------------------------------------

export const MAR_WINDOW_DAYS = 30;

function windowStart(days: number, now: Date): number {
  return now.getTime() - days * 24 * 60 * 60 * 1000;
}

export interface MarComplianceBreakdown {
  given: number;
  refused: number;
  held: number;
  denominator: number;
  pct: number | null;
}

/**
 * given / (given + refused + held) across every patient in the trailing
 * window. Voided rows are excluded — a voided administration is not a charted
 * event. Returns pct: null when nothing was charted in the window, because a
 * 0% compliance reading with zero doses would be a lie.
 */
export function marCompliance(
  patients: Pick<Patient, "administrations">[],
  now = new Date(),
  days = MAR_WINDOW_DAYS,
): MarComplianceBreakdown {
  const from = windowStart(days, now);
  let given = 0;
  let refused = 0;
  let held = 0;
  for (const p of patients) {
    for (const a of p.administrations ?? []) {
      if (a.voided) continue;
      const at = Date.parse(a.scheduledAt || a.chartedAt);
      if (!Number.isFinite(at) || at < from || at > now.getTime()) continue;
      if (a.action === "given") given++;
      else if (a.action === "refused") refused++;
      else if (a.action === "held") held++;
    }
  }
  const denominator = given + refused + held;
  return {
    given,
    refused,
    held,
    denominator,
    pct: denominator === 0 ? null : (given / denominator) * 100,
  };
}

export interface UnsignedNoteRow {
  patientId: string;
  patientName: string;
  noteId: string;
  date: string;
  sessionType: string;
  clinicianId: string;
  ageDays: number;
}

/**
 * "Unsigned" = ProgressNote.status === "draft" (including legacy rows with no
 * status, which `noteStatus` normalizes to draft). Deliberately NOT
 * age-filtered: our note lifecycle already has explicit downstream states
 * (`cosign_pending`, `declined`), so "draft" is the only state where no
 * clinician has attested at all. An age threshold would hide brand-new
 * unsigned work, which is exactly what a worklist metric should surface.
 * Age is still reported per row so the drill-down can be triaged.
 */
export function unsignedNotes(patients: Patient[], now = new Date()): UnsignedNoteRow[] {
  const rows: UnsignedNoteRow[] = [];
  for (const p of patients) {
    for (const n of p.progressNotes ?? []) {
      if (noteStatus(n as ProgressNote) !== "draft") continue;
      const ts = Date.parse(n.date);
      rows.push({
        patientId: p.id,
        patientName: `${p.firstName} ${p.lastName}`,
        noteId: n.id,
        date: n.date,
        sessionType: n.sessionType,
        clinicianId: n.clinicianId,
        ageDays: Number.isFinite(ts)
          ? Math.max(0, Math.floor((now.getTime() - ts) / 86_400_000))
          : 0,
      });
    }
  }
  return rows.sort((a, b) => b.ageDays - a.ageDays);
}

export interface OverdueTaskRow {
  patientId: string;
  patientName: string;
  taskId: string;
  title: string;
  dueDate: string;
  assignedTo: string;
  origin: string;
  overdueDays: number;
}

/**
 * CaseTask already carries a real `dueDate`, so this is a true overdue count
 * (open, past due) rather than the open-count proxy the spec allowed for.
 * Snoozed tasks are excluded until their snooze expires — a snoozed task is an
 * explicit deferral, not a missed one.
 */
export function overdueTasks(
  tasks: CaseTask[],
  patients: Patient[],
  now = new Date(),
): OverdueTaskRow[] {
  const nameFor = new Map(patients.map((p) => [p.id, `${p.firstName} ${p.lastName}`]));
  const rows: OverdueTaskRow[] = [];
  for (const t of tasks) {
    if (t.status === "done") continue;
    if (t.status === "snoozed" && t.snoozedUntil && Date.parse(t.snoozedUntil) > now.getTime())
      continue;
    const due = Date.parse(t.dueDate);
    if (!Number.isFinite(due) || due >= now.getTime()) continue;
    rows.push({
      patientId: t.patientId,
      patientName: nameFor.get(t.patientId) ?? t.patientId,
      taskId: t.id,
      title: t.title,
      dueDate: t.dueDate,
      assignedTo: t.assignedTo,
      origin: t.origin,
      overdueDays: Math.max(0, Math.floor((now.getTime() - due) / 86_400_000)),
    });
  }
  return rows.sort((a, b) => b.overdueDays - a.overdueDays);
}

const NO_SOURCE = (unit: MetricUnit, higherIsBetter: boolean): LiveMetric => ({
  value: null,
  unit,
  higherIsBetter,
  basis: undefined,
});

/** Build the full live metric map from the current store contents. */
export function computeLiveMetrics(now = new Date()): LiveMetricMap {
  const patients = AdelanteEHR.listPatients();
  const mar = marCompliance(patients, now);
  const notes = unsignedNotes(patients, now);
  const overdue = overdueTasks(AdelanteEHR.listCaseTasks(), patients, now);

  return {
    mar_compliance_pct: {
      value: mar.pct,
      unit: "percent",
      higherIsBetter: true,
      basis:
        mar.denominator === 0
          ? `No doses charted in the last ${MAR_WINDOW_DAYS} days`
          : `${mar.given} given of ${mar.denominator} charted (${MAR_WINDOW_DAYS}d)`,
    },
    unsigned_notes_count: {
      value: notes.length,
      unit: "count",
      higherIsBetter: false,
      basis: "Progress notes still in draft",
    },
    overdue_task_count: {
      value: overdue.length,
      unit: "count",
      higherIsBetter: false,
      basis: "Open case tasks past their due date",
    },
    controlled_count_discrepancies: NO_SOURCE("count", false),
    open_kites_count: NO_SOURCE("count", false),
    ncchc_intake_screening_pct: NO_SOURCE("percent", true),
    ncchc_health_assessment_pct: NO_SOURCE("percent", true),
    ncchc_chronic_care_pct: NO_SOURCE("percent", true),
    ncchc_grievance_response_pct: NO_SOURCE("percent", true),
  };
}

/** Rows behind a metric, for the drill-down dialog. Empty when unsupported. */
export function metricSupportsDrillDown(key: MetricKey): boolean {
  return (
    key === "unsigned_notes_count" ||
    key === "overdue_task_count" ||
    key === "mar_compliance_pct"
  );
}

export interface MarDrillRow {
  patientId: string;
  patientName: string;
  action: DoseAdministration["action"];
  scheduledAt: string;
  chartedBy: string;
  reason?: string;
}

/** Non-"given" administrations in the window — the rows dragging the % down. */
export function marExceptions(
  patients: Patient[],
  now = new Date(),
  days = MAR_WINDOW_DAYS,
): MarDrillRow[] {
  const from = windowStart(days, now);
  const rows: MarDrillRow[] = [];
  for (const p of patients) {
    for (const a of p.administrations ?? []) {
      if (a.voided || a.action === "given") continue;
      const at = Date.parse(a.scheduledAt || a.chartedAt);
      if (!Number.isFinite(at) || at < from || at > now.getTime()) continue;
      rows.push({
        patientId: p.id,
        patientName: `${p.firstName} ${p.lastName}`,
        action: a.action,
        scheduledAt: a.scheduledAt,
        chartedBy: a.chartedBy,
        reason: a.reason,
      });
    }
  }
  return rows.sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
}
