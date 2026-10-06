// §Scribe Phase 1 — AI session-recording consent, scribe → draft note in the
// chart, sentence-level provenance, retention and pilot metrics.
//
// The capture and AI layers are SIMULATED (src/lib/vendors/scribe.ts). All the
// logic around them is real: consent gate (incl. Part 2 + all-party), draft in
// the chart's real note form, review/sign gate, provenance, audit, retention.
// Audit rows carry ids and counts only — never transcript or draft text.
// Every mutation runs through the registry (runAction) — see chartActions.ts.
import { AdelanteEHR, type ConsentRecordSection, type Patient, type ProgressNote } from "./ehr";
import type { StaffRole } from "./roles";
import { canAccess } from "./roles";
import { roleSeesAsamSection } from "./asamReporting";
import { cohortGuard } from "./cohortGuard";
import { scribe, type AfbiDraftFields, type DraftSentence, type ScribeDraftOutput, type ScribeSpeaker, type TranscriptSegment } from "./vendors/scribe";
import { canRecordAfbi, recordAfbiContact, ownsAfbiContact, updateAfbiContactFromDraft, roleSeesAfbiDetail, AFBI_ACTIVITIES, AFBI_LOCATION_TYPES, AFBI_OUTCOMES, type AfbiActivity, type AfbiContact, type AfbiLocationType, type AfbiOutcome } from "./afbiOutreach";
import { defaultFormat, DMC_NARRATIVE_KEYS, FORMAT_SECTIONS, SCRIBE_FORMAT_LABEL, templateKeyFor, type ScribeFormat } from "./scribeFormats";

export const AI_CONSENT_CATEGORY = "ai_session_recording" as const;
export const AI_CONSENT_PART2_CATEGORY = "ai_session_recording_part2" as const;
export const AI_DRAFT_LABEL = "AI draft — review required";
export const COUNSEL_DRAFT_LABEL = "Draft — pending counsel review";
export const RETENTION_DRAFT_LABEL = "Transcript kept until the note is signed, or 7 days if unsigned — Draft, pending clinical sign-off";
export const UNSIGNED_RETENTION_DAYS = 7;
export const UNSUPPORTED_LABEL = "Not found in transcript — verify or delete";
export const SPEAKER_UNCERTAIN_LABEL = "Speaker uncertain";
export const UNSURE_LABEL = "Unsure what was said — check";
export const SPANISH_MARKER = "Session included Spanish";
/** Confidence thresholds — Draft, pending clinical sign-off. */
export const SPEAKER_CONFIDENCE_MIN = 0.7;
export const ASR_CONFIDENCE_MIN = 0.75;

/** Roles that may capture with the AI scribe in Phase 1. */
export const SCRIBE_CAPTURE_ROLES: readonly StaffRole[] = ["physician", "pmhnp", "therapist", "sud_counselor", "nurse_rn"];
/**
 * §1b (Draft — pending clinical sign-off): POST-ENCOUNTER DICTATION ONLY, limited
 * to AFBI contacts and the role's own contact notes. No live ambient capture.
 */
export const SCRIBE_DICTATION_ONLY_ROLES: readonly StaffRole[] = ["peer_specialist", "community_health_worker", "ecm_provider", "cf_care_manager"];
/** §1b — no scribe access at all. */
export const SCRIBE_NO_ACCESS_ROLES: readonly StaffRole[] = ["lvn"];
/** Older name kept for screens that list "not live capture" roles. */
export const SCRIBE_PHASE2_ROLES = SCRIBE_DICTATION_ONLY_ROLES;
export const ROLE_SCOPE_DRAFT_LABEL = "Scribe roles: Draft — pending SME decision";
export function canCaptureScribe(role: StaffRole | string): boolean {
  return (SCRIBE_CAPTURE_ROLES as readonly string[]).includes(role);
}
export function isDictationOnlyRole(role: StaffRole | string): boolean {
  return (SCRIBE_DICTATION_ONLY_ROLES as readonly string[]).includes(role);
}
/** Post-encounter dictation (and reviewing one's own AI drafts). */
export function canDictateScribe(role: StaffRole | string): boolean {
  return canCaptureScribe(role) || isDictationOnlyRole(role);
}
/** Visit types that count as a dictation-only role's "own contact note". */
export const CONTACT_NOTE_SERVICE_TYPES: readonly string[] = ["case_management", "care_coordination", "peer_support"];

// ------------------------------------------------------------------ §1b settings
export type ScribeSetting = "telehealth" | "clinic" | "field";
export const SCRIBE_SETTINGS: readonly ScribeSetting[] = ["telehealth", "clinic", "field"];
export const SCRIBE_SETTING_LABEL: Record<ScribeSetting, string> = { telehealth: "Telehealth", clinic: "In person — clinic", field: "In the field" };
export const SETTING_DRAFT_LABEL = "Setting safeguards: Draft — pending clinical sign-off";
export const NOISY_SETTING_LABEL = "Noisy setting";
export const PRIVATE_LOCATION_LABEL = "Location is private enough for this conversation";
/** Uncertainty thresholds by setting — Draft, pending clinical sign-off. Field is stricter. */
export function thresholdsFor(setting: ScribeSetting | undefined): { speaker: number; asr: number } {
  return setting === "field" ? { speaker: 0.8, asr: 0.85 } : { speaker: SPEAKER_CONFIDENCE_MIN, asr: ASR_CONFIDENCE_MIN };
}
const FIELD_LOCATION = /field|home|community|street|shelter|outreach|mobile/i;
/** Default setting: AFBI → field; else from the visit's modality and location. */
export function defaultSetting(input: { appointmentId?: string; afbi?: boolean }): ScribeSetting {
  if (input.afbi) return "field";
  const a = input.appointmentId ? AdelanteEHR.listAppointments().find((x) => x.id === input.appointmentId) : undefined;
  if (!a) return "clinic";
  if (a.modality === "video" || a.modality === "phone") return "telehealth";
  const loc = a.locationId ? AdelanteEHR.locationsForService(a.serviceType as never).find((l) => l.id === a.locationId) : undefined;
  if (FIELD_LOCATION.test(`${a.locationId ?? ""} ${loc?.name ?? ""}`)) return "field";
  return "clinic";
}

// ------------------------------------------------------------------ §1b connectivity
/** Demo toggle — simulated connectivity. No audio is ever buffered on the device. */
let offline = false;
export function setScribeOffline(on: boolean): void {
  offline = on;
}
export function isScribeOffline(): boolean {
  return offline;
}
export const OFFLINE_REASON = "No connection — capture can't run offline";
export const OFFLINE_NEXT = "We never store audio, so nothing can be recorded offline. Use \"Dictate after the encounter\" once you're back online.";
/**
 * Counsel question kept in ONE flag: does dictating the staff member's own
 * summary need the patient's AI recording consent? Default: yes (required).
 */
