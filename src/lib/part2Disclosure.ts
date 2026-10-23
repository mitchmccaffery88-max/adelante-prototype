// §Batch C1 — the ONE outbound disclosure function for 42 CFR Part 2 content.
//
// Every outbound path that can carry SUD-classified information (HIE share,
// note PDF, record print, document download, advocate share, legal
// disclosure, referral-out, DMC-ODS / CalOMS CSV) calls `disclose()`. It:
//   (a) checks the consent ledger for that recipient + purpose, blocking with
//       a plain-language reason when nothing covers it (medical emergency is
//       the only exception: allowed, logged, flagged for compliance review);
//   (b) returns the redisclosure notice the caller must attach to the output;
//   (c) writes a disclosure-log entry that never contains clinical content.
// Non-SUD disclosures pass straight through (no notice, no log entry).
import { AdelanteEHR, LEGAL_DISCLOSURE_CONSENT_CATEGORY } from "./ehr";
import { validateCoordinatorEmergency } from "./coordinatorSudAccess";
import type { ConsentType } from "./consentRecordModel";

// Legal disclosure records live in outpatientCare.ts, which registers its
// reader here (no import: avoids an ehr → outpatientCare load cycle).
type LegalRow = { id: string; recipient: string; purpose?: string; revokedAt?: string };
let legalSource: (patientId: string) => LegalRow[] = () => [];
export function registerLegalDisclosureSource(fn: (patientId: string) => LegalRow[]) {
  legalSource = fn;
}
const listLegalDisclosures = (pid: string) => legalSource(pid);

export const PART2_NOTICE_DRAFT_LABEL = "Draft wording — pending counsel review";

/** Standard redisclosure notice (42 CFR 2.32). Draft wording. */
export const PART2_REDISCLOSURE_NOTICE =
  "This record, which has been disclosed to you, is protected by federal confidentiality rules (42 CFR part 2). " +
  "These rules prohibit you from using or disclosing this record, or testimony that describes the information contained in this record, " +
  "in any civil, criminal, administrative, or legislative proceedings against the patient, unless authorized by the consent of the patient " +
  "or by a court order that meets 42 CFR part 2. The federal rules also prohibit any other use or disclosure of this record unless expressly " +
  "permitted by the written consent of the patient or as otherwise permitted by 42 CFR part 2. " +
  "A general authorization for the release of medical or other information is NOT sufficient for this purpose.";

/** Notice block as attached to every output (text + draft label). */
export const PART2_NOTICE_BLOCK = `42 CFR Part 2 redisclosure notice (${PART2_NOTICE_DRAFT_LABEL}): ${PART2_REDISCLOSURE_NOTICE}`;

export type DisclosureChannel =
  | "hie_share"
  | "note_pdf"
  | "record_print"
  | "document_download"
  | "advocate_share"
  | "legal_disclosure"
  | "referral_out"
  | "dmc_ods_csv"
  | "county_report"
  | "care_partner_handoff"
  | "adel_share"
  | "referrer_update";
// Patient-specific P2 exceptions are internal access, not outbound export grants.

export const CHANNEL_LABEL: Record<DisclosureChannel | "coordinator_emergency", string> = {
  coordinator_emergency: "Emergency access review (Simulated)",
  hie_share: "HIE share (Simulated)",
  note_pdf: "Note PDF",
  record_print: "Record print / PDF",
  document_download: "Document download",
  advocate_share: "Advocate share",
  legal_disclosure: "Legal disclosure",
  referral_out: "Referral out",
  dmc_ods_csv: "DMC-ODS / CalOMS export",
  county_report: "County reporting file (prototype)",
  care_partner_handoff: "Care partner handoff",
  adel_share: "Patient share from Adel (Simulated summary)",
  referrer_update: "Referrer status update",
};

export type RecipientType = "patient" | "internal" | "advocate" | "provider" | "hie" | "legal" | "county" | "other";

export interface DisclosureRecipient {
  name: string;
  organization?: string;
  type: RecipientType;
}

/** Record CLASS names only — never content. */
export type Part2RecordClass =
  | "SUD treatment notes"
  | "SUD medications"
  | "SUD screening results"
  | "SUD diagnoses"
  | "SUD documents"
  | "SUD referral information"
  | "SUD episode / CalOMS data"
  | "SUD-related Adel conversation summary";

