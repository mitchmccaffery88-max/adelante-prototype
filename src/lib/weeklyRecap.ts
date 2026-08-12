// §Weekly recap — REAL, computed weekly stats + the grounding contract for the
// Adel-generated reflection.
//
// HONESTY RULES BAKED IN (investigated before building):
//   • Check-in days ARE dated. Three real per-day sources exist (dose
//     self-reports, short-form quick checks, the daily mood check-in) — the
//     same three `checkInStreak.ts` folds. Counting distinct days inside the
//     7-day window is genuinely computable.
//   • Medication IS dated. `adherenceWeek` projects real MAR slots per day and
//     overlays the patient's own self-reports, so "you marked N of M doses" is
//     real. We report the PATIENT-AUTHORED layer only (self-reports), never the
//     charted MAR, because this is the patient's own weekly view.
//   • Lesson/exercise completion is NOT dated. `engagement.ts` stores unordered
//     id SETS with only a row-level `lastActivityAt`. There is no per-completion
//     date, so "3 lessons this week" is NOT computable and is not claimed. We
//     report running TOTALS plus whether there was any activity in the window,
//     and the UI says exactly that. (Changing the engagement model is an
//     explicit non-goal of this build.)
//
// PART 2 / PRIVACY: nothing here reads AUDIT-10 / DAST-10 or any screener
// content — quick-check DATES only, via the same short-form-filtered facade
// call the dashboard already uses. Craving logs, lapse records and check-in
// EMOTIONS are patient-private and are deliberately excluded from both the
// stats and anything sent to the model. Medication is reported as counts, never
// drug names.
import { dayKey } from "./checkInStreak";
import type { AdherenceDay } from "./medAdherence";

export interface WeeklyRecapSources {
  /** `DoseSelfReport.facilityDate` values. */
  doseSelfReportDates: readonly string[];
  /** Short-form quick-check `completedAt` ISO strings (dates only). */
  quickCheckCompletedAt: readonly string[];
  /** Day keys from the real daily mood check-in (no emotions). */
  dailyCheckInDayKeys: readonly string[];
  /** Real 7-day `adherenceWeek` projection. */
  adherence: readonly AdherenceDay[];
  /** Running engagement totals — see the header: these are NOT weekly. */
  engagement: {
    lessonsCompleted: number;
    recoveryLessonsCompleted: number;
    exercisesCompleted: number;
    lastActivityAt?: string;
  };
}

export interface WeeklyRecapMedication {
  /** Real scheduled MAR slots across the window. */
  scheduled: number;
  /** Slots the patient themself marked taken. */
  selfMarkedTaken: number;
  /** Slots with no self-report and nothing charted. */
  unmarked: number;
}

export interface WeeklyRecapStats {
  weekStartKey: string;
  weekEndKey: string;
  /** Distinct days in the window with at least one patient-authored check-in. */
  checkInDays: number;
  /** Always 7 — the denominator the UI shows. */
  windowDays: number;
  /** Absent when the patient has no scheduled medication at all this week. */
  medication?: WeeklyRecapMedication;
  learning: {
    lessonsCompletedTotal: number;
    recoveryLessonsCompletedTotal: number;
    exercisesCompletedTotal: number;
    /** True when `lastActivityAt` falls inside the window. */
    activeThisWeek: boolean;
    /** Always false — kept explicit so no caller mistakes totals for weekly. */
    weeklyCountsAvailable: false;
  };
}

const DAY = 86_400_000;

function windowKeys(now: Date): string[] {
  const keys: string[] = [];
  for (let i = 6; i >= 0; i--) keys.push(dayKey(new Date(now.getTime() - i * DAY)));
  return keys;
}

