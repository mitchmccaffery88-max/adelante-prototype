// §Orders/MAR — facility-anchored, DST-safe time helpers.
//
// DEV HANDOFF: port of the reference EMR's `facilityTime.ts`. Every scheduling
// calculation in the MAR must be anchored to the FACILITY's timezone, never the
// device's. A nurse in a custody site may be on a tablet whose zone is wrong;
// an outpatient clinician may be travelling. Wall-clock admin times ("08:00
// dose") are facility-local by definition.
//
// ADELANTE NOTE: the reference had a `facility` table carrying the zone.
// Adelante has no site/facility concept yet, so the zone lives on `Patient`
// (`facilityTimezone`) — chosen over a global const because a single Adelante
// program serves both community clients and custody partner sites, and those
// can differ. TODO(sites): when a real Site/CareSetting entity lands, move this
// field there and have Patient reference the site.

export const DEFAULT_FACILITY_TZ = "America/Los_Angeles";

/** Resolve the effective facility zone, falling back to the county default. */
export function facilityZone(tz?: string): string {
  return tz && tz.trim() ? tz : DEFAULT_FACILITY_TZ;
}

const partsCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string): Intl.DateTimeFormat {
  let f = partsCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsCache.set(tz, f);
  }
  return f;
}

export interface WallClock {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number;
  second: number;
}

/** Break an instant into facility-local wall-clock parts. */
export function toFacilityParts(instant: Date, tz?: string): WallClock {
  const zone = facilityZone(tz);
  const p = Object.fromEntries(
    fmt(zone)
      .formatToParts(instant)
      .filter((x) => x.type !== "literal")
      .map((x) => [x.type, Number(x.value)]),
  ) as Record<string, number>;
  // Intl renders midnight as hour 24 in some engines.
  return {
    year: p.year,
    month: p.month,
    day: p.day,
    hour: p.hour === 24 ? 0 : p.hour,
    minute: p.minute,
    second: p.second,
  };
}

/**
 * Offset (in minutes) of `tz` from UTC at a given instant. Positive means ahead
 * of UTC. Computed by round-tripping the instant through the zone's wall clock,
 * which is DST-correct because Intl applies the rules in force at that instant.
 */
export function zoneOffsetMinutes(instant: Date, tz?: string): number {
  const w = toFacilityParts(instant, tz);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return Math.round((asUtc - instant.getTime()) / 60000);
}

/**
 * Build the instant for a facility-local wall clock time. DST-safe: the naive
 * guess is corrected once against the offset actually in force at that guess,
 * which resolves both the spring-forward gap and the fall-back overlap the same
 * way the reference implementation does (earliest valid instant wins).
 */
export function fromFacilityWallClock(
  wall: {
    year: number;
    month: number;
    day: number;
    hour?: number;
    minute?: number;
    second?: number;
  },
  tz?: string,
): Date {
  const naive = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour ?? 0,
    wall.minute ?? 0,
    wall.second ?? 0,
  );
  let guess = new Date(naive - zoneOffsetMinutes(new Date(naive), tz) * 60000);
  // Second pass: the offset at the guessed instant may differ across a DST edge.
  const corrected = new Date(naive - zoneOffsetMinutes(guess, tz) * 60000);
  if (corrected.getTime() !== guess.getTime()) guess = corrected;
  return guess;
}

/** Facility-local calendar date key (YYYY-MM-DD) for an instant. */
export function facilityDateKey(instant: Date, tz?: string): string {
  const w = toFacilityParts(instant, tz);
  const p2 = (n: number) => String(n).padStart(2, "0");
  return `${w.year}-${p2(w.month)}-${p2(w.day)}`;
}

/** Start of the facility-local day containing `instant`. */
export function startOfFacilityDay(instant: Date, tz?: string): Date {
  const w = toFacilityParts(instant, tz);
  return fromFacilityWallClock({ year: w.year, month: w.month, day: w.day }, tz);
}

/** Add whole facility-local days (DST-safe: re-anchors the wall clock). */
export function addFacilityDays(instant: Date, days: number, tz?: string): Date {
  const w = toFacilityParts(instant, tz);
  return fromFacilityWallClock(
    {
      year: w.year,
      month: w.month,
      day: w.day + days,
      hour: w.hour,
      minute: w.minute,
      second: w.second,
    },
    tz,
  );
}

/** Format an instant as facility-local `HH:MM` (24h). */
export function facilityTimeLabel(instant: Date, tz?: string): string {
  const w = toFacilityParts(instant, tz);
  return `${String(w.hour).padStart(2, "0")}:${String(w.minute).padStart(2, "0")}`;
}

/** Human label for an admin-grid hour, e.g. 8 -> "8:00 AM", 20 -> "8:00 PM". */
export function adminHourLabel(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  const suffix = h < 12 ? "AM" : "PM";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:00 ${suffix}`;
}