export interface DisclosureActor {
  name: string;
  role: string;
  staffId?: string;
  viewedAs?: string;
}

export interface DisclosureRequest {
  patientId: string;
  actor: DisclosureActor;
  recipient: DisclosureRecipient;
  purpose: string;
  channel: DisclosureChannel | "coordinator_emergency";
  /** Empty = no Part 2 content (non-SUD disclosure passes straight through). */
  recordClasses: Part2RecordClass[];
  emergency?: { reason: string; exception?: "medical_emergency" | "audit_evaluation" | "court_order"; detail?: string; reference?: string; start?: string; end?: string };
  simulated?: boolean;
  at?: string;
}

export interface DisclosureLogEntry {
  id: string;
  at: string;
  actorName: string;
  actorId?: string;
  actingRole: string;
  viewedAs?: string;
  recipient: DisclosureRecipient;
  purpose: string;
  consentRef: string;
  recordClasses: Part2RecordClass[];
  patientId: string;
  channel: DisclosureChannel | "coordinator_emergency";
  simulated: boolean;
  emergency: boolean;
  complianceReview?: "pending" | "reviewed";
  /** Required emergency justification, retained for disclosure review only. */
  emergencyReason?: string;
  emergencyDetail?: string;
  emergencyReference?: string;
  accessStart?: string;
  accessEnd?: string;
  /** §B2-6 — typed consent record covering this disclosure (read-only link), or null = legacy. */
  consentRecordId?: string | null;
}

export type DisclosureResult =
  | { ok: true; notice?: string; entry?: DisclosureLogEntry }
  | { ok: false; reason: string };

const log: DisclosureLogEntry[] = [];
let seq = 0;

// ------------------------------------------------------------------ §B2-6 disclosure links
// Read-only: which typed record covers a logged disclosure. NEVER blocks,
// allows or changes a disclosure (enforcement is B2-4). Draft — pending counsel.
export const NO_TYPED_RECORD_LABEL = "No typed record (legacy)";
const LINK_TYPES: Record<RecipientType, ConsentType[]> = {
  advocate: ["advocate_release"],
  legal: ["legal_part2_disclosure", "part2_specific_written"],
  provider: ["part2_specific_written", "part2_tpo_single"],
  hie: ["part2_specific_written", "part2_tpo_single"],
  other: ["part2_specific_written", "part2_tpo_single"],
  internal: ["part2_tpo_single"],
  county: ["part2_tpo_single"],
  patient: [],
};
/** The consent types a disclosure could be covered by (first match wins). */
export function linkTypesFor(channel: DisclosureEntryChannel, recipientType: RecipientType): ConsentType[] {
  if (channel === "coordinator_emergency") return [];
  if (channel === "referrer_update") return ["referrer_authorization"];
  return LINK_TYPES[recipientType] ?? [];
}
type DisclosureEntryChannel = DisclosureChannel | "coordinator_emergency";
function linkEntry(entry: DisclosureLogEntry): void {
  const at = new Date(entry.at);
  let id: string | null = null;
  for (const type of linkTypesFor(entry.channel, entry.recipient.type)) {
    for (const recipient of [entry.recipient.name, entry.recipient.organization].filter((x): x is string => !!x && !!x.trim())) {
      id = AdelanteEHR.consentCoveringRecordId(entry.patientId, { type, recipient, purpose: entry.purpose, at });
      if (id) break;
    }
    if (id) break;
  }
  entry.consentRecordId = id;
  if (id) AdelanteEHR.linkConsentDisclosure(id, entry.id);
}
/** Link label for a disclosure entry. */
export function disclosureLinkLabel(entry: Pick<DisclosureLogEntry, "consentRecordId">): string {
  return entry.consentRecordId ? `Consent record ${entry.consentRecordId}` : NO_TYPED_RECORD_LABEL;
}
/** One logged disclosure by id (copy), for the consent record detail / consent audit view. */
export function getDisclosureEntry(id: string): DisclosureLogEntry | undefined {
  const e = log.find((x) => x.id === id);
  return e ? { ...e, recipient: { ...e.recipient }, recordClasses: [...e.recordClasses] } : undefined;
}

