// §v3.0 Phase 2 — AB 133 exemption vs. explicit-consent disclosure.
//
// These are TWO GENUINELY DIFFERENT CODE PATHS, not one gate with two labels:
//
//  - `ab133CoordinationAccess()` never touches the consent ledger at all. It
//    resolves purely from (dataset x actor role x recipient role). There is no
//    call to `isConsentCategoryAuthorized`, no ConsentRecord lookup, and no
//    `canAccess(..., "consent_gated")` branch anywhere beneath it — which is
//    the property `ab133.test.ts` asserts by spying on the ledger.
//
//  - `disclosureAccess()` is the consent path. It requires a live, active
//    ConsentRecord authorization for the relevant category and denies by
//    default, including for the same actors AB 133 exempts.
//
// The split is deliberate: AB 133 permits basic data sharing WITHOUT consent
// for enrollment coordination itself. Everything else — third-party
// disclosure, and any 42 CFR Part 2 SUD content — still requires explicit
// written authorization.
//
// LEGAL-CONTENT WARNING: the dataset list below is a working placeholder set
// modelled on what enrollment coordination plainly requires. The authoritative
// scope of the AB 133 exemption is Christi's to confirm; nothing statutory is
// invented here.
import { AdelanteEHR, type ConsentCategory } from "./ehr";
import type { StaffRole } from "./roles";

/** Data elements AB 133 permits sharing for enrollment coordination itself. */
export type CoordinationDataset =
  | "identity"
  | "medi_cal_eligibility"
  | "release_logistics"
  | "reentry_care_plan"
  | "appointment_logistics";

export const AB133_EXEMPT_DATASETS: CoordinationDataset[] = [
  "identity",
  "medi_cal_eligibility",
  "release_logistics",
  "reentry_care_plan",
  "appointment_logistics",
];

/**
 * Parties inside the enrollment-coordination relationship. Anyone outside this
 * set is a third party by definition and falls to `disclosureAccess()`.
 */
export const COORDINATION_PARTY_ROLES: StaffRole[] = [
  "cf_care_manager",
  "ecm_provider",
  "sys_admin",
];

export type AccessGate = "ab133_exemption" | "consent_record";

export interface CoordinationDecision {
  allowed: boolean;
  /** Which mechanism decided. Distinct values = distinct paths. */
  gate: AccessGate;
  /** True only on the AB 133 path — no consent record was consulted. */
  consentChecked: boolean;
  reason: string;
}

/**
 * AB 133 path. Consent is NOT consulted; do not add a ledger call here.
 *
 * Scope guard: SUD/Part 2 content is not a coordination dataset and cannot be
 * requested through this function — the type won't allow it, and the runtime
 * check below refuses anything not on the exempt list.
 */
export function ab133CoordinationAccess(input: {
  dataset: CoordinationDataset;
  actorRole: StaffRole;
  recipientRole: StaffRole;
}): CoordinationDecision {
  const { dataset, actorRole, recipientRole } = input;
  if (!AB133_EXEMPT_DATASETS.includes(dataset))
    return {
      allowed: false,
      gate: "ab133_exemption",
      consentChecked: false,
      reason: `${dataset} is outside the AB 133 enrollment-coordination exemption.`,
    };
  const bothParties =
    COORDINATION_PARTY_ROLES.includes(actorRole) && COORDINATION_PARTY_ROLES.includes(recipientRole);
  if (!bothParties)
    return {
      allowed: false,
      gate: "ab133_exemption",
      consentChecked: false,
      reason:
        "AB 133 covers coordination between the correctional facility care manager and the receiving ECM Provider only — this is a third-party disclosure.",
    };
  return {
    allowed: true,
    gate: "ab133_exemption",
    consentChecked: false,
    reason: "AB 133 — enrollment coordination; no member consent required.",
  };
}

export type DisclosureKind = "third_party" | "part2_sud";

/**
 * Consent path. Denies by default; requires a live authorization in the
 * structured ConsentRecord ledger (which is itself evaluated fresh on every
 * call, so revocation and expiry stop access immediately).
 */
export function disclosureAccess(input: {
  patientId: string;
  kind: DisclosureKind;
  actorRole: StaffRole;
  /** For audit context only — never affects the decision. */
  recipientDescription?: string;
  at?: Date;
}): CoordinationDecision {
  const category: ConsentCategory =
    input.kind === "part2_sud" ? "sud_treatment" : "information_sharing_disclosure";
  const authorized = AdelanteEHR.isConsentCategoryAuthorized(
    input.patientId,
    category,
    input.at ?? new Date(),
  );
  if (!authorized)
    return {
      allowed: false,
      gate: "consent_record",
      consentChecked: true,
      reason:
        input.kind === "part2_sud"
          ? "42 CFR Part 2 — signed authorization required before SUD content may be disclosed."
          : "Third-party disclosure requires a signed Information Sharing / Disclosure Authorization.",
    };
  return {
    allowed: true,
    gate: "consent_record",
    consentChecked: true,
    reason: `Authorized by the active consent record (${category}).`,
  };
}

/**
 * Convenience router for callers that hold a mixed payload. It picks a path;
 * it does not merge them — each branch returns the decision of the mechanism
 * that actually applies.
 */
export function reentryShareDecision(input: {
  patientId: string;
  actorRole: StaffRole;
  recipientRole: StaffRole;
  dataset?: CoordinationDataset;
  disclosure?: DisclosureKind;
}): CoordinationDecision {
  if (input.disclosure)
    return disclosureAccess({
      patientId: input.patientId,
      kind: input.disclosure,
      actorRole: input.actorRole,
    });
  if (input.dataset)
    return ab133CoordinationAccess({
      dataset: input.dataset,
      actorRole: input.actorRole,
      recipientRole: input.recipientRole,
    });
  return {
    allowed: false,
    gate: "consent_record",
    consentChecked: false,
    reason: "Nothing requested.",
  };
}