export const DICTATION_REQUIRES_PATIENT_CONSENT = true;
export const DICTATION_CONSENT_DRAFT_LABEL = "Draft — counsel to confirm whether dictation of the staff member's own summary needs patient recording consent";
export const PRE_ENROLLMENT_RULE = "Not enrolled yet: AI recording consent can't be checked, so only post-encounter dictation is allowed. Use initials only — no names, birth dates, phone numbers or addresses. Draft — pending clinical sign-off.";
export const IDENTIFYING_LABEL = "Identifying detail — initials only before enrollment";
const IDENTIFYING = /\b[A-Z][a-z]+\s[A-Z][a-z]+\b|\b\d{3}[-.\s]\d{3,4}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b\d+\s+\w+\s+(street|st|avenue|ave|road|rd|blvd|boulevard)\b/;
export function hasIdentifyingDetail(text: string): boolean {
  // Ignore the first word of a sentence so "Next step" style openers don't match.
  return IDENTIFYING.test(text.replace(/^\s*\S+/, (w) => w.toLowerCase()));
}
/** Staff who may record the consent on a patient's behalf (assisted-consent pattern). */
export function canRecordAiConsent(role: StaffRole | string): boolean {
  return canCaptureScribe(role) || role === "clinical_coordinator" || role === "medical_assistant";
}

// ------------------------------------------------------------------ consent text
export const AI_CONSENT_COPY = {
  en: {
    title: "AI-assisted session documentation (recording)",
    lines: [
      "With your OK, a computer listens during your session and writes a first draft of your clinician's note.",
      "What is captured: the words spoken in the session, turned into text. Audio is not stored.",
      "The text (transcript) is deleted after your clinician signs the note.",
      "Your clinician reviews and edits everything before it goes in your record.",
      "You can say no, or stop it at any time, even in the middle of a session. Your care will not change.",
    ],
    part2Line:
      "This also covers sessions about substance use. Those records have extra federal protection (42 CFR Part 2) and are not shared without your written permission.",
    grant: "I agree",
    withdraw: "Stop / withdraw",
    active: "You agreed",
    notActive: "Not agreed",
    draft: "",
  },
  es: {
    title: "Documentación de la sesión con ayuda de IA (grabación)",
    lines: [
      "Con su permiso, una computadora escucha durante su sesión y escribe un primer borrador de la nota de su clínico.",
      "Qué se captura: las palabras dichas en la sesión, convertidas en texto. El audio no se guarda.",
      "El texto (transcripción) se borra después de que su clínico firma la nota.",
      "Su clínico revisa y corrige todo antes de que pase a su expediente.",
      "Puede decir que no, o detenerlo en cualquier momento, incluso durante la sesión. Su atención no cambiará.",
    ],
    part2Line:
      "Esto también cubre sesiones sobre el uso de sustancias. Esos registros tienen protección federal adicional (42 CFR Parte 2) y no se comparten sin su permiso por escrito.",
    grant: "Acepto",
    withdraw: "Detener / retirar",
    active: "Usted aceptó",
    notActive: "No ha aceptado",
    draft: "Borrador — traducción pendiente de revisión bilingüe",
  },
} as const;

export const ALL_PARTY_REMINDER =
  "California generally requires every party's consent to record a confidential conversation. Confirm everyone present has agreed before you start. Draft — pending counsel review.";

// ------------------------------------------------------------------ Part 2
const SUD_SERVICE = /^sud_/;
/** Patient has SUD context: an active SUD problem, a SUD note, or a SUD visit type. */
export function patientNeedsPart2(p: Patient): boolean {
  if ((p.problems ?? []).some((x) => x.category === "sud" && !(x as { removedAt?: string }).removedAt)) return true;
  if ((p.progressNotes ?? []).some((n) => n.category === "sud")) return true;
  return AdelanteEHR.listAppointments().some((a) => a.patientId === p.id && SUD_SERVICE.test(a.serviceType ?? ""));
}
function sessionIsSud(p: Patient, appointmentId?: string): boolean {
  const a = appointmentId ? AdelanteEHR.listAppointments().find((x) => x.id === appointmentId) : undefined;
  return SUD_SERVICE.test(a?.serviceType ?? "") || patientNeedsPart2(p);
}
/** Roles failing the existing Part 2 checks see SUD transcripts / drafts hidden. */
export function roleSeesSudScribe(role: StaffRole, p: Patient): boolean {
  return roleSeesAsamSection(role, p) && !canAccess(role, "screeners_sud", p).locked;
}

// ------------------------------------------------------------------ consent status
export type AiConsentState = "active" | "none" | "withdrawn" | "expired" | "not_yet";
export interface AiConsentStatus {
  state: AiConsentState;
  part2: boolean;
  effectiveOn?: string;
  expiresOn?: string;
}
export function aiConsentStatus(patientId: string, at = new Date()): AiConsentStatus {
  const rec = AdelanteEHR.activeConsentRecord(patientId, at);
  const sec = rec?.sections.find((s) => s.category === AI_CONSENT_CATEGORY);
  const p2 = rec?.sections.find((s) => s.category === AI_CONSENT_PART2_CATEGORY);
  if (!sec) {
    const ever = AdelanteEHR.listConsentRecords(patientId).some((r) => r.sections.some((s) => s.category === AI_CONSENT_CATEGORY));
    return { state: ever ? "withdrawn" : "none", part2: false };
  }
  const base = { effectiveOn: sec.effectiveOn, expiresOn: sec.expiresOn, part2: Boolean(p2?.authorized) };
  if (!sec.authorized) return { ...base, state: "withdrawn", part2: false };
  const day = at.toISOString().slice(0, 10);
  if (sec.effectiveOn && sec.effectiveOn > day) return { ...base, state: "not_yet" };
  if (sec.expiresOn && sec.expiresOn < day) return { ...base, state: "expired" };
  return { ...base, state: "active" };
}
function hasActiveConsent(p: Patient, sud: boolean, at = new Date()): boolean {
  const s = aiConsentStatus(p.id, at);
  return s.state === "active" && (!sud || s.part2);
}

export interface ScribeActor {
  name: string;
  role: StaffRole | string;
  staffId?: string;
  clinicianId?: string;
}

function audit(action: string, patientId: string | undefined, actor: ScribeActor | { name: string; role: string }, detail: Record<string, unknown> = {}) {
  AdelanteEHR._recordAudit({ category: "scribe", action, patientId, actorId: actor.name, actorRole: String(actor.role), detail: { simulated: true, ...detail } });
}

function carrySections(patientId: string): ConsentRecordSection[] {
  const prior = AdelanteEHR.activeConsentRecord(patientId);
  return (prior?.sections ?? []).filter((s) => s.category !== AI_CONSENT_CATEGORY && s.category !== AI_CONSENT_PART2_CATEGORY);
}

