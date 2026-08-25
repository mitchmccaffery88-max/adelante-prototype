// §Engagement/Reporting Build 1 — ENGAGEMENT PROJECTION.
//
// A real projection over the real stores: `engagementRecords()` (cohort read,
// free text already stripped) joined against the derived cohort resolver in
// `cohorts.ts`. Nothing here invents a number — the same honesty discipline
// `dashboardMetrics.ts` established applies: a measure with no underlying
// events reports `null`, and the UI renders "no live metric yet" rather than
// a 0 that reads like a measured result.
//
// Per-patient rows here are ACTIVITY COUNTS only. They never carry lesson
// responses, reflections or self-tracking rows — self-tracking enters this
// module strictly as a cohort-level aggregate (see the section at the bottom).
import { engagementRecords, type PatientEngagement } from "@/lib/engagement";
import {
  resolveCohorts,
  type CohortBreakdown,
  type CohortMember,
} from "@/lib/cohorts";
import { AdelanteEHR } from "@/lib/ehr";
import { POPULATION_LABEL, type PopulationTrack } from "@/lib/population";
import {
  MIN_COHORT_SIZE,
  selfTrackingAggregate,
  type SelfTrackingAggregate,
} from "@/lib/selfTracking";

export const ENGAGEMENT_WINDOW_DAYS = 30;

export interface PatientEngagementRow {
  patientId: string;
  patientName: string;
  track: PopulationTrack;
  provisional: boolean;
  lessonsCompleted: number;
  recoveryLessonsCompleted: number;
  exercisesCompleted: number;
  /** Recovery lessons where the patient actually finished the guided tool flow. */
  toolFlowsCompleted: number;
  toolkitSaved: number;
  /** Lessons with any saved in-progress work — from response KEYS only, no text. */
  lessonsStarted: number;
  firstActivityAt?: string;
  lastActivityAt?: string;
  /** Days since last activity; null when the patient has never engaged. */
  daysSinceLastActivity: number | null;
  /** True when they did anything inside the trailing window. */
  activeInWindow: boolean;
}

/**
 * A tool flow counts as completed when the patient made a real selection in
 * it — an empty auto-created row is not an accomplishment.
 */
function toolFlowsCompleted(r: PatientEngagement): number {
  return Object.values(r.recoveryToolFlows ?? {}).filter(
    (f) => f.warningSigns.length > 0 || f.supportPeople.length > 0 || Boolean(f.todayAction),
  ).length;
}

function daysBetween(from: string | undefined, now: Date): number | null {
  if (!from) return null;
  const t = Date.parse(from);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((now.getTime() - t) / 86_400_000));
}

/**
 * Per-patient engagement rows for a cohort. Patients with NO engagement row
 * are included with zeros — they are the denominator, and dropping them would
 * silently inflate every average.
 */
export function engagementRows(
  members: CohortMember[],
  now = new Date(),
  windowDays = ENGAGEMENT_WINDOW_DAYS,
): PatientEngagementRow[] {
  const byId = new Map(
    engagementRecords(members.map((m) => m.patientId)).map((r) => [r.patientId, r]),
  );
  const windowFrom = now.getTime() - windowDays * 86_400_000;

  return members.map((m) => {
    const r = byId.get(m.patientId);
    const last = r?.lastActivityAt;
    const lastTs = last ? Date.parse(last) : NaN;
    return {
      patientId: m.patientId,
      patientName: m.patientName,
      track: m.track,
      provisional: m.provisional,
      lessonsCompleted: r?.completedLibraryItems.length ?? 0,
      recoveryLessonsCompleted: r?.completedRecoveryLessons.length ?? 0,
      exercisesCompleted: r?.completedExercises.length ?? 0,
      toolFlowsCompleted: r ? toolFlowsCompleted(r) : 0,
      toolkitSaved: r?.savedToolkitItems.length ?? 0,
      // `engagementRecords` blanks the response bodies; the KEY COUNT still
      // tells us how many lessons were opened far enough to save work.
      lessonsStarted: Object.keys(r?.lessonResponses ?? {}).length,
      ...(r?.firstActivityAt ? { firstActivityAt: r.firstActivityAt } : {}),
      ...(last ? { lastActivityAt: last } : {}),
      daysSinceLastActivity: daysBetween(last, now),
      activeInWindow: Number.isFinite(lastTs) && lastTs >= windowFrom,
    };
  });
}

