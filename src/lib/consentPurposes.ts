// Oct 26 — canonical consent purpose CODES. Gates compare codes only; the
// human label (and any staff note) is display text. Codes come from what the
// gates check today. Draft — pending counsel.

export const CONSENT_PURPOSES = [
  { code: "treatment", label: "Treatment" },
  { code: "care_coordination", label: "Care coordination" },
  { code: "status_updates", label: "Referral status updates" },
  { code: "enrolled_update", label: "\"Enrolled\" update only" },
  { code: "referral_for_treatment", label: "Referral for treatment" },
  { code: "reentry_coordination", label: "Reentry coordination" },
  { code: "telehealth", label: "Telehealth services" },
  { code: "group_confidentiality", label: "Group confidentiality" },
] as const;

export type ConsentPurposeCode = (typeof CONSENT_PURPOSES)[number]["code"];
export const PURPOSE_REFERRAL_FOR_TREATMENT: ConsentPurposeCode = "referral_for_treatment";
export const PURPOSE_LABEL: Record<ConsentPurposeCode, string> = Object.fromEntries(
  CONSENT_PURPOSES.map((p) => [p.code, p.label]),
) as Record<ConsentPurposeCode, string>;

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
export function isPurposeCode(s: string | undefined): s is ConsentPurposeCode {
  return !!s && CONSENT_PURPOSES.some((p) => p.code === s);
}

/** Migration rule: text that exactly matches a code or its label maps to that code; anything else stays unmapped. */
export function purposeCodeForText(text: string | undefined): ConsentPurposeCode | undefined {
  if (!text) return undefined;
  const t = norm(text);
  return CONSENT_PURPOSES.find((p) => p.code === t || norm(p.label) === t)?.code;
}

/** The code a record answers to: its stored code, else an exact text match. */
export function purposeCodeOf(r: { purposeCode?: string; purpose?: string }): ConsentPurposeCode | undefined {
  return isPurposeCode(r.purposeCode) ? r.purposeCode : purposeCodeForText(r.purpose);
}

/** Typed record whose purpose maps to no known code: shown "Purpose needs review", never silently reinterpreted. */
export function purposeNeedsReview(r: { consentType?: string; purposeCode?: string; purpose?: string }): boolean {
  return !!r.consentType && !purposeCodeOf(r);
}
