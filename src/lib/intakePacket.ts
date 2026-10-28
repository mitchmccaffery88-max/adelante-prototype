import { AdelanteEHR, type Referral } from "./ehr";
import { canAccess } from "./roles";
import { isRestricted } from "./chartAccess";
import { canIntakeB, assertIntakeB, intakeBReferral, intakeFormsStatus, careTeamCanRead } from "./intakePhaseB";
import { intakeCompleted, type IntakeActor } from "./intakePhaseA";
import { registerIntakeStagingBoundary } from "./intakeStagingBoundary";
import { canReadIntakePacket } from "./intakeFollowup";

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
registerIntakeStagingBoundary((raw, who) => {
  const fields = raw as Record<string, unknown>; const actor = who as IntakeActor;
  assertIntakeB(actor, "staging_import", "Referral staging");
  const keys = ["firstName", "lastName", "dob", "phone", "email", "referrerName", "referrerPhone", "referrerEmail", "referringAgency", "releaseDate", "intakeStaging", "referralSource", "consentToContact", "identityConfidence"];
  if (Object.keys(fields).some(k => !keys.includes(k))) throw new Error("Referral staging fields only.");
});
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
    const metadata = { source, sourceRef: sourceRef.trim(), ingestedBy: actor.staffId ?? "", ingestedAt: new Date().toISOString(), referralReason: row.referralReason?.trim() };
    const r = row.referralId ? AdelanteEHR.updateIntakeStagingReferral(row.referralId, { ...fields, intakeStaging: metadata }, actor) : AdelanteEHR.createReferral({ ...fields, intakeStaging: metadata, stagingActor: actor, channel: "staff", referralSource: source === "pre_release_packet" ? "correctional" : "community_based_organization", consentToContact: false, requestManualOutreach: true, identityConfidence: "verified_source" });
    if (!r) throw new Error("Staging referral unavailable.");
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
  if (r.enrolledPatientId && isRestricted(r.enrolledPatientId)) throw new Error("Restricted record — checklist unavailable.");
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
  if (actor.role === "intake_coordinator" && !canReadIntakePacket(actor, referralId)) return [];
  const r = referralForPacket(referralId);
  return (documents.get(referralId) ?? []).map(d => {
    const restricted = !!(r.enrolledPatientId && isRestricted(r.enrolledPatientId)) || (d.part2 && !intakeTreatmentConsent(r));
    return restricted ? { id: d.id, type: "restricted" as const, restricted: true, reason: "Part 2 — needs consent covering intake/treatment", attachedAt: d.attachedAt } : { id: d.id, type: d.type, restricted: false, fileName: d.fileName, source: d.source, attachedAt: d.attachedAt, contentAvailable: !!d.dataUrl };
  });
}
export function packetDocumentContent(actor: IntakeActor, referralId: string, documentId: string) {
  const r = referralForPacket(referralId); const d = (documents.get(referralId) ?? []).find(x => x.id === documentId); if (!d) throw new Error("Document unavailable.");
  const isIntake = canIntakeB(actor, "packet_attach") && (actor.role !== "intake_coordinator" || canReadIntakePacket(actor, referralId));
  const patient = r.enrolledPatientId ? AdelanteEHR.getPatient(r.enrolledPatientId) : undefined;
  const docAccess = patient ? canAccess(actor.role, "documents", patient) : undefined;
  const handoff = !!r.enrolledPatientId && completed(r.id) && careTeamCanRead(actor, r) && !!docAccess && !docAccess.locked && docAccess.level !== "none";
  const p = r.enrolledPatientId ? AdelanteEHR.getPatient(r.enrolledPatientId) : undefined;
  if (isIntake && r.enrolledPatientId && isRestricted(r.enrolledPatientId)) throw new Error("Restricted record — packet unavailable.");
  if (!isIntake && !handoff) throw new Error("Assigned care team after intake completion only.");
  if (d.part2 && (isIntake ? !intakeTreatmentConsent(r) : !p || canAccess(actor.role, "sud_treatment", p).locked || canAccess(actor.role, "sud_treatment", p).level === "none")) throw new Error("Part 2 — needs consent covering intake/treatment");
  AdelanteEHR._recordAudit({ category: "access", action: "record.viewed", patientId: r.enrolledPatientId, actorId: actor.staffId, actorRole: actor.role, detail: { sectionId: "intake_packet", kind: "open", documentId, referralId, simulated: true } });
  return { mime: d.mime, dataUrl: d.dataUrl, fileName: d.fileName };
}
const completed = intakeCompleted;
export function careTeamPacket(actor: IntakeActor, patientId: string) {
  return AdelanteEHR.listReferrals().filter(r => r.enrolledPatientId === patientId && completed(r.id) && careTeamCanRead(actor, r)).map(r => {
    const p = AdelanteEHR.getPatient(patientId); const sud = p ? canAccess(actor.role, "sud_treatment", p) : undefined;
    const allowed = !!sud && !sud.locked && sud.level !== "none";
    const sdoh = p ? canAccess(actor.role, "sdoh", p) : undefined; const docs = p ? canAccess(actor.role, "documents", p) : undefined;
    return { referralId: r.id, needs: sdoh && !sdoh.locked && sdoh.level !== "none" ? (needs.get(r.id) ?? []).filter(n => referenceValid(r, n) && (!n.part2 || allowed)).map(n => ({ kind: n.kind, source: n.source, state: n.state })) : [], documents: docs && !docs.locked && docs.level !== "none" ? (documents.get(r.id) ?? []).filter(d => !d.part2 || allowed).map(d => ({ id: d.id, type: d.type, fileName: d.fileName })) : [] };
  });
}
export function packetSourceChoices(actor: IntakeActor, referralId: string, source: PacketSource) {
  assertIntakeB(actor, "staging_import", "Source references"); const r = referralForPacket(referralId);
  if (source === "referral_form") return [{ id: `referral:${r.id}`, label: "This referral form" }];
  return [...(r.intakeStaging?.source === source ? [{ id: r.intakeStaging.sourceRef, label: "Imported referral source" }] : []), ...(documents.get(referralId) ?? []).filter(d => d.source === source && (!d.part2 || intakeTreatmentConsent(r))).map(d => ({ id: d.id, label: d.fileName }))];
}
export function intakePacketProgress(actor: IntakeActor, referralId: string) {
  const packet = intakePacketChecklist(actor, referralId);
  return { collected: packet.forms.filter(f => f.status === "Collected").length, missing: packet.forms.filter(f => f.status !== "Collected").length, needsLogged: packet.needs.filter(n => n.state !== "unknown").length, needsUnknown: packet.needs.filter(n => n.state === "unknown").length, documents: packet.documents.length };
}
export function intakePacketChecklist(actor: IntakeActor, referralId: string) { return { forms: intakeFormsStatus(actor, referralId), needs: intakePacketNeeds(actor, referralId), documents: intakePacketDocuments(actor, referralId) }; }
// 27 Oct lifecycle — "Getting started" reads. The person sees their own
// source-bound packet needs (kind + state only); clinicians drafting the first
// plan receive non-Part-2 needs only, as suggestions. No new store.
export const NEED_LABEL: Record<PacketNeedKind, { en: string; es: string }> = {
  housing: { en: "A place to live", es: "Un lugar donde vivir" }, food: { en: "Food", es: "Comida" },
  transportation: { en: "Getting around", es: "Transporte" }, employment: { en: "Work", es: "Trabajo" },
  benefits: { en: "Benefits", es: "Beneficios" }, legal: { en: "Legal help", es: "Ayuda legal" },
  education: { en: "School or training", es: "Estudios o capacitación" }, childcare: { en: "Childcare", es: "Cuidado de niños" },
  other: { en: "Other help", es: "Otra ayuda" },
};
function linkedReferrals(patientId: string) { return AdelanteEHR.listReferrals().filter(r => r.enrolledPatientId === patientId); }
export function patientOwnPacketNeeds(patientId: string) {
  return linkedReferrals(patientId).flatMap(r => (needs.get(r.id) ?? []).filter(n => referenceValid(r, n))).map(n => ({ id: n.id, kind: n.kind, state: n.state, source: n.source }));
}
export function clinicianPacketNeedFacts(patientId: string) {
  if (isRestricted(patientId)) return [];
  return linkedReferrals(patientId).flatMap(r => (needs.get(r.id) ?? []).filter(n => referenceValid(r, n) && !n.part2 && n.state !== "resolved")).map(n => ({ id: n.id, kind: n.kind, source: n.source }));
}
/** "Still need help with this?" — the person's own answer, through the same checklist state. */
export function patientConfirmPacketNeed(actor: { role: string; staffId?: string }, patientId: string, needId: string, still: boolean) {
  if (actor.role !== "patient" || actor.staffId !== patientId) throw new Error("Only you can do this for yourself.");
  for (const r of linkedReferrals(patientId)) {
    const n = (needs.get(r.id) ?? []).find(x => x.id === needId && referenceValid(r, x));
    if (n) { n.state = still ? "confirmed_still_needed" : "resolved"; AdelanteEHR._emit(); return { needId }; }
  }
  throw new Error("That item is no longer open.");
}
