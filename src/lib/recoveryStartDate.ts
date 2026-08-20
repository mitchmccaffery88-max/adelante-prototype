// §Recovery start date — the pure part.
//
// The self-reported abstinence/recovery start date is close to a direct SUD
// status marker, so the STORE gates it exactly like Part 2 screener content
// (see `AdelanteEHR.recoveryStartDateAccess`). This module holds only the
// date math and the patient-facing wording, so it can be unit-tested and
// reused without touching the gated store.

/** Local-midnight day key, matching src/lib/checkInStreak.ts. */
export function dayKeyLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse a `YYYY-MM-DD` key as LOCAL midnight (never UTC-shifted). */
export function parseDayKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Whole days between the recovery start date and today, inclusive of the
 * start day being "day 0". A future date returns null — we never render a
 * negative streak, and we never silently correct the patient's entry.
 */
export function daysSober(startDate: string | undefined, now: Date = new Date()): number | null {
  if (!startDate) return null;
  const start = parseDayKey(startDate);
  if (!start) return null;
  const today = parseDayKey(dayKeyLocal(now));
  if (!today) return null;
  const diff = Math.round((today.getTime() - start.getTime()) / 86_400_000);
  return diff < 0 ? null : diff;
}

/**
 * Shame-free label. Deliberately no "clean", no "relapse-free", no score:
 * the same discipline as the Recovery Journey content. Milestones are noted,
 * never demanded.
 */
export function daysSoberLabel(days: number | null): string {
  if (days === null) return "Set your date";
  if (days === 0) return "Day one — today counts";
  if (days === 1) return "1 day";
  return `${days} days`;
}

/** Nearest milestone already passed, for a quiet acknowledgement. */
export const RECOVERY_MILESTONES = [30, 60, 90, 180, 365, 730] as const;
export function passedMilestone(days: number | null): number | null {
  if (days === null) return null;
  const hit = [...RECOVERY_MILESTONES].reverse().find((m) => days >= m);
  return hit ?? null;
}