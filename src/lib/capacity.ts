// §CF Care Manager pre-release intake — capacity / legal-authority policy.
//
// PURE module, same posture as `advocate.ts`: no store access, no React. It
// takes facts and returns a decision so the gate is testable in isolation.
//
// WHY THIS EXISTS AS A SEPARATE, EARLY STEP
// The DHCS pre-release workflow branches on ONE question before anything
// consent-dependent can honestly happen: can this individual participate in
// and consent to their own intake right now? Everything downstream — SUD
// level-of-care screening, informed consent for pre-release services,
// telehealth consent, information-sharing authorization — assumes an answer.
// Leaving it implicit means the system silently proceeds "as though the person
// consented themselves", which is the exact failure this module closes.
//
// It deliberately does NOT re-implement any part of the four-tier advocate
// model or the AHCD activation/validation checklist. When capacity is
// impaired, the surrogate question is answered ENTIRELY by
// `advocateAccessDecision` + `ahcdValidationState` + `activateAdvocateAhcd`
// in their existing form; this module only asks "is a legal-authority
// instrument in force yet, or merely identified?".

/** The real DHCS branch point. Two impaired variants, one meaning. */
export type IntakeCapacityStatus = "competent" | "impaired" | "unresponsive";

export const INTAKE_CAPACITY_OPTIONS: {
  key: IntakeCapacityStatus;
  label: string;
  detail: string;
}[] = [
  {
    key: "competent",
    label: "Able to participate and consent",
    detail:
      "The individual understands the intake, can answer for themselves, and can sign their own consents.",
  },
  {
    key: "impaired",
    label: "Impaired — cannot consent for themselves right now",
    detail:
      "Cognitive, psychiatric or medical impairment prevents informed participation. A legal-authority instrument is required before consent-dependent steps.",
  },
  {
    key: "unresponsive",
    label: "Unresponsive / unable to be interviewed",
    detail:
      "The individual cannot be interviewed at all. Treated identically to impaired for authority purposes.",
  },
];

export const CAPACITY_LABEL: Record<IntakeCapacityStatus, string> = {
  competent: "Able to consent",
  impaired: "Impaired",
  unresponsive: "Unresponsive",
};

/** Impaired and unresponsive branch the same way. One predicate, used everywhere. */
export function capacityRequiresSurrogate(status: IntakeCapacityStatus): boolean {
  return status === "impaired" || status === "unresponsive";
}

/**
 * The two legal instruments that can answer for someone who cannot consent.
 * Mirrors `AdvocateAuthorizationType` values 1:1 — no parallel vocabulary.
 */
export const LEGAL_AUTHORITY_TYPES = ["ahcd", "conservatorship"] as const;
export type LegalAuthorityType = (typeof LEGAL_AUTHORITY_TYPES)[number];

export interface CapacityAuthorityFacts {
  /** Undefined until a CF Care Manager records the determination. */
  capacity?: IntakeCapacityStatus;
  /**
   * A legal-authority advocate whose authority is IN FORCE right now —
   * `advocateAccess(link).allowed` for an `ahcd` (activated) or
   * `conservatorship` (certified docs on file) link. Computed by the store
   * from the existing gate; never re-derived here.
   */
  legalAuthorityActive: boolean;
  /**
   * A legal-authority advocate has been identified and invited, but the
   * instrument is not in force yet (unclaimed invitation, dormant directive,
   * missing court documents).
   */
  legalAuthorityPending: boolean;
}

export type CapacityGateState =
  | "not_determined"
  | "self_consent"
  | "surrogate_active"
  | "surrogate_pending"
  | "no_authority";

export interface CapacityGateDecision {
  /** May a consent-dependent intake step proceed right now? */
  canProceed: boolean;
  state: CapacityGateState;
  /** True whenever consent must come from someone other than the individual. */
  requiresSurrogate: boolean;
  reason: string;
}

/**
 * PURE. The one rule every consent-dependent pre-release step consults.
 *
 * "Not determined" is a BLOCK, not a pass. That is the point of making the
 * step required: an unanswered capacity question must not read as consent.
 */
export function capacityGateDecision(facts: CapacityAuthorityFacts): CapacityGateDecision {
  if (!facts.capacity)
    return {
      canProceed: false,
      state: "not_determined",
      requiresSurrogate: false,
      reason:
        "Capacity has not been determined yet. Complete the capacity & legal-authority step before any consent-dependent step.",
    };

  if (!capacityRequiresSurrogate(facts.capacity))
    return {
      canProceed: true,
      state: "self_consent",
      requiresSurrogate: false,
      reason: "The individual can participate in and consent to their own intake.",
    };

  if (facts.legalAuthorityActive)
    return {
      canProceed: true,
      state: "surrogate_active",
      requiresSurrogate: true,
      reason:
        "A legal-authority advocate is in force and may act on the individual's behalf for consent-dependent steps.",
    };

  if (facts.legalAuthorityPending)
    return {
      canProceed: false,
      state: "surrogate_pending",
      requiresSurrogate: true,
      reason:
        "A legal-authority advocate has been identified but their authority is not in force yet — the AHCD validation checklist and clinician determination (or certified conservatorship documents) must be completed first.",
    };

  return {
    canProceed: false,
    state: "no_authority",
    requiresSurrogate: true,
    reason:
      "The individual cannot consent for themselves and no AHCD or conservatorship documentation is on file. Locate the directive or court order before any consent-dependent step.",
  };
}

export const CAPACITY_GATE_BADGE: Record<CapacityGateState, string> = {
  not_determined: "Capacity not determined",
  self_consent: "Self-consent",
  surrogate_active: "Surrogate authority active",
  surrogate_pending: "Awaiting legal authority",
  no_authority: "Blocked — no legal authority",
};