export function computeWeeklyRecap(
  sources: WeeklyRecapSources,
  now: Date = new Date(),
): WeeklyRecapStats {
  const keys = windowKeys(now);
  const inWindow = new Set(keys);

  const checkInKeys = new Set<string>();
  for (const k of sources.doseSelfReportDates) if (inWindow.has(k)) checkInKeys.add(k);
  for (const k of sources.dailyCheckInDayKeys) if (inWindow.has(k)) checkInKeys.add(k);
  for (const iso of sources.quickCheckCompletedAt) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) continue;
    const k = dayKey(d);
    if (inWindow.has(k)) checkInKeys.add(k);
  }

  const days = sources.adherence.filter((d) => inWindow.has(d.dateKey));
  const scheduled = days.reduce((n, d) => n + d.scheduled, 0);
  const medication: WeeklyRecapMedication | undefined =
    scheduled > 0
      ? {
          scheduled,
          selfMarkedTaken: days.reduce((n, d) => n + d.selfTaken, 0),
          unmarked: days.reduce((n, d) => n + d.unmarked, 0),
        }
      : undefined;

  const last = sources.engagement.lastActivityAt;
  const activeThisWeek = Boolean(last && inWindow.has(dayKey(new Date(last))));

  return {
    weekStartKey: keys[0]!,
    weekEndKey: keys[keys.length - 1]!,
    checkInDays: checkInKeys.size,
    windowDays: 7,
    ...(medication ? { medication } : {}),
    learning: {
      lessonsCompletedTotal: sources.engagement.lessonsCompleted,
      recoveryLessonsCompletedTotal: sources.engagement.recoveryLessonsCompleted,
      exercisesCompletedTotal: sources.engagement.exercisesCompleted,
      activeThisWeek,
      weeklyCountsAvailable: false,
    },
  };
}

/** True when there is literally nothing real to reflect on. */
export function recapIsEmpty(s: WeeklyRecapStats): boolean {
  return (
    s.checkInDays === 0 &&
    !s.learning.activeThisWeek &&
    (!s.medication || s.medication.selfMarkedTaken === 0)
  );
}

// ---------------------------------------------------------------------------
// The reflection prompt — grounding is the whole point.
// ---------------------------------------------------------------------------

/**
 * The ONLY facts the model is given. Built from numbers, on the server, so no
 * caller-supplied free text can reach the prompt.
 */
export function weeklyRecapFacts(s: WeeklyRecapStats): string[] {
  const facts: string[] = [
    `Days with a check-in in the last 7 days: ${s.checkInDays} of 7.`,
  ];
  if (s.medication) {
    facts.push(
      `Medication doses scheduled in the last 7 days: ${s.medication.scheduled}. Doses the member marked as taken: ${s.medication.selfMarkedTaken}. Doses not marked either way: ${s.medication.unmarked}.`,
    );
  } else {
    facts.push("The member has no scheduled medication this week. Do not mention medication.");
  }
  facts.push(
    `Lessons finished all-time: ${s.learning.lessonsCompletedTotal}. Recovery-module lessons finished all-time: ${s.learning.recoveryLessonsCompletedTotal}. Exercises finished all-time: ${s.learning.exercisesCompletedTotal}.`,
    s.learning.activeThisWeek
      ? "The member opened learning content at some point in the last 7 days. The app does NOT know how many lessons were finished this week — never state a weekly lesson count."
      : "The app has no record of learning activity in the last 7 days, and does NOT track per-week lesson counts. Do not claim any lessons were or were not finished this week.",
  );
  return facts;
}

/** Tight, non-clinical, anti-fabrication system prompt. */
export function buildWeeklyReflectionPrompt(s: WeeklyRecapStats): string {
  return `You are Adel, a warm, steady guide inside the Adelante recovery app. You are writing one short weekly reflection for a member (a person in recovery).

THE ONLY FACTS YOU HAVE
${weeklyRecapFacts(s)
  .map((f) => `- ${f}`)
  .join("\n")}

GROUNDING — THIS IS THE MOST IMPORTANT RULE
- Use ONLY the facts above. Nothing else about this person is known to you.
- Invent NOTHING: no events, no appointments, no people, no feelings, no cravings, no slips, no goals, no achievements, no plans, no "last week you...".
- Do not guess why a number is what it is. Do not predict next week.
- Do not restate every number. Two numbers at most, and only if they are in the facts.
- If the facts are mostly zeros, say something kind and true about a fresh start. Never scold, never imply failure.

HOW YOU WRITE
- Second person, to the member. Warm, plain, everyday words. 5th-grade reading level.
- 60 words maximum. Two or three sentences. No lists, no headings, no emoji.
- You are NOT a clinician. No diagnosis, no medical or medication advice, no interpretation.
- Never use clinical or scored words: "elevated", "risk", "score", "adherence", "compliance", "symptoms", "PHQ", "GAD", "AUDIT", "DAST", "screening".
- Never shame. A missed dose or a quiet week is not a failure and you never imply it is.
- Do not ask a question and do not suggest content. Plain text only — no ACTION line.`;
}