export interface GrantAiConsentInput {
  patientId: string;
  signedByName: string;
  relationship?: "patient" | "guardian" | "proxy";
  attested: boolean;
  /** Required when the patient has SUD context. */
  part2: boolean;
  effectiveOn?: string;
  expiresOn?: string;
  /** "patient_self" from My care, or the assisted staff member. */
  capturedBy: { staffId?: string; staffName: string; role: string };
  source?: string;
}
/** Store function for `scribe_consent_grant`. Supersedes the record in force, carrying every other section forward. */
export function grantAiRecordingConsent(input: GrantAiConsentInput) {
  const p = AdelanteEHR.getPatient(input.patientId);
  if (!p) throw new Error("Patient not found.");
  if (patientNeedsPart2(p) && !input.part2)
    throw new Error("This person has substance-use care. The consent must also cover Part 2 sessions.");
  const today = new Date().toISOString().slice(0, 10);
  const effectiveOn = input.effectiveOn ?? today;
  if (input.expiresOn && input.expiresOn < effectiveOn) throw new Error("The expiry date must be after the effective date.");
  const rec = AdelanteEHR.createConsentRecord({
    patientId: p.id,
    formType: "NonAB133",
    source: input.source ?? (input.capturedBy.role === "patient" ? "patient — My care" : "assisted — staff on patient's behalf"),
    signedByName: input.signedByName,
    relationship: input.relationship,
    attested: input.attested,
    effectiveDate: effectiveOn,
    sections: [
      ...carrySections(p.id),
      { category: AI_CONSENT_CATEGORY, authorized: true, effectiveOn, expiresOn: input.expiresOn },
      { category: AI_CONSENT_PART2_CATEGORY, authorized: input.part2, effectiveOn, expiresOn: input.expiresOn },
    ],
    capturedBy: input.capturedBy,
  });
  audit("scribe_consent_granted", p.id, { name: input.capturedBy.staffName, role: input.capturedBy.role }, { consentRecordId: rec.id, part2: input.part2, expiresOn: input.expiresOn ?? null });
  return rec;
}

/** Store function for `scribe_consent_withdraw`. Stops any live capture for this patient at once and discards it. */
export function withdrawAiRecordingConsent(input: { patientId: string; by: string; role: string; staffId?: string }) {
  const p = AdelanteEHR.getPatient(input.patientId);
  if (!p) throw new Error("Patient not found.");
  const rec = AdelanteEHR.createConsentRecord({
    patientId: p.id,
    formType: "Revocation",
    source: input.role === "patient" ? "patient — My care (withdrawal)" : "assisted — withdrawal recorded by staff",
    signedByName: input.by,
    attested: true,
    effectiveDate: new Date().toISOString().slice(0, 10),
    sections: [...carrySections(p.id), { category: AI_CONSENT_CATEGORY, authorized: false }, { category: AI_CONSENT_PART2_CATEGORY, authorized: false }],
    capturedBy: { staffId: input.staffId, staffName: input.by, role: input.role },
  });
  audit("scribe_consent_withdrawn", p.id, { name: input.by, role: input.role }, { consentRecordId: rec.id });
  for (const s of sessions.filter((x) => x.patientId === p.id && x.state === "capturing"))
    discardSession(s, { name: input.by, role: input.role }, "consent_withdrawn");
  return rec;
}

// ------------------------------------------------------------------ sessions
export interface ScribeParty {
  kind: "patient" | "advocate" | "interpreter" | "family" | "other";
  agreed: boolean;
  /** §1b — clinic and field: everyone else present must be named (name + relationship). */
  name?: string;
  relationship?: string;
}
export interface ScribeSentence {
  id: string;
  sectionKey: string;
  text: string;
  originalText: string;
  /** Provenance — survives transcript deletion. */
  sources: { segmentId: string; speaker: ScribeSpeaker; atSec: number }[];
  unsupported: boolean;
  speakerUncertain: boolean;
  unsure: boolean;
  /** §1b — pre-enrollment AFBI dictation: identifying detail must be edited out or deleted. */
  identifying?: boolean;
  resolution?: { kind: "kept" | "edited" | "deleted"; reason?: string; by: string; at: string };
}
export interface ScribeSession {
  id: string;
  patientId: string;
  appointmentId?: string;
  groupSessionId?: string;
  format: ScribeFormat;
  sud: boolean;
  state: "capturing" | "discarded" | "drafted";
  startedAt: string;
  startedBy: { name: string; role: string; staffId?: string; clinicianId?: string };
  endedAt?: string;
  parties: ScribeParty[];
  /** null once deleted under retention (or discarded). */
  transcript: TranscriptSegment[] | null;
  transcriptDeleted?: { at: string; by: string; reason: "signed" | "unsigned_7_days" | "discarded" };
  includedSpanish: boolean;
  noteId?: string;
  sentences: ScribeSentence[];
  followUps: { id: string; kind: "book_visit" | "rescreen"; label: string; detail?: string; acceptedAt?: string; acceptedBy?: string }[];
  /** §1b */
  setting: ScribeSetting;
  kind: "ambient" | "dictation";
  target: "note" | "afbi";
  privateLocationConfirmed?: boolean;
  paused?: boolean;
  /** Pauses show as gaps; nothing is captured while paused. */
  pauses: { at: string; resumedAt?: string; afterSegmentId?: string; skipped: number }[];
  /** AFBI target: person initials when not enrolled (patientId is ""). */
  afbiInitials?: string;
  afbiFields?: AfbiDraftFields;
  afbiContactId?: string;
  /** AFBI target review state (notes keep it on the note). */
  openedAt?: string;
  reviewConfirmedAt?: string;
  reviewConfirmedBy?: string;
  rating?: number;
}

const sessions: ScribeSession[] = [];
let seq = 0;
const sid = () => `scr-${Date.now().toString(36)}-${(++seq).toString(36)}`;

export function listScribeSessions(patientId?: string): ScribeSession[] {
  return sessions.filter((s) => !patientId || s.patientId === patientId);
}
export function getScribeSession(id: string): ScribeSession | undefined {
  return sessions.find((s) => s.id === id);
}
export function scribeSessionForNote(noteId: string): ScribeSession | undefined {
  return sessions.find((s) => s.noteId === noteId);
}
/** Test hook. */
export function _resetScribe(): void {
  sessions.length = 0;
  metricRows.length = 0;
  pending.clear();
  offline = false;
}
/** Simulated vendor stream not yet received (in memory only — never on device storage). */
const pending = new Map<string, TranscriptSegment[]>();

export type ScribeBlock = { reason: string; next: string };
export interface CaptureRequest {
  actor: ScribeActor;
  patientId: string;
  appointmentId?: string;
  format: ScribeFormat;
  allPartyConfirmed: boolean;
  parties?: ScribeParty[];
  /** Group (IOT/ODF) occurrence: every present member must have consent. */
  groupSessionId?: string;
  presentPatientIds?: string[];
  /** §1b — defaults from the visit (AFBI → field). */
  setting?: ScribeSetting;
  privateLocationConfirmed?: boolean;
  target?: "note" | "afbi";
}
const initials = (p: Patient) => `${p.firstName[0] ?? ""}.${p.lastName[0] ?? ""}.`;

