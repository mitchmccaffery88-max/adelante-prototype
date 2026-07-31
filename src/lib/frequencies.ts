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
  /** Admin-authored free text shown next to the code in pickers/admin. */
  description?: string;
  /** PRN only: minimum minutes between administrations (MAR advisory). */
  minGapMinutes?: number;
  /** Non-daily cadences (e.g. QWK = 7). Defaults to 1. */
  intervalDays?: number;
  /** Inactive rows drop out of pickers but still resolve for history. */
  active?: boolean;
  /** Ascending picker order; seeded rows are spaced by 10. */
  sortOrder?: number;
  /** Set when an admin deactivates the row. */
  deactivatedReason?: string;
  updatedBy?: string;
  updatedAt?: string;
}

/**
 * Seeded rows. §Admin governance: the live catalog is a mutable registry
 * layered on this seed (see `listFrequencies` / AdelanteEHR.saveFrequency).
 * Import `listFrequencies()` in UI code — never this array.
 */
export const SEED_FREQUENCIES: MedFrequency[] = [
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
  },
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
  return f?.intervalDays ?? 1;
}

// ----- §Admin governance: mutable frequency registry -----------------------
//
// Mutators here are raw. Audit logging, in-use protection and reactive emit
// live in `AdelanteEHR` (src/lib/ehr.ts) — admin UI must go through those.

function seedCatalog(): MedFrequency[] {
  return SEED_FREQUENCIES.map((f, i) => ({ ...f, active: true, sortOrder: (i + 1) * 10 }));
}

let catalog: MedFrequency[] = seedCatalog();

/** Active rows (picker order), or everything when `includeInactive`. */
export function listFrequencies(includeInactive = false): MedFrequency[] {
  return catalog
    .filter((f) => includeInactive || f.active !== false)
    .map((f) => ({ ...f }))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.code.localeCompare(b.code));
}

/** Resolves INACTIVE rows too, so historical orders never lose their label. */
export function frequencyByCode(code?: string): MedFrequency | undefined {
  if (!code) return undefined;
  return catalog.find((f) => f.code === code);
}

/** Insert or replace by code. Returns the stored row. */
export function putFrequency(row: MedFrequency): MedFrequency {
  const i = catalog.findIndex((f) => f.code === row.code);
  if (i >= 0) catalog[i] = { ...catalog[i], ...row };
  else catalog.push({ ...row });
  return { ...(catalog.find((f) => f.code === row.code) as MedFrequency) };
}

/** Hard delete. Only ever called after the in-use check in `AdelanteEHR`. */
export function dropFrequency(code: string): boolean {
  const i = catalog.findIndex((f) => f.code === code);
  if (i < 0) return false;
  catalog.splice(i, 1);
  return true;
}

/** Test helper — restores the seeded catalog. */
export function resetFrequencyCatalog(): void {
  catalog = seedCatalog();
}

/** Administrations per 24h. PRN uses its worst-case ceiling. */
export function dosesPerDay(f?: MedFrequency): number {
  if (!f) return 0;
  if (f.isPrn) return f.maxPerDay ?? 1;
  const interval = frequencyIntervalDays(f);
  return f.adminTimes.length / interval;
}