const norm = (s: string) => s.trim().toLowerCase();

/** Consent lookup for recipient + purpose. Pure read of the ledger. */
export function part2ConsentFor(
  patientId: string,
  recipient: DisclosureRecipient,
  purpose?: string,
): { ok: true; ref: string } | { ok: false; reason: string } {
  if (recipient.type === "patient") return { ok: true, ref: "Patient's own right of access" };
  const rec = AdelanteEHR.activeConsentRecord(patientId);
  const recRef = rec ? `Consent record ${rec.id}` : "Consent on file (legacy flag)";
  const has = (c: Parameters<typeof AdelanteEHR.isConsentCategoryAuthorized>[1]) =>
    AdelanteEHR.isConsentCategoryAuthorized(patientId, c);
  const legal = listLegalDisclosures(patientId).find(
    (d) =>
      !d.revokedAt &&
      (norm(d.recipient) === norm(recipient.name) ||
        (!!recipient.organization && norm(d.recipient) === norm(recipient.organization))) &&
      // Recipient AND purpose must match the recorded legal disclosure.
      (!purpose || !d.purpose || norm(d.purpose) === norm(purpose)),
  );
  // B2-5: a named legal disclosure still needs its signed typed record
  // (same recipient AND purpose); the legacy category alone grants nothing.
  const legalOk = !!legal && (has(LEGAL_DISCLOSURE_CONSENT_CATEGORY) ||
    !!AdelanteEHR.consentCoveringRecordId(patientId, { type: "legal_part2_disclosure", recipient: legal.recipient, purpose: purpose ?? legal.purpose }));
  switch (recipient.type) {
    case "internal":
      // Communications within the program's own treatment team (42 CFR 2.12(c)(3)).
      return { ok: true, ref: "Internal program use — 42 CFR 2.12(c)(3)" };
    case "advocate":
      return has("advocate_sud_disclosure" as never) || has(LEGAL_DISCLOSURE_CONSENT_CATEGORY)
        ? { ok: true, ref: `${recRef} (advocate disclosure)` }
        : { ok: false, reason: "No substance-use disclosure consent covers this advocate, so this can't be shared." };
    case "county": {
      if (!has("sud_treatment")) return { ok: false, reason: "No substance-use treatment consent is on file for this person, so this can't be shared." };
      // B2-5: cite the signed typed record that grants, never a legacy flag.
      const typed = rec ? null : AdelanteEHR.consentCoveringRecordId(patientId, { type: "part2_tpo_single", recipient: "adelante-program", purpose: "treatment" });
      return { ok: true, ref: typed ? `Consent record ${typed}` : recRef };
    }
    case "legal":
      if (legal && legalOk) return { ok: true, ref: `Legal disclosure ${legal.id}` };
      return { ok: false, reason: "No Part 2 disclosure consent names this recipient. Record the consent first." };
    default:
      if (legal && legalOk) return { ok: true, ref: `Legal disclosure ${legal.id}` };
      if (has(LEGAL_DISCLOSURE_CONSENT_CATEGORY)) return { ok: true, ref: `${recRef} (Part 2 disclosure)` };
      if (has("information_sharing_disclosure")) return { ok: true, ref: `${recRef} (information sharing)` };
      return {
        ok: false,
        reason: "The person hasn't signed a consent that lets us share substance-use records with this recipient. Record the consent first.",
      };
  }
}