/** The one gate. Returns why capture can't start, or null. */
export function captureBlocker(req: CaptureRequest, at = new Date()): ScribeBlock | null {
  if (!canCaptureScribe(req.actor.role))
    return isDictationOnlyRole(req.actor.role)
      ? { reason: "Your role uses post-encounter dictation only — no live capture.", next: "After the encounter, use \"Dictate after the encounter\" (AFBI contacts and your own contact notes). Draft — pending SME decision." }
      : { reason: "Your role doesn't use the AI scribe.", next: "Write the note in the chart." };
  if (offline) return { reason: OFFLINE_REASON, next: OFFLINE_NEXT };
  const p = AdelanteEHR.getPatient(req.patientId);
  if (!p) return { reason: "Pick a patient.", next: "Open the scribe from a chart or a visit." };
  const appt = req.appointmentId ? AdelanteEHR.listAppointments().find((a) => a.id === req.appointmentId) : undefined;
  const isGroup = Boolean(req.groupSessionId) || /group/.test(appt?.serviceType ?? "");
  if (isGroup) {
    const ids = req.presentPatientIds ?? (req.groupSessionId ? AdelanteEHR.listGroupEnrollments(req.groupSessionId).map((e) => e.patientId) : [p.id]);
    const missing = ids
      .map((id) => AdelanteEHR.getPatient(id))
      .filter((m): m is Patient => Boolean(m))
      .filter((m) => !hasActiveConsent(m, true, at));
    if (missing.length)
      return {
        reason: `Group capture is blocked: ${missing.length} member${missing.length === 1 ? "" : "s"} present without AI recording consent (${missing.map(initials).join(", ")}).`,
        next: "Every member present must agree first. Write this group note by hand today.",
      };
  }
  const sud = sessionIsSud(p, req.appointmentId);
  const st = aiConsentStatus(p.id, at);
  if (st.state !== "active") {
    const why = { none: "No AI recording consent on file.", withdrawn: "The patient withdrew AI recording consent.", expired: "AI recording consent has expired.", not_yet: "AI recording consent isn't in effect yet." }[st.state];
    return { reason: why, next: "Ask the patient. If they agree, record it in the chart's Consents section (or they can agree in My care). Otherwise write the note by hand." };
  }
  if (sud && !st.part2)
    return { reason: "This session involves substance-use care, and the consent doesn't cover Part 2.", next: "Record a new AI recording consent that includes the Part 2 line, or write the note by hand." };
  const setting = req.setting ?? defaultSetting({ appointmentId: req.appointmentId, afbi: req.target === "afbi" });
  if (setting === "field" && !req.privateLocationConfirmed)
    return { reason: "Confirm the location is private enough for this conversation.", next: "Move somewhere more private if you need to, then tick the privacy check." };
  const others = (req.parties ?? []).filter((x) => x.kind !== "patient");
  if (setting !== "telehealth" && others.some((x) => !x.name?.trim() || !x.relationship?.trim()))
    return { reason: "Add each other person present by name and relationship.", next: "A general checkbox doesn't count in person. Name each person (interpreter, advocate, family, bystander) and how they relate to the patient." };
  if (!req.allPartyConfirmed || (req.parties ?? []).some((x) => !x.agreed))
    return { reason: "Confirm everyone present has agreed to recording.", next: "Ask each person in the room (patient, advocate, interpreter, family), then tick the confirmation." };
  return null;
}

/** Store function for `scribe_start`. */
export function startScribeSession(req: CaptureRequest): ScribeSession {
  const block = captureBlocker(req);
  if (block) throw new Error(block.reason);
  const p = AdelanteEHR.getPatient(req.patientId)!;
  const setting = req.setting ?? defaultSetting({ appointmentId: req.appointmentId, afbi: req.target === "afbi" });
  const s: ScribeSession = {
    id: sid(),
    patientId: p.id,
    appointmentId: req.appointmentId,
    groupSessionId: req.groupSessionId,
    format: req.format,
    sud: sessionIsSud(p, req.appointmentId),
    state: "capturing",
    startedAt: new Date().toISOString(),
    startedBy: { name: req.actor.name, role: String(req.actor.role), staffId: req.actor.staffId, clinicianId: req.actor.clinicianId },
    parties: req.parties?.length ? req.parties : [{ kind: "patient", agreed: true }],
    // Filled as the (simulated) stream arrives — see ingestScribeSegments.
    transcript: [],
    includedSpanish: false,
    sentences: [],
    followUps: [],
    setting,
    kind: "ambient",
    target: req.target ?? "note",
    privateLocationConfirmed: req.privateLocationConfirmed,
    pauses: [],
  };
  pending.set(s.id, scribe.transcript({ patientFirstName: p.firstName }));
  sessions.unshift(s);
  // Party names are identifying — the audit gets counts only.
  audit("scribe_capture_started", p.id, req.actor, { sessionId: s.id, format: s.format, setting, parties: s.parties.length, group: Boolean(req.groupSessionId) });
  return s;
}

/**
 * Simulated vendor stream → transcript. Not a registry action (it is the
 * capture pipeline, like a vendor callback), and nothing is audited per chunk.
 * While paused, speech is never captured: the segments are dropped and the
 * pause shows as a gap.
 */
export function ingestScribeSegments(sessionId: string, count = 1): number {
  const s = getScribeSession(sessionId);
  const q = pending.get(sessionId);
  if (!s || s.state !== "capturing" || !s.transcript || !q) return 0;
  let n = 0;
  for (let i = 0; i < count && q.length; i++) {
    const seg = q.shift()!;
    if (s.paused) {
      s.pauses[s.pauses.length - 1]!.skipped++;
      continue;
    }
    s.transcript.push(seg);
    n++;
  }
  s.includedSpanish = s.transcript.some((t) => t.lang !== "en");
  return n;
}
export function pendingSegments(sessionId: string): number {
  return pending.get(sessionId)?.length ?? 0;
}
/** Store function for `scribe_pause`. */
export function pauseScribeSession(sessionId: string, actor: ScribeActor) {
  const s = getScribeSession(sessionId);
  if (!s || s.state !== "capturing") throw new Error("This session is not capturing.");
  if (s.setting === "telehealth") throw new Error("Pause is for in-person and field sessions.");
  if (s.paused) return s;
  s.paused = true;
  s.pauses.push({ at: new Date().toISOString(), afterSegmentId: s.transcript?.[s.transcript.length - 1]?.id, skipped: 0 });
  audit("scribe_capture_paused", s.patientId || undefined, actor, { sessionId });
  return s;
}
/** Store function for `scribe_resume`. */
export function resumeScribeSession(sessionId: string, actor: ScribeActor) {
  const s = getScribeSession(sessionId);
  if (!s || s.state !== "capturing") throw new Error("This session is not capturing.");
  if (!s.paused) return s;
  s.paused = false;
  s.pauses[s.pauses.length - 1]!.resumedAt = new Date().toISOString();
  audit("scribe_capture_resumed", s.patientId || undefined, actor, { sessionId });
  return s;
}

function discardSession(s: ScribeSession, actor: { name: string; role: string }, reason: string) {
  s.state = "discarded";
  s.transcript = null;
  pending.delete(s.id);
  s.transcriptDeleted = { at: new Date().toISOString(), by: actor.name, reason: "discarded" };
  audit("scribe_capture_discarded", s.patientId, actor, { sessionId: s.id, reason });
}
/** Store function for `scribe_discard` — stops capture now and discards the in-progress transcript. */
export function discardScribeSession(sessionId: string, actor: ScribeActor, reason = "stopped") {
  const s = getScribeSession(sessionId);
  if (!s) throw new Error("Session not found.");
  if (s.state !== "capturing") throw new Error("This session is not capturing.");
  discardSession(s, { name: actor.name, role: String(actor.role) }, reason);
  return s;
}

