// §Orders/MAR — administration scheduling + dispense quantity.
//
// DEV HANDOFF: port of the reference EMR's `medSchedule.ts`, kept whole.
// The admin-time-grid half (`nextAdminAt` / `nthAdminAt` /
// `deriveMedicationSchedule`) exists because Adelante serves CUSTODY-BASED
// partner sites where a nurse administers every dose on the facility's clock —
// it is not outpatient-only convenience code. All wall-clock math routes
// through facilityTime.ts so DST transitions and device-zone drift cannot shift
// a dose.
//
// TODO(mar): a real MAR needs administration RECORDS (given / refused / held /
// missed) reconciled against this derived grid. That is Phase 2 — this module
// only derives the DUE times.

import {
  addFacilityDays,
  facilityDateKey,
  fromFacilityWallClock,
  startOfFacilityDay,
  toFacilityParts,
} from "@/lib/facilityTime";
import {
  dosesPerDay,
  frequencyByCode,
  frequencyIntervalDays,
  type MedFrequency,
} from "@/lib/frequencies";

export interface ScheduleContext {
  /** Frequency catalog code, e.g. "BID". */
  frequencyCode?: string;
  /** Facility/site timezone. Falls back to America/Los_Angeles. */
  timezone?: string;
  /** Therapy start. Defaults to now. */
  startAt?: Date;
  durationValue?: number;
  durationUnit?: "days" | "doses";
  isStat?: boolean;
}

export interface AdminSlot {
  /** Instant the dose is due. */
  dueAt: Date;
  /** Facility-local calendar day the dose belongs to (YYYY-MM-DD). */
  facilityDate: string;
  /** Facility-local hour from the frequency grid. */
  hour: number;
  /** 1-based ordinal across the whole course. */
  ordinal: number;
}

function gridFor(freq?: MedFrequency): number[] {
  return [...(freq?.adminTimes ?? [])].sort((a, b) => a - b);
}

/**
 * Next scheduled administration strictly after `from`.
 * Returns undefined for PRN (no grid) and for unknown frequencies.
 */
export function nextAdminAt(from: Date, ctx: ScheduleContext): Date | undefined {
  const freq = frequencyByCode(ctx.frequencyCode);
  const grid = gridFor(freq);
  if (!freq || freq.isPrn || grid.length === 0) return undefined;

  const interval = frequencyIntervalDays(freq);
  const anchor = startOfFacilityDay(ctx.startAt ?? from, ctx.timezone);

  // Scan forward day by day; interval > 1 (weekly) only lands on multiples.
  for (let dayOffset = 0; dayOffset <= interval * 8; dayOffset++) {
    const day = addFacilityDays(anchor, dayOffset, ctx.timezone);
    if (dayOffset % interval !== 0) continue;
    if (day.getTime() + 86400000 < from.getTime()) continue;
    const w = toFacilityParts(day, ctx.timezone);
    for (const hour of grid) {
      const due = fromFacilityWallClock(
        { year: w.year, month: w.month, day: w.day, hour },
        ctx.timezone,
      );
      if (due.getTime() > from.getTime()) return due;
    }
  }
  return undefined;
}

/** The nth (1-based) administration of the course. */
export function nthAdminAt(n: number, ctx: ScheduleContext): Date | undefined {
  if (!Number.isFinite(n) || n < 1) return undefined;
  const start = ctx.startAt ?? new Date();
  // STAT is a single immediate administration — no grid.
  if (ctx.isStat) return n === 1 ? start : undefined;
  let cursor = new Date(start.getTime() - 1);
  for (let i = 0; i < n; i++) {
    const next = nextAdminAt(cursor, { ...ctx, startAt: start });
    if (!next) return undefined;
    cursor = next;
  }
  return cursor;
}

/** Total scheduled administrations for the course, or undefined when open-ended. */
export function totalAdminCount(ctx: ScheduleContext): number | undefined {
  if (ctx.isStat) return 1;
  const freq = frequencyByCode(ctx.frequencyCode);
  if (!freq) return undefined;
  if (ctx.durationUnit === "doses") return ctx.durationValue;
  if (ctx.durationUnit === "days" && ctx.durationValue)
    return Math.ceil(dosesPerDay(freq) * ctx.durationValue);
  return undefined;
}

/**
 * Full derived MAR grid for the course. PRN orders return an empty grid with
 * `isPrn: true` — the MAR shows them as an on-demand row, not timed slots.
 */
