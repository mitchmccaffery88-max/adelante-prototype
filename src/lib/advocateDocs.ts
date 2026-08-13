// §Advocate dashboard build 1 — consent-documentation requirements, PURE.
//
// Same discipline as `advocate.ts`: facts in, definitions out. No store
// access, no React. The store records STATE against these keys; this module
// owns only what each advocate type must have on file and how it is described
// in plain language to the person being asked for it.
//
// LEGAL-CONTENT WARNING: the descriptions are working plain-language summaries
// for UI copy, not legal definitions. Real DHCS AR (MC 382 / MC 383) and ROI
// form content is Christi's to supply; nothing statutory is invented here.
//
// NOTE ON SCOPE: recording/attesting a requirement does NOT widen access.
// `TIER_PERMISSIONS` in `advocate.ts` is untouched by this build — these rows
// are the paperwork trail staff work, not a permission grant.
import type { AdvocateAuthorizationType } from "./advocate";

export type AdvocateDocRequirementKey =
  | "hipaa_roi"
  | "dhcs_ar_designation"
  | "ahcd_document"
  | "ahcd_clinician_activation"
  | "conservatorship_order"
  | "collateral_roi";

export type AdvocateDocRequirementStatus =
  /** Nothing yet — the advocate has not attested and staff have not verified. */
  | "pending"
  /** The advocate checked the box saying the document exists / is being sent. */
  | "attested"
  /** Staff confirmed the real document is on file. */
  | "verified";

export interface AdvocateDocRequirementDef {
  key: AdvocateDocRequirementKey;
  label: string;
  /** Plain-language: what this document is and what it lets the advocate do. */
  plainLanguage: string;
  /** What the advocate is being asked to confirm at claim time. */
  attestation: string;
  /**
   * True when the requirement can only be satisfied by staff/clinician action
   * — the advocate cannot check it off themselves.
   */
  staffOnly?: boolean;
}

export const ADVOCATE_DOC_REQUIREMENTS: Record<
  AdvocateDocRequirementKey,
  AdvocateDocRequirementDef
> = {
  hipaa_roi: {
    key: "hipaa_roi",
    label: "Signed HIPAA Release of Information",
    plainLanguage:
      "A form the person you're supporting signs to say we may share their health information with you. It lets you talk with the care team and see what they've chosen to share. It does not let you make decisions for them.",
    attestation:
      "A signed HIPAA release naming me is on file, or is being sent to the care team.",
  },
  dhcs_ar_designation: {
    key: "dhcs_ar_designation",
    label: "DHCS Authorized Representative designation (MC 382 / MC 383)",
    plainLanguage:
      "The Medi-Cal form that names you as an Authorized Representative. It lets you help with the Medi-Cal application, enrollment, plan choice and appeals. It does not give you access to clinical or substance-use information.",
    attestation:
      "A completed MC 382 or MC 383 naming me as Authorized Representative is on file, or is being sent to the care team.",
  },
  ahcd_document: {
    key: "ahcd_document",
    label: "Advance Health Care Directive naming you as agent",
    plainLanguage:
      "The signed directive that names you as the health care agent. It has to be on file and checked before it can be used.",
    attestation: "The signed directive naming me as agent is on file, or is being sent in.",
  },
  ahcd_clinician_activation: {
    key: "ahcd_clinician_activation",
    label: "Clinician determination that the directive is active",
    plainLanguage:
      "A directive only starts working when a clinician determines the person cannot communicate or make their own decisions. Until then it stays dormant, whatever the paperwork says.",
    attestation: "Recorded by a clinician — nothing for you to do here.",
    staffOnly: true,
  },
  conservatorship_order: {
    key: "conservatorship_order",
    label: "Certified conservatorship court order",
    plainLanguage:
      "The certified court order appointing you as conservator. Staff verify the certified copy before any access opens.",
    attestation: "Verified by staff against the certified copy.",
    staffOnly: true,
  },
  collateral_roi: {
    key: "collateral_roi",
    label: "Release of Information for family / support participation",
    plainLanguage:
      "A release the person you're supporting signs before a family member or support person can take part in care coordination. Without it, nothing is shared.",
    attestation: "A signed release naming me is on file, or is being sent to the care team.",
  },
};

/** Which requirements apply to each legal instrument. Order is display order. */
export const ADVOCATE_DOCS_BY_TYPE: Record<
  AdvocateAuthorizationType,
  AdvocateDocRequirementKey[]
> = {
  hipaa_authorization: ["hipaa_roi"],
  dhcs_authorized_representative: ["dhcs_ar_designation"],
  ahcd: ["ahcd_document", "ahcd_clinician_activation"],
  conservatorship: ["conservatorship_order"],
  family_participation: ["collateral_roi"],
};

export function requirementsForType(
  type: AdvocateAuthorizationType,
): AdvocateDocRequirementDef[] {
  return ADVOCATE_DOCS_BY_TYPE[type].map((k) => ADVOCATE_DOC_REQUIREMENTS[k]);
}
