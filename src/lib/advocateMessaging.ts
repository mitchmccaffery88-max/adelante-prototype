// §Advocate build 3 — advocate ↔ care-team messaging: the REVIEW GATE and the
// communication-rights axis. PURE: no store access, no React.
//
// TWO SEPARATE THINGS LIVE HERE and they must not be confused:
//
// 1. ADVOCATE_MESSAGING_REVIEW — the clinical sign-off flag, the same real
//    pattern as `SAFETY_CONTENT_REVIEW` in `safetyContent.ts`. The whole
//    feature is BUILT and testable, but while `pending` is true no advocate
//    can actually send or receive: the store refuses the write and the UI
//    renders the pending-review notice instead of the live thread. Flipping
//    `pending` to false (one edit, here) is the only thing needed to go live.
//    Do NOT clear it in code without Christi / Dr. Bagga sign-off.
//
// 2. Communication rights — a REAL authorization axis, independent of the
//    tier permission model and independent of Part 2. Holding a HIPAA
//    authorization, or being a Medi-Cal Authorized Representative, does not by
//    itself authorise two-way correspondence with the care team: general AR
//    scope is eligibility and enrollment. So this axis is satisfied only by a
//    staff-VERIFIED document row that specifically carries communication
//    rights (see `COMMUNICATION_RIGHTS_REQUIREMENT_KEYS`).
import {
  ADVOCATE_DOC_REQUIREMENTS,
  COMMUNICATION_RIGHTS_REQUIREMENT_KEYS,
  type AdvocateDocRequirementKey,
  type AdvocateDocRequirementStatus,
} from "./advocateDocs";

export const ADVOCATE_MESSAGING_REVIEW = {
  pending: true,
  reviewers: "Christi / Dr. Bagga",
  scope:
    "Advocate ↔ care-team messaging. The feature is fully built and audited, including 42 CFR Part 2 masking and the communication-rights authorization axis, but no message can be sent or delivered to a real advocate until this review clears.",
  notice:
    "Pending clinical review by Christi / Dr. Bagga. Messaging with advocates is built but not switched on — nothing sent here would reach the care team.",
} as const;

export interface AdvocateCommunicationRightsDecision {
  granted: boolean;
  /** The verified instrument that granted it, when granted. */
  basis?: AdvocateDocRequirementKey;
  /** Rows on this link that could grant it but are not verified yet. */
  pending: AdvocateDocRequirementKey[];
  reason: string;
}

/**
 * Deny by default. Requires BOTH the advocate's own live access decision AND
 * one verified communication-rights document. Neither alone is enough.
 */
export function advocateCommunicationRightsDecision(input: {
  accessAllowed: boolean;
  accessReason: string;
  rows: { key: AdvocateDocRequirementKey; status: AdvocateDocRequirementStatus }[];
}): AdvocateCommunicationRightsDecision {
  const relevant = input.rows.filter((r) =>
    (COMMUNICATION_RIGHTS_REQUIREMENT_KEYS as readonly string[]).includes(r.key),
  );
  const verified = relevant.find((r) => r.status === "verified");
  const pending = relevant.filter((r) => r.status !== "verified").map((r) => r.key);
  if (!input.accessAllowed)
    return { granted: false, pending, reason: input.accessReason };
  if (!verified)
    return {
      granted: false,
      pending,
      reason:
        "Messaging needs a document that specifically grants communication rights — a HIPAA release covering two-way communication, a valid power of attorney, or an Authorized Representative designation where communication rights were granted. None is verified yet.",
    };
  return {
    granted: true,
    basis: verified.key,
    pending,
    reason: `Communication rights verified: ${ADVOCATE_DOC_REQUIREMENTS[verified.key].label}.`,
  };
}
