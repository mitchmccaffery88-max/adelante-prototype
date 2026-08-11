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
 * §Adelante Journey Phase 4.1 — FOUR-TIER legal-authority model.
 *
 * This REPLACES the earlier two-tier (`participation` / `decision_making`)
 * split. The old split grouped by "does the instrument confer decision
 * authority"; that collapsed two genuinely different legal instruments (a
 * HIPAA authorization and a DHCS Authorized Representative designation) into
 * one tier even though their permitted actions barely overlap, and it made
 * SUD/Part 2 access look like a function of tier depth. Both are now fixed:
 * the tier ladder is the GENERAL authority axis, and Part 2 access is a
 * SEPARATE axis (see `ADVOCATE_SUD_MODE_BY_TIER`) that is not monotonic in it.
 *
 * - `hipaa_only`               view clinical records / care plan / diagnostic
 *                              info, request copies, talk to providers. No
 *                              MCP or enrollment action, no care-plan
 *                              signature, no consent to treatment.
 * - `authorized_representative` sign/submit Medi-Cal applications, select or
 *                              change an MCP, file eligibility appeals and
 *                              grievances. CATEGORICALLY barred from clinical
 *                              and SUD content — a HARDER restriction than
 *                              hipaa_only, not a softer one.
 * - `ahcd_agent`               full clinical file, signs/authorizes the care
 *                              plan, consents to or refuses treatment,
 *                              directs placement. Dormant until activated.
 * - `conservator`              broadest. Requires certified court documents on
 *                              file as a real precondition, not a grant.
 *
 * LEGAL-CONTENT WARNING (unchanged): working summaries for UI copy, not legal
 * definitions.
 */
export type AdvocateTier =
  | "hipaa_only"
  | "authorized_representative"
  | "ahcd_agent"
  | "conservator";

export const ADVOCATE_TIER_BY_TYPE: Record<AdvocateAuthorizationType, AdvocateTier> = {
  ahcd: "ahcd_agent",
  conservatorship: "conservator",
  hipaa_authorization: "hipaa_only",
  dhcs_authorized_representative: "authorized_representative",
  // A family/support person participating in care holds no legal instrument
  // beyond the ROI they must already have; they sit at the read-only floor.
  family_participation: "hipaa_only",
};

export const ADVOCATE_TIER_LABEL: Record<AdvocateTier, string> = {
  hipaa_only: "HIPAA authorization (view only)",
  authorized_representative: "Authorized Representative (enrollment)",
  ahcd_agent: "Activated AHCD agent",
  conservator: "Legal conservator",
};

/**
 * §6.2 — SUD / 42 CFR Part 2 access is its OWN axis.
 *
 * Deliberately NOT derived from the general tier ladder: `authorized_
 * representative` sits ABOVE `hipaa_only` on the general axis and BELOW it
 * here. An AR's authority is eligibility and enrollment; clinical — and
 * especially Part 2 — content is outside its scope entirely, so no consent
 * artifact unlocks it.
 */
export type AdvocateSudAccessMode =
  /** The existing `advocate_sud_disclosure` consent-conditional gate, unchanged. */
  | "consent_conditional"
  /** No path to access. Consent is not consulted, because it cannot help. */
  | "categorically_barred"
  /** Access follows from the legal instrument itself. See the note below. */
  | "authority_derived";

/**
 * AHCD / conservator = `authority_derived`, NOT "activation writes a consent
 * record".
 *
 * The choice: an activated AHCD agent (and a conservator) holds, in the real
 * world, the authority to sign the ASCMI/Part 2 disclosure form ON the
 * client's behalf. Two ways to model that were available:
 *   (a) programmatically mint an `advocate_sud_disclosure` ConsentRecord at
 *       activation, or
 *   (b) let the gate resolve on the instrument and leave the ledger alone.
 * (b) is implemented. The consent ledger in this build is a record of what a
 * PERSON SIGNED; auto-writing a row into it would put an unsigned artifact
 * next to signed ones and make the audit trail lie about provenance — and it
 * would then be revocable by a patient-facing toggle, which is exactly the
 * two-tier confusion Phase 3 just removed for PO disclosure. So access is
 * decided from the instrument, and the audit row records
 * `sudBasis: "authority_derived"` so a reader can always tell the two apart.
 */
