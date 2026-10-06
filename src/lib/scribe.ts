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
import { scribe, type DraftSentence, type ScribeSpeaker, type TranscriptSegment } from "./vendors/scribe";
import { DMC_NARRATIVE_KEYS, FORMAT_SECTIONS, SCRIBE_FORMAT_LABEL, templateKeyFor, type ScribeFormat } from "./scribeFormats";

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
/** Not at this phase — a Phase 2 decision. */
export const SCRIBE_PHASE2_ROLES: readonly StaffRole[] = ["lvn", "peer_specialist", "community_health_worker", "ecm_provider"];
export function canCaptureScribe(role: StaffRole | string): boolean {
  return (SCRIBE_CAPTURE_ROLES as readonly string[]).includes(role);
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
}

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
}
const initials = (p: Patient) => `${p.firstName[0] ?? ""}.${p.lastName[0] ?? ""}.`;

/** The one gate. Returns why capture can't start, or null. */
export function captureBlocker(req: CaptureRequest, at = new Date()): ScribeBlock | null {
  if (!canCaptureScribe(req.actor.role))
    return { reason: "Your role doesn't use the AI scribe in this phase.", next: "Write the note in the chart. Scribe for this role is a Phase 2 decision." };
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
  if (!req.allPartyConfirmed || (req.parties ?? []).some((x) => !x.agreed))
    return { reason: "Confirm everyone present has agreed to recording.", next: "Ask each person in the room (patient, advocate, interpreter, family), then tick the confirmation." };
  return null;
}

/** Store function for `scribe_start`. */
export function startScribeSession(req: CaptureRequest): ScribeSession {
  const block = captureBlocker(req);
  if (block) throw new Error(block.reason);
  const p = AdelanteEHR.getPatient(req.patientId)!;
  const transcript = scribe.transcript({ patientFirstName: p.firstName });
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
    transcript,
    includedSpanish: transcript.some((t) => t.lang !== "en"),
    sentences: [],
    followUps: [],
  };
  sessions.unshift(s);
  audit("scribe_capture_started", p.id, req.actor, { sessionId: s.id, format: s.format, parties: s.parties.length, group: Boolean(req.groupSessionId) });
  return s;
}

function discardSession(s: ScribeSession, actor: { name: string; role: string }, reason: string) {
  s.state = "discarded";
  s.transcript = null;
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
  return s.sentences.filter((x) => x.unsupported && !x.resolution).length;
}