/** THE disclosure function. */
export function disclose(req: DisclosureRequest): DisclosureResult {
  if (req.recordClasses.length === 0) return { ok: true };
  if (req.channel === "coordinator_emergency") {
    if (req.actor.role !== "clinical_coordinator" || !req.actor.staffId || !req.emergency)
      return { ok: false, reason: "Coordinator emergency evidence is required." };
    try { validateCoordinatorEmergency({ reason: req.emergency.exception ?? "", detail: req.emergency.detail ?? "", reference: req.emergency.reference }); }
    catch { return { ok: false, reason: "An allowed reason, detail and applicable reference are required." }; }
  }
  const emergencyReason = req.emergency?.reason.trim();
  const emergency = !!req.emergency;
  let consentRef: string;
  if (emergency) {
    if (!emergencyReason || emergencyReason.length < 3)
      return { ok: false, reason: "Describe the medical emergency before sharing." };
    if (req.channel === "coordinator_emergency" && req.actor.role !== "clinical_coordinator") return { ok: false, reason: "Coordinator access only." };
    if (req.emergency?.exception && req.emergency.exception !== "medical_emergency") {
      if (req.channel !== "coordinator_emergency" || !req.emergency.reference?.trim() || !req.emergency.detail?.trim()) return { ok: false, reason: "Exception reference and detail are required." };
      consentRef = req.emergency.exception === "court_order" ? "Part 2 court order — reference on file" : "Audit/evaluation — reference on file";
    } else consentRef = "Medical emergency — no consent (42 CFR 2.51)";
  } else {
    const c = part2ConsentFor(req.patientId, req.recipient, req.purpose);
    if (!c.ok) {
      AdelanteEHR._recordAudit({
        category: "disclosure",
        action: "part2_disclosure_blocked",
        patientId: req.patientId,
        actorId: req.actor.staffId ?? req.actor.name,
        actorRole: req.actor.role,
        detail: { channel: req.channel, recipientType: req.recipient.type, recordClasses: req.recordClasses, simulated: !!req.simulated },
      });
      return { ok: false, reason: c.reason };
    }
    consentRef = c.ref;
  }
  const entry: DisclosureLogEntry = {
    id: `dl-${++seq}`,
    at: req.at ?? new Date().toISOString(),
    actorName: req.actor.name,
    actorId: req.actor.staffId,
    actingRole: req.actor.role,
    viewedAs: req.actor.viewedAs,
    recipient: { ...req.recipient },
    purpose: req.purpose,
    consentRef,
    recordClasses: [...req.recordClasses],
    patientId: req.patientId,
    channel: req.channel,
    simulated: !!req.simulated,
    emergency,
    ...(emergency ? { complianceReview: "pending" as const, emergencyReason, emergencyDetail: req.emergency?.detail, emergencyReference: req.emergency?.reference, accessStart: req.emergency?.start, accessEnd: req.emergency?.end } : {}),
  };
  linkEntry(entry);
  log.unshift(entry);
  AdelanteEHR._recordAudit({
    category: "disclosure",
    action: emergency ? "part2_emergency_disclosure" : "part2_disclosure",
    patientId: req.patientId,
    actorId: req.actor.staffId ?? req.actor.name,
    actorRole: req.actor.role,
    detail: {
      disclosureLogId: entry.id,
      channel: entry.channel,
      recipientType: entry.recipient.type,
      recordClasses: entry.recordClasses,
      consentRef,
      consentRecordId: AdelanteEHR.activeConsentRecord(req.patientId)?.id,
      categories: ["sud_treatment"],
      purpose: entry.purpose,
      simulated: entry.simulated,
      ...(emergency ? { complianceReview: "pending", emergencyReason, emergencyDetail: entry.emergencyDetail, emergencyReference: entry.emergencyReference, start: entry.accessStart, end: entry.accessEnd, actorName: entry.actorName } : {}),
    },
  });
  return { ok: true, notice: PART2_NOTICE_BLOCK, entry };
}

/**
 * Privacy P3 — a Part 2 consent that NAMES this recipient (legal-disclosure
 * ledger match on name or organization, not revoked). Category-only consents
 * do not count for referrer updates.
 */
export function part2ConsentNamesRecipient(patientId: string | undefined, recipient: { name: string; organization?: string }): boolean {
  if (!patientId) return false;
  const names = [recipient.name, recipient.organization].filter((x): x is string => !!x && !!x.trim()).map(norm);
  return listLegalDisclosures(patientId).some((r) => !r.revokedAt && names.includes(norm(r.recipient)));
}

/**
 * Privacy P3 — every referrer status message that is SENT writes one
 * disclosure-log entry and one audit event. Content-free: message kind only.
 */