function bodyFor(s: ScribeSession): Record<string, string> {
  const out: Record<string, string> = {};
  for (const sec of [...FORMAT_SECTIONS[s.format].map((x) => x.key), ...DMC_NARRATIVE_KEYS]) {
    out[sec] = s.sentences.filter((x) => x.sectionKey === sec && x.resolution?.kind !== "deleted").map((x) => x.text).join(" ");
  }
  return out;
}
export function unresolvedCount(s: ScribeSession): number {
  return s.sentences.filter((x) => (x.unsupported || x.identifying) && !x.resolution).length;
}

function buildSentences(s: ScribeSession, out: ScribeDraftOutput) {
  const segs = s.transcript ?? [];
  const byId = new Map(segs.map((t) => [t.id, t]));
  const th = thresholdsFor(s.setting);
  const preEnroll = s.target === "afbi" && !s.patientId;
  let n = 0;
  const mk = (sectionKey: string, d: DraftSentence): ScribeSentence => {
    const src = d.sourceIds.map((id) => byId.get(id)).filter((x): x is TranscriptSegment => Boolean(x));
    return {
      id: `${s.id}-${++n}`,
      sectionKey,
      text: d.text,
      originalText: d.text,
      sources: src.map((g) => ({ segmentId: g.id, speaker: g.speaker, atSec: g.atSec })),
      unsupported: src.length === 0,
      speakerUncertain: src.some((g) => g.speakerConfidence < th.speaker),
      unsure: src.some((g) => g.asrConfidence < th.asr),
      ...(preEnroll && hasIdentifyingDetail(d.text) ? { identifying: true } : {}),
    };
  };
  s.sentences = Object.entries(out.sections).flatMap(([k, list]) => list.map((d) => mk(k, d)));
  s.followUps = out.followUps.map((f) => ({ ...f }));
  if (out.afbi) s.afbiFields = { ...out.afbi };
  s.includedSpanish = segs.some((t) => t.lang !== "en");
}

function createDraftNote(s: ScribeSession, actor: ScribeActor): ProgressNote {
  const appt = s.appointmentId ? AdelanteEHR.listAppointments().find((a) => a.id === s.appointmentId) : undefined;
  const tpl = AdelanteEHR.listNoteTemplates().find((t) => t.key === templateKeyFor(s.format));
  const loc = appt?.locationId ? AdelanteEHR.locationsForService(appt.serviceType as never).find((l) => l.id === appt.locationId)?.name : undefined;
  const answers: Record<string, string | number> = {
    ...bodyFor(s),
    // Visit facts only — never a diagnosis or billing code.
    service_type: appt ? (AdelanteEHR.getServiceType(appt.serviceType as never)?.label ?? String(appt.serviceType)) : "",
    service_date: (appt?.start ?? s.startedAt).slice(0, 10),
    service_minutes: appt?.durationMin ?? Math.max(1, Math.round((+new Date(s.endedAt!) - +new Date(s.startedAt)) / 60000)),
    modality: appt?.modality === "in_person" ? "In person" : appt?.modality === "phone" ? "Phone" : appt?.modality === "video" ? "Video" : s.setting === "telehealth" ? "" : "In person",
    location: appt?.modality === "in_person" ? (loc ?? "") : appt ? "Telehealth" : s.setting === "field" ? "Community (field)" : "",
  };
  const note = AdelanteEHR.addProgressNote(s.patientId, {
    appointmentId: s.appointmentId,
    clinicianId: actor.clinicianId ?? actor.staffId ?? actor.name,
    date: new Date().toISOString().slice(0, 10),
    sessionType: s.groupSessionId ? "group" : appt?.modality === "phone" ? "phone" : "individual",
    subjective: "",
    objective: "",
    assessment: "",
    plan: "",
    ...(s.sud ? { category: "sud" as const } : {}),
    authorSource: "ai_draft",
    status: "draft",
    templateId: tpl?.id,
    templateKey: tpl?.key,
    templateTitle: tpl ? `${tpl.title} · ${AI_DRAFT_LABEL}` : AI_DRAFT_LABEL,
    templateVersion: tpl?.version,
    templateSchema: tpl?.schema,
    templateAnswers: answers as never,
    aiScribe: { sessionId: s.id, format: s.format, unresolved: unresolvedCount(s), includedSpanish: s.includedSpanish },
  })!;
  s.noteId = note.id;
  return note;
}

function auditDraft(s: ScribeSession, actor: ScribeActor) {
  audit("scribe_draft_created", s.patientId || undefined, actor, {
    sessionId: s.id,
    noteId: s.noteId,
    kind: s.kind,
    target: s.target,
    setting: s.setting,
    format: s.format,
    sentences: s.sentences.length,
    unsupported: s.sentences.filter((x) => x.unsupported).length,
    speakerUncertain: s.sentences.filter((x) => x.speakerUncertain).length,
    pauses: s.pauses.length,
  });
}

/** Store function for `scribe_end` — creates the unsigned AI draft (chart note, or AFBI fields). */
/** Returns the draft note (target note) or the session (target AFBI). */
export function endScribeSession<T extends ProgressNote | ScribeSession = ProgressNote>(sessionId: string, actor: ScribeActor): T {
  const s = getScribeSession(sessionId);
  if (!s) throw new Error("Session not found.");
  if (s.state !== "capturing" || !s.transcript) throw new Error("This session is not capturing.");
  // Consent is re-checked live at the end: a withdrawal discards instead.
  const p = AdelanteEHR.getPatient(s.patientId)!;
  if (!hasActiveConsent(p, s.sud) && !s.groupSessionId) {
    discardSession(s, { name: actor.name, role: String(actor.role) }, "consent_inactive_at_end");
    throw new Error("Consent is no longer active — the transcript was discarded.");
  }
  // Drain the stream; while paused, the rest is never captured.
  ingestScribeSegments(s.id, Number.MAX_SAFE_INTEGER);
  if (s.paused) resumeScribeSession(s.id, actor);
  pending.delete(s.id);
  buildSentences(s, s.target === "afbi" ? scribe.afbiDraft(s.transcript) : scribe.draft(s.transcript, s.format));
  s.endedAt = new Date().toISOString();
  s.state = "drafted";
  if (s.target === "afbi") {
    auditDraft(s, actor);
    return s as T;
  }
  const note = createDraftNote(s, actor);
  auditDraft(s, actor);
  return note as T;
}

// ------------------------------------------------------------------ §1b post-encounter dictation
export interface DictationRequest {
  actor: ScribeActor;
  target: "note" | "afbi";
  patientId?: string;
  appointmentId?: string;
  format?: ScribeFormat;
  /** AFBI pre-enrollment only. */
  initials?: string;
  setting?: ScribeSetting;
  /** Dictating onto an EXISTING AFBI contact — only its recorder (or reassigned owner). */
  afbiContactId?: string;
}

