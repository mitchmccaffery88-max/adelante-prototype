// §B2-6 — neutral consent event names carried on the EXISTING audit entry each
// consent write already produces (no extra entries). Metadata is neutral only:
// event name, consent type, record ID, actor role and recipient kind — never
// names, wording, reasons or SUD content. Pure: no store imports (ehr.ts
// imports this). Draft — pending counsel.

export const CONSENT_EVENT_NAMES = [
  "consent.captured",
  "consent.signed",
  "consent.uploaded",
  "consent.revoked",
  "consent.renewed",
  "consent.superseded",
  "consent.expired",
] as const;
export type ConsentEventName = (typeof CONSENT_EVENT_NAMES)[number];

/** The audit action written the first time a read finds a typed record expired. */
export const CONSENT_EXPIRED_AUDIT_ACTION = "consent_record_expired";

interface RecordLike {
  id: string;
  source?: string;
  consentType?: string;
  recipients?: { kind: "person" | "org" }[];
  signature?: { method: string };
}

/** Recipient kinds only (person / org), sorted and de-duplicated; "none" when absent. */
export function recipientKindOf(rec: RecordLike): string {
  const kinds = [...new Set((rec.recipients ?? []).map((r) => r.kind))].sort();
  return kinds.length ? kinds.join("+") : "none";
}

/** Default event for a newly written record when the caller did not name one. */
export function defaultCreateEvent(rec: RecordLike, actorRole: string): ConsentEventName {
  if (!rec.consentType) {
    const src = rec.source ?? "";
    if (src.startsWith("form:") && src.endsWith(" revoked")) return "consent.revoked";
    if (src.startsWith("form:")) return "consent.signed";
    return "consent.captured";
  }
  if (rec.signature?.method === "wet_sign_upload") return "consent.uploaded";
  if (actorRole === "patient") return "consent.signed";
  return "consent.captured";
}

/** Flat, neutral audit-detail keys for one consent event. */
export function consentEventDetail(input: {
  name: ConsentEventName;
  rec: RecordLike;
  actorRole: string;
  supersededId?: string;
}): Record<string, unknown> {
  return {
    consentEvent: input.name,
    consentType: input.rec.consentType ?? "untyped",
    consentEventRecordId: input.rec.id,
    consentEventActorRole: input.actorRole,
    recipientKind: recipientKindOf(input.rec),
    ...(input.supersededId ? { supersededConsentEvent: "consent.superseded", supersededRecordId: input.supersededId } : {}),
  };
}

/** Detail for a create: explicit name wins, otherwise derived. */
export function createEventDetail(rec: RecordLike, actorRole: string, explicit?: ConsentEventName, supersededId?: string) {
  return consentEventDetail({ name: explicit ?? defaultCreateEvent(rec, actorRole), rec, actorRole, supersededId });
}
