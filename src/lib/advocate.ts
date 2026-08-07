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
  | "dhcs_collateral";

export const ADVOCATE_AUTHORIZATION_TYPES: {
  key: AdvocateAuthorizationType;
  label: string;
  /** Patient-safe one-liner shown at claim time. Placeholder wording. */
  summary: string;
}[] = [
  {
    key: "ahcd",
    label: "Advance Health Care Directive (AHCD)",
    summary:
      "Medical power of attorney and living will. Decision-making authority activates only when a physician determines the patient cannot communicate or decide.",
  },
  {
    key: "hipaa_authorization",
    label: "HIPAA Authorization",
    summary:
      "Permission to speak with providers and review records. No decision-making authority.",
  },
  {
    key: "conservatorship",
    label: "Conservatorship",
    summary: "Court-ordered authority, used when the patient lacks capacity and has no AHCD.",
  },
  {
    key: "dhcs_authorized_representative",
    label: "DHCS Authorized Representative (AR)",
    summary:
      "CalAIM / Medi-Cal eligibility and enrollment support. (Placeholder — pending DHCS AR form content.)",
  },
  {
    key: "dhcs_collateral",
    label: "DHCS Collateral",
    summary:
      "CalAIM DMC-ODS treatment-participation role. Requires a signed Release of Information before any access is granted. (Placeholder — pending DHCS Collateral form content.)",
  },
];

/**
 * The permission vocabulary. Declared in full so scope can be widened later by
 * editing ONE table, not by touching every surface.
 *
 * IMPORTANT — as of this pass, `schedule_view` is the ONLY permission granted
 * to ANY authorization type. `care_plan_view`, `clinical_notes_view` and
 * `messaging` exist as names only; nothing grants them, and no surface reads
 * them. Whether they are ever appropriate is Mitch's pending swim-lane role
 * documentation to determine — do not grant one without that.
 */
export type AdvocatePermission =
  | "schedule_view"
  | "care_plan_view"
  | "clinical_notes_view"
  | "messaging";

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
 * Scope genuinely differs by authorization type — this is the table to edit,
 * and the only one. Today every grantable type resolves to the same single
 * permission because that is all that ships; the DIFFERENCE between types is
 * carried by the pre-conditions above it (AHCD activation, Collateral ROI),
 * which are real gates, not labels.
 */
const PERMISSIONS_BY_TYPE: Record<AdvocateAuthorizationType, AdvocatePermission[]> = {
  ahcd: ["schedule_view"],
  hipaa_authorization: ["schedule_view"],
  conservatorship: ["schedule_view"],
  dhcs_authorized_representative: ["schedule_view"],
  dhcs_collateral: ["schedule_view"],
};

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

  // Hard gate: Collateral means zero access until a real, active ROI exists.
  if (type === "dhcs_collateral" && !facts.roiCollateralActive)
    return DENY(
      "roi_missing",
      "Collateral access requires an active signed Release of Information (ROI).",
    );

  // AHCD authority is dormant until a physician activates it.
  if (type === "ahcd" && !facts.ahcdActivated)
    return DENY(
      "ahcd_not_activated",
      "This Advance Health Care Directive is on file but not activated by a physician.",
    );

  const permissions = PERMISSIONS_BY_TYPE[type];
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
