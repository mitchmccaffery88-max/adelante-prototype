// §B2-2 — consent record capture flows (additive; no gate reads these yet —
// enforcement switches in B2-4). Every write runs through a registry action
// (chartActions consent_record_*) and lands in the ONE consent ledger as a
// typed record via AdelanteEHR.createConsentRecord. Typed records carry no
// legacy `sections`, so no existing gate, AI-consent check or migration reads
// them. Draft — pending counsel.
import { AdelanteEHR, effectiveConsentStatus, type ConsentRecord, type ConsentRecordStatus } from "./ehr";
import { canAccess, type StaffRole } from "./roles";
import { roleHasChartEntry } from "./chartAccess";
import { migrateLegacyConsents, publishedForm, textHash, type FormKey } from "./consentForms";
import {
  isPart2Type,
  verbalAssentAllowed,
  validateConsentExtension,
  type ConsentRecipient,
  type ConsentRecordExtension,
  type ConsentSignatureMethod,
  type ConsentType,
  type Part2Elements,
} from "./consentRecordModel";

export const CAPTURE_DRAFT_LABEL = "Draft — pending counsel";
export const REDISCLOSURE_NOTICE_VERSION = "redisclosure-notice-v1 (Draft — pending counsel)";
export const UPLOAD_SIMULATED_LABEL = "Simulated — paper copy is not stored in a real document system";

/** Template (published form) behind each type, where one exists. */
export const TEMPLATE_FOR: Partial<Record<ConsentType, FormKey>> = {
  part2_tpo_single: "part2",
  hipaa_authorization: "hipaa",
  telehealth: "telehealth",
  group_confidentiality: "group",
  po_voluntary_coordination: "po_release",
  advocate_release: "advocate_patient",
  ai_recording: "ai_recording",
  sms_reminder: "sms",
  portal_reminder: "portal",
};

export const CONSENT_TYPE_LABEL: Record<ConsentType, { en: string; es: string }> = {
  part2_tpo_single: { en: "Part 2 — single consent for care, payment and operations", es: "Parte 2 — consentimiento único para atención, pago y operaciones" },
  part2_specific_written: { en: "Part 2 — specific written consent", es: "Parte 2 — consentimiento escrito específico" },
  counseling_notes_release: { en: "Counseling notes release", es: "Divulgación de notas de consejería" },
  hipaa_authorization: { en: "HIPAA authorization", es: "Autorización HIPAA" },
  referrer_authorization: { en: "Referrer update authorization", es: "Autorización de avisos a quien te refirió" },
  advocate_release: { en: "Release to my helper (advocate)", es: "Permiso para mi ayudante (defensor)" },
  legal_part2_disclosure: { en: "Part 2 legal disclosure", es: "Divulgación legal de Parte 2" },
  po_voluntary_coordination: { en: "Voluntary coordination with officer", es: "Coordinación voluntaria con el oficial" },
  telehealth: { en: "Telehealth", es: "Telesalud" },
  group_confidentiality: { en: "Group confidentiality", es: "Confidencialidad del grupo" },
  ai_recording: { en: "AI recording of visits", es: "Grabación de visitas con IA" },
  sms_reminder: { en: "Text reminders", es: "Recordatorios por texto" },
  portal_reminder: { en: "Portal reminders", es: "Recordatorios del portal" },
};

type Actor = { role: StaffRole | "patient"; staffId?: string; name: string };

export interface CaptureDraft {
  patientId: string;
  consentType: ConsentType;
  recipients: ConsentRecipient[];
  purpose: string;
  purposeCode?: string;
  items: string[];
  effectiveDate?: string;
  expiresOn?: string;
  expiresOnEvent?: string;
  part2Elements?: Part2Elements;
  language?: "en" | "es";
}

function assertLedgerWriter(actor: Actor) {
  if (actor.role === "patient" || canAccess(actor.role, "consent_ledger").level !== "write")
    throw new Error("Your role can read the consent ledger but can't change it.");
}

function baseChecks(d: CaptureDraft) {
  if (!AdelanteEHR.getPatient(d.patientId)) throw new Error("Patient not found.");
  if (!d.recipients.length || d.recipients.some((r) => r.name.trim().length < 2)) throw new Error("Name at least one recipient.");
  if (d.purpose.trim().length < 3) throw new Error("A purpose is required.");
  if (!d.items.length) throw new Error("Choose what information is covered.");
  if (!d.expiresOn && !d.expiresOnEvent?.trim()) throw new Error("Add an end date or an end event.");
}

