// §B2-3 — revoke / renew / expiry / missing-or-expiring view for TYPED consent
// records (additive; enforcement stays OFF until B2-4 — nothing here changes
// who can see or do what). Every write runs through a registry action
// (consent_record_revoke / consent_record_patient_revoke / consent_record_renew)
// so there is exactly one action audit per write. Draft — pending counsel.
import { AdelanteEHR, effectiveConsentStatus, type ConsentRecord } from "./ehr";
import { canAccess, type StaffRole } from "./roles";
import { roleHasChartEntry } from "./chartAccess";
import { staffPatientLabel } from "./staffPatientLabel";
import { cohortGuard, type CohortGuard } from "./cohortGuard";
import { captureConsentRecord, consentRecordHistory, type CaptureDraft, type HistoryRow } from "./consentCapture";
import { isPart2Type, type ConsentType } from "./consentRecordModel";

export const LIFECYCLE_DRAFT_LABEL = "Draft — pending counsel";
export const REVOKE_WORDING_DRAFT = "Revoking stops new sharing from this point on. It does not undo sharing that already happened. (Draft — pending counsel)";

type Actor = { role: StaffRole | "patient"; staffId?: string; name: string };

export type RevokeMethod = "written" | "e_sign" | "oral";
/** ConsentRevocation.method enum in the record model. */
const REVOKE_METHOD_MAP: Record<RevokeMethod, "portal" | "in_person" | "written"> = {
  written: "written",
  e_sign: "portal",
  oral: "in_person",
};

function typedRecord(recordId: string): ConsentRecord {
  const rec = AdelanteEHR.listConsentRecords().find((r) => r.id === recordId);
  if (!rec) throw new Error("Consent record not found.");
  if (!rec.consentType) throw new Error("Only typed consent records use this flow.");
  return rec;
}

/**
 * Revoke a typed record. Staff need consent_ledger write; the patient may
 * revoke only their OWN record. Advocates never reach this (no registry key).
 * Nothing is deleted: the record stays in history with status "revoked".
 * The store writes no domain audit — the registry action is the one event.
 */
export function revokeTypedConsent(input: { recordId: string; method: RevokeMethod; note?: string; actor: Actor }): ConsentRecord {
  const rec = typedRecord(input.recordId);
  const isPatient = input.actor.role === "patient";
  if (isPatient) {
    if (rec.patientId !== AdelanteEHR.getCurrentPatientId()) throw new Error("You can only change your own forms.");
  } else if (canAccess(input.actor.role as StaffRole, "consent_ledger").level !== "write") {
    throw new Error("Your role can read the consent ledger but can't change it.");
  }
  if (effectiveConsentStatus(rec) !== "active") throw new Error("Only an active consent can be revoked.");
  return AdelanteEHR.revokeTypedConsentRecord(input.recordId, {
    by: isPatient ? "Patient (self-service)" : input.actor.name,
    role: input.actor.role,
    method: REVOKE_METHOD_MAP[input.method],
    reason: input.note?.trim() || (isPatient ? "Revoked by the patient in the portal" : "Revoked by staff"),
    onBehalfOfPatient: !isPatient,
  });
}

/**
 * Renew: a new version of an existing typed record. The ledger's create
 * supersedes the old one only within the same type + recipient key, and the
 * same capture rules apply (Part 2 checklist, verbal assent only where B2-2
 * allows it). Gated exactly like consent_record_capture.
 */
export function renewTypedConsent(input: {
  recordId: string;
  expiresOn?: string;
  expiresOnEvent?: string;
  method: "e_sign" | "verbal_assent";
  signer: string;
  relationship: "patient" | "guardian" | "proxy";
  attested: boolean;
  assentWording?: string;
  witness?: string;
  actor: Actor;
}): ConsentRecord {
  const old = typedRecord(input.recordId);
  if (input.actor.role === "patient" || canAccess(input.actor.role, "consent_ledger").level !== "write")
    throw new Error("Your role can read the consent ledger but can't change it.");
  const draft: CaptureDraft = {
    patientId: old.patientId,
    consentType: old.consentType!,
    recipients: (old.recipients ?? []).map((r) => ({ ...r })),
    purpose: old.purpose ?? "",
    ...(old.purposeCode ? { purposeCode: old.purposeCode } : {}),
    items: [...(old.items ?? [])],
    ...(input.expiresOn ? { expiresOn: input.expiresOn } : {}),
    ...(input.expiresOnEvent?.trim() ? { expiresOnEvent: input.expiresOnEvent.trim() } : {}),
    ...(isPart2Type(old.consentType!) ? { part2Elements: { ...old.part2Elements } } : {}),
  };
  return captureConsentRecord({
    draft,
    method: input.method,
    signer: input.signer,
    relationship: input.relationship,
    attested: input.attested,
    ...(input.assentWording ? { assentWording: input.assentWording } : {}),
    ...(input.witness?.trim() ? { witness: input.witness.trim() } : {}),
    actor: input.actor,
    consentEvent: "consent.renewed",
  });
}

