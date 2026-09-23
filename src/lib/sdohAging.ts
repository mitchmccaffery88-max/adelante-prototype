// §SDOH Referral Thread Phase 5d-3 — how long a social need or a resource
// referral has sat with nothing happening.
//
// Same discipline as `referralAging.ts`: nothing is stamped, nothing runs in
// the background. Every value here is computed from real timestamps already on
// the record — `createdAt`, `updatedAt`, and the newest activity-log entry.
// Adding a log entry IS a real action, so it resets the clock.
//
// THRESHOLD REASONING (draft, labelled as such on screen, NOT ratified by
// Adelante care operations):
//
//   Identified but never referred — 5 days due / 14 overdue.
//     A need that has been named and not acted on is the classic dropout
//     point for a recently released person. A working week to make the first
//     move; two weeks with nothing is a failure, not a delay.
//
//   Referred, no outcome yet — 7 days due / 21 overdue.
//     Community organizations commonly answer inside a week. Three weeks of
//     silence means the referral will not close itself and needs a human.
//
//   Waitlisted — 30 days due / 60 overdue.
//     A waitlist is a legitimately slow state; clocking it weekly would bury
//     real work in noise. A monthly check-in matches real practice.
import {
  RESOURCE_REFERRAL_CLOSED_OUTCOMES,
  type ResourceReferral,
  type SdohPlanItem,
} from "./ehr";

export const SDOH_AGING_DRAFT = {
  label: "Draft threshold — pending care-operations sign-off",
  identified: { dueDays: 5, overdueDays: 14 },
  awaitingOutcome: { dueDays: 7, overdueDays: 21 },
  waitlisted: { dueDays: 30, overdueDays: 60 },
  note:
    "Draft: a need identified and not referred reads as due at 5 days and overdue at 14; a referral with no outcome at 7 and 21; a waitlisted referral at 30 and 60. The clock resets on any real action, including an activity-log entry. Not yet ratified by care operations.",
} as const;

export type SdohAgingState = "closed" | "fresh" | "due" | "overdue";

export interface SdohAging {
  state: SdohAgingState;
  days: number;
  /** Which draft threshold pair was applied. */
  band: "identified" | "awaitingOutcome" | "waitlisted" | "none";
}

const NEED_CLOSED = new Set(["completed", "not_completed"]);

const dayDiff = (from: string, now: Date) =>
  Math.max(0, Math.floor((+now - +new Date(from)) / 86_400_000));

const newestLogAt = (log?: { at: string }[]) =>
  log && log.length ? log.reduce((a, e) => (a > e.at ? a : e.at), log[0].at) : undefined;

/** The last moment a human really did something with this need. */
export function sdohNeedLastActionAt(item: SdohPlanItem): string {
  const candidates = [item.createdAt, item.updatedAt, newestLogAt(item.log)].filter(
    Boolean,
  ) as string[];
  return candidates.sort().at(-1) ?? item.createdAt;
}

/** The last moment a human really did something with this referral. */
export function referralLastActivityAt(r: ResourceReferral): string {
  const candidates = [r.createdAt, r.updatedAt, newestLogAt(r.log)].filter(Boolean) as string[];
  return candidates.sort().at(-1) ?? r.createdAt;
}

function band(days: number, t: { dueDays: number; overdueDays: number }): SdohAgingState {
  if (days >= t.overdueDays) return "overdue";
  if (days >= t.dueDays) return "due";
  return "fresh";
}

/**
 * A need ages only while nothing has been referred for it. Once a referral
 * exists, the referral carries the clock — otherwise one stalled item would
 * be counted twice.
 */
export function sdohNeedAging(
  item: SdohPlanItem,
  referralCount: number,
  now: Date = new Date(),
): SdohAging {
  const days = dayDiff(sdohNeedLastActionAt(item), now);
  if (NEED_CLOSED.has(item.status)) return { state: "closed", days, band: "none" };
  if (referralCount > 0) return { state: "fresh", days, band: "none" };
  return { state: band(days, SDOH_AGING_DRAFT.identified), days, band: "identified" };
}

export function referralAgingState(r: ResourceReferral, now: Date = new Date()): SdohAging {
  const days = dayDiff(referralLastActivityAt(r), now);
  if ((RESOURCE_REFERRAL_CLOSED_OUTCOMES as readonly string[]).includes(r.status))
    return { state: "closed", days, band: "none" };
  if (r.status === "waitlisted")
    return { state: band(days, SDOH_AGING_DRAFT.waitlisted), days, band: "waitlisted" };
  return { state: band(days, SDOH_AGING_DRAFT.awaitingOutcome), days, band: "awaitingOutcome" };
}

export function sdohAgingLabel(a: SdohAging): string {
  if (a.state === "closed") return "Closed";
  if (a.days <= 0) return "Active today";
  return `No activity for ${a.days} day${a.days === 1 ? "" : "s"}`;
}
