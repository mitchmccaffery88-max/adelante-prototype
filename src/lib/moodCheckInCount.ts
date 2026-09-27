// §4 carry-over (d) — the ONE staff-safe read of the patient-private mood
// store: a bare count of days with a mood check-in in a date range. It never
// returns emotions, reasons, cravings, recap text or trends. Staff screens
// import this module, never the private store itself.
import { dailyCheckInDayKeys } from "@/lib/selfTracking";

/** Days (YYYY-MM-DD, inclusive) with a mood check-in. Number only. */
export function moodCheckInDayCount(patientId: string, fromYmd: string, toYmd: string): number {
  return new Set(dailyCheckInDayKeys(patientId).filter((d) => d >= fromYmd && d <= toYmd)).size;
}
