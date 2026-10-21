// §B2-1 — consent record model extension (additive only). Types and pure
// validation for the extended ConsentRecord fields. Nothing here is wired into
// any access gate yet (that is B2-4). Draft — pending counsel.

export type ConsentType =
  | "part2_tpo_single"
  | "part2_specific_written"
  | "counseling_notes_release"
  | "hipaa_authorization"
  | "referrer_authorization"
  | "advocate_release"
  | "legal_part2_disclosure"
  | "po_voluntary_coordination"
  | "telehealth"
  | "group_confidentiality"
  | "ai_recording"
  | "sms_reminder"
  | "portal_reminder";

/** Types that carry 42 CFR Part 2 SUD information. */
export const PART2_CONSENT_TYPES: readonly ConsentType[] = [
  "part2_tpo_single",
  "part2_specific_written",
  "counseling_notes_release",
  "legal_part2_disclosure",
  "advocate_release",
];

/** Mitch's rule: verbal assent covers ONLY these types. */
export const VERBAL_ASSENT_TYPES: readonly ConsentType[] = ["referrer_authorization", "sms_reminder", "portal_reminder"];
/** referrer_authorization verbal assent covers only the "enrolled" update. */
export const VERBAL_ASSENT_REFERRER_PURPOSE = "enrolled_update";

export type ConsentSignatureMethod = "e_sign" | "wet_sign_upload" | "verbal_assent";

export interface ConsentRecipient {
  kind: "person" | "org";
  name: string;
  /** Directory reference (community resource / org / staff id) where one exists. */
  directoryRef?: string;
}

export interface ConsentSignature {
  method: ConsentSignatureMethod;
  signer: string;
  relationship: "patient" | "guardian" | "proxy";
  signedAt: string;
  recordedAt: string;
  recordedBy: { staffId?: string; staffName: string; role: string };
  witness?: string;
}

export interface ConsentDocumentRef {
  formKey: string;
  versionId: string;
  version: number;
  documentHash: string;
  uploadRef?: string;
}

export interface ConsentRevocation {
  by: string;
  at: string;
  method: "portal" | "in_person" | "phone" | "written";
  reason: string;
  onBehalfOfPatient: boolean;
}

/** 42 CFR 2.31 required elements. Draft — pending counsel. */
export const PART2_ELEMENT_KEYS = [
  "patientName",
  "recipients",
  "amountAndKind",
  "purpose",
  "rightToRevoke",
  "expiration",
  "signatureAndDate",
  "redisclosureNotice",
] as const;
export type Part2ElementKey = (typeof PART2_ELEMENT_KEYS)[number];
export type Part2Elements = Partial<Record<Part2ElementKey, boolean>>;

export const PART2_CHECKLIST_DRAFT_LABEL = "Draft — pending counsel";
export const PART2_ELEMENT_LABELS: Record<Part2ElementKey, string> = {
  patientName: "Patient name",
  recipients: "Who receives the information",
  amountAndKind: "How much and what kind of information",
  purpose: "Purpose of the disclosure",
  rightToRevoke: "Right to revoke",
  expiration: "Expiration date or event",
  signatureAndDate: "Signature and date",
  redisclosureNotice: "Notice prohibiting re-disclosure",
};

/** The extended, all-optional fields added to ConsentRecord in B2-1. */
export interface ConsentRecordExtension {
  consentType?: ConsentType;
  recipients?: ConsentRecipient[];
  purpose?: string;
  purposeCode?: string;
  items?: string[];
  expiresOnEvent?: string;
  /** Set when the expiry event has occurred; the record no longer covers. */
  expiryEventOccurredAt?: string;
  signature?: ConsentSignature;
  document?: ConsentDocumentRef;
  part2Elements?: Part2Elements;
  redisclosureNoticeVersion?: string;
  revocation?: ConsentRevocation;
  disclosureIds?: string[];
  legacyUnverified?: boolean;
}

export function recipientKey(recipients?: ConsentRecipient[]): string {
  if (!recipients?.length) return "";
  return recipients
    .map((r) => `${r.kind}:${(r.directoryRef ?? r.name).trim().toLowerCase()}`)
    .sort()
    .join("|");
}

export function isPart2Type(t: ConsentType): boolean {
  return PART2_CONSENT_TYPES.includes(t);
}

export function verbalAssentAllowed(t: ConsentType, purposeCode?: string): boolean {
  if (!VERBAL_ASSENT_TYPES.includes(t)) return false;
  if (t === "referrer_authorization") return purposeCode === VERBAL_ASSENT_REFERRER_PURPOSE;
  return true;
}

/** Returns the reasons a typed record cannot be saved; empty means valid. */
export function validateConsentExtension(ext: ConsentRecordExtension): string[] {
  const errors: string[] = [];
  if (!ext.consentType) return errors; // untyped (existing) records keep today's rules
  const method = ext.signature?.method;
  if (isPart2Type(ext.consentType)) {
    const missing = PART2_ELEMENT_KEYS.filter((k) => !ext.part2Elements?.[k]);
    if (missing.length) errors.push(`Part 2 consent is missing required elements: ${missing.join(", ")}.`);
    if (method !== "e_sign" && method !== "wet_sign_upload")
      errors.push("Part 2 consent needs an e-signature or an uploaded wet signature.");
  }
  if (method === "verbal_assent" && !verbalAssentAllowed(ext.consentType, ext.purposeCode))
    errors.push("Verbal assent is not allowed for this consent type.");
  return errors;
}
