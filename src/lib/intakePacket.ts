import { AdelanteEHR, type Referral } from "./ehr";
import { canAccess } from "./roles";
import { isRestricted } from "./chartAccess";
import { canIntakeB, assertIntakeB, intakeBReferral, intakeFormsStatus, careTeamCanRead } from "./intakePhaseB";
import { intakeCompleted, type IntakeActor } from "./intakePhaseA";

export const PACKET_SOURCES = ["referral_form", "partner_referral", "pre_release_packet"] as const;
export type PacketSource = (typeof PACKET_SOURCES)[number];
export const PACKET_NEEDS = ["housing", "food", "transportation", "employment", "benefits", "legal", "education", "childcare", "other"] as const;
export type PacketNeedKind = (typeof PACKET_NEEDS)[number];
export type NeedState = "confirmed_still_needed" | "resolved" | "unknown";
type Need = { id: string; kind: PacketNeedKind; source: PacketSource; sourceRef: string; referralId: string; ingestedBy: string; ingestedAt: string; state: NeedState; part2: boolean };
type PacketDocument = { id: string; referralId: string; type: "hra" | "reentry_plan" | "medication_list" | "roi"; source: PacketSource; fileName: string; size: number; mime: string; dataUrl?: string; part2: boolean; classification: "general" | "part2" | "sud_related" | "unclassified"; attachedAt: string; attachedBy: string };
const needs = new Map<string, Need[]>();
const documents = new Map<string, PacketDocument[]>();
let seq = 0;
function sourceValid(source: string): source is PacketSource { return (PACKET_SOURCES as readonly string[]).includes(source); }
function sourceBound(r: Referral, source: PacketSource, ref: string) {
  return source === "referral_form" ? ref === `referral:${r.id}` : (r.intakeStaging?.source === source && r.intakeStaging.sourceRef === ref) || (documents.get(r.id) ?? []).some(d => d.id === ref && d.source === source);
}
function referenceValid(r: Referral, n: Need) { return n.referralId === r.id && sourceValid(n.source) && sourceBound(r, n.source, n.sourceRef) && !!n.ingestedBy && !!n.ingestedAt && (PACKET_NEEDS as readonly string[]).includes(n.kind); }
function intakeTreatmentConsent(r: Referral) { return !!r.enrolledPatientId && !isRestricted(r.enrolledPatientId) && AdelanteEHR.isConsentCategoryAuthorized(r.enrolledPatientId, "sud_treatment"); }
export interface StagingRow { referralId?: string; firstName: string; lastName: string; dob?: string; phone?: string; email?: string; referrerName: string; referrerPhone?: string; referrerEmail?: string; referringAgency?: string; releaseDate?: string; referralReason?: string; sdoh?: { kind: PacketNeedKind; part2?: boolean }[]; }
const STAGING_FIELDS = ["referralId", "firstName", "lastName", "dob", "phone", "email", "referrerName", "referrerPhone", "referrerEmail", "referringAgency", "releaseDate", "referralReason", "sdoh"];
export function importIntakeStaging(actor: IntakeActor, source: PacketSource, sourceRef: string, rows: StagingRow[], reason: string) {
  assertIntakeB(actor, "staging_import", reason);
  if (!sourceValid(source) || source === "referral_form" || !sourceRef.trim() || !Array.isArray(rows) || !rows.length || rows.length > 500) throw new Error("Partner roster or pre-release packet source required (1–500 rows).");
  // Validate every row before writing anything; identifiers never auto-link a chart.
  for (const r of rows) {
    if (!r || Object.keys(r).some(k => !STAGING_FIELDS.includes(k)) || !r.firstName?.trim() || !r.lastName?.trim() || !r.referrerName?.trim() || !(r.phone?.trim() || r.email?.trim() || r.referrerPhone?.trim() || r.referrerEmail?.trim())) throw new Error("Staging accepts referral identity/contact fields only.");
    for (const d of [r.dob, r.releaseDate]) if (d && (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !Number.isFinite(Date.parse(d)) || new Date(d).toISOString().slice(0, 10) !== d)) throw new Error("Use valid dates.");
    if (r.dob && r.dob >= new Date().toISOString().slice(0, 10)) throw new Error("Birth date must be in the past.");
    if (r.sdoh?.some(n => !(PACKET_NEEDS as readonly string[]).includes(n.kind) || Object.keys(n).some(k => !["kind", "part2"].includes(k)))) throw new Error("Packet SDOH structured source required; no notes or clinical origins.");
    if (r.referralId) { const existing = intakeBReferral(actor, r.referralId, "staging_import", reason, true); if (existing.enrolledPatientId || !["submitted", "contacted"].includes(existing.status)) throw new Error("Only unlinked open staging referrals may be updated."); }
  }
  const ids: string[] = [];
  for (const row of rows) {
    const fields = { firstName: row.firstName.trim(), lastName: row.lastName.trim(), dob: row.dob, phone: row.phone?.trim(), email: row.email?.trim().toLowerCase(), referrerName: row.referrerName.trim(), referrerPhone: row.referrerPhone?.trim(), referrerEmail: row.referrerEmail?.trim(), referringAgency: row.referringAgency?.trim() ?? "", releaseDate: row.releaseDate };
    const r = row.referralId ? AdelanteEHR.listReferrals().find(x => x.id === row.referralId) : AdelanteEHR.createReferral({ ...fields, channel: "staff", referralSource: source === "pre_release_packet" ? "correctional" : "community_based_organization", consentToContact: false, requestManualOutreach: true, identityConfidence: "verified_source" });
    if (!r) throw new Error("Staging referral unavailable.");
    if (row.referralId) Object.assign(r, fields);
    r.intakeStaging = { source, sourceRef: sourceRef.trim(), ingestedBy: actor.staffId ?? "", ingestedAt: new Date().toISOString(), referralReason: row.referralReason?.trim() };
    if (row.sdoh) ingestPacketNeeds(actor, r.id, source, sourceRef, row.sdoh, reason);
    ids.push(r.id);
  }
  AdelanteEHR._emit(); return { referralIds: ids };
}
declare module "./ehr" { interface Referral { intakeStaging?: { source: PacketSource; sourceRef: string; ingestedBy: string; ingestedAt: string; referralReason?: string }; } }
export function ingestPacketNeeds(actor: IntakeActor, referralId: string, source: PacketSource, sourceRef: string, input: { kind: PacketNeedKind; part2?: boolean }[], reason: string) {
  const r = intakeBReferral(actor, referralId, "staging_import", reason, true);
  if (!sourceValid(source) || !sourceBound(r, source, sourceRef) || !Array.isArray(input) || input.some(n => !(PACKET_NEEDS as readonly string[]).includes(n.kind) || Object.keys(n).some(k => !["kind", "part2"].includes(k)))) throw new Error("Validated referral/partner/packet source reference required.");
  const existing = needs.get(referralId) ?? [];
  for (const n of input) if (!existing.some(x => x.source === source && x.sourceRef === sourceRef && x.kind === n.kind)) existing.push({ id: `packet-need-${++seq}`, kind: n.kind, source, sourceRef, referralId, ingestedBy: actor.staffId ?? "", ingestedAt: new Date().toISOString(), state: "unknown", part2: n.part2 === true });
  needs.set(referralId, existing); AdelanteEHR._emit(); return { referralId };
}
export function intakePacketNeeds(actor: IntakeActor, referralId: string) {
  if (!canIntakeB(actor, "sdoh_checklist")) return [];
  const r = referralForPacket(referralId);
  if (r.enrolledPatientId && isRestricted(r.enrolledPatientId)) return [];
  return (needs.get(referralId) ?? []).filter(n => referenceValid(r, n) && (!n.part2 || intakeTreatmentConsent(r))).map(n => ({ id: n.id, kind: n.kind, source: n.source, state: n.state }));
}
function referralForPacket(id: string) { const r = AdelanteEHR.listReferrals().find(x => x.id === id); if (!r) throw new Error("Referral unavailable."); return r; }
export function logIntakePacketNeed(actor: IntakeActor, referralId: string, needId: string, state: NeedState, reason: string) {
  const r = intakeBReferral(actor, referralId, "sdoh_checklist", reason, true);
  const n = (needs.get(referralId) ?? []).find(x => x.id === needId && referenceValid(r, x));
  if (!n || (n.part2 && !intakeTreatmentConsent(r)) || !["confirmed_still_needed", "resolved", "unknown"].includes(state)) throw new Error("Source-bound checklist item unavailable.");
  n.state = state; AdelanteEHR._emit(); return { referralId, needId };
}
export interface PacketAttachInput { type: PacketDocument["type"]; source: PacketSource; fileName: string; size: number; mime: string; dataUrl?: string; classification: PacketDocument["classification"]; }
export function attachIntakePacket(actor: IntakeActor, referralId: string, input: PacketAttachInput, reason: string) {
  intakeBReferral(actor, referralId, "packet_attach", reason, true);
  if (!sourceValid(input.source) || !["hra", "reentry_plan", "medication_list", "roi"].includes(input.type) || !["general", "part2", "sud_related", "unclassified"].includes(input.classification) || !input.fileName?.trim() || !Number.isFinite(input.size) || input.size <= 0 || input.size > 10 * 1024 * 1024 || !["application/pdf", "image/png", "image/jpeg", "text/plain"].includes(input.mime)) throw new Error("Valid packet type, source and PDF/image/text file up to 10 MB required.");
  if (input.dataUrl && (!input.dataUrl.startsWith(`data:${input.mime};base64,`) || input.dataUrl.length > 14 * 1024 * 1024)) throw new Error("File format does not match.");
  const d: PacketDocument = { ...input, id: `packet-doc-${++seq}`, referralId, part2: input.classification !== "general", attachedAt: new Date().toISOString(), attachedBy: actor.staffId ?? "" };
  documents.set(referralId, [...(documents.get(referralId) ?? []), d]); AdelanteEHR._emit(); return { referralId, documentId: d.id };
}
export function intakePacketDocuments(actor: IntakeActor, referralId: string) {
  if (!canIntakeB(actor, "packet_attach")) return [];
  const r = referralForPacket(referralId);
  return (documents.get(referralId) ?? []).map(d => {
    const restricted = !!(r.enrolledPatientId && isRestricted(r.enrolledPatientId)) || (d.part2 && !intakeTreatmentConsent(r));
    return restricted ? { id: d.id, type: "restricted" as const, restricted: true, reason: "Part 2 — needs consent covering intake/treatment", attachedAt: d.attachedAt } : { id: d.id, type: d.type, restricted: false, fileName: d.fileName, source: d.source, attachedAt: d.attachedAt, contentAvailable: !!d.dataUrl };
  });
}
export function packetDocumentContent(actor: IntakeActor, referralId: string, documentId: string) {
  const r = referralForPacket(referralId); const d = (documents.get(referralId) ?? []).find(x => x.id === documentId); if (!d) throw new Error("Document unavailable.");
  const isIntake = canIntakeB(actor, "packet_attach");
  const handoff = !!r.enrolledPatientId && completed(r.id) && careTeamCanRead(actor, r);
  const p = r.enrolledPatientId ? AdelanteEHR.getPatient(r.enrolledPatientId) : undefined;
  if (isIntake && r.enrolledPatientId && isRestricted(r.enrolledPatientId)) throw new Error("Restricted record — packet unavailable.");
  if (!isIntake && !handoff) throw new Error("Assigned care team after intake completion only.");
  if (d.part2 && (isIntake ? !intakeTreatmentConsent(r) : !p || canAccess(actor.role, "sud_treatment", p).locked || canAccess(actor.role, "sud_treatment", p).level === "none")) throw new Error("Part 2 — needs consent covering intake/treatment");
  return { mime: d.mime, dataUrl: d.dataUrl, fileName: d.fileName };
}
const completed = intakeCompleted;
export function careTeamPacket(actor: IntakeActor, patientId: string) {
  return AdelanteEHR.listReferrals().filter(r => r.enrolledPatientId === patientId && completed(r.id) && careTeamCanRead(actor, r)).map(r => {
    const p = AdelanteEHR.getPatient(patientId); const sud = p ? canAccess(actor.role, "sud_treatment", p) : undefined;
    const allowed = !!sud && !sud.locked && sud.level !== "none";
    return { referralId: r.id, needs: (needs.get(r.id) ?? []).filter(n => referenceValid(r, n) && (!n.part2 || allowed)).map(n => ({ kind: n.kind, source: n.source, state: n.state })), documents: (documents.get(r.id) ?? []).filter(d => !d.part2 || allowed).map(d => ({ id: d.id, type: d.type, fileName: d.fileName })) };
  });
}
export function intakePacketChecklist(actor: IntakeActor, referralId: string) { return { forms: intakeFormsStatus(actor, referralId), needs: intakePacketNeeds(actor, referralId), documents: intakePacketDocuments(actor, referralId) }; }