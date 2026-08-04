// §ASCMI consent audit viewer — read-only derivation helpers.
//
// UI support only: no new data model, no new events. Consent and disclosure
// events already carry everything needed; this just derives the category set
// for filtering, resolving `consentRecordId` back to the record's authorized
// categories when the event itself does not list them.
import { AdelanteEHR, CONSENT_CATEGORIES, type AuditEvent, type ConsentCategory } from "./ehr";

const VALID = new Set<string>(CONSENT_CATEGORIES.map((c) => c.key));

/** Categories an audit event touches, or [] when it is category-agnostic. */
export function categoriesForAuditEvent(event: AuditEvent): ConsentCategory[] {
  const raw = event.detail?.["categories"];
  if (Array.isArray(raw)) {
    return raw.filter((c): c is ConsentCategory => typeof c === "string" && VALID.has(c));
  }
  const recordId = event.detail?.["consentRecordId"];
  if (typeof recordId === "string" && event.patientId) {
    const rec = AdelanteEHR.listConsentRecords(event.patientId).find((r) => r.id === recordId);
    if (rec) return rec.sections.filter((s) => s.authorized).map((s) => s.category);
  }
  return [];
}

export const CONSENT_AUDIT_EVENT_TYPES = [
  { value: "consent_record_created", label: "Consent captured" },
  { value: "consent_record_revoked", label: "Consent revoked" },
  { value: "consent_gated_content_disclosed", label: "Disclosure" },
  { value: "granted", label: "Legacy toggle — granted" },
  { value: "revoked", label: "Legacy toggle — revoked" },
] as const;
