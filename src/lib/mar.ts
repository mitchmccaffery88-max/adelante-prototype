// §MAR Phase 1–2 — due-dose derivation for a single patient.
//
// ARCHITECTURE NOTE: the reference EMR's MedPass is a FACILITY-WIDE roster grid
// (one nurse charts across every patient on a unit in one pass). Adelante's
// clinical UI is patient-centric, so Phase 1 derives and renders the MAR inside
// one patient's record. A multi-patient roster view would need a "patients on
// my unit right now" concept Adelante does not have yet — that is a separate
// architectural decision, deliberately not taken here.
//
// Nothing here rebuilds scheduling: due times come from the existing
// deriveMedicationSchedule (medSchedule.ts) + frequency catalog.

import {
  type DoseAdministration,
  type DoseClaim,
  type MedOrder,
  type Patient,
} from "@/lib/ehr";
import { isOrderActive, isPrnOrder } from "@/lib/orders";
import { frequencyByCode, frequencyIntervalDays } from "@/lib/frequencies";
import { STAFF_ROSTER, type StaffMember } from "@/lib/roles";
import {
  facilityDateKey,
  fromFacilityWallClock,
  facilityTimeLabel,
  toFacilityParts,
} from "@/lib/facilityTime";

/**
 * Phase 1 kept PRN / KOP / controlled orders read-only in a deferred section.
 * Phase 2 moved all three into the actionable queue, so nothing defers today —
 * the type and labels are retained for any future staged rollout.
 */
export type MarDeferralReason = "prn" | "kop" | "controlled";

export const MAR_DEFERRAL_LABEL: Record<MarDeferralReason, string> = {
  prn: "PRN — eligibility & reason capture",
  kop: "KOP — patient self-administration issuance",
  controlled: "Controlled — witness workflow",
};

/** Phase 2: no order class is deferred any more. */
export function deferralReasonFor(order: MedOrder): MarDeferralReason | undefined {
  void order;
  return undefined;
}

/** What kind of MAR row this is — drives which actions the row offers. */
export type MarSlotKind = "scheduled" | "prn" | "kop";

export interface MarSlot {
  /** Stable key for the slot: order + scheduled instant. */
  key: string;
  kind: MarSlotKind;
  order: MedOrder;
  /** ISO instant the dose is due. */
  scheduledAt: string;
  /** Facility-local calendar day (YYYY-MM-DD). */
  facilityDate: string;
  /** Facility-local HH:MM label. */
  timeLabel: string;
  /** Live (non-voided) charted entry for this slot, when one exists. */
  administration?: DoseAdministration;
  /** Current claim on this slot, when one exists. */
  claim?: DoseClaim;
}

export interface MarDay {
  /** Facility-local date the window covers. */
  dateKey: string;
  /** Chartable scheduled doses. */
  slots: MarSlot[];
  /** As-needed orders — chartable on demand, one row per active PRN order. */
  prn: MarSlot[];
  /** Keep-on-person orders — issued as a supply, never charted here. */
  kop: MarSlot[];
  /** Active orders shown read-only until their Phase 2 workflow exists. */
  deferred: { order: MedOrder; reason: MarDeferralReason }[];
}

/**
 * Facility-local calendar day therapy begins.
 *
 * `startDate` is a first-class field on MedOrder as of this pass. The
 * attestedAt/createdAt chain below is a LEGACY read path only, for orders
 * written before the field existed — new orders always carry a real start date
 * (defaulted at draft/sign time, editable by the prescriber).
 */
export function orderStartDateKey(order: MedOrder, tz?: string): string {
  if (order.startDate) return order.startDate;
  const raw = order.attestedAt ?? order.createdAt;
  const d = raw ? new Date(raw) : new Date();
  return facilityDateKey(Number.isNaN(d.getTime()) ? new Date() : d, tz);
}