/** The document the signer saw: the published template (if any) plus the captured terms. */
function documentFor(d: CaptureDraft) {
  const formKey = TEMPLATE_FOR[d.consentType];
  const v = formKey ? publishedForm(formKey) : undefined;
  const lang = d.language ?? "en";
  const terms = [
    `type:${d.consentType}`,
    `recipients:${d.recipients.map((r) => `${r.kind}:${r.name}`).join(";")}`,
    `purpose:${d.purpose.trim()}`,
    `items:${d.items.join(";")}`,
    `ends:${d.expiresOn ?? ""}|${d.expiresOnEvent ?? ""}`,
    ...(isPart2Type(d.consentType) ? [`redisclosure:${REDISCLOSURE_NOTICE_VERSION}`] : []),
  ].join("\n");
  const text = `${v ? v.body[lang] : ""}\n---\n${terms}`;
  return {
    formKey: v?.key ?? `capture:${d.consentType}`,
    versionId: v?.id ?? "capture-v1",
    version: v?.version ?? 1,
    documentHash: textHash(text),
  };
}

function extensionFor(d: CaptureDraft, signature: NonNullable<ConsentRecordExtension["signature"]>, uploadRef?: string): ConsentRecordExtension {
  return {
    consentType: d.consentType,
    recipients: d.recipients.map((r) => ({ kind: r.kind, name: r.name.trim(), ...(r.directoryRef ? { directoryRef: r.directoryRef } : {}) })),
    purpose: d.purpose.trim(),
    ...(d.purposeCode ? { purposeCode: d.purposeCode } : {}),
    items: [...d.items],
    ...(d.expiresOnEvent?.trim() ? { expiresOnEvent: d.expiresOnEvent.trim() } : {}),
    signature,
    document: { ...documentFor(d), ...(uploadRef ? { uploadRef } : {}) },
    ...(isPart2Type(d.consentType) ? { part2Elements: { ...d.part2Elements }, redisclosureNoticeVersion: REDISCLOSURE_NOTICE_VERSION } : {}),
    disclosureIds: [],
  };
}

function write(d: CaptureDraft, ext: ConsentRecordExtension, capturedBy: { staffId?: string; staffName: string; role: string }, source: string): ConsentRecord {
  const errors = validateConsentExtension(ext);
  if (errors.length) throw new Error(errors.join(" "));
  // Run the lazy legacy migration first so a typed record never changes whether it runs.
  migrateLegacyConsents(d.patientId);
  const today = new Date().toISOString().slice(0, 10);
  return AdelanteEHR.createConsentRecord({
    patientId: d.patientId,
    formType: "NonAB133",
    source,
    signedByName: ext.signature!.signer,
    relationship: ext.signature!.relationship,
    attested: true,
    effectiveDate: d.effectiveDate ?? today,
    ...(d.expiresOn ? { expirationDate: d.expiresOn } : {}),
    sections: [],
    capturedBy,
    extension: ext,
  });
}

const staffBy = (a: Actor) => ({ ...(a.staffId ? { staffId: a.staffId } : {}), staffName: a.name, role: a.role });

/** Staff capture: in-person e-sign (typed name + attestation) or verbal assent where allowed. */
export function captureConsentRecord(input: {
  draft: CaptureDraft;
  method: Exclude<ConsentSignatureMethod, "wet_sign_upload">;
  signer: string;
  relationship: "patient" | "guardian" | "proxy";
  attested: boolean;
  assentWording?: string;
  witness?: string;
  actor: Actor;
}): ConsentRecord {
  assertLedgerWriter(input.actor);
  baseChecks(input.draft);
  if (!input.attested) throw new Error("Attestation is required.");
  if (input.signer.trim().length < 2) throw new Error("Type the signer's full name.");
  if (input.method === "verbal_assent") {
    if (!verbalAssentAllowed(input.draft.consentType, input.draft.purposeCode)) throw new Error("Verbal assent is not allowed for this consent type.");
    if ((input.assentWording ?? "").trim().length < 10) throw new Error("Record the exact words read to the person.");
  }
  const now = new Date().toISOString();
  const ext = extensionFor(input.draft, {
    method: input.method,
    signer: input.signer.trim(),
    relationship: input.relationship,
    signedAt: now,
    recordedAt: now,
    recordedBy: { ...(input.actor.staffId ? { staffId: input.actor.staffId } : {}), staffName: input.actor.name, role: input.actor.role },
    ...(input.witness?.trim() ? { witness: input.witness.trim() } : {}),
    ...(input.method === "verbal_assent" ? { assentWording: input.assentWording!.trim() } : {}),
  });
  return write(input.draft, ext, staffBy(input.actor), input.method === "verbal_assent" ? "verbal assent — consents section" : "in person — consents section");
}

