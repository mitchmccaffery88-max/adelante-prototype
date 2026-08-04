// §Audit log PHI redaction.
// The unified audit log is cross-patient and cross-category, so it is the one
// screen where a role can see traces of records it may not open. Redaction
// reuses the SAME RBAC matrix used everywhere else (roles.ts `canAccess`) so
// there is no second, drifting policy: if a role cannot read the record class
// an event belongs to, it does not get that event's PHI here either.
//
// Consent-gated classes (42 CFR Part 2) resolve through `canAccess`, which
// checks the patient's live consent state — so a Part-2 event is redacted for
// a case manager until SUD consent is on file.

import { AdelanteEHR, type AuditCategory, type AuditEvent } from "./ehr";
import { canAccess, type RecordClass, type StaffRole } from "./roles";

/** Which record class each audit category's PHI belongs to. */
const CATEGORY_CLASS: Record<AuditCategory, RecordClass> = {
  consent: "consent_ledger",
  rx: "meds_erx",
  telehealth: "telehealth_room",
  vendor: "documents",
  access: "consent_ledger",
  provider_switch: "care_coordination",
  care_plan: "care_plan",
  assignment: "care_coordination",
  clinical: "case_notes",
};

/**
 * Detail keys that are structural, not clinical: identifiers, counts, flags,
 * state transitions, and export bookkeeping. Anything NOT on this list is
 * treated as potential PHI (free text, medication names, goal text, notes)
 * and is withheld unless the role can read the record class.
 */
const SAFE_DETAIL_KEYS = new Set([
  "format",
  "rowCount",
  "count",
  "status",
  "from",
  "to",
  "kind",
  "type",
  "version",
  "reviewed",
  "source",
  "since",
  "until",
  "outcome",
  "result",
  // Route/navigation bookkeeping (§Platform nav denials): a URL path, its
  // registry label and the redirect target are app structure, never PHI.
  "path",
  "redirectTo",
  "label",
]);

function isSafeDetailKey(key: string, value: unknown): boolean {
  if (SAFE_DETAIL_KEYS.has(key)) return true;
  // `*Id` / `id` style keys are internal linking identifiers, not PHI.
  if (key === "id" || /Id$/.test(key)) return true;
  // Booleans and numbers cannot carry narrative PHI.
  return typeof value === "boolean" || typeof value === "number";
}

/** Masks an identifier so rows stay linkable without exposing the raw ID. */
export function maskIdentifier(id: string): string {
  if (id.length <= 4) return "••••";
  return `${id.slice(0, 2)}••••${id.slice(-2)}`;
}

export interface RedactedAuditEvent {
  event: AuditEvent;
  /** Patient/program identifier as it should be rendered. */
  subjectLabel: string;
  subjectMasked: boolean;
  /** Detail entries safe to render for this role. */
  detail: Record<string, unknown>;
  /** True when at least one detail field was withheld. */
  redacted: boolean;
  /** Human-readable justification shown next to a redacted row. */
  redactionReason?: string;
  recordClass: RecordClass;
}

export function redactAuditEvent(event: AuditEvent, role: StaffRole): RedactedAuditEvent {
  const recordClass = CATEGORY_CLASS[event.category];
  const patient = event.patientId ? AdelanteEHR.getPatient(event.patientId) : undefined;
  const gate = canAccess(role, recordClass, patient);
  const canReadClass = gate.level === "read" || gate.level === "write";
  const canReadSubject =
    canReadClass &&
    (() => {
      const demo = canAccess(role, "demographics", patient);
      return demo.level === "read" || demo.level === "write";
    })();

  const rawDetail = event.detail ?? {};
  const detail: Record<string, unknown> = {};
  let withheld = 0;
  for (const [k, v] of Object.entries(rawDetail)) {
    if (v === undefined || v === null || v === "") continue;
    if (canReadClass || isSafeDetailKey(k, v)) detail[k] = v;
    else withheld += 1;
  }

  const subjectRaw = event.programId ?? event.patientId;
  const subjectMasked = Boolean(subjectRaw) && !canReadSubject;
  const subjectLabel = subjectRaw
    ? subjectMasked
      ? maskIdentifier(subjectRaw)
      : subjectRaw
    : "—";

  const redacted = withheld > 0 || subjectMasked;
  const redactionReason = redacted
    ? (gate.reason ??
      (canReadClass
        ? "Patient identifier masked — no demographics access"
        : `No read access to ${recordClass.replace(/_/g, " ")}`))
    : undefined;

  return { event, subjectLabel, subjectMasked, detail, redacted, redactionReason, recordClass };
}

export function redactAuditEvents(events: AuditEvent[], role: StaffRole): RedactedAuditEvent[] {
  return events.map((e) => redactAuditEvent(e, role));
}