export const OWN_CONTACT_BLOCK = "You can only dictate on your own contacts";

/** Rendering (own calendar) or assigned staff on the visit. */
export function isOwnContactVisit(a: { clinicianId: string; assignedStaffId?: string }, actor: ScribeActor): boolean {
  if (actor.staffId && a.assignedStaffId === actor.staffId) return true;
  return Boolean(actor.clinicianId && a.clinicianId === actor.clinicianId);
}
/** Why post-encounter dictation can't run, or null. */
export function dictationBlocker(req: DictationRequest, at = new Date()): ScribeBlock | null {
  const role = req.actor.role;
  if (!canDictateScribe(role)) return { reason: "Your role doesn't use the AI scribe or dictation.", next: "Write the note or contact by hand." };
  if (offline) return { reason: "No connection — dictation is available once you're back online.", next: "Jot a few words on paper if you need to, then dictate when you have signal. Nothing is recorded offline." };
  const p = req.patientId ? AdelanteEHR.getPatient(req.patientId) : undefined;
  if (req.patientId && !p) return { reason: "Patient not found.", next: "Pick the person again." };
  if (req.target === "afbi") {
    if (!canRecordAfbi(role as StaffRole)) return { reason: "Your role doesn't record field outreach (AFBI) contacts.", next: "Dictate a contact note from a visit instead." };
    if (req.afbiContactId && !ownsAfbiContact(req.afbiContactId, req.actor.staffId))
      return { reason: OWN_CONTACT_BLOCK, next: "Ask the staff member who recorded this contact, or a clinical coordinator to reassign it to you." };
    if (!p && !req.afbiContactId && !/^[A-Za-z]{1,4}$/.test((req.initials ?? "").replace(/\./g, "").trim()))
      return { reason: "Enter the person's initials first.", next: PRE_ENROLLMENT_RULE };
  } else {
    if (!p) return { reason: "Pick a patient.", next: "Open dictation from a chart or a visit." };
    if (isDictationOnlyRole(role)) {
      const a = req.appointmentId ? AdelanteEHR.listAppointments().find((x) => x.id === req.appointmentId && x.patientId === p.id) : undefined;
      if (!a || !CONTACT_NOTE_SERVICE_TYPES.includes(String(a.serviceType)))
        return { reason: "Dictation for your role is limited to AFBI contacts and your own contact notes.", next: "Pick a case management, care coordination or peer support visit — or use the AFBI form." };
      if (!isOwnContactVisit(a, req.actor))
        return { reason: OWN_CONTACT_BLOCK, next: "Only the staff member rendering or assigned to this visit can dictate on it." };
    }
  }
  if (p) {
    const sud = req.target === "afbi" ? patientNeedsPart2(p) : sessionIsSud(p, req.appointmentId);
    if (isDictationOnlyRole(role) && sud && !roleSeesSudScribe(role as StaffRole, p) && req.target === "note")
      return { reason: "This contact involves care your role can't see.", next: "Ask the patient's clinician to document it." };
    if (DICTATION_REQUIRES_PATIENT_CONSENT) {
      const st = aiConsentStatus(p.id, at);
      if (st.state !== "active") return { reason: "No active AI recording consent — required for dictation too.", next: `Ask the patient first, or write it by hand. ${DICTATION_CONSENT_DRAFT_LABEL}.` };
      if (sud && !st.part2 && req.target === "note") return { reason: "The AI recording consent doesn't cover Part 2.", next: "Record a consent with the Part 2 line, or write it by hand." };
    }
  }
  return null;
}
/** Store function for `scribe_dictate` — the staff member's own spoken summary → a draft with the same review rules. */
export function createDictationDraft(req: DictationRequest): ScribeSession | ProgressNote {
  const block = dictationBlocker(req);
  if (block) throw new Error(block.reason);
  const p = req.patientId ? AdelanteEHR.getPatient(req.patientId) : undefined;
  const format = req.format ?? defaultFormat({ serviceType: req.appointmentId ? String(AdelanteEHR.listAppointments().find((a) => a.id === req.appointmentId)?.serviceType ?? "") : undefined });
  const transcript = scribe.dictation({ target: req.target, enrolled: Boolean(p) });
  const now = new Date().toISOString();
  const s: ScribeSession = {
    id: sid(),
    patientId: p?.id ?? "",
    appointmentId: req.appointmentId,
    format,
    sud: p ? (req.target === "afbi" ? true : sessionIsSud(p, req.appointmentId)) : true,
    state: "drafted",
    startedAt: now,
    endedAt: now,
    startedBy: { name: req.actor.name, role: String(req.actor.role), staffId: req.actor.staffId, clinicianId: req.actor.clinicianId },
    parties: [],
    transcript,
    includedSpanish: false,
    sentences: [],
    followUps: [],
    setting: req.setting ?? (req.target === "afbi" ? "field" : defaultSetting({ appointmentId: req.appointmentId })),
    kind: "dictation",
    target: req.target,
    pauses: [],
    afbiInitials: p ? undefined : (req.initials ?? "").replace(/\./g, "").trim().toUpperCase().slice(0, 4),
  };
  sessions.unshift(s);
  buildSentences(s, req.target === "afbi" ? scribe.afbiDraft(transcript) : scribe.dictationDraft(transcript, format));
  if (req.target === "afbi") {
    auditDraft(s, req.actor);
    return s;
  }
  const note = createDraftNote(s, req.actor);
  auditDraft(s, req.actor);
  return note;
}

function sessionAndNote(sessionId: string) {
  const s = getScribeSession(sessionId);
  if (s && s.target === "afbi") {
    if (s.state !== "drafted") throw new Error("AI draft not found.");
    if (s.afbiContactId) throw new Error("This contact is already saved.");
    return { s, n: undefined as unknown as ProgressNote };
  }
  if (!s || !s.noteId) throw new Error("AI draft not found.");
  const { n } = AdelanteEHR._findNote(s.patientId, s.noteId);
  if (!n) throw new Error("AI draft not found.");
  if ((n.status ?? "draft") !== "draft") throw new Error("This note is no longer a draft.");
  return { s, n };
}
function sync(s: ScribeSession) {
  if (s.target === "afbi") {
    s.reviewConfirmedAt = undefined;
    s.reviewConfirmedBy = undefined;
    return;
  }
  AdelanteEHR._patchAiDraftNote(s.patientId, s.noteId!, {
    templateAnswers: { ...(AdelanteEHR._findNote(s.patientId, s.noteId!).n?.templateAnswers ?? {}), ...bodyFor(s) } as never,
    aiScribe: { unresolved: unresolvedCount(s), reviewConfirmedAt: undefined, reviewConfirmedBy: undefined },
  });
}

