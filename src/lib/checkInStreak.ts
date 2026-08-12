// §Patient portal Build 2 — check-in streak.
//
// Cathy's dashboard shows "{n}-day check-in streak". This computes that from
// REAL dated, patient-authored events. It deliberately does NOT read the
// engagement store: `src/lib/engagement.ts` records lesson/exercise completion
// as unordered id SETS with only a row-level `firstActivityAt`/`lastActivityAt`
// — there is no per-completion date, so "days I did a lesson" is not derivable
// and inventing one would be a fabricated number on a motivational surface.
//
// The two real per-day sources are:
//   1. Dose self-reports  — `DoseSelfReport.facilityDate`, patient-authored.
//   2. Quick checks       — PHQ-2/GAD-2 `ScreenerResult.completedAt`.
// Both are things the patient personally did on a dated day. Neither is 42 CFR
// Part 2 material (the quick checks are the short-form depression/anxiety
// gateway, not AUDIT-10/DAST-10), so no Part 2 surface is widened here.

/** A streak is a run of consecutive local days ending today or yesterday. */
export interface CheckInStreak {
  /** Consecutive days with at least one patient-authored check-in. */
  days: number;
  /** True when today itself already has a check-in. */
  checkedInToday: boolean;
  /** Distinct day keys that counted, most recent first. */
  contributingDays: string[];
}

/** YYYY-MM-DD for a Date in the viewer's locale-independent calendar day. */
export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shiftKey(key: string, deltaDays: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + deltaDays);
  return dayKey(dt);
}

/**
 * Pure streak computation over already-collected day keys.
 *
 * Grace rule: a streak that ends YESTERDAY still counts, because a person who
 * has not opened the app yet today has not broken anything. It only resets
 * once a full day has been skipped. This is the forgiving reading, matching
 * the non-punitive tone of the rest of the patient surface.
 */
export function computeCheckInStreak(
  checkInDayKeys: readonly string[],
  todayKey: string,
): CheckInStreak {
  const set = new Set(checkInDayKeys);
  const checkedInToday = set.has(todayKey);
  // Anchor on today when today counts, else on yesterday (grace), else no run.
  let cursor = checkedInToday ? todayKey : shiftKey(todayKey, -1);
  if (!set.has(cursor)) {
    return { days: 0, checkedInToday, contributingDays: [] };
  }
  const contributingDays: string[] = [];
  while (set.has(cursor)) {
    contributingDays.push(cursor);
    cursor = shiftKey(cursor, -1);
  }
  return { days: contributingDays.length, checkedInToday, contributingDays };
}

/** Inputs the dashboard collects from the real stores. */
export interface CheckInSources {
  /** `DoseSelfReport.facilityDate` values authored by the patient. */
  doseSelfReportDates: readonly string[];
  /** `ScreenerResult.completedAt` ISO strings for the short-form quick checks. */
  quickCheckCompletedAt: readonly string[];
  /**
   * §Tier 1 Build B — day keys from the real daily mood check-in
   * (`selfTracking.dailyCheckInDayKeys`). A third genuinely patient-authored,
   * genuinely dated source, distinct from the clinical PHQ-2/GAD-2 quick check.
   */
  dailyCheckInDayKeys?: readonly string[];
}

/** Fold the real sources into distinct day keys, then compute the run. */
export function checkInStreakFrom(
  sources: CheckInSources,
  now: Date = new Date(),
): CheckInStreak {
  const keys = new Set<string>(sources.doseSelfReportDates);
  for (const k of sources.dailyCheckInDayKeys ?? []) keys.add(k);
  for (const iso of sources.quickCheckCompletedAt) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) keys.add(dayKey(d));
  }
  return computeCheckInStreak([...keys], dayKey(now));
}