export const ADVOCATE_SUD_MODE_BY_TIER: Record<AdvocateTier, AdvocateSudAccessMode> = {
  hipaa_only: "consent_conditional",
  authorized_representative: "categorically_barred",
  ahcd_agent: "authority_derived",
  conservator: "authority_derived",
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
    tier: "ahcd_agent",
    summary:
      "Medical power of attorney and living will. Decision-making authority activates only when a physician determines the patient cannot communicate or decide.",
  },
  {
    key: "conservatorship",
    label: "Conservatorship",
    tier: "conservator",
    summary: "Court-ordered authority, used when the patient lacks capacity and has no AHCD.",
  },
  {
    key: "hipaa_authorization",
    label: "HIPAA Authorization",
    tier: "hipaa_only",
    summary:
      "Permission to speak with providers, review shared information and help coordinate. No decision-making authority.",
  },
  {
    key: "dhcs_authorized_representative",
    label: "DHCS Authorized Representative (AR)",
    tier: "authorized_representative",
    summary:
      "CalAIM / Medi-Cal eligibility and enrollment support, including acting on the member's behalf on an application. (Placeholder — pending DHCS AR form content.)",
  },
  {
    key: "family_participation",
    label: "Family / support-person participation",
    tier: "hipaa_only",
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
  // §v3.0 Phase 5 — documents. Uploading and reviewing a patient's own
  // paperwork is the SAME category of supportive access Phase 4 already
  // granted for coordination and care-plan participation, so both tiers hold
  // it and no new authorization tier was introduced. Part 2 documents are
  // gated separately by the `advocate_sud_disclosure` consent, exactly as SUD
  // group topics are — a permission never lifts Part 2 masking.
  | "document_view"
  | "document_upload"
  | "clinical_notes_view"
  | "messaging";

/**
 * 42 CFR Part 2 / SUD masking is NOT a tier property and is NOT waivable by
 * any authorization type. Broader general access never implies Part 2 access;
 * that content needs its own explicit gate, exactly as it does for every
 * clinical staff role in this build. No advocate permission exists that lifts
 * it, and this constant exists so a future edit has to argue with it.
 *
 * The ONE exception, added deliberately and narrowly: a patient-signed Part 2
 * disclosure authorization naming advocate disclosure
 * (`advocate_sud_disclosure`). That is a consent artifact, not a permission —
 * it is checked per-patient at read time, IN ADDITION TO the advocate's own
 * authorization gate, and it never becomes a property of a tier or a link.
 * Absent that active consent, this default stands.
 */
export const ADVOCATE_PART2_ALWAYS_MASKED = true as const;

/**
 * PLACEHOLDER ASCMI category, same discipline as every other one in this
 * build: the real DHCS / 42 CFR Part 2 disclosure-authorization language is
 * Christi's to supply. The GATE is real even though the content is not.
 */
export const ADVOCATE_SUD_DISCLOSURE_CATEGORY = "advocate_sud_disclosure" as const;

/**
 * Masked unless BOTH are true: the advocate's own link is currently valid,
 * AND an active `advocate_sud_disclosure` ConsentRecord exists for THAT
 * patient. Neither alone is sufficient. Called with no options (or with only
 * an authorization type) it returns the unconditional default — so every
 * caller that has not been taught about the exception stays masked.
 */
export function advocatePart2Masked(
  _type?: AdvocateAuthorizationType,
  facts?: { linkValid: boolean; sudDisclosureConsentActive: boolean },
): boolean {
  if (!facts) return ADVOCATE_PART2_ALWAYS_MASKED;
  return !(facts.linkValid && facts.sudDisclosureConsentActive);
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
    "document_view",
    "document_upload",
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
    "document_view",
    "document_upload",
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