/** Paper wet-signature scan. Simulated: the file is not stored anywhere real. */
export function uploadPaperConsent(input: {
  draft: CaptureDraft;
  signer: string;
  relationship: "patient" | "guardian" | "proxy";
  signedOn: string;
  fileName: string;
  witness?: string;
  actor: Actor;
}): ConsentRecord {
  assertLedgerWriter(input.actor);
  baseChecks(input.draft);
  if (input.signer.trim().length < 2) throw new Error("Type the signer's name as written on the paper.");
  if (!input.signedOn) throw new Error("Add the date on the paper.");
  if (!input.fileName.trim()) throw new Error("Choose the scanned file.");
  const now = new Date().toISOString();
  const uploadRef = `simulated-upload:${textHash(`${input.fileName}|${now}`)}`;
  const ext = extensionFor(input.draft, {
    method: "wet_sign_upload",
    signer: input.signer.trim(),
    relationship: input.relationship,
    signedAt: `${input.signedOn}T00:00:00.000Z`,
    recordedAt: now,
    recordedBy: { ...(input.actor.staffId ? { staffId: input.actor.staffId } : {}), staffName: input.actor.name, role: input.actor.role },
    ...(input.witness?.trim() ? { witness: input.witness.trim() } : {}),
  }, uploadRef);
  return write(input.draft, ext, staffBy(input.actor), "paper upload (Simulated)");
}

// ------------------------------------------------------------------ patient e-sign requests
export interface ESignRequest {
  id: string;
  patientId: string;
  draft: CaptureDraft;
  sentBy: { role: string; staffId?: string; name: string };
  sentAt: string;
  status: "waiting" | "signed";
  recordId?: string;
}
const eSignRequests: ESignRequest[] = [];
let seq = 0;

/** Staff send a typed consent to the patient for e-sign in Forms to sign. */
export function requestConsentESign(input: { draft: CaptureDraft; actor: Actor }): ESignRequest {
  if (input.actor.role === "patient" || !roleHasChartEntry(input.actor.role)) throw new Error("Only care-team roles with chart entry can send forms.");
  baseChecks(input.draft);
  if (isPart2Type(input.draft.consentType) && validateConsentExtension({ consentType: input.draft.consentType, part2Elements: input.draft.part2Elements, signature: { method: "e_sign" } as never }).length)
    throw new Error("Part 2 consent is missing required elements.");
  const r: ESignRequest = {
    id: `cesr_${Date.now().toString(36)}_${(seq++).toString(36)}`,
    patientId: input.draft.patientId,
    draft: JSON.parse(JSON.stringify(input.draft)) as CaptureDraft,
    sentBy: { role: input.actor.role, ...(input.actor.staffId ? { staffId: input.actor.staffId } : {}), name: input.actor.name },
    sentAt: new Date().toISOString(),
    status: "waiting",
  };
  eSignRequests.push(r);
  return { ...r };
}

export function listESignRequests(patientId: string): ESignRequest[] {
  return eSignRequests.filter((r) => r.patientId === patientId).map((r) => ({ ...r }));
}

/** The patient signs their own request: typed name + attestation (same mechanism as Forms to sign). */
export function patientSignConsent(input: { requestId: string; typedName: string; attested: boolean; language: "en" | "es" }): ConsentRecord {
  const r = eSignRequests.find((x) => x.id === input.requestId);
  if (!r || r.status !== "waiting") throw new Error("This form is no longer waiting for you.");
  if (r.patientId !== AdelanteEHR.getCurrentPatientId()) throw new Error("Only the patient can sign their own form.");
  if (!input.attested) throw new Error("Check the box to agree.");
  if (input.typedName.trim().length < 2) throw new Error("Type your full name.");
  const now = new Date().toISOString();
  const draft = { ...r.draft, language: input.language };
  const ext = extensionFor(draft, {
    method: "e_sign",
    signer: input.typedName.trim(),
    relationship: "patient",
    signedAt: now,
    recordedAt: now,
    recordedBy: { staffName: "Patient (self-service)", role: "patient" },
  });
  const rec = write(draft, ext, { staffName: "Patient (self-service)", role: "patient" }, "portal e-sign");
  r.status = "signed";
  r.recordId = rec.id;
  return rec;
}

