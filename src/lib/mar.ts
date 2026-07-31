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
import { frequencyByCode } from "@/lib/frequencies";
import { deriveMedicationSchedule } from "@/lib/medSchedule";
import {
  addFacilityDays,
  facilityDateKey,
  startOfFacilityDay,
  facilityTimeLabel,
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

/** The start instant the schedule should be anchored to for this order. */
function orderStart(order: MedOrder): Date {
  const raw = order.attestedAt ?? order.createdAt;
  const d = raw ? new Date(raw) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Scheduled due times for one order that fall on `dateKey`.
 *
 * The order may have started weeks ago, and deriveMedicationSchedule caps
 * open-ended courses at 14 days of grid, so the projection is re-anchored to
 * the start of the requested day whenever therapy began before it. The daily
 * admin grid is identical either way for daily cadences; weekly cadences are
 * re-checked against the true start so their interval is preserved.
 */
function slotsForOrder(order: MedOrder, dateKey: string, tz?: string): string[] {
  const start = orderStart(order);
  const dayStart = startOfFacilityDay(new Date(`${dateKey}T12:00:00Z`), tz);
  const dayEnd = addFacilityDays(dayStart, 1, tz);
  const anchor = start.getTime() > dayStart.getTime() ? start : dayStart;
  const { isPrn, slots } = deriveMedicationSchedule({
    frequencyCode: order.frequencyCode,
    timezone: tz,
    startAt: anchor,
    durationValue: order.durationValue,
    durationUnit: order.durationUnit,
    isStat: order.isStat,
  });
  if (isPrn) return [];
  return slots
    .filter((s) => s.dueAt.getTime() >= dayStart.getTime() && s.dueAt.getTime() < dayEnd.getTime())
    .map((s) => s.dueAt.toISOString());
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
  const deferred: MarDay["deferred"] = [];

  for (const order of orders) {
    const reason = deferralReasonFor(order);
    if (reason) {
      deferred.push({ order, reason });
      continue;
    }
    if (!order.frequencyCode && !order.isStat) continue;
    for (const scheduledAt of slotsForOrder(order, key, tz)) {
      slots.push({
        key: `${order.id}@${scheduledAt}`,
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
  return { dateKey: key, slots, deferred };
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
