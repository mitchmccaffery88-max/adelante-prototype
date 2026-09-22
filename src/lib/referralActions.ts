// §Referrals Rework Phase 4a — who may move an inbound referral.
//
// Pure policy, deliberately separate from the store so it is testable without
// touching referral data. Before this existed nothing was gated at all: the
// two tracker cards inherited whatever dashboard access the viewer already
// had, which meant a trainee or a peer specialist could have reached an
// action that creates a client record or turns someone away from care.
//
// Two tiers:
//   • "contacted" is logging outreach — anyone with care-coordination write.
//   • "enroll"/"decline" are real dispositions — a narrow, named set.
import { canAccess, type StaffRole } from "./roles";

export type ReferralAction = "contact" | "enroll" | "decline";

/**
 * Roles trusted to accept someone into the program or turn a referral away.
 * Deliberately NOT derived from a record class: no existing class means
 * "referral disposition authority", and widening one to fit would have handed
 * the same authority to every other surface that class gates.
 */
export const REFERRAL_DISPOSITION_ROLES: readonly StaffRole[] = [
  "ecm_provider",
  "cf_care_manager",
  "clinical_coordinator",
];

export const REFERRAL_DECLINE_REASONS = [
  { key: "unable_to_reach", label: "Unable to reach after repeated attempts" },
  { key: "declined_services", label: "Person declined services" },
  { key: "not_eligible", label: "Not eligible for this program" },
  { key: "referred_elsewhere", label: "Referred to a more appropriate provider" },
  { key: "duplicate", label: "Duplicate of an existing referral or client" },
  { key: "other", label: "Other (explain)" },
] as const;

export type ReferralDeclineReason = (typeof REFERRAL_DECLINE_REASONS)[number]["key"];

export function referralDeclineReasonLabel(key: string): string {
  return REFERRAL_DECLINE_REASONS.find((r) => r.key === key)?.label ?? key;
}

/** May this role take this action? Access only — says nothing about state. */
export function canPerformReferralAction(role: StaffRole, action: ReferralAction): boolean {
  if (action === "contact") return canAccess(role, "care_coordination").level === "write";
  return REFERRAL_DISPOSITION_ROLES.includes(role);
}

/** Honest, short explanation for a disabled action. */
export function referralActionDeniedReason(action: ReferralAction): string {
  return action === "contact"
    ? "Logging outreach needs care-coordination write access."
    : "Enrolling or declining a referral is limited to ECM providers, reentry care managers, and clinical coordinators.";
}
