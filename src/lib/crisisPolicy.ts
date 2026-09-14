// §Crisis Redesign Phase 2 — DRAFT crisis policy values.
//
// EVERYTHING in this file is a placeholder pending real clinical/operational
// sign-off (Christi's response-clock conversation was still open as of
// Sept 2026). It lives in ONE module on purpose: when the real policy lands,
// the numbers and the disposition list change here and nowhere else — no
// hunting through components for inline literals.
//
// This module deliberately depends on the EHR, never the other way round, so
// there is no import cycle: `ehr.ts` exposes `markCrisisSlaBreach` and this
// file decides WHEN to call it.
import { AdelanteEHR, type CrisisEscalation } from "./ehr";
import type { StaffRole } from "./roles";

/** Rendered anywhere a draft policy value is shown to real staff. */
export const CRISIS_POLICY_DRAFT_LABEL =
  "Draft response target — pending operational policy review";

// ---------------------------------------------------------------------------
// 1. Response clocks (DRAFT)
// ---------------------------------------------------------------------------

const HOUR = 60 * 60 * 1000;

/**
 * DRAFT response targets, in milliseconds. A row that is still OPEN past its
 * target is "overdue" — claimed or not, because a claimed-and-forgotten
 * escalation is precisely the failure this catches.
 *
 * Resolution order: category `sdoh` first (the social-needs lane runs on a
 * day clock, not an hour clock), then severity.
 */
export const CRISIS_SLA_DRAFT = {
  /** Clinical lane, by draft severity. */
  bySeverity: {
    critical: { ms: 2 * HOUR, label: "2 hour" },
    urgent: { ms: 8 * HOUR, label: "8 hour" },
    routine: { ms: 48 * HOUR, label: "48 hour" },
  },
  /**
   * SDOH lane. Christi's real number is unsettled — the working range is
   * 24–48h and this takes the conservative end of it.
   */
  sdoh: { ms: 24 * HOUR, label: "24 hour (draft, 24–48h under review)" },
} as const;

/** Who gets re-notified when a row goes overdue. DRAFT routing. */
export const CRISIS_SLA_SUPERVISOR: Record<"clinical" | "sdoh", StaffRole> = {
  clinical: "clinical_coordinator",
  sdoh: "ecm_provider",
};

export interface CrisisSlaState {
  /** Draft target for this row. */
  thresholdMs: number;
  thresholdLabel: string;
  /** Milliseconds since the most recent signal on the row. */
  ageMs: number;
  overdue: boolean;
  /** Milliseconds past the target; 0 when not overdue. */
  overdueByMs: number;
}

export function crisisSlaTarget(escalation: CrisisEscalation): {
  ms: number;
  label: string;
} {
  if (escalation.category === "sdoh") return CRISIS_SLA_DRAFT.sdoh;
  return CRISIS_SLA_DRAFT.bySeverity[escalation.severity] ?? CRISIS_SLA_DRAFT.bySeverity.critical;
}

/**
 * Pure age/overdue calculation. The clock runs from the most recent signal
 * (`lastTriggeredAt`), not the original flag: a re-trigger is a fresh signal
 * that someone has just acted on or is about to.
 */
export function crisisSlaState(
  escalation: CrisisEscalation,
  now: number = Date.now(),
): CrisisSlaState {
  const target = crisisSlaTarget(escalation);
  const since = escalation.lastTriggeredAt ?? escalation.triggeredAt;
  const ageMs = Math.max(0, now - +new Date(since));
  const overdueByMs = Math.max(0, ageMs - target.ms);
  return {
    thresholdMs: target.ms,
    thresholdLabel: target.label,
    ageMs,
    overdue: escalation.status === "open" && ageMs >= target.ms,
    overdueByMs,
  };
}

export function overdueByLabel(ms: number): string {
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m over`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m over`;
  return `${Math.floor(hrs / 24)}d ${hrs % 24}h over`;
}

/**
 * Sweep every open escalation and stamp/notify the ones that have crossed
 * their draft target. Idempotent — `markCrisisSlaBreach` writes its stamp
 * once, so a supervisor is notified once per escalation.
 *
 * Returns how many rows breached on THIS sweep.
 */
export function sweepCrisisSla(now: number = Date.now()): number {
  let breached = 0;
  for (const { patient, escalation } of AdelanteEHR.listOpenCrisisEscalations()) {
    if (escalation.slaBreachAt) continue;
    const state = crisisSlaState(escalation, now);
    if (!state.overdue) continue;
    const row = AdelanteEHR.markCrisisSlaBreach(patient.id, escalation.id, {
      thresholdLabel: state.thresholdLabel,
      supervisorRole:
        CRISIS_SLA_SUPERVISOR[escalation.category === "sdoh" ? "sdoh" : "clinical"],
    });
    if (row) breached += 1;
  }
  return breached;
}

// ---------------------------------------------------------------------------
// 2. Disposition categories (DRAFT)
// ---------------------------------------------------------------------------

export type CrisisDispositionCode =
  | "crisis_line"
  | "safety_plan_reviewed"
  | "resource_provided"
  | "warm_handoff"
  | "no_further_action"
  | "escalated"
  | "other";

/**
 * DRAFT disposition set — a starting point, NOT a settled clinical taxonomy.
 * `other` always stays: if a real disposition does not fit this list, the
 * free text is kept verbatim rather than forced into the nearest category.
 */
export const CRISIS_DISPOSITIONS: {
  code: CrisisDispositionCode;
  label: string;
  /** When true, the free-text box is required rather than optional. */
  requiresDetail?: boolean;
}[] = [
  { code: "crisis_line", label: "Connected to crisis line" },
  { code: "safety_plan_reviewed", label: "Safety plan reviewed" },
  { code: "resource_provided", label: "Resource provided" },
  { code: "warm_handoff", label: "Warm handoff completed" },
  { code: "no_further_action", label: "No further action needed" },
  { code: "escalated", label: "Escalated to…", requiresDetail: true },
  { code: "other", label: "Other (describe)", requiresDetail: true },
];

export const CRISIS_DISPOSITION_DRAFT_LABEL =
  "Draft disposition categories — pending clinical review";

export function dispositionLabel(code?: string): string | undefined {
  return CRISIS_DISPOSITIONS.find((d) => d.code === code)?.label;
}

/**
 * The stored human-readable disposition string. Kept as prose so every
 * existing reader (chart history, alert-removal reason, audit) is unchanged
 * by the move to a structured picker.
 */
export function composeDisposition(code: CrisisDispositionCode, detail: string): string {
  const entry = CRISIS_DISPOSITIONS.find((d) => d.code === code);
  const text = detail.trim();
  if (code === "other") return text;
  if (!entry) return text;
  return text ? `${entry.label.replace("…", "")} ${text}`.trim() : entry.label;
}
