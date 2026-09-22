// §Referrals Rework Phase 4c — how long a referral has sat without action.
//
// Purely computed from real timestamps already on the record. No new state,
// no background job, nothing stamped: the badge is a read of elapsed time
// since the last real staff action (`contactedAt`, else submission).
//
// THRESHOLD REASONING (draft, deliberately labelled as such on screen):
// neither existing SLA family transfers. Crisis escalation clocks are in
// HOURS because someone is unsafe right now; coverage staleness is in MONTHS
// because Medi-Cal eligibility is a monthly fact. An inbound referral is a
// third thing: the person is usually newly released or newly out of a
// program, and the phone number on the form decays fast — a week is about
// where a reachable number commonly stops being reachable. So: 3 days due,
// 7 days overdue. NOT ratified by Adelante care operations.
import { isReferralClosed, type Referral } from "./ehr";

export const REFERRAL_AGING_DRAFT = {
  dueDays: 3,
  overdueDays: 7,
  label: "Draft threshold — pending care-operations sign-off",
  note:
    "Draft: a referral with no staff action in 3 days reads as due and 7 days as overdue. A newly released person's phone number commonly stops being reachable inside a week. Not yet ratified by care operations.",
} as const;

export type ReferralAgingState = "closed" | "fresh" | "due" | "overdue";

/** The last moment a human did something with this referral. */
export function referralLastActionAt(r: Referral): string {
  return r.contactedAt ?? r.createdAt;
}

export function referralAging(
  r: Referral,
  now: Date = new Date(),
): { state: ReferralAgingState; days: number } {
  const days = Math.floor((+now - +new Date(referralLastActionAt(r))) / 86400_000);
  if (isReferralClosed(r.status)) return { state: "closed", days };
  if (days >= REFERRAL_AGING_DRAFT.overdueDays) return { state: "overdue", days };
  if (days >= REFERRAL_AGING_DRAFT.dueDays) return { state: "due", days };
  return { state: "fresh", days };
}

export function referralAgingLabel(days: number): string {
  if (days <= 0) return "No action yet · today";
  if (days === 1) return "No action for 1 day";
  return `No action for ${days} days`;
}