export interface CohortEngagement {
  track: PopulationTrack;
  label: string;
  patients: number;
  provisionalPatients: number;
  /** Patients with at least one completion or saved lesson response. */
  everEngaged: number;
  activeInWindow: number;
  /** activeInWindow / patients, 0–100. null when the cohort is empty. */
  activeRatePct: number | null;
  totalLessonsCompleted: number;
  totalRecoveryLessonsCompleted: number;
  totalExercisesCompleted: number;
  totalToolFlowsCompleted: number;
  /** Mean completions per patient across the whole cohort. null when empty. */
  avgCompletionsPerPatient: number | null;
  /** Median days since last activity among patients who ever engaged. */
  medianDaysSinceActivity: number | null;
}

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? (s[mid] as number) : (((s[mid - 1] as number) + (s[mid] as number)) / 2);
}

function rollUp(
  track: PopulationTrack,
  rows: PatientEngagementRow[],
  label?: string,
): CohortEngagement {
  const completions = rows.map(
    (r) => r.lessonsCompleted + r.recoveryLessonsCompleted + r.exercisesCompleted,
  );
  const everEngaged = rows.filter(
    (r, i) => (completions[i] as number) > 0 || r.lessonsStarted > 0,
  );
  const totalCompletions = completions.reduce((a, b) => a + b, 0);
  const active = rows.filter((r) => r.activeInWindow).length;
  return {
    track,
    label: label ?? POPULATION_LABEL[track],
    patients: rows.length,
    provisionalPatients: rows.filter((r) => r.provisional).length,
    everEngaged: everEngaged.length,
    activeInWindow: active,
    activeRatePct: rows.length ? (active / rows.length) * 100 : null,
    totalLessonsCompleted: rows.reduce((a, r) => a + r.lessonsCompleted, 0),
    totalRecoveryLessonsCompleted: rows.reduce((a, r) => a + r.recoveryLessonsCompleted, 0),
    totalExercisesCompleted: rows.reduce((a, r) => a + r.exercisesCompleted, 0),
    totalToolFlowsCompleted: rows.reduce((a, r) => a + r.toolFlowsCompleted, 0),
    avgCompletionsPerPatient: rows.length ? totalCompletions / rows.length : null,
    medianDaysSinceActivity: median(
      everEngaged
        .map((r) => r.daysSinceLastActivity)
        .filter((d): d is number => d !== null),
    ),
  };
}

/**
 * §Self-tracking in population reporting — DE-AGGREGATED ONLY.
 *
 * Cravings, lapses and the recovery start date remain excluded from the EHR
 * and from every individual read path (see mem://features/recovery-start-date).
 * They are included HERE, at cohort level, as counts with no attribution.
 *
 * ⚠️ The `belowMinimumCohort` flag is carried through unchanged from
 * `selfTracking.selfTrackingAggregate`. At demo scale these counts are
 * practically re-identifiable; the flag exists so the UI can say so, and so
 * the production team has an explicit hook to convert into hard small-cell
 * suppression. Do not strip it because it looks noisy.
 */
export interface SelfTrackingSection extends SelfTrackingAggregate {
  minimumCohortSize: number;
  windowDays: number;
}

export interface EngagementProjection {
  now: string;
  windowDays: number;
  cohorts: CohortBreakdown;
  rows: PatientEngagementRow[];
  overall: CohortEngagement;
  byTrack: CohortEngagement[];
  /** Population-level only. Never joined to `rows`. */
  selfTracking: SelfTrackingSection;
  /** True when no engagement event exists at all — the honest "no data" state. */
  hasAnyEngagementData: boolean;
}

/** Build the whole projection from the live stores. */
export function engagementProjection(
  opts: { patientIds?: string[]; now?: Date; windowDays?: number } = {},
): EngagementProjection {
  const now = opts.now ?? new Date();
  const windowDays = opts.windowDays ?? ENGAGEMENT_WINDOW_DAYS;
  const cohorts = resolveCohorts(opts.patientIds);
  const rows = engagementRows(cohorts.members, now, windowDays);

  const allIds = cohorts.members.map((m) => m.patientId);
  const st = selfTrackingAggregate(allIds);

  return {
    now: now.toISOString(),
    windowDays,
    cohorts,
    rows,
    overall: rollUp("general_population", rows, "All patients"),
    byTrack: cohorts.buckets.map((b) =>
      rollUp(
        b.track,
        rows.filter((r) => r.track === b.track),
      ),
    ),
    selfTracking: { ...st, minimumCohortSize: MIN_COHORT_SIZE, windowDays },
    hasAnyEngagementData: rows.some(
      (r) =>
        r.lessonsCompleted +
          r.recoveryLessonsCompleted +
          r.exercisesCompleted +
          r.lessonsStarted >
        0,
    ),
  };
}

/** Convenience for the dashboard: total patient count in the program. */
export function programPatientCount(): number {
  return AdelanteEHR.listPatients().length;
}
