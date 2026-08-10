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
  { value: "advocate_schedule_viewed", label: "Advocate — schedule viewed" },
  { value: "advocate_documents_viewed", label: "Advocate — documents viewed" },
  { value: "advocate_access_denied", label: "Advocate — access denied" },
] as const;

/**
 * §Group D item 7 — advocate Part 2 visibility rests on TWO independent gates,
 * and an auditor needs to see WHICH one decided the outcome. Both facts are
 * already recorded on the advocate audit row (`advocateLinkValid`,
 * `sudDisclosureConsentActive`); this only reads them back. Returns undefined
 * for events that are not advocate Part 2 evaluations, so no other row grows a
 * meaningless column.
 */
export interface AdvocateGateOutcome {
  linkValid: boolean;
  consentActive: boolean;
  part2Disclosed: boolean;
}

export function advocateGateOutcome(event: AuditEvent): AdvocateGateOutcome | undefined {
  if (event.category !== "advocate") return undefined;
  const d = event.detail ?? {};
  const linkValid = d["advocateLinkValid"];
  const consentActive = d["sudDisclosureConsentActive"];
  if (typeof linkValid !== "boolean" || typeof consentActive !== "boolean") return undefined;
  return {
    linkValid,
    consentActive,
    part2Disclosed: d["part2Disclosed"] === true,
  };
}
