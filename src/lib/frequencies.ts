// §Orders — frequency catalog (seeded).
//
// DEV HANDOFF: the reference EMR reads this from a `med_frequencies` database
// table. Adelante has no such table yet, so this is the seeded, code-side
// equivalent with the SAME shape, so the swap is drop-in: replace
// `FREQUENCY_CATALOG` with a fetch and keep `frequencyByCode` / the
// `MedFrequency` type. Nothing else imports the array directly.
//
// `adminTimes` is the facility-local hour-of-day grid. It is the single source
// of truth for BOTH dispense-quantity math (doses per day = adminTimes.length)
// and MAR admin-time scheduling in medSchedule.ts.
//
// ADELANTE EXTENSION (does NOT mirror the reference): PRN entries carry an
// empty admin grid plus an explicit `maxPerDay` ceiling. The reference EMR
// computed dosesPerDay as `adminTimes.length || (is_prn ? 1 : 0)` — i.e. any
// PRN fell back to a flat 1 dose/day for quantity estimation. That under-
// dispenses a Q4H PRN analgesic, so Adelante encodes the real worst-case
// ceiling per PRN cadence instead. `dosesPerDay` still falls back to 1 when a
// PRN entry has no `maxPerDay`, matching the reference behaviour exactly.

export interface MedFrequency {
  code: string;
  label: string;
  /** Sig fragment, e.g. "twice daily". */
  sigLabel: string;
  isPrn: boolean;
  /** Facility-local hours (0-23) at which a scheduled dose is due. */
  adminTimes: number[];
  /** PRN only: worst-case administrations per 24h, for dispense quantity. */
  maxPerDay?: number;
}

export const FREQUENCY_CATALOG: MedFrequency[] = [
  { code: "QD", label: "QD — once daily", sigLabel: "once daily", isPrn: false, adminTimes: [8] },
  {
    code: "QAM",
    label: "QAM — every morning",
    sigLabel: "every morning",
    isPrn: false,
    adminTimes: [8],
  },
  {
    code: "QHS",
    label: "QHS — at bedtime",
    sigLabel: "at bedtime",
    isPrn: false,
    adminTimes: [21],
  },
  {
    code: "BID",
    label: "BID — twice daily",
    sigLabel: "twice daily",
    isPrn: false,
    adminTimes: [8, 20],
  },
  {
    code: "TID",
    label: "TID — three times daily",
    sigLabel: "three times daily",
    isPrn: false,
    adminTimes: [8, 14, 20],
  },
  {
    code: "QID",
    label: "QID — four times daily",
    sigLabel: "four times daily",
    isPrn: false,
    adminTimes: [8, 12, 16, 20],
  },
  {
    code: "Q4H",
    label: "Q4H — every 4 hours",
    sigLabel: "every 4 hours",
    isPrn: false,
    adminTimes: [0, 4, 8, 12, 16, 20],
  },
  {
    code: "Q6H",
    label: "Q6H — every 6 hours",
    sigLabel: "every 6 hours",
    isPrn: false,
    adminTimes: [0, 6, 12, 18],
  },
  {
    code: "Q8H",
    label: "Q8H — every 8 hours",
    sigLabel: "every 8 hours",
    isPrn: false,
    adminTimes: [6, 14, 22],
  },
  {
    code: "Q12H",
    label: "Q12H — every 12 hours",
    sigLabel: "every 12 hours",
    isPrn: false,
    adminTimes: [8, 20],
  },
  {
    code: "QWK",
    label: "QWK — once weekly",
    sigLabel: "once weekly",
    isPrn: false,
    adminTimes: [8],
    intervalDays: 7,
  } as MedFrequency & { intervalDays: number },
  {
    code: "PRN",
    label: "PRN — as needed",
    sigLabel: "as needed",
    isPrn: true,
    adminTimes: [],
    maxPerDay: 4,
  },
  {
    code: "Q4H_PRN",
    label: "Q4H PRN — as needed, up to every 4 hours",
    sigLabel: "every 4 hours as needed",
    isPrn: true,
    adminTimes: [],
    maxPerDay: 6,
  },
  {
    code: "Q6H_PRN",
    label: "Q6H PRN — as needed, up to every 6 hours",
    sigLabel: "every 6 hours as needed",
    isPrn: true,
    adminTimes: [],
    maxPerDay: 4,
  },
  {
    code: "QHS_PRN",
    label: "QHS PRN — as needed at bedtime",
    sigLabel: "at bedtime as needed",
    isPrn: true,
    adminTimes: [],
    maxPerDay: 1,
  },
];

/** Weekly / non-daily cadences carry an interval; daily ones default to 1. */
export function frequencyIntervalDays(f?: MedFrequency): number {
  return (f as (MedFrequency & { intervalDays?: number }) | undefined)?.intervalDays ?? 1;
}

export function frequencyByCode(code?: string): MedFrequency | undefined {
  if (!code) return undefined;
  return FREQUENCY_CATALOG.find((f) => f.code === code);
}

/** Administrations per 24h. PRN uses its worst-case ceiling. */
export function dosesPerDay(f?: MedFrequency): number {
  if (!f) return 0;
  if (f.isPrn) return f.maxPerDay ?? 1;
  const interval = frequencyIntervalDays(f);
  return f.adminTimes.length / interval;
}
