// §Referrals Rework Phase 4e — real manual-outreach work on a referral.
//
// Pure policy + derivation, deliberately separate from the store so every
// threshold is testable without touching referral data.
//
// Why this is NOT a `CaseTask`: every `CaseTask` consumer dereferences
// `patientId` (the worklist row links to /record/$patientId, the CM queue and
// personal worklist look the patient up by name). A referral has no patient
// record until enrollment, so a referral task routed through `CaseTask` would
// render a nameless row with a dead link on two existing pages. The shape
// below mirrors `CaseTask` semantics — role pool, individual claim, open/done,
// attribution — on the record the work actually belongs to.
import type { ReferralActor } from "./ehr";
import { canAccess, type StaffRole } from "./roles";

export const REFERRAL_OUTREACH_OUTCOMES = [
  { key: "no_answer", label: "Called — no answer", dead: false },
  { key: "left_message", label: "Left a message", dead: false },
  { key: "wrong_number", label: "Wrong number", dead: true },
  { key: "disconnected", label: "Number disconnected", dead: true },
  { key: "reached", label: "Reached the person", dead: false },
] as const;

export type ReferralOutreachOutcome = (typeof REFERRAL_OUTREACH_OUTCOMES)[number]["key"];

export function referralOutreachOutcomeLabel(key: string): string {
  return REFERRAL_OUTREACH_OUTCOMES.find((o) => o.key === key)?.label ?? key;
}

function isDeadOutcome(key: string): boolean {
  return REFERRAL_OUTREACH_OUTCOMES.find((o) => o.key === key)?.dead === true;
}

export interface ReferralOutreachAttempt {
  id: string;
  at: string;
  outcome: ReferralOutreachOutcome;
  note?: string;
  by: ReferralActor;
}

export interface ReferralOutreachTask {
  /** Why this work exists — honest, and shown on screen. */
  reason: "no_phone" | "no_consent";
  createdAt: string;
  dueDate: string;
  status: "open" | "done";
  /** Role pool, mirroring `CaseTask.allowedRoles`: nobody owns a referral yet. */
  allowedRoles: StaffRole[];
  claimedBy?: ReferralActor;
  claimedAt?: string;
  completedAt?: string;
  completedBy?: ReferralActor;
}

export interface ReferralOutreachState {
  task?: ReferralOutreachTask;
  attempts: ReferralOutreachAttempt[];
}

/**
 * Draft threshold, unratified — labelled as such everywhere it is shown, the
 * same honesty pattern as the Phase 4c aging badge.
 *
 * Two unanswered calls is roughly a working day of tries, and the referrer's
 * own number is still fresh at that point. A *dead* outcome (wrong number,
 * disconnected) proves the contact path is gone rather than merely unanswered,
 * so it escalates immediately rather than waiting out the count.
 */
export const OUTREACH_FALLBACK_DRAFT = {
  unansweredAttempts: 2,
  label: "Draft threshold — pending care-operations sign-off",
  note: "After 2 unanswered attempts — or immediately if no phone was given, or a number turns out to be wrong or disconnected — staff are pointed to the referrer for updated contact details.",
} as const;

/** Any role that may log outreach may also claim the work. */
export function canWorkReferralOutreach(role: StaffRole): boolean {
  return canAccess(role, "care_coordination").level === "write";
}

type OutreachShapedReferral = {
  phone?: string;
  consentToContact?: boolean;
  status?: string;
  outreach?: ReferralOutreachState;
  referrerPhone?: string;
  referrerEmail?: string;
};

/** Should a real outreach task exist for a referral in this shape? */
export function referralNeedsOutreachTask(r: {
  phone?: string;
  consentToContact: boolean;
}): ReferralOutreachTask["reason"] | undefined {
  if (!r.phone) return "no_phone";
  if (!r.consentToContact) return "no_consent";
  return undefined;
}

export interface ReferrerFallback {
  due: boolean;
  reason?: "no_phone" | "dead_number" | "unanswered";
  explanation?: string;
  /**
   * A fallback WOULD be due, but the referrer has no phone or email on file
   * (legacy data) — there is no one to fall back on. Never recommend it.
   */
  referrerUnreachable?: boolean;
}

export const NO_REFERRER_CONTACT_NOTE =
  "No contact details for the referrer are on file — there is no one to fall back on. Continue outreach to the person directly.";

export function referrerHasContact(r: { referrerPhone?: string; referrerEmail?: string }): boolean {
  return !!(r.referrerPhone?.trim() || r.referrerEmail?.trim());
}

/**
 * Should staff be pointed at the REFERRER for updated contact details?
 * Closed referrals (enrolled/declined) never prompt. Suppressed (with
 * `referrerUnreachable`) when the referrer has no contact info on file.
 */
export function needsReferrerFallback(r: OutreachShapedReferral): ReferrerFallback {
  const f = fallbackTrigger(r);
  if (f.due && !referrerHasContact(r)) return { ...f, due: false, referrerUnreachable: true };
  return f;
}

function fallbackTrigger(r: OutreachShapedReferral): ReferrerFallback {
  if (r.status === "enrolled" || r.status === "declined") return { due: false };
  const attempts = r.outreach?.attempts ?? [];
  if (attempts.some((a) => a.outcome === "reached")) return { due: false };
  if (attempts.some((a) => isDeadOutcome(a.outcome))) {
    return {
      due: true,
      reason: "dead_number",
      explanation: "The number on file is wrong or disconnected — there is no working contact path for this person.",
    };
  }
  if (!r.phone) {
    return {
      due: true,
      reason: "no_phone",
      explanation: "No phone number was given for this person, so there is no way to reach them directly.",
    };
  }
  const unanswered = attempts.filter((a) => !isDeadOutcome(a.outcome) && a.outcome !== "reached").length;
  if (unanswered >= OUTREACH_FALLBACK_DRAFT.unansweredAttempts) {
    return {
      due: true,
      reason: "unanswered",
      explanation: `${unanswered} attempts have gone unanswered.`,
    };
  }
  return { due: false };
}

/** True when this referral has open manual-outreach work. */
export function hasOpenOutreachTask(r: OutreachShapedReferral): boolean {
  return r.outreach?.task?.status === "open";
}
