// Demo seed times — every seeded visit lands in local business hours
// (8 AM–6 PM, America/Los_Angeles), whatever timezone the server runs in.
// The old seeds used Date#setHours, which is the *server's* clock (UTC in
// production), so a "10 AM" visit showed at 3 AM Pacific.
import { DEFAULT_FACILITY_TZ, fromFacilityWallClock, toFacilityParts } from "./facilityTime";

export const DEMO_TZ = DEFAULT_FACILITY_TZ;
export const DEMO_DAY_START_HOUR = 8;
/** Last start so a visit up to 60 min still ends by 6 PM. */
export const DEMO_LAST_START_HOUR = 17;

/** Wall-clock hour (0-23, fractional) of an instant in the demo zone. */
export function demoLocalHour(instant: Date | string | number): number {
  const w = toFacilityParts(new Date(instant), DEMO_TZ);
  return w.hour + w.minute / 60;
}

/** Instant for `hour:minute` Pacific, `days` calendar days from `base`'s Pacific date. */
export function demoLocalDayAt(days: number, hour: number, minute = 0, base: Date = new Date()): Date {
  const w = toFacilityParts(base, DEMO_TZ);
  const noonUtc = new Date(Date.UTC(w.year, w.month - 1, w.day + days, 12));
  return fromFacilityWallClock(
    { year: noonUtc.getUTCFullYear(), month: noonUtc.getUTCMonth() + 1, day: noonUtc.getUTCDate(), hour, minute },
    DEMO_TZ,
  );
}

/**
 * Keep an instant on its own Pacific date but inside business hours. Inside
 * 8:00–17:00 it is kept (rounded to 15 min); outside, it moves to a slot
 * from 9:00 spread by `slot` × 30 min (capped at 17:00). Returns ISO.
 */
export function demoBusinessTime(instant: Date | string | number, slot = 0): string {
  const d = new Date(instant);
  const w = toFacilityParts(d, DEMO_TZ);
  const h = w.hour + w.minute / 60;
  let hour: number;
  let minute: number;
  if (h >= DEMO_DAY_START_HOUR && h <= DEMO_LAST_START_HOUR) {
    const m = Math.floor(w.minute / 15) * 15;
    hour = w.hour;
    minute = m;
  } else {
    const total = Math.min(9 * 60 + Math.max(0, slot) * 30, DEMO_LAST_START_HOUR * 60);
    hour = Math.floor(total / 60);
    minute = total % 60;
  }
  return fromFacilityWallClock({ year: w.year, month: w.month, day: w.day, hour, minute }, DEMO_TZ).toISOString();
}
