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
  | "care_partner_handoff";

export const CHANNEL_LABEL: Record<DisclosureChannel, string> = {
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
  | "SUD episode / CalOMS data";

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
  channel: DisclosureChannel;
  /** Empty = no Part 2 content (non-SUD disclosure passes straight through). */
  recordClasses: Part2RecordClass[];
  emergency?: { reason: string };
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
  channel: DisclosureChannel;
  simulated: boolean;
  emergency: boolean;
  complianceReview?: "pending" | "reviewed";
}

export type DisclosureResult =
  | { ok: true; notice?: string; entry?: DisclosureLogEntry }
  | { ok: false; reason: string };

const log: DisclosureLogEntry[] = [];
let seq = 0;

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
  switch (recipient.type) {
    case "internal":
      // Communications within the program's own treatment team (42 CFR 2.12(c)(3)).
      return { ok: true, ref: "Internal program use — 42 CFR 2.12(c)(3)" };
    case "advocate":
      return has("advocate_sud_disclosure" as never) || has(LEGAL_DISCLOSURE_CONSENT_CATEGORY)
        ? { ok: true, ref: `${recRef} (advocate disclosure)` }
        : { ok: false, reason: "No substance-use disclosure consent covers this advocate, so this can't be shared." };
    case "county":
      return has("sud_treatment")
        ? { ok: true, ref: recRef }
        : { ok: false, reason: "No substance-use treatment consent is on file for this person, so this can't be shared." };
    case "legal":
      if (legal && has(LEGAL_DISCLOSURE_CONSENT_CATEGORY)) return { ok: true, ref: `Legal disclosure ${legal.id}` };
      return { ok: false, reason: "No Part 2 disclosure consent names this recipient. Record the consent first." };
    default:
      if (legal && has(LEGAL_DISCLOSURE_CONSENT_CATEGORY)) return { ok: true, ref: `Legal disclosure ${legal.id}` };
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
  const emergency = !!req.emergency;
  let consentRef: string;
  if (emergency) {
    if ((req.emergency!.reason ?? "").trim().length < 3)
      return { ok: false, reason: "Describe the medical emergency before sharing." };
    consentRef = "Medical emergency — no consent (42 CFR 2.51)";
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
    ...(emergency ? { complianceReview: "pending" as const } : {}),
  };
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
      ...(emergency ? { complianceReview: "pending" } : {}),
    },
  });
  return { ok: true, notice: PART2_NOTICE_BLOCK, entry };
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