/** Whole calendar days from `from` to `to`, both YYYY-MM-DD. */
function dayOffset(from: string, to: string): number {
  const a = Date.parse(`${from}T12:00:00Z`);
  const b = Date.parse(`${to}T12:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.NaN;
  return Math.round((b - a) / 86_400_000);
}

/**
 * Scheduled due times for one order on `dateKey`.
 *
 * Due/not-due is computed DIRECTLY from (selected day − order start date)
 * against the frequency's `intervalDays`. The previous implementation
 * re-anchored deriveMedicationSchedule to the start of the selected day, which
 * silently treated every selected day as day 0 of the course — correct for
 * daily cadences (offset is irrelevant when every day is due) but wrong for any
 * cadence with intervalDays > 1, which would then appear due on every day it
 * was viewed.
 */
function slotsForOrder(order: MedOrder, dateKey: string, tz?: string): string[] {
  const startKey = orderStartDateKey(order, tz);
  const offset = dayOffset(startKey, dateKey);
  if (!Number.isFinite(offset) || offset < 0) return []; // therapy has not begun

  const parts = dateKey.split("-").map(Number);
  const at = (hour: number) =>
    fromFacilityWallClock(
      { year: parts[0], month: parts[1], day: parts[2], hour },
      tz,
    ).toISOString();

  // STAT is a single immediate administration on the start day only.
  if (order.isStat) {
    if (offset !== 0) return [];
    const raw = order.attestedAt ?? order.createdAt;
    const inst = raw ? new Date(raw) : new Date();
    return [(Number.isNaN(inst.getTime()) ? new Date() : inst).toISOString()];
  }

  const freq = frequencyByCode(order.frequencyCode);
  if (!freq || freq.isPrn || freq.adminTimes.length === 0) return [];

  // Interval cadence: only days that are an exact multiple of intervalDays from
  // the REAL start date are due.
  const interval = frequencyIntervalDays(freq);
  if (offset % interval !== 0) return [];

  const grid = [...freq.adminTimes].sort((a, b) => a - b);

  // Course end.
  if (order.durationUnit === "days" && order.durationValue && offset >= order.durationValue)
    return [];
  let hours = grid;
  if (order.durationUnit === "doses" && order.durationValue) {
    const priorDueDays = offset / interval;
    const remaining = order.durationValue - priorDueDays * grid.length;
    if (remaining <= 0) return [];
    hours = grid.slice(0, remaining);
  }
  // On the start day, a dose cannot be due before the order itself existed.
  if (offset === 0) {
    const raw = order.attestedAt ?? order.createdAt;
    const created = raw ? new Date(raw) : undefined;
    if (created && !Number.isNaN(created.getTime())) {
      const createdKey = facilityDateKey(created, tz);
      if (createdKey === dateKey) {
        const createdHour = toFacilityParts(created, tz).hour;
        hours = hours.filter((h) => h >= createdHour);
      }
    }
  }

  return hours.map(at);
}

/**
 * Build the MAR for one patient on one facility-local day.
 * `dateKey` defaults to the patient's facility "today".
 */
export function deriveMarDay(patient: Patient, dateKey?: string): MarDay {
  const tz = patient.facilityTimezone;
  const key = dateKey ?? facilityDateKey(new Date(), tz);
  const orders = (patient.orders ?? []).filter(isOrderActive);
  const administrations = patient.administrations ?? [];
  const claims = patient.doseClaims ?? [];

  const slots: MarSlot[] = [];
  const prn: MarSlot[] = [];
  const kop: MarSlot[] = [];
  const deferred: MarDay["deferred"] = [];
  const nowIso = new Date().toISOString();

  for (const order of orders) {
    const reason = deferralReasonFor(order);
    if (reason) {
      deferred.push({ order, reason });
      continue;
    }
    // KOP is a supply event, not a bedside administration — it never gets a
    // scheduled slot or a dose claim, matching the reference EMR.
    if (order.isKop) {
      kop.push({
        key: `${order.id}@kop`,
        kind: "kop",
        order,
        scheduledAt: nowIso,
        facilityDate: key,
        timeLabel: "As issued",
      });
      continue;
    }
    // PRN has no fixed schedule — one on-demand row per active PRN order.
    if (isPrnOrder(order)) {
      prn.push({
        key: `${order.id}@prn`,
        kind: "prn",
        order,
        scheduledAt: nowIso,
        facilityDate: key,
        timeLabel: frequencyByCode(order.frequencyCode)?.sigLabel ?? "as needed",
      });
      continue;
    }
    if (!order.frequencyCode && !order.isStat) continue;
    for (const scheduledAt of slotsForOrder(order, key, tz)) {
      slots.push({
        key: `${order.id}@${scheduledAt}`,
        kind: "scheduled",
        order,
        scheduledAt,
        facilityDate: key,
        timeLabel: facilityTimeLabel(new Date(scheduledAt), tz),
        administration: administrations.find(
          (a) => a.orderId === order.id && a.scheduledAt === scheduledAt && !a.voided,
        ),
        claim: claims.find((c) => c.orderId === order.id && c.scheduledAt === scheduledAt),
      });
    }
  }

  slots.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  return { dateKey: key, slots, prn, kop, deferred };
}

/** True when charting this slot now counts as a late entry (>4h past due). */
export function isLateEntry(scheduledAt: string, now: Date = new Date()): boolean {
  return now.getTime() - new Date(scheduledAt).getTime() > 4 * 3600_000;
}

/** Human summary of the drug + dose for a MAR row. */
export function marRowLabel(order: MedOrder): string {
  return [order.productName ?? order.drugName, order.dose, order.route]
    .filter(Boolean)
    .join(" · ");
}

// ---------------------------------------------------------------------------
// §MAR Phase 2 — PRN reasons, witness scoping, Suboxone detection.
// ---------------------------------------------------------------------------

/** Reference EMR's PRN indication chip set, ported verbatim. Free text still allowed. */
export const PRN_REASONS = [
  "Pain",
  "Anxiety",
  "Nausea",
  "Insomnia",
  "Withdrawal",
  "Headache",
  "Allergy",
  "Other",
] as const;

/**
 * "Not indicated" is charted as a HELD dose with this exact reason, matching
 * the reference — it is a distinct clinical outcome, not a generic hold.
 */
export const NOT_INDICATED_REASON = "Not indicated";

/** Staff who may witness a Schedule II administration: clinical/prescriber roles only. */
export function witnessCandidates(exclude?: string): StaffMember[] {
  return STAFF_ROSTER.filter(
    (s) => (s.role === "pmhnp" || s.role === "therapist") && s.name !== exclude,
  );
}

/**
 * Buprenorphine (Suboxone) sublingual detection — drives the extra mouth-check
 * attestation on batch commit. Matches on ingredient/drug name plus a
 * sublingual dose form or route.
 */
export function isSuboxoneOrder(order: MedOrder): boolean {
  const name = [order.drugName, order.productName, ...(order.ingredientNames ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (!/buprenorphine|suboxone|zubsolv/.test(name)) return false;
  const form = `${order.doseForm ?? ""} ${order.route ?? ""} ${name}`.toLowerCase();
  return /sublingual|\bsl\b|film|buccal/.test(form);
}

export const MOUTH_CHECK_ATTESTATION_TEXT =
  "I confirm mouth checks were completed for all Suboxone/buprenorphine sublingual doses in this pass.";