/** Store function for `scribe_open_draft` — the clinician has opened the draft (required before signing). */
export function openAiDraft(sessionId: string, actor: ScribeActor) {
  const { s, n } = sessionAndNote(sessionId);
  if (s.target === "afbi") {
    if (!s.openedAt) {
      s.openedAt = new Date().toISOString();
      audit("scribe_draft_opened", s.patientId || undefined, actor, { sessionId, target: "afbi" });
    }
    return s;
  }
  if (n.aiScribe?.openedAt) return n;
  AdelanteEHR._patchAiDraftNote(s.patientId, n.id, { aiScribe: { openedAt: new Date().toISOString() } });
  audit("scribe_draft_opened", s.patientId, actor, { sessionId, noteId: n.id });
  return n;
}

function sentence(s: ScribeSession, id: string) {
  const x = s.sentences.find((y) => y.id === id);
  if (!x) throw new Error("Sentence not found.");
  return x;
}
/** Store function for `scribe_sentence_edit`. */
export function editAiSentence(sessionId: string, sentenceId: string, text: string, actor: ScribeActor) {
  const { s } = sessionAndNote(sessionId);
  const x = sentence(s, sentenceId);
  if (!text.trim()) throw new Error("Use Delete to remove a sentence.");
  if (x.identifying && hasIdentifyingDetail(text)) throw new Error(IDENTIFYING_LABEL + ". Remove the name or other identifying detail.");
  x.text = text.trim();
  x.resolution = { kind: "edited", by: actor.name, at: new Date().toISOString() };
  sync(s);
  audit("scribe_sentence_edited", s.patientId || undefined, actor, { sessionId, sentenceId, wasUnsupported: x.unsupported });
  return x;
}
/** Visit-fact fields the clinician fills on the AI draft (never narrative, never codes). */
export const AI_DRAFT_VISIT_FIELDS = ["service_type", "service_date", "service_minutes", "modality", "location"] as const;
/** Store function for `scribe_visit_field` — fills a DMC-ODS visit fact on the draft. Clears review confirmation. */
/** AFBI-target fields the reviewer can change on the draft. */
export const AFBI_DRAFT_FIELDS = ["activities", "minutes", "outcome", "nextStep", "locationType"] as const;
export function setAiDraftVisitField(sessionId: string, key: string, value: string | number | string[], actor: ScribeActor) {
  const { s, n } = sessionAndNote(sessionId);
  if (s.target === "afbi") {
    if (!(AFBI_DRAFT_FIELDS as readonly string[]).includes(key)) throw new Error("Pick an AFBI field.");
    if (key === "nextStep" && !s.patientId && hasIdentifyingDetail(String(value))) throw new Error(IDENTIFYING_LABEL + ".");
    s.afbiFields = { ...(s.afbiFields ?? { activities: [], minutes: 15, outcome: "engaged", nextStep: "", locationType: "other" }), [key]: value } as AfbiDraftFields;
    sync(s);
    audit("scribe_visit_field_set", s.patientId || undefined, actor, { sessionId, field: key });
    return s;
  }
  if (!(AI_DRAFT_VISIT_FIELDS as readonly string[]).includes(key)) throw new Error("Edit narrative sentences in the AI draft review.");
  AdelanteEHR._patchAiDraftNote(s.patientId, n.id, {
    templateAnswers: { ...(n.templateAnswers ?? {}), [key]: value } as never,
    aiScribe: { reviewConfirmedAt: undefined, reviewConfirmedBy: undefined },
  });
  audit("scribe_visit_field_set", s.patientId, actor, { sessionId, field: key });
  return n;
}
/** Store function for `scribe_sentence_keep` — keep an unsupported sentence with a reason. */
export function keepAiSentence(sessionId: string, sentenceId: string, reason: string, actor: ScribeActor) {
  const { s } = sessionAndNote(sessionId);
  const x = sentence(s, sentenceId);
  if (x.identifying) throw new Error(IDENTIFYING_LABEL + " — edit it out or delete the sentence.");
  if (reason.trim().length < 3) throw new Error("Give a reason (at least 3 characters) to keep it.");
  x.resolution = { kind: "kept", reason: reason.trim(), by: actor.name, at: new Date().toISOString() };
  sync(s);
  // The reason may be clinical — it stays on the session, not in the audit.
  audit("scribe_sentence_kept", s.patientId || undefined, actor, { sessionId, sentenceId });
  return x;
}
/** Store function for `scribe_sentence_delete`. */
export function deleteAiSentence(sessionId: string, sentenceId: string, actor: ScribeActor) {
  const { s } = sessionAndNote(sessionId);
  const x = sentence(s, sentenceId);
  x.resolution = { kind: "deleted", by: actor.name, at: new Date().toISOString() };
  sync(s);
  audit("scribe_sentence_deleted", s.patientId || undefined, actor, { sessionId, sentenceId });
  return x;
}

/** Store function for `scribe_review_confirm` — "I reviewed and edited this note" + 1–5 rating. Snapshots the AI version. */
export function confirmAiReview(sessionId: string, actor: ScribeActor, rating: number) {
  const { s, n } = sessionAndNote(sessionId);
  const opened = s.target === "afbi" ? s.openedAt : n.aiScribe?.openedAt;
  if (!opened) throw new Error("Open the AI draft first.");
  if (unresolvedCount(s) > 0) throw new Error(`Resolve every flagged sentence ("${UNSUPPORTED_LABEL}" or identifying detail) first.`);
  if (!(rating >= 1 && rating <= 5)) throw new Error("Rate the draft from 1 to 5.");
  if (s.target === "afbi") {
    s.reviewConfirmedAt = new Date().toISOString();
    s.reviewConfirmedBy = actor.name;
    s.rating = rating;
    audit("scribe_review_confirmed", s.patientId || undefined, actor, { sessionId, target: "afbi", rating });
    return s;
  }
  const original: Record<"subjective" | "objective" | "assessment" | "plan", string> = { subjective: "", objective: "", assessment: "", plan: "" };
  for (const sec of FORMAT_SECTIONS[s.format])
    original[sec.soap] = [original[sec.soap], s.sentences.filter((x) => x.sectionKey === sec.key).map((x) => x.originalText).join(" ")].filter(Boolean).join(" ");
  const alreadySnap = (n.priorVersions ?? []).some((v) => v.version === 0);
  AdelanteEHR._patchAiDraftNote(s.patientId, n.id, {
    aiScribe: { reviewConfirmedAt: new Date().toISOString(), reviewConfirmedBy: actor.name, rating },
    ...(alreadySnap
      ? {}
      : { priorVersion: { version: 0, supersededAt: new Date().toISOString(), supersededBy: actor.name, reason: `${AI_DRAFT_LABEL} — original ${SCRIBE_FORMAT_LABEL[s.format]} draft before clinician review`, ...original } }),
  });
  audit("scribe_review_confirmed", s.patientId, actor, { sessionId, noteId: n.id, rating });
  return n;
}

/** Store function for `scribe_followup_accept` — marks one suggested follow-up accepted; the UI then runs its normal registry action. */
export function acceptAiFollowUp(sessionId: string, followUpId: string, actor: ScribeActor) {
  const s = getScribeSession(sessionId);
  if (!s) throw new Error("Session not found.");
  const f = s.followUps.find((x) => x.id === followUpId);
  if (!f) throw new Error("Suggestion not found.");
  f.acceptedAt = new Date().toISOString();
  f.acceptedBy = actor.name;
  audit("scribe_followup_accepted", s.patientId, actor, { sessionId, kind: f.kind });
  return f;
}