// ------------------------------------------------------------------ missing / expiring
/** Which typed consents every active patient should have. Draft — pending clinical sign-off. */
export const REQUIRED_CONSENT_TYPES: readonly ConsentType[] = ["part2_tpo_single", "hipaa_authorization", "telehealth"];
export const REQUIRED_CONSENTS_DRAFT_LABEL = "Draft — pending clinical sign-off";
export const EXPIRING_WITHIN_DAYS = 30;

export type ConsentGapState = "missing" | "expired" | "expiring" | "ok";
export interface ConsentGap {
  patientId: string;
  consentType: ConsentType;
  state: ConsentGapState;
  expirationDate?: string;
}

/** Per-patient gap list, computed on read (no background job). */
export function consentGapFor(patientId: string, at = new Date()): ConsentGap[] {
  const rows = consentRecordHistory(patientId, at);
  const soon = new Date(at);
  soon.setDate(soon.getDate() + EXPIRING_WITHIN_DAYS);
  return REQUIRED_CONSENT_TYPES.map((type) => {
    const ofType = rows.filter((r) => r.consentType === type);
    const active = ofType.find((r) => r.status === "active");
    if (active) {
      if (active.expirationDate && new Date(`${active.expirationDate}T23:59:59`) <= soon)
        return { patientId, consentType: type, state: "expiring", expirationDate: active.expirationDate };
      return { patientId, consentType: type, state: "ok" };
    }
    if (ofType.some((r) => r.status === "expired" || r.status === "revoked"))
      return { patientId, consentType: type, state: "expired" };
    return { patientId, consentType: type, state: "missing" };
  });
}

export interface ConsentGapRow extends ConsentGap {
  /** staffPatientLabel: full name only when the viewer could open the chart. */
  label: string;
}

/** Worklist for roles with chart entry. Read-only; names follow the name policy. */
export function consentGapWorklist(viewer: { role: StaffRole; staffId?: string }, at = new Date()): ConsentGapRow[] {
  if (!roleHasChartEntry(viewer.role)) return [];
  const rows: ConsentGapRow[] = [];
  for (const p of AdelanteEHR.listPatients()) {
    for (const gap of consentGapFor(p.id, at)) {
      if (gap.state === "ok") continue;
      rows.push({ ...gap, label: staffPatientLabel(viewer, p.id) });
    }
  }
  return rows.sort((a, b) => a.label.localeCompare(b.label) || a.consentType.localeCompare(b.consentType));
}

/** Aggregated counts carry the shared cohort guard (11). */
export function consentGapCounts(rows: ConsentGapRow[]): Record<Exclude<ConsentGapState, "ok">, { count: number; guard: CohortGuard }> {
  const count = (s: Exclude<ConsentGapState, "ok">) => rows.filter((r) => r.state === s).length;
  return {
    missing: { count: count("missing"), guard: cohortGuard(count("missing")) },
    expired: { count: count("expired"), guard: cohortGuard(count("expired")) },
    expiring: { count: count("expiring"), guard: cohortGuard(count("expiring")) },
  };
}

/**
 * Test hook for the parity proof: everything an EXISTING gate reads about
 * consent today. The B2-1 typed-record coverage check is deliberately
 * excluded — it is a new reader of typed records (not a gate yet), so it
 * legitimately changes when typed records are added; B2-1's own tests pin it.
 */
export function consentGateSnapshot(patientId: string, at: Date): unknown {
  const cats = ["sud_treatment", "mental_health", "case_coordination", "billing"] as const;
  return {
    categories: cats.map((c) => AdelanteEHR.isConsentCategoryAuthorized(patientId, c, at)),
    activeId: AdelanteEHR.activeConsentRecord(patientId, at)?.id ?? null,
    state: AdelanteEHR.getConsentState(patientId),
  };
}

export type { HistoryRow };
