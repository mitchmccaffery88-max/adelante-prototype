// §v3.0 Phase 4 — Advocate / Family Member: PURE ACCESS POLICY.
//
// ARCHITECTURE DECISION (see the response + mem://features/advocate-access):
// an Advocate is deliberately NOT a `StaffRole`. Every StaffRole in
// `roles.ts` encodes a cross-patient, employment-derived caseload: the RBAC
// matrix answers "what may this JOB see, on any patient". An advocate is the
// exact inverse — one external person, invited by ONE patient, scoped to that
// one patient's record, with authority derived from a legal instrument rather
// than a job. Forcing that into the matrix would either (a) leak cross-patient
// reach the moment any surface calls `canAccess(role, class)` without a
// patient, or (b) require a parallel "but only for this patient" qualifier on
// every existing gate. So advocates live in their own entity — `AdvocateLink`
// in `ehr.ts` — with their own narrow, explicitly-enumerated permission set,
// and they never appear in `STAFF_ROLES`, `STAFF_NAV` or the RBAC matrix.
//
// This module is PURE: no store access, no consent lookup, no React. It takes
// facts and returns a decision, so the gate is testable in isolation and
// cannot accidentally grow a side effect. `ehr.ts` supplies the live facts.
//
// LEGAL-CONTENT WARNING: the authorization descriptions below are working
// summaries for UI copy, not legal definitions. Real DHCS AR / Collateral form
// content is Christi's to supply; nothing statutory is invented here.

/** The legal instrument an advocate's access rests on. Never a boolean. */
export type AdvocateAuthorizationType =
  | "ahcd"
  | "hipaa_authorization"
  | "conservatorship"
  | "dhcs_authorized_representative"
  // RENAMED (was `dhcs_collateral`). DHCS research finding: post-CalAIM,
  // "Collateral" is no longer a standing DMC-ODS access category — collateral
  // involvement is folded into whatever service is occurring rather than
  // persisting as a tier. The real-world relationship it modelled (a family
  // member or support person participating in care) still exists, so the type
  // is kept but named for what it is. The hard ROI pre-condition is UNCHANGED:
  // this type still grants zero access without an active `roi_collateral`
  // ConsentRecord.
  | "family_participation";

/**
 * §Phase 4 expansion — two-tier permission model.
 *
 * Types are grouped by what the underlying legal instrument actually grants,
 * not by the original 5-way split:
 *
 * - `decision_making` (AHCD, conservatorship): the instrument confers
 *   authority to DECIDE for the patient. Superset of participation.
 * - `participation` (HIPAA authorization, DHCS AR, family participation):
 *   communication / coordination rights. No medical decision-making authority.
 *   This tier is the FLOOR — every grantable type gets at least this.
 */
export type AdvocateTier = "decision_making" | "participation";

export const ADVOCATE_TIER_BY_TYPE: Record<AdvocateAuthorizationType, AdvocateTier> = {
  ahcd: "decision_making",
  conservatorship: "decision_making",
  hipaa_authorization: "participation",
  dhcs_authorized_representative: "participation",
  family_participation: "participation",
};

export const ADVOCATE_TIER_LABEL: Record<AdvocateTier, string> = {
  decision_making: "Decision-making",
  participation: "Participation & coordination",
};

export const ADVOCATE_AUTHORIZATION_TYPES: {
  key: AdvocateAuthorizationType;
  label: string;
  tier: AdvocateTier;
  /** Patient-safe one-liner shown at claim time. Placeholder wording. */
  summary: string;
}[] = [
  {
    key: "ahcd",
    label: "Advance Health Care Directive (AHCD)",
    tier: "decision_making",
    summary:
      "Medical power of attorney and living will. Decision-making authority activates only when a physician determines the patient cannot communicate or decide.",
  },
  {
    key: "conservatorship",
    label: "Conservatorship",
    tier: "decision_making",
    summary: "Court-ordered authority, used when the patient lacks capacity and has no AHCD.",
  },
  {
    key: "hipaa_authorization",
    label: "HIPAA Authorization",
    tier: "participation",
    summary:
      "Permission to speak with providers, review shared information and help coordinate. No decision-making authority.",
  },
  {
    key: "dhcs_authorized_representative",
    label: "DHCS Authorized Representative (AR)",
    tier: "participation",
    summary:
      "CalAIM / Medi-Cal eligibility and enrollment support, including acting on the member's behalf on an application. (Placeholder — pending DHCS AR form content.)",
  },
  {
    key: "family_participation",
    label: "Family / support-person participation",
    tier: "participation",
    summary:
      "A family member or support person participating in care coordination. Requires a signed Release of Information before any access is granted. (Placeholder — exact participation scope pending Christi's form content.)",
  },
];