/**
 * Store function for `scribe_afbi_save` — saves the reviewed AFBI draft through
 * the normal AFBI store function (funding lane ISL, never a Medi-Cal claim).
 */
export function saveAfbiFromScribe(sessionId: string, actor: ScribeActor): AfbiContact {
  const s = getScribeSession(sessionId);
  if (!s || s.target !== "afbi" || s.state !== "drafted") throw new Error("AI draft not found.");
  if (s.afbiContactId) throw new Error("This contact is already saved.");
  if (!s.reviewConfirmedAt) throw new Error("Confirm \"I reviewed and edited this draft\" first.");
  if (unresolvedCount(s) > 0) throw new Error("Resolve every flagged sentence first.");
  const f = s.afbiFields!;
  const okActs = f.activities.filter((a) => AFBI_ACTIVITIES.some((x) => x.id === a)) as AfbiActivity[];
  const loc = (AFBI_LOCATION_TYPES.some((l) => l.id === f.locationType) ? f.locationType : "other") as AfbiLocationType;
  const out = (AFBI_OUTCOMES.some((o) => o.id === f.outcome) ? f.outcome : "engaged") as AfbiOutcome;
  const c = recordAfbiContact(
    { role: actor.role as StaffRole, name: actor.name, staffId: actor.staffId },
    { locationType: loc, patientId: s.patientId || undefined, initials: s.afbiInitials, activities: okActs, minutes: f.minutes, outcome: out, nextStep: f.nextStep },
  );
  s.afbiContactId = c.id;
  audit("scribe_afbi_saved", s.patientId || undefined, actor, { sessionId, contactId: c.id });
  sweepScribeRetention();
  return c;
}

// ------------------------------------------------------------------ retention + metrics
export interface ScribeMetricRow {
  sessionId: string;
  endToSignMin: number;
  editPct: number;
  unsupported: number;
  rating?: number;
  setting?: ScribeSetting;
  kind?: "ambient" | "dictation";
}
const metricRows: ScribeMetricRow[] = [];

function words(t: string) {
  return t.toLowerCase().split(/\s+/).filter(Boolean);
}
/** % of AI draft words changed (1 − LCS / max length). */
export function editPercent(original: string, final: string): number {
  const a = words(original);
  const b = words(final);
  if (!a.length && !b.length) return 0;
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i]![j] = a[i - 1] === b[j - 1] ? dp[i - 1]![j - 1]! + 1 : Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
  return Math.round((1 - dp[a.length]![b.length]! / Math.max(a.length, b.length)) * 100);
}

/** Deletes transcripts that are past retention and records pilot metrics for signed drafts. Idempotent. */
export function sweepScribeRetention(now = new Date()): number {
  let deleted = 0;
  for (const s of sessions) {
    if (s.state !== "drafted") continue;
    if (s.target === "note" && !s.noteId) continue;
    const n = s.noteId ? AdelanteEHR._findNote(s.patientId, s.noteId).n : undefined;
    const doneAt = s.target === "afbi" ? (s.afbiContactId ? s.reviewConfirmedAt : undefined) : n?.signedAt;
    const signed = Boolean(doneAt);
    if (signed && !metricRows.some((m) => m.sessionId === s.id)) {
      metricRows.push({
        sessionId: s.id,
        setting: s.setting,
        kind: s.kind,
        endToSignMin: Math.max(0, Math.round((+new Date(doneAt!) - +new Date(s.endedAt!)) / 60000)),
        editPct: editPercent(s.sentences.map((x) => x.originalText).join(" "), s.sentences.filter((x) => x.resolution?.kind !== "deleted").map((x) => x.text).join(" ")),
        unsupported: s.sentences.filter((x) => x.unsupported).length,
        rating: s.target === "afbi" ? s.rating : n?.aiScribe?.rating,
      });
    }
    if (!s.transcript) continue;
    const old = +now - +new Date(s.endedAt!) >= UNSIGNED_RETENTION_DAYS * 86400000;
    if (signed || old) {
      s.transcript = null;
      s.transcriptDeleted = { at: now.toISOString(), by: "System retention", reason: signed ? "signed" : "unsigned_7_days" };
      audit("scribe_transcript_deleted", s.patientId || undefined, { name: "System retention", role: "system" }, { sessionId: s.id, reason: s.transcriptDeleted.reason });
      deleted++;
    }
  }
  return deleted;
}

export function listScribeMetricRows(): ScribeMetricRow[] {
  return metricRows.slice();
}
/** Test hook — add a metric row as if a signed session existed. */
export function _addMetricRow(r: ScribeMetricRow) {
  metricRows.push(r);
}
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2);
};
/** Pilot metrics — aggregate only, suppressed below the cohort guard (11). */
export function scribePilotMetrics(filter?: { setting?: ScribeSetting }) {
  const rows = filter?.setting ? metricRows.filter((r) => (r.setting ?? "clinic") === filter.setting) : metricRows;
  const g = cohortGuard(rows.length);
  if (g.belowMinimumCohort) return { ...g, medianEndToSignMin: null, meanEditPct: null, unsupportedTotal: null, meanRating: null };
  const rated = rows.filter((r) => r.rating).map((r) => r.rating!);
  return {
    ...g,
    medianEndToSignMin: median(rows.map((r) => r.endToSignMin)),
    meanEditPct: Math.round(rows.reduce((a, r) => a + r.editPct, 0) / rows.length),
    unsupportedTotal: rows.reduce((a, r) => a + r.unsupported, 0),
    meanRating: rated.length ? Math.round((rated.reduce((a, b) => a + b, 0) / rated.length) * 10) / 10 : null,
  };
}

// ------------------------------------------------------------------ views (Part 2)
export interface ScribeView {
  masked: boolean;
  session: ScribeSession | null;
}
/** Transcripts and drafts inherit the patient's SUD classification. */
export function scribeView(sessionId: string, role: StaffRole): ScribeView {
  const s = getScribeSession(sessionId);
  if (!s) return { masked: false, session: null };
  const p = s.patientId ? AdelanteEHR.getPatient(s.patientId) : undefined;
  if (s.target === "afbi") return roleSeesAfbiDetail(role, p) ? { masked: false, session: s } : { masked: true, session: null };
  if (s.sud && p && !roleSeesSudScribe(role, p)) return { masked: true, session: null };
  return { masked: false, session: s };
}
export function segmentText(s: ScribeSession, segmentId: string): TranscriptSegment | undefined {
  return s.transcript?.find((t) => t.id === segmentId);
}
export function reviewSummary(s: ScribeSession) {
  const live = s.sentences.filter((x) => x.resolution?.kind !== "deleted");
  return {
    total: live.length,
    sourced: live.filter((x) => !x.unsupported).length,
    unsupported: live.filter((x) => x.unsupported && !x.resolution).length,
    identifying: live.filter((x) => x.identifying && !x.resolution).length,
    speakerUncertain: live.filter((x) => x.speakerUncertain).length,
    unsure: live.filter((x) => x.unsure).length,
  };
}