export function logReferrerStatusDisclosure(input: {
  patientId: string; actor: DisclosureActor; recipient: DisclosureRecipient;
  message: string; referralId: string; sud: boolean; consentRef: string; simulated?: boolean;
}): DisclosureLogEntry {
  const entry: DisclosureLogEntry = {
    id: `dl-${++seq}`, at: new Date().toISOString(), actorName: input.actor.name, actorId: input.actor.staffId,
    actingRole: input.actor.role, recipient: { ...input.recipient }, purpose: `Referral status: ${input.message}`,
    consentRef: input.consentRef, recordClasses: input.sud ? ["SUD referral information"] : [],
    patientId: input.patientId, channel: "referrer_update", simulated: !!input.simulated, emergency: false,
  };
  linkEntry(entry);
  log.unshift(entry);
  AdelanteEHR._recordAudit({ category: "disclosure", action: "referrer_status_disclosure", patientId: input.patientId,
    actorId: input.actor.staffId ?? input.actor.name, actorRole: input.actor.role,
    detail: { disclosureLogId: entry.id, referralId: input.referralId, recipientType: entry.recipient.type, message: input.message, consentRef: input.consentRef, simulated: entry.simulated } });
  return { ...entry, recipient: { ...entry.recipient }, recordClasses: [...entry.recordClasses] };
}

/** Privacy P3 — an emergency window ended early: shorten the logged end time only. */
export function recordEmergencyAccessEnded(id: string, endAt: string): DisclosureLogEntry | undefined {
  const e = log.find((x) => x.id === id);
  if (!e || !e.emergency || e.channel !== "coordinator_emergency") return undefined;
  if (!e.accessEnd || Date.parse(endAt) < Date.parse(e.accessEnd)) e.accessEnd = endAt;
  return { ...e, recipient: { ...e.recipient }, recordClasses: [...e.recordClasses] };
}

/** Compliance marks an emergency disclosure reviewed. */
export function markEmergencyReviewed(id: string, actor: DisclosureActor): void {
  if (!DISCLOSURE_LOG_ROLES.includes(actor.role)) throw new Error("Only compliance can review emergency disclosures.");
  const e = log.find((x) => x.id === id);
  if (!e || !e.emergency) throw new Error("Not an emergency disclosure.");
  e.complianceReview = "reviewed";
  AdelanteEHR._recordAudit({
    category: "disclosure",
    action: "part2_emergency_reviewed",
    patientId: e.patientId,
    actorId: actor.staffId ?? actor.name,
    actorRole: actor.role,
    detail: { disclosureLogId: id },
  });
}

/** sys_admin + the compliance stand-in (credentialing coordinator). */
export const DISCLOSURE_LOG_ROLES: readonly string[] = ["sys_admin", "credentialing_coordinator"];

export interface DisclosureFilter {
  patientId?: string;
  channel?: DisclosureChannel;
  recipientType?: RecipientType;
  emergencyOnly?: boolean;
  sinceDays?: number;
}

export function listDisclosureLog(f: DisclosureFilter = {}, now = new Date()): DisclosureLogEntry[] {
  const since = f.sinceDays ? now.getTime() - f.sinceDays * 86_400_000 : 0;
  return log
    .filter((e) => !f.patientId || e.patientId === f.patientId)
    .filter((e) => !f.channel || e.channel === f.channel)
    .filter((e) => !f.recipientType || e.recipient.type === f.recipientType)
    .filter((e) => !f.emergencyOnly || e.emergency)
    .filter((e) => new Date(e.at).getTime() >= since)
    .map((e) => ({ ...e, recipient: { ...e.recipient }, recordClasses: [...e.recordClasses] }));
}

/** Per-patient accounting of disclosures (staff view). */
export function accountingOfDisclosures(patientId: string): DisclosureLogEntry[] {
  return listDisclosureLog({ patientId });
}

export interface PatientSharedRow {
  id: string;
  at: string;
  recipient: string;
  purpose: string;
  emergency: boolean;
}

/** Patient-facing list: recipient, date, purpose. No staff names, no review status. */
export function patientSharedList(patientId: string): PatientSharedRow[] {
  return log
    .filter((e) => e.patientId === patientId && e.recipient.type !== "internal" && e.recipient.type !== "patient")
    .map((e) => ({
      id: e.id,
      at: e.at,
      recipient: e.recipient.organization ? `${e.recipient.name} (${e.recipient.organization})` : e.recipient.name,
      purpose: e.purpose,
      emergency: e.emergency,
    }));
}

export function _resetDisclosureLogForTests() {
  log.length = 0;
}