/**
 * The permission vocabulary.
 *
 * GRANTED today (see `TIER_PERMISSIONS`):
 *  - `schedule_view`                  upcoming appointments/groups (unchanged)
 *  - `coordination_view` / `_write`   housing / food / transport coordination
 *                                     activity — the existing SDOH
 *                                     (`care_coordination`) infrastructure,
 *                                     not a parallel one.
 *  - `care_plan_participation_view` / `_write`
 *                                     comments and input on the reentry care
 *                                     plan. NOT authorship: the ECM Provider /
 *                                     CF Care Manager still owns every plan
 *                                     field. Advocates append to a separate
 *                                     contribution stream.
 *  - `eligibility_assist_view`        Medi-Cal application / coverage status
 *                                     visibility (the `eligibility`
 *                                     RecordClass workflow, read side).
 *  - `eligibility_assist_write`       submitting/attesting on the member's
 *                                     behalf. Decision-making tier, PLUS the
 *                                     DHCS AR by type addendum — an AR's
 *                                     entire purpose is acting on the
 *                                     application.
 *  - `care_plan_clinical_view`        the clinical care-plan snapshot (goals,
 *                                     focus areas, non-Part-2 problems).
 *                                     Decision-making tier only.
 *
 * NEVER granted, names only: `clinical_notes_view`, `messaging`. Do not grant
 * one without Mitch's swim-lane documentation.
 */
export type AdvocatePermission =
  | "schedule_view"
  | "coordination_view"
  | "coordination_write"
  | "care_plan_participation_view"
  | "care_plan_participation_write"
  | "eligibility_assist_view"
  | "eligibility_assist_write"
  | "care_plan_clinical_view"
  | "clinical_notes_view"
  | "messaging";

/**
 * 42 CFR Part 2 / SUD masking is NOT a tier property and is NOT waivable by
 * any authorization type. Broader general access never implies Part 2 access;
 * that content needs its own explicit gate, exactly as it does for every
 * clinical staff role in this build. No advocate permission exists that lifts
 * it, and this constant exists so a future edit has to argue with it.
 */
export const ADVOCATE_PART2_ALWAYS_MASKED = true as const;

/** True for every advocate, every tier, every authorization type. Always. */
export function advocatePart2Masked(_type?: AdvocateAuthorizationType): boolean {
  return ADVOCATE_PART2_ALWAYS_MASKED;
}

/** Facts the caller must supply. All live-evaluated by the store, never cached. */
export interface AdvocateAccessFacts {
  /** Link lifecycle status from the store. */
  status: "invited" | "active" | "revoked" | "expired";
  /** Set only once the advocate confirms it at claim time. */
  authorizationType?: AdvocateAuthorizationType;
  /**
   * Whether an ACTIVE `roi_collateral` ConsentRecord exists for the patient.
   * Only consulted for the Collateral type — see the hard gate below.
   */
  roiCollateralActive: boolean;
  /**
   * AHCD only: a physician has determined the patient cannot communicate or
   * decide. Until then the directive is on file but dormant.
   */
  ahcdActivated?: boolean;
}

export type AdvocateDenyReason =
  | "no_link"
  | "not_claimed"
  | "revoked"
  | "expired"
  | "authorization_not_confirmed"
  | "roi_missing"
  | "ahcd_not_activated"
  | "permission_not_granted";