export function deriveMedicationSchedule(ctx: ScheduleContext): {
  isPrn: boolean;
  slots: AdminSlot[];
  totalDoses?: number;
} {
  const freq = frequencyByCode(ctx.frequencyCode);
  if (!freq) return { isPrn: false, slots: [] };
  if (freq.isPrn) return { isPrn: true, slots: [], totalDoses: totalAdminCount(ctx) };

  const start = ctx.startAt ?? new Date();
  if (ctx.isStat) {
    return {
      isPrn: false,
      totalDoses: 1,
      slots: [
        {
          dueAt: start,
          facilityDate: facilityDateKey(start, ctx.timezone),
          hour: toFacilityParts(start, ctx.timezone).hour,
          ordinal: 1,
        },
      ],
    };
  }

  const total = totalAdminCount(ctx);
  // Cap unbounded courses so the MAR preview stays finite (14 days of grid).
  const cap = total ?? (Math.ceil(dosesPerDay(freq) * 14) || 14);
  const slots: AdminSlot[] = [];
  let cursor = new Date(start.getTime() - 1);
  for (let i = 1; i <= cap; i++) {
    const due = nextAdminAt(cursor, { ...ctx, startAt: start });
    if (!due) break;
    slots.push({
      dueAt: due,
      facilityDate: facilityDateKey(due, ctx.timezone),
      hour: toFacilityParts(due, ctx.timezone).hour,
      ordinal: i,
    });
    cursor = due;
  }
  return { isPrn: false, slots, totalDoses: total };
}

export interface DispenseInput {
  frequencyCode?: string;
  /** Reconciled units (tablets/caps) or mL per administration. */
  amountPerAdmin?: number;
  durationValue?: number;
  durationUnit?: "days" | "doses";
  isStat?: boolean;
  /** True when `amountPerAdmin` is mL — switches rounding to bottle sizes. */
  isLiquid?: boolean;
}

export interface DispenseResult {
  /** Total units/mL to dispense. Undefined when inputs are incomplete. */
  quantity?: number;
  /** Days the dispensed quantity covers — feeds days-supply for controlled meds. */
  daysSupply?: number;
  /** Administrations the quantity covers. */
  totalDoses?: number;
}

/** Standard oral-liquid bottle sizes (mL) a pharmacy actually dispenses. */
export const STANDARD_BOTTLE_SIZES_ML = [30, 60, 120, 240, 480];

/**
 * Round a computed liquid volume UP to a dispensable bottle size. Above the
 * largest standard bottle, round up to the next 60 mL (multiple bottles).
 */
export function roundLiquid(ml: number): number {
  for (const size of STANDARD_BOTTLE_SIZES_ML) if (ml <= size + 1e-9) return size;
  return Math.ceil(ml / 60) * 60;
}

/** Solids are never dispensed fractionally — always ceil to a whole unit. */
function roundSolid(units: number): number {
  return Math.ceil(units - 1e-9);
}

function roundDispense(amount: number, isLiquid?: boolean): number {
  return isLiquid ? roundLiquid(amount) : roundSolid(amount);
}

/**
 * Dispense quantity = amount per administration x total administrations.
 * PRN uses the frequency catalog's worst-case ceiling (an Adelante extension —
 * see frequencies.ts): a PRN order must be dispensed for the maximum the
 * patient could legitimately take.
 *
 * Rounding mirrors the reference: liquids round UP to a standard bottle size,
 * solids ceil to whole tablets/capsules. Never round DOWN — that short-supplies
 * the course.
 */
export function computeDispenseQuantity(input: DispenseInput): DispenseResult {
  const freq = frequencyByCode(input.frequencyCode);
  const per = input.amountPerAdmin;
  if (!per || !Number.isFinite(per) || per <= 0) return {};

  if (input.isStat)
    return { quantity: roundDispense(per, input.isLiquid), daysSupply: 1, totalDoses: 1 };
  if (!freq) return {};

  const perDay = dosesPerDay(freq);
  let totalDoses: number | undefined;
  let days: number | undefined;

  if (input.durationUnit === "doses" && input.durationValue) {
    totalDoses = input.durationValue;
    days = perDay > 0 ? Math.ceil(totalDoses / perDay) : undefined;
  } else if (input.durationUnit === "days" && input.durationValue) {
    days = input.durationValue;
    totalDoses = Math.ceil(perDay * days);
  } else {
    return {};
  }

  return { quantity: roundDispense(per * totalDoses, input.isLiquid), daysSupply: days, totalDoses };
}
