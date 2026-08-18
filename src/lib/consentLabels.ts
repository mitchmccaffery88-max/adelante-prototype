// §Build A item 2 — DISPLAY LAYER ONLY for consent-category wording.
//
// `CONSENT_CATEGORIES` in `ehr.ts` deliberately carries a literal
// "(placeholder)" marker because the DHCS-sourced ASCMI wording is still
// pending from Christi. That marker is a REAL pending flag and must stay in
// the data — staff surfaces read it and it is what tells us the content is
// unfinished. What it must never do is render raw to a patient.
//
// So: the flag stays, the raw string never reaches a patient. Staff-facing
// surfaces keep using the label from `CONSENT_CATEGORIES` unchanged.

const PLACEHOLDER_RE = /\s*\((?:placeholder|placeholder wording)\)\s*$/i;

/** True when the authored label is still placeholder wording. */
export function isPlaceholderConsentLabel(label: string): boolean {
  return PLACEHOLDER_RE.test(label);
}

/**
 * The patient-safe rendering of a consent-category label: the same wording
 * with the internal placeholder marker stripped. Never invents new wording.
 */
export function patientConsentLabel(label: string): string {
  return label.replace(PLACEHOLDER_RE, "").trim();
}