export interface AdvocateAccessDecision {
  allowed: boolean;
  permissions: AdvocatePermission[];
  reason: string;
  denyReason?: AdvocateDenyReason;
}

const DENY = (denyReason: AdvocateDenyReason, reason: string): AdvocateAccessDecision => ({
  allowed: false,
  permissions: [],
  reason,
  denyReason,
});

/**
 * Tier grants. `participation` is the floor; `decision_making` is a strict
 * superset — the extra grants are the ones that genuinely need the added legal
 * authority:
 *  - `care_plan_clinical_view`: reading clinical goals/problems is materially
 *    broader PHI than logistics, and is the information a decision-maker needs
 *    to decide. A coordinating family member does not need it to arrange a ride.
 *  - `eligibility_assist_write`: submitting or attesting on a member's behalf
 *    is an act with legal consequence, so it needs an instrument that confers
 *    authority to act — or the DHCS AR addendum below, whose whole purpose is
 *    exactly that act.
 */
const TIER_PERMISSIONS: Record<AdvocateTier, AdvocatePermission[]> = {
  participation: [
    "schedule_view",
    "coordination_view",
    "coordination_write",
    "care_plan_participation_view",
    "care_plan_participation_write",
    "eligibility_assist_view",
  ],
  decision_making: [
    "schedule_view",
    "coordination_view",
    "coordination_write",
    "care_plan_participation_view",
    "care_plan_participation_write",
    "eligibility_assist_view",
    "eligibility_assist_write",
    "care_plan_clinical_view",
  ],
};

/** Type-specific additions on top of the tier floor. */
const TYPE_ADDENDA: Partial<Record<AdvocateAuthorizationType, AdvocatePermission[]>> = {
  dhcs_authorized_representative: ["eligibility_assist_write"],
};

export function advocateTier(type: AdvocateAuthorizationType): AdvocateTier {
  return ADVOCATE_TIER_BY_TYPE[type];
}

export function permissionsForType(type: AdvocateAuthorizationType): AdvocatePermission[] {
  const base = TIER_PERMISSIONS[ADVOCATE_TIER_BY_TYPE[type]];
  const extra = TYPE_ADDENDA[type] ?? [];
  return Array.from(new Set([...base, ...extra]));
}

/** The whole gate. Deny by default; every allow path is explicit. */
export function advocateAccessDecision(facts: AdvocateAccessFacts): AdvocateAccessDecision {
  if (facts.status === "revoked") return DENY("revoked", "This advocate connection was revoked.");
  if (facts.status === "expired")
    return DENY("expired", "This advocate invitation expired before it was claimed.");
  if (facts.status === "invited")
    return DENY("not_claimed", "The invitation has not been claimed yet.");

  const type = facts.authorizationType;
  // An invitation alone grants NOTHING. Both halves are required.
  if (!type)
    return DENY(
      "authorization_not_confirmed",
      "No authorization type has been confirmed for this advocate.",
    );

  // Hard gate (UNCHANGED from the base build): family/collateral participation
  // means zero access until a real, active ROI exists.
  if (type === "family_participation" && !facts.roiCollateralActive)
    return DENY(
      "roi_missing",
      "This access requires an active signed Release of Information (ROI).",
    );

  // AHCD authority is dormant until a physician activates it.
  if (type === "ahcd" && !facts.ahcdActivated)
    return DENY(
      "ahcd_not_activated",
      "This Advance Health Care Directive is on file but not activated by a physician.",
    );

  const permissions = permissionsForType(type);
  if (permissions.length === 0)
    return DENY("permission_not_granted", "This authorization type grants no access today.");

  return { allowed: true, permissions, reason: "Authorized advocate access." };
}

/** Convenience: does this advocate hold one specific permission right now? */
export function advocateHasPermission(
  facts: AdvocateAccessFacts,
  permission: AdvocatePermission,
): boolean {
  const d = advocateAccessDecision(facts);
  return d.allowed && d.permissions.includes(permission);
}