// ------------------------------------------------------------------ view / history
export type TypedStatus = ConsentRecordStatus | "legacy_unverified";
export interface HistoryRow {
  id: string;
  consentType: ConsentType;
  status: TypedStatus;
  recipients: ConsentRecipient[];
  purpose?: string;
  items: string[];
  effectiveDate: string;
  expirationDate?: string;
  expiresOnEvent?: string;
  method?: ConsentSignatureMethod;
  signer?: string;
  relationship?: string;
  signedAt?: string;
  recordedBy?: string;
  witness?: string;
  assentWording?: string;
  document?: ConsentRecord["document"];
  supersedesId?: string;
  revocation?: ConsentRecord["revocation"];
  disclosureIds: string[];
  simulatedUpload: boolean;
}

function statusOf(r: ConsentRecord, at: Date): TypedStatus {
  if (r.legacyUnverified) return "legacy_unverified";
  if (r.revocation) return "revoked";
  if (r.expiryEventOccurredAt) return "expired";
  return effectiveConsentStatus(r, at);
}

/** Typed records only (untyped history stays in the existing ledger panel). Newest first. */
export function consentRecordHistory(patientId: string, at = new Date()): HistoryRow[] {
  return AdelanteEHR.listConsentRecords(patientId)
    .filter((r) => r.consentType)
    .map((r) => ({
      id: r.id,
      consentType: r.consentType!,
      status: statusOf(r, at),
      recipients: r.recipients ?? [],
      ...(r.purpose ? { purpose: r.purpose } : {}),
      items: r.items ?? [],
      effectiveDate: r.effectiveDate,
      ...(r.expirationDate ? { expirationDate: r.expirationDate } : {}),
      ...(r.expiresOnEvent ? { expiresOnEvent: r.expiresOnEvent } : {}),
      ...(r.signature ? { method: r.signature.method, signer: r.signature.signer, relationship: r.signature.relationship, signedAt: r.signature.signedAt, recordedBy: `${r.signature.recordedBy.staffName} (${r.signature.recordedBy.role})` } : {}),
      ...(r.signature?.witness ? { witness: r.signature.witness } : {}),
      ...(r.signature?.assentWording ? { assentWording: r.signature.assentWording } : {}),
      ...(r.document ? { document: r.document } : {}),
      ...(r.supersedesId ? { supersedesId: r.supersedesId } : {}),
      ...(r.revocation ? { revocation: r.revocation } : {}),
      disclosureIds: r.disclosureIds ?? [],
      simulatedUpload: Boolean(r.document?.uploadRef?.startsWith("simulated-upload:")),
    }));
}

/** The patient's own view: plain terms, no staff names beyond "your care team". */
export function myConsentRecords(patientId: string, at = new Date()) {
  if (patientId !== AdelanteEHR.getCurrentPatientId()) return [];
  return consentRecordHistory(patientId, at).map((h) => ({
    id: h.id,
    consentType: h.consentType,
    status: h.status,
    recipients: h.recipients.map((r) => r.name),
    purpose: h.purpose,
    effectiveDate: h.effectiveDate,
    expirationDate: h.expirationDate,
    expiresOnEvent: h.expiresOnEvent,
    method: h.method,
  }));
}

/** An advocate sees only whether their OWN release is on file. Nothing about other records. */
export type AdvocateReleaseStatus = "active" | "ended" | "none";
export function advocateOwnReleaseStatus(linkId: string, at = new Date()): AdvocateReleaseStatus {
  const link = AdelanteEHR.listAdvocateLinks().find((l) => l.id === linkId);
  if (!link) return "none";
  const mine = consentRecordHistory(link.patientId, at).filter(
    (h) => h.consentType === "advocate_release" && h.recipients.some((r) => r.directoryRef === linkId),
  );
  if (!mine.length) return "none";
  return mine.some((h) => h.status === "active") ? "active" : "ended";
}

/** Test hook. */
export function _resetConsentCapture(): void {
  eSignRequests.length = 0;
}