/** Store function for `scribe_end` — creates the unsigned AI draft in the chart's note form. */
export function endScribeSession(sessionId: string, actor: ScribeActor): ProgressNote {
  const s = getScribeSession(sessionId);
  if (!s) throw new Error("Session not found.");
  if (s.state !== "capturing" || !s.transcript) throw new Error("This session is not capturing.");
  // Consent is re-checked live at the end: a withdrawal discards instead.
  const p = AdelanteEHR.getPatient(s.patientId)!;
  if (!hasActiveConsent(p, s.sud) && !s.groupSessionId) {
    discardSession(s, { name: actor.name, role: String(actor.role) }, "consent_inactive_at_end");
    throw new Error("Consent is no longer active — the transcript was discarded.");
  }
  const out = scribe.draft(s.transcript, s.format);
  const byId = new Map(s.transcript.map((t) => [t.id, t]));
  let n = 0;
  const mk = (sectionKey: string, d: DraftSentence): ScribeSentence => {
    const segs = d.sourceIds.map((id) => byId.get(id)).filter((x): x is TranscriptSegment => Boolean(x));
    return {
      id: `${s.id}-${++n}`,
      sectionKey,
      text: d.text,
      originalText: d.text,
      sources: segs.map((g) => ({ segmentId: g.id, speaker: g.speaker, atSec: g.atSec })),
      unsupported: segs.length === 0,
      speakerUncertain: segs.some((g) => g.speakerConfidence < SPEAKER_CONFIDENCE_MIN),
      unsure: segs.some((g) => g.asrConfidence < ASR_CONFIDENCE_MIN),
    };
  };
  s.sentences = Object.entries(out.sections).flatMap(([k, list]) => list.map((d) => mk(k, d)));
  s.followUps = out.followUps.map((f) => ({ ...f }));
  s.endedAt = new Date().toISOString();
  s.state = "drafted";
  const appt = s.appointmentId ? AdelanteEHR.listAppointments().find((a) => a.id === s.appointmentId) : undefined;
  const tpl = AdelanteEHR.listNoteTemplates().find((t) => t.key === templateKeyFor(s.format));
  const loc = appt?.locationId ? AdelanteEHR.locationsForService(appt.serviceType as never).find((l) => l.id === appt.locationId)?.name : undefined;
  const answers: Record<string, string | number> = {
    ...bodyFor(s),
    // Visit facts only — never a diagnosis or billing code.
    service_type: appt ? (AdelanteEHR.getServiceType(appt.serviceType as never)?.label ?? String(appt.serviceType)) : "",
    service_date: (appt?.start ?? s.startedAt).slice(0, 10),
    service_minutes: appt?.durationMin ?? Math.max(1, Math.round((+new Date(s.endedAt) - +new Date(s.startedAt)) / 60000)),
    modality: appt?.modality === "in_person" ? "In person" : appt?.modality === "phone" ? "Phone" : appt?.modality === "video" ? "Video" : "",
    location: appt?.modality === "in_person" ? (loc ?? "") : appt ? "Telehealth" : "",
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
  audit("scribe_draft_created", s.patientId, actor, {
    sessionId: s.id,
    noteId: note.id,
    format: s.format,
    sentences: s.sentences.length,
    unsupported: s.sentences.filter((x) => x.unsupported).length,
    speakerUncertain: s.sentences.filter((x) => x.speakerUncertain).length,
  });
  return note;
}

function sessionAndNote(sessionId: string) {
  const s = getScribeSession(sessionId);
  if (!s || !s.noteId) throw new Error("AI draft not found.");
  const { n } = AdelanteEHR._findNote(s.patientId, s.noteId);
  if (!n) throw new Error("AI draft not found.");
  if ((n.status ?? "draft") !== "draft") throw new Error("This note is no longer a draft.");
  return { s, n };
}
function sync(s: ScribeSession) {
  AdelanteEHR._patchAiDraftNote(s.patientId, s.noteId!, {
    templateAnswers: { ...(AdelanteEHR._findNote(s.patientId, s.noteId!).n?.templateAnswers ?? {}), ...bodyFor(s) } as never,
    aiScribe: { unresolved: unresolvedCount(s), reviewConfirmedAt: undefined, reviewConfirmedBy: undefined },
  });
}

/** Store function for `scribe_open_draft` — the clinician has opened the draft (required before signing). */
export function openAiDraft(sessionId: string, actor: ScribeActor) {
  const { s, n } = sessionAndNote(sessionId);
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
  x.text = text.trim();
  x.resolution = { kind: "edited", by: actor.name, at: new Date().toISOString() };
  sync(s);
  audit("scribe_sentence_edited", s.patientId, actor, { sessionId, sentenceId, wasUnsupported: x.unsupported });
  return x;
}
/** Visit-fact fields the clinician fills on the AI draft (never narrative, never codes). */
export const AI_DRAFT_VISIT_FIELDS = ["service_type", "service_date", "service_minutes", "modality", "location"] as const;
/** Store function for `scribe_visit_field` — fills a DMC-ODS visit fact on the draft. Clears review confirmation. */
export function setAiDraftVisitField(sessionId: string, key: string, value: string | number, actor: ScribeActor) {
  const { s, n } = sessionAndNote(sessionId);
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
  if (reason.trim().length < 3) throw new Error("Give a reason (at least 3 characters) to keep it.");
  x.resolution = { kind: "kept", reason: reason.trim(), by: actor.name, at: new Date().toISOString() };
  sync(s);
  // The reason may be clinical — it stays on the session, not in the audit.
  audit("scribe_sentence_kept", s.patientId, actor, { sessionId, sentenceId });
  return x;
}
/** Store function for `scribe_sentence_delete`. */
export function deleteAiSentence(sessionId: string, sentenceId: string, actor: ScribeActor) {
  const { s } = sessionAndNote(sessionId);
  const x = sentence(s, sentenceId);
  x.resolution = { kind: "deleted", by: actor.name, at: new Date().toISOString() };
  sync(s);
  audit("scribe_sentence_deleted", s.patientId, actor, { sessionId, sentenceId });
  return x;
}

/** Store function for `scribe_review_confirm` — "I reviewed and edited this note" + 1–5 rating. Snapshots the AI version. */
export function confirmAiReview(sessionId: string, actor: ScribeActor, rating: number) {
  const { s, n } = sessionAndNote(sessionId);
  if (!n.aiScribe?.openedAt) throw new Error("Open the AI draft first.");
  if (unresolvedCount(s) > 0) throw new Error(`Resolve every sentence marked "${UNSUPPORTED_LABEL}" first.`);
  if (!(rating >= 1 && rating <= 5)) throw new Error("Rate the draft from 1 to 5.");
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

// ------------------------------------------------------------------ retention + metrics
export interface ScribeMetricRow {
  sessionId: string;
  endToSignMin: number;
  editPct: number;
  unsupported: number;
  rating?: number;
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
    if (s.state !== "drafted" || !s.noteId) continue;
    const { n } = AdelanteEHR._findNote(s.patientId, s.noteId);
    const signed = Boolean(n?.signedAt);
    if (signed && !metricRows.some((m) => m.sessionId === s.id)) {
      metricRows.push({
        sessionId: s.id,
        endToSignMin: Math.max(0, Math.round((+new Date(n!.signedAt!) - +new Date(s.endedAt!)) / 60000)),
        editPct: editPercent(s.sentences.map((x) => x.originalText).join(" "), s.sentences.filter((x) => x.resolution?.kind !== "deleted").map((x) => x.text).join(" ")),
        unsupported: s.sentences.filter((x) => x.unsupported).length,
        rating: n!.aiScribe?.rating,
      });
    }
    if (!s.transcript) continue;
    const old = +now - +new Date(s.endedAt!) >= UNSIGNED_RETENTION_DAYS * 86400000;
    if (signed || old) {
      s.transcript = null;
      s.transcriptDeleted = { at: now.toISOString(), by: "System retention", reason: signed ? "signed" : "unsigned_7_days" };
      audit("scribe_transcript_deleted", s.patientId, { name: "System retention", role: "system" }, { sessionId: s.id, reason: s.transcriptDeleted.reason });
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
export function scribePilotMetrics() {
  const rows = metricRows;
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
  const p = AdelanteEHR.getPatient(s.patientId);
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
    speakerUncertain: live.filter((x) => x.speakerUncertain).length,
    unsure: live.filter((x) => x.unsure).length,
  };
}
