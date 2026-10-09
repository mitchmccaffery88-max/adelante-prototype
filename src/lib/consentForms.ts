// §Consent workflow (Mitch 9 Oct) — form library, send, sign, track, store,
// renew, revoke, intake packet by pathway. ALL rules: "Draft — pending
// counsel review" (no counsel engaged yet). All wording is placeholder.
//
// One ledger: signing a form writes a superseding ConsentRecord through
// `AdelanteEHR.createConsentRecord` (sections copied from the record in force,
// the form's categories set). Signed copies are frozen objects; nothing is
// ever deleted. SMS is Simulated.
import {
  AdelanteEHR,
  setGroupConsentGate,
  type ConsentCategory,
  type ConsentRecordSection,
  type Patient,
} from "./ehr";
import type { StaffRole } from "./roles";
import { canAccess } from "./roles";
import { roleHasChartEntry } from "./chartAccess";
import { patientPathway, type Pathway } from "./flagJourneys";

export const CONSENT_DRAFT_LABEL = "Draft — pending counsel review";
export const PLACEHOLDER_WORDING = "Placeholder wording — pending counsel";
export const COUNSEL_PENDING = "Counsel: pending";
export const UNSIGNED_TASK_DAYS = 3; // Draft
export const RENEWAL_LEAD_DAYS = 30; // Draft
export const RETENTION_YEARS = 10; // Draft, WIC 14124.1
export const FORM_NOTICE = { en: "You have a form to review", es: "Tiene un formulario para revisar" } as const;
export const FORM_NOTICE_BODY = { en: "Open Forms to sign in the app.", es: "Abra Formularios para firmar en la app. (Borrador de traducción)" } as const;

export type FormKey =
  | "hipaa"
  | "telehealth"
  | "portal"
  | "sms"
  | "part2"
  | "group"
  | "po_release"
  | "advocate_patient"
  | "advocate_attestation"
  | "ai_recording";
export type SignatureMethod = "checkbox" | "typed_name" | "drawn";
export type FormStatus = "draft" | "legal_review" | "approved" | "published" | "retired";
type Bi = { en: string; es: string };

export interface FormVersion {
  id: string;
  key: FormKey;
  version: number;
  status: FormStatus;
  title: Bi;
  summary: Bi;
  body: Bi;
  signatureMethod: SignatureMethod;
  pathways: Pathway[] | "all";
  durationDays?: number;
  categories: ConsentCategory[];
  /** Part 2 forms get their own card naming who receives what and why. */
  part2?: { recipient: string; what: string; why: string };
  audience: "patient" | "advocate";
  placeholder: true;
  counsel: typeof COUNSEL_PENDING;
  approvedBy?: string;
  publishedAt?: string;
  createdAt: string;
}

export type RequestStatus = "sent" | "viewed" | "signed" | "declined" | "expired";
export interface FormRequest {
  id: string;
  patientId: string;
  formKey: FormKey;
  versionId: string;
  version: number;
  sentBy: { role: string; staffId?: string; name: string };
  sentAt: string;
  dueAt: string;
  status: RequestStatus;
  viewedAt?: string;
  checked?: boolean;
  decidedAt?: string;
  required: boolean;
  packet?: boolean;
  advocateId?: string;
  taskRaisedAt?: string;
}

export interface SignedCopy {
  readonly id: string;
  readonly requestId?: string;
  readonly patientId: string;
  readonly formKey: FormKey;
  readonly versionId: string;
  readonly version: number;
  readonly title: string;
  readonly language: "en" | "es";
  readonly fullText: string;
  readonly textHash: string;
  readonly signatureMethod: SignatureMethod;
  readonly signerName: string;
  readonly relationship: "patient" | "guardian" | "proxy" | "advocate";
  readonly signedAt: string;
  readonly channel: "portal" | "in_person" | "intake (legacy)";
  readonly sentBy?: string;
  readonly consentRecordId?: string;
  readonly endsOn?: string;
  readonly signatureData?: string;
}
/** End/retention facts live beside the frozen copy — the copy itself never changes. */
interface CopyEnd { endedAt: string; reason: "revoked" | "expired" | "superseded"; note?: string }

const versions: FormVersion[] = [];
const requests: FormRequest[] = [];
const copies: SignedCopy[] = [];
const ends = new Map<string, CopyEnd>();
export interface SimulatedSms { id: string; patientId: string; to?: string; body: string; at: string; simulated: true }
const smsLog: SimulatedSms[] = [];
let n = 0;
const id = (p: string) => `${p}_${Date.now().toString(36)}_${(n++).toString(36)}`;
const DAY = 86_400_000;

/** FNV-1a 32-bit text hash (prototype; SculptSoft replaces with SHA-256). */
export function textHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `fnv1a:${h.toString(16).padStart(8, "0")}`;
}

// ------------------------------------------------------------------ library
const ph = (en: string) => ({ en, es: `${en} (Borrador — traducción pendiente)` });
const SEED: Omit<FormVersion, "id" | "version" | "status" | "placeholder" | "counsel" | "createdAt">[] = [
  { key: "hipaa", title: { en: "HIPAA authorization", es: "Autorización HIPAA" }, summary: { en: "How we keep your health information private, and who on your care team can see it.", es: "Cómo protegemos su información de salud y quién de su equipo puede verla. (Borrador)" }, body: ph("We use your health information to give you care, to arrange care with others who help you, and for payment. We share only what is needed. You can ask for a copy of your record. Placeholder wording — pending counsel."), signatureMethod: "checkbox", pathways: "all", categories: ["hipaa_authorization", "mental_health", "case_coordination"], audience: "patient" },
  { key: "telehealth", title: { en: "Telehealth", es: "Telesalud" }, summary: { en: "You agree to get some care by video or phone. You can always ask for in person.", es: "Acepta recibir parte de su atención por video o teléfono. Siempre puede pedir en persona. (Borrador)" }, body: ph("Video and phone visits are private, but no technology is perfect. You can stop a video visit any time and ask for an in-person visit. Placeholder wording — pending counsel."), signatureMethod: "checkbox", pathways: "all", categories: ["telehealth_services"], audience: "patient" },
  { key: "portal", title: { en: "Patient portal", es: "Portal del paciente" }, summary: { en: "You can use this app to see your care, message your team and sign forms.", es: "Puede usar esta app para ver su atención, escribir a su equipo y firmar formularios. (Borrador)" }, body: ph("Keep your sign-in to yourself. Messages are not for emergencies — call or text 988. Placeholder wording — pending counsel."), signatureMethod: "checkbox", pathways: "all", categories: ["patient_portal"], audience: "patient" },
  { key: "sms", title: { en: "Text reminders", es: "Recordatorios por texto" }, summary: { en: "We can text you visit and check-in reminders. Texts never name your care.", es: "Podemos enviarle recordatorios por texto. Los textos nunca nombran su atención. (Borrador)" }, body: ph("Message and data rates may apply. Reply STOP to stop. Placeholder wording — pending counsel."), signatureMethod: "checkbox", pathways: "all", categories: ["sms_reminders"], audience: "patient" },
  { key: "part2", title: { en: "Sharing substance-use information (Part 2)", es: "Compartir información sobre uso de sustancias (Parte 2)" }, summary: { en: "Lets your Adelante care team share substance-use information with each other to coordinate your care.", es: "Permite que su equipo de Adelante comparta información sobre uso de sustancias para coordinar su atención. (Borrador)" }, body: ph("Federal law (42 CFR Part 2) protects substance-use records. This form names who may receive them, what, and why. It never allows sharing with probation, parole or a court. You can stop sharing any time. Placeholder wording — pending counsel."), signatureMethod: "typed_name", pathways: ["sud", "reentry_sud"], durationDays: 365, categories: ["sud_treatment"], part2: { recipient: "Your Adelante care team (clinicians, case managers, care coordinators)", what: "Substance-use assessments, treatment notes, medications and visit types", why: "To plan and coordinate your care" }, audience: "patient" },
  { key: "group", title: { en: "Group participation", es: "Participación en grupos" }, summary: { en: "Group members keep what is said private. Other members are not bound by Part 2. Attendance is shared within the group.", es: "Los miembros del grupo mantienen la privacidad. Otros miembros no están sujetos a la Parte 2. La asistencia se comparte en el grupo. (Borrador)" }, body: ph("Confidentiality among members: what is said in group stays in group. Other members are people, not providers, and are not bound by 42 CFR Part 2. Other members will see that you attended. Video groups: join from a private place; do not record. Placeholder wording — pending counsel."), signatureMethod: "checkbox", pathways: ["reentry", "sud", "reentry_sud"], categories: ["group_participation", "group_confidentiality_ack"], audience: "patient" },
  { key: "po_release", title: { en: "Release to probation or parole officer", es: "Divulgación al oficial de libertad condicional" }, summary: { en: "Optional. Lets us share care coordination updates (not substance-use details) with your officer.", es: "Opcional. Nos permite compartir actualizaciones de coordinación (no detalles de uso de sustancias) con su oficial. (Borrador)" }, body: ph("This is your choice and is never required for care. It covers attendance and coordination only. You can stop it any time. Placeholder wording — pending counsel."), signatureMethod: "typed_name", pathways: ["reentry", "reentry_sud"], durationDays: 365, categories: ["po_voluntary_coordination"], audience: "patient" },
  { key: "advocate_patient", title: { en: "Share with my helper (advocate)", es: "Compartir con mi ayudante (defensor)" }, summary: { en: "Lets the helper you named take part in your care. It does not share substance-use records.", es: "Permite que su ayudante participe en su atención. No comparte registros de uso de sustancias. (Borrador)" }, body: ph("Your helper can see appointment times and help you get ready. You can remove them any time. Placeholder wording — pending counsel."), signatureMethod: "typed_name", pathways: "all", durationDays: 365, categories: ["roi_collateral"], audience: "patient" },
  { key: "advocate_attestation", title: { en: "Advocate attestation", es: "Declaración del defensor" }, summary: { en: "The helper confirms who they are and agrees to keep what they learn private.", es: "El ayudante confirma quién es y acepta mantener la privacidad. (Borrador)" }, body: ph("I am the person named by the patient. I will use what I learn only to support them. Placeholder wording — pending counsel."), signatureMethod: "typed_name", pathways: "all", durationDays: 365, categories: ["advocate_attestation"], audience: "advocate" },
  { key: "ai_recording", title: { en: "AI recording of visits", es: "Grabación de visitas con IA" }, summary: { en: "Optional. Lets your clinician use a tool that drafts visit notes from a recording.", es: "Opcional. Permite que su clínico use una herramienta que redacta notas desde una grabación. (Borrador)" }, body: ph("Recordings are deleted after the note is drafted. You can say no and nothing changes about your care. Placeholder wording — pending counsel."), signatureMethod: "checkbox", pathways: "all", categories: ["ai_session_recording"], audience: "patient" },
];

function seedLibrary() {
  if (versions.length) return;
  const at = new Date().toISOString();
  for (const s of SEED) {
    const v = createFormDraft({ ...s }, { role: "sys_admin", name: "Seed" }, at);
    submitForLegalReview(v.id, { role: "sys_admin", name: "Seed" });
    approveForm(v.id, { role: "sys_admin", name: "Seed" });
    publishForm(v.id, { role: "sys_admin", name: "Seed" });
  }
}

type Actor = { role: StaffRole | "system" | "patient"; staffId?: string; name: string };
const audit = (action: string, actor: Actor, detail: Record<string, unknown>, patientId?: string) =>
  AdelanteEHR.recordActionEvent({ action, actorRole: actor.role, actorId: actor.staffId ?? actor.name, ...(patientId ? { patientId } : {}), detail: { ...detail, draft: CONSENT_DRAFT_LABEL } });

export const listFormVersions = (key?: FormKey) => versions.filter((v) => !key || v.key === key).map((v) => ({ ...v }));
export const publishedForm = (key: FormKey) => versions.find((v) => v.key === key && v.status === "published");
export const listPublishedForms = () => versions.filter((v) => v.status === "published").map((v) => ({ ...v }));
export const getFormVersion = (vid: string) => versions.find((v) => v.id === vid);

export function createFormDraft(input: Omit<FormVersion, "id" | "version" | "status" | "placeholder" | "counsel" | "createdAt">, actor: Actor, at = new Date().toISOString()): FormVersion {
  if (input.title.en.trim().length < 3) throw new Error("A title is required.");
  const prior = versions.filter((v) => v.key === input.key);
  const v: FormVersion = { ...input, id: id("cfv"), version: prior.length + 1, status: "draft", placeholder: true, counsel: COUNSEL_PENDING, createdAt: at };
  versions.push(v);
  audit("consent_form.draft_created", actor, { formKey: v.key, version: v.version });
  return v;
}
/** Editing a published form creates a NEW draft version; the published one is untouched. */
export function editForm(key: FormKey, changes: Partial<Pick<FormVersion, "title" | "summary" | "body" | "signatureMethod" | "durationDays" | "pathways">>, actor: Actor): FormVersion {
  const base = [...versions].reverse().find((v) => v.key === key);
  if (!base) throw new Error("Form not found.");
  const { id: _i, version: _v, status: _s, placeholder: _p, counsel: _c, createdAt: _a, approvedBy: _ab, publishedAt: _pa, ...rest } = base;
  return createFormDraft({ ...rest, ...changes }, actor);
}
function step(vid: string, from: FormStatus, to: FormStatus, actor: Actor) {
  const v = versions.find((x) => x.id === vid);
  if (!v) throw new Error("Form version not found.");
  if (v.status !== from) throw new Error(`This version is ${v.status.replace("_", " ")}, not ${from.replace("_", " ")}.`);
  v.status = to;
  return v;
}
export function submitForLegalReview(vid: string, actor: Actor) {
  const v = step(vid, "draft", "legal_review", actor);
  audit("consent_form.legal_review", actor, { formKey: v.key, version: v.version });
  return v;
}
export function approveForm(vid: string, actor: Actor) {
  if (actor.role !== "sys_admin") throw new Error("Only sys_admin can approve a form (counsel pending).");
  const v = step(vid, "legal_review", "approved", actor);
  v.approvedBy = `${actor.name} · ${COUNSEL_PENDING}`;
  audit("consent_form.approved", actor, { formKey: v.key, version: v.version, counsel: "pending" });
  return v;
}
export function publishForm(vid: string, actor: Actor) {
  if (actor.role !== "sys_admin") throw new Error("Only sys_admin can publish a form.");
  const v = step(vid, "approved", "published", actor);
  for (const o of versions) if (o.key === v.key && o.id !== v.id && o.status === "published") o.status = "retired";
  v.publishedAt = new Date().toISOString();
  audit("consent_form.published", actor, { formKey: v.key, version: v.version });
  return v;
}

// ------------------------------------------------------------------ send
export const SEND_ROLES_RULE = "roleHasChartEntry";
export function sendForms(input: { patientId: string; formKeys: FormKey[]; actor: Actor; dueDays?: number; packet?: boolean; required?: Partial<Record<FormKey, boolean>>; now?: string; advocateId?: string }): FormRequest[] {
  const { actor } = input;
  if (actor.role !== "system" && (actor.role === "patient" || !roleHasChartEntry(actor.role as StaffRole)))
    throw new Error("Only care-team roles with chart entry can send forms.");
  const p = AdelanteEHR.getPatient(input.patientId);
  if (!p) throw new Error("Patient not found.");
  if (!input.formKeys.length) throw new Error("Pick at least one form.");
  const now = input.now ?? new Date().toISOString();
  migrateLegacyConsents(p.id);
  const out: FormRequest[] = [];
  for (const key of input.formKeys) {
    const v = publishedForm(key);
    if (!v) throw new Error("Only published forms can be sent.");
    const open = requests.find((r) => r.patientId === p.id && r.formKey === key && (r.status === "sent" || r.status === "viewed"));
    if (open) {
      out.push(open);
      continue;
    }
    const r: FormRequest = { id: id("cfr"), patientId: p.id, formKey: key, versionId: v.id, version: v.version, sentBy: { role: actor.role, ...(actor.staffId ? { staffId: actor.staffId } : {}), name: actor.name }, sentAt: now, dueAt: new Date(+new Date(now) + (input.dueDays ?? 7) * DAY).toISOString(), status: "sent", required: input.required?.[key] ?? true, ...(input.packet ? { packet: true } : {}), ...(input.advocateId ? { advocateId: input.advocateId } : {}) };
    requests.push(r);
    out.push(r);
    audit("consent_form.sent", actor, { requestId: r.id, formKey: key, version: v.version, dueAt: r.dueAt }, p.id);
  }
  deliverNotice(p, now);
  return out.map((r) => ({ ...r }));
}
function deliverNotice(p: Patient, at: string) {
  const es = p.preferredLanguage === "es";
  AdelanteEHR.notifyMember({ audience: "patient", recipientId: p.id, patientId: p.id, subject: es ? FORM_NOTICE.es : FORM_NOTICE.en, body: es ? FORM_NOTICE_BODY.es : FORM_NOTICE_BODY.en, linkRoute: "/patient", dedupeKey: `forms:${p.id}:${at.slice(0, 13)}` });
  if (AdelanteEHR.getConsentState(p.id).sms) smsLog.push({ id: id("sms"), patientId: p.id, ...(p.phone ? { to: p.phone } : {}), body: es ? FORM_NOTICE.es : FORM_NOTICE.en, at, simulated: true });
}
export const listSimulatedSms = (patientId?: string) => smsLog.filter((s) => !patientId || s.patientId === patientId).map((s) => ({ ...s }));

// ------------------------------------------------------------------ patient side
export const listRequests = (patientId: string) => requests.filter((r) => r.patientId === patientId).map((r) => ({ ...r }));
const openReq = (patientId: string, key: FormKey) => requests.find((r) => r.patientId === patientId && r.formKey === key && (r.status === "sent" || r.status === "viewed"));
export function formsToSign(patientId: string) {
  const mine = requests.filter((r) => r.patientId === patientId && !r.advocateId);
  const latest = new Map<FormKey, FormRequest>();
  for (const r of mine) latest.set(r.formKey, r);
  const items = [...latest.values()].map((r) => ({ request: { ...r }, form: getFormVersion(r.versionId)! }));
  const done = items.filter((i) => i.request.status === "signed" || i.request.status === "declined").length;
  return { items, done, total: items.length };
}
export function markViewed(patientId: string, key: FormKey) {
  const r = openReq(patientId, key);
  if (r && r.status === "sent") {
    r.status = "viewed";
    r.viewedAt = new Date().toISOString();
    audit("consent_form.viewed", { role: "patient", name: "patient" }, { requestId: r.id, formKey: key }, patientId);
  }
}
/** Save & resume — the checkbox state lives on the request, not the screen. */
export function setChecked(patientId: string, key: FormKey, checked: boolean) {
  const r = openReq(patientId, key);
  if (!r) throw new Error("No open form to check.");
  if (r.status === "sent") markViewed(patientId, key);
  r.checked = checked;
  audit("consent_form.checked", { role: "patient", name: "patient" }, { requestId: r.id, formKey: key, checked }, patientId);
}
export function declineForm(patientId: string, key: FormKey, opts: { channel?: "portal" | "in_person"; at?: string } = {}) {
  const r = openReq(patientId, key);
  if (!r) throw new Error("No open form to decline.");
  r.status = "declined";
  r.checked = false;
  r.decidedAt = opts.at ?? new Date().toISOString();
  audit("consent_form.declined", { role: "patient", name: "patient" }, { requestId: r.id, formKey: key, channel: opts.channel ?? "portal" }, patientId);
}

export interface SignInput { patientId: string; signerName: string; relationship?: "patient" | "guardian" | "proxy"; channel?: "portal" | "in_person"; language?: "en" | "es"; typedName?: string; drawn?: string; at?: string }
/** One signature step: signs every checked open form. Returns the copies. */
export function signChecked(input: SignInput): SignedCopy[] {
  const p = AdelanteEHR.getPatient(input.patientId);
  if (!p) throw new Error("Patient not found.");
  const checked = requests.filter((r) => r.patientId === p.id && !r.advocateId && r.checked && (r.status === "sent" || r.status === "viewed"));
  if (!checked.length) throw new Error("Check at least one form first.");
  if (input.signerName.trim().length < 2) throw new Error("Type the signer's name.");
  for (const r of checked) {
    const m = getFormVersion(r.versionId)!.signatureMethod;
    if (m === "typed_name" && (input.typedName ?? "").trim().length < 2) throw new Error("Type your full name to sign.");
    if (m === "drawn" && !input.drawn) throw new Error("Draw your signature to sign.");
  }
  migrateLegacyConsents(p.id);
  const at = input.at ?? new Date().toISOString();
  return checked.map((r) => signOne(p, r, { ...input, at }));
}
function signOne(p: Patient, r: FormRequest, input: SignInput & { at: string }, relationshipOverride?: SignedCopy["relationship"]): SignedCopy {
  const v = getFormVersion(r.versionId)!;
  const lang = input.language ?? (p.preferredLanguage === "es" ? "es" : "en");
  const prior = AdelanteEHR.activeConsentRecord(p.id);
  const keep = (prior?.sections ?? []).filter((s) => !v.categories.includes(s.category));
  const endsOn = v.durationDays ? new Date(+new Date(input.at) + v.durationDays * DAY).toISOString().slice(0, 10) : undefined;
  const rec = AdelanteEHR.createConsentRecord({
    patientId: p.id,
    formType: prior?.formType ?? "NonAB133",
    source: `form:${v.key} v${v.version}`,
    signedByName: input.signerName,
    relationship: input.relationship ?? "patient",
    attested: true,
    effectiveDate: input.at.slice(0, 10),
    sections: [...keep, ...v.categories.map((c): ConsentRecordSection => ({ category: c, authorized: true }))],
    capturedBy: { staffName: input.channel === "in_person" ? `In person (sent by ${r.sentBy.name})` : "Patient (self-signed)", role: input.channel === "in_person" ? "in_person" : "patient" },
    ...(prior ? { supersedesId: prior.id } : {}),
  });
  if (v.key === "sms") AdelanteEHR.setConsent(p.id, "sms", true, "form signed");
  if (v.key === "part2") AdelanteEHR.setConsent(p.id, "part2Sud", true, "form signed");
  // A newer signature of the same form supersedes the older copy.
  for (const c of copies) if (c.patientId === p.id && c.formKey === v.key && !ends.has(c.id)) ends.set(c.id, { endedAt: input.at, reason: "superseded" });
  const text = `${v.title[lang]}\n\n${v.body[lang]}`;
  const copy: SignedCopy = Object.freeze({
    id: id("csc"), requestId: r.id, patientId: p.id, formKey: v.key, versionId: v.id, version: v.version, title: v.title[lang], language: lang, fullText: text, textHash: textHash(text), signatureMethod: v.signatureMethod,
    signerName: (input.typedName ?? input.signerName).trim(), relationship: relationshipOverride ?? input.relationship ?? "patient", signedAt: input.at, channel: input.channel ?? "portal", sentBy: r.sentBy.name, consentRecordId: rec.id,
    ...(endsOn ? { endsOn } : {}), ...(input.drawn ? { signatureData: input.drawn } : {}),
  });
  copies.push(copy);
  r.status = "signed";
  r.decidedAt = input.at;
  audit("consent_form.signed", { role: input.channel === "in_person" ? "in_person" as never : "patient", name: copy.signerName }, { requestId: r.id, formKey: v.key, version: v.version, language: lang, textHash: copy.textHash, method: v.signatureMethod, relationship: copy.relationship, channel: copy.channel }, p.id);
  return copy;
}

/** Advocate side: the advocate signs their attestation (same workflow, relationship "advocate"). */
export function signAdvocateAttestation(input: { patientId: string; advocateId: string; signerName: string; at?: string }): SignedCopy {
  const p = AdelanteEHR.getPatient(input.patientId);
  if (!p) throw new Error("Patient not found.");
  const r = requests.find((x) => x.patientId === p.id && x.advocateId === input.advocateId && x.formKey === "advocate_attestation" && (x.status === "sent" || x.status === "viewed"));
  if (!r) throw new Error("No attestation waiting for this advocate.");
  if (input.signerName.trim().length < 2) throw new Error("Type your full name to sign.");
  return signOne(p, r, { patientId: p.id, signerName: input.signerName, typedName: input.signerName, at: input.at ?? new Date().toISOString() }, "advocate");
}
export const advocateFormsToSign = (advocateId: string) => requests.filter((r) => r.advocateId === advocateId && (r.status === "sent" || r.status === "viewed")).map((r) => ({ request: { ...r }, form: getFormVersion(r.versionId)! }));

// ------------------------------------------------------------------ store
export function listSignedCopies(patientId: string) {
  return copies.filter((c) => c.patientId === patientId).map((c) => {
    const e = ends.get(c.id) ?? (c.endsOn && c.endsOn < new Date().toISOString().slice(0, 10) ? { endedAt: `${c.endsOn}T00:00:00.000Z`, reason: "expired" as const } : undefined);
    return { copy: c, ended: e, retainUntil: e ? retainUntil(e.endedAt) : undefined };
  });
}
export function retainUntil(endedAtIso: string): string {
  const d = new Date(endedAtIso);
  d.setUTCFullYear(d.getUTCFullYear() + RETENTION_YEARS);
  return d.toISOString().slice(0, 10);
}
const activeCopy = (patientId: string, key: FormKey) => [...copies].reverse().find((c) => c.patientId === patientId && c.formKey === key && !ends.has(c.id) && !(c.endsOn && c.endsOn < new Date().toISOString().slice(0, 10)));
export const hasSignedForm = (patientId: string, key: FormKey) => Boolean(activeCopy(patientId, key));

/** W5 — legacy intake booleans → one ledger entry, source "intake (legacy)". Idempotent. */
const migrated = new Set<string>();
export function migrateLegacyConsents(patientId: string): boolean {
  if (migrated.has(patientId)) return false;
  migrated.add(patientId);
  const p = AdelanteEHR.getPatient(patientId);
  if (!p || AdelanteEHR.listConsentRecords(p.id).length) return false;
  const st = AdelanteEHR.getConsentState(p.id);
  const sections: ConsentRecordSection[] = [
    { category: "sud_treatment", authorized: Boolean(st.part2Sud) },
    { category: "sms_reminders", authorized: Boolean(st.sms) },
    { category: "case_coordination", authorized: Boolean(st.ecmShare) },
  ];
  if (!sections.some((s) => s.authorized) && !p.consents?.hipaa) return false;
  if (p.consents?.hipaa) sections.push({ category: "hipaa_authorization", authorized: true });
  AdelanteEHR.createConsentRecord({ patientId: p.id, formType: "NonAB133", source: "intake (legacy)", signedByName: `${p.firstName} ${p.lastName}`, attested: true, effectiveDate: (p.consents?.signedAt ?? new Date().toISOString()).slice(0, 10), sections, capturedBy: { staffName: "Migration", role: "system" } });
  return true;
}

// ------------------------------------------------------------------ revoke
export const CARE_IMPACT: Record<FormKey, Bi> = {
  hipaa: { en: "Without this, care can't start or continue at Adelante.", es: "Sin esto, la atención no puede empezar ni continuar en Adelante. (Borrador)" },
  telehealth: { en: "Your visits will be in person only.", es: "Sus visitas serán solo en persona. (Borrador)" },
  portal: { en: "Staff will help you with forms and messages instead of the app.", es: "El personal le ayudará con formularios y mensajes en lugar de la app. (Borrador)" },
  sms: { en: "You won't get text reminders. We'll remind you in the app instead.", es: "No recibirá recordatorios por texto. Le recordaremos en la app. (Borrador)" },
  part2: { en: "Substance-use information will stay locked. Your team may not see all of your care.", es: "La información sobre uso de sustancias quedará bloqueada. Su equipo puede no ver toda su atención. (Borrador)" },
  group: { en: "You can't be booked into groups. Individual visits and medications don't change.", es: "No se le puede reservar en grupos. Las visitas individuales y medicamentos no cambian. (Borrador)" },
  po_release: { en: "We won't share coordination updates with your officer. Required reporting doesn't change.", es: "No compartiremos actualizaciones con su oficial. Los informes obligatorios no cambian. (Borrador)" },
  advocate_patient: { en: "Your helper will lose access to your care.", es: "Su ayudante perderá acceso a su atención. (Borrador)" },
  advocate_attestation: { en: "The helper's access will stop.", es: "El acceso del ayudante se detendrá. (Borrador)" },
  ai_recording: { en: "Visits won't be recorded. Nothing else changes.", es: "Las visitas no se grabarán. Nada más cambia. (Borrador)" },
};
export function revokeForm(input: { patientId: string; formKey: FormKey; by: "patient" | "staff"; reason?: string; actor?: Actor; at?: string }) {
  const p = AdelanteEHR.getPatient(input.patientId);
  if (!p) throw new Error("Patient not found.");
  if (input.by === "staff") {
    if (!input.actor || input.actor.role === "patient" || input.actor.role === "system" || canAccess(input.actor.role as StaffRole, "consent_ledger").level !== "write")
      throw new Error("Your role can read the consent ledger but can't change it.");
    if ((input.reason ?? "").trim().length < 3) throw new Error("A reason is required.");
  }
  const c = activeCopy(p.id, input.formKey);
  if (!c) throw new Error("Nothing signed to stop.");
  const v = getFormVersion(c.versionId)!;
  const at = input.at ?? new Date().toISOString();
  const prior = AdelanteEHR.activeConsentRecord(p.id);
  const keep = (prior?.sections ?? []).filter((s) => !v.categories.includes(s.category));
  AdelanteEHR.createConsentRecord({ patientId: p.id, formType: prior?.formType ?? "NonAB133", source: `form:${v.key} revoked`, signedByName: input.by === "patient" ? `${p.firstName} ${p.lastName}` : input.actor!.name, attested: true, effectiveDate: at.slice(0, 10), sections: [...keep, ...v.categories.map((cat) => ({ category: cat, authorized: false }))], capturedBy: { staffName: input.by === "patient" ? "Patient (self-service)" : input.actor!.name, role: input.by === "patient" ? "patient" : input.actor!.role }, ...(prior ? { supersedesId: prior.id } : {}) });
  // Purpose mirrors — Part 2 re-locks SUD rows immediately (live gate).
  if (v.key === "sms" || v.key === "part2") {
    const purpose = v.key === "sms" ? "sms" : "part2Sud";
    if (input.by === "staff") AdelanteEHR.staffSetConsent(p.id, purpose, false, { role: input.actor!.role as StaffRole, ...(input.actor!.staffId ? { staffId: input.actor!.staffId } : {}), staffName: input.actor!.name }, input.reason);
    else AdelanteEHR.setConsent(p.id, purpose, false, "patient stopped sharing");
  }
  ends.set(c.id, { endedAt: at, reason: "revoked", ...(input.reason ? { note: input.reason.trim() } : {}) });
  audit("consent_form.revoked", input.actor ?? { role: "patient", name: "patient" }, { formKey: v.key, version: v.version, by: input.by, reason: input.reason?.trim() || "(none given)", retainUntil: retainUntil(at) }, p.id);
}

// ------------------------------------------------------------------ track: tasks, expiry, renewal
export function sweepConsentForms(now = new Date()): void {
  const t = +now;
  for (const r of requests) {
    if ((r.status === "sent" || r.status === "viewed") && t > +new Date(r.dueAt) + 14 * DAY) {
      r.status = "expired";
      audit("consent_form.expired", { role: "system", name: "system" }, { requestId: r.id, formKey: r.formKey }, r.patientId);
      continue;
    }
    if ((r.status === "sent" || r.status === "viewed") && !r.taskRaisedAt && t - +new Date(r.sentAt) >= UNSIGNED_TASK_DAYS * DAY) {
      r.taskRaisedAt = now.toISOString();
      const target = r.sentBy.staffId ? { recipientStaffId: r.sentBy.staffId } : { recipientRole: "clinical_coordinator" as StaffRole };
      AdelanteEHR.notify({ ...target, category: "patient_update", subject: "New task: Form not signed yet", body: "A form you sent is still waiting after 3 days. Open the client's Consents section.", linkRoute: "/record/$patientId", linkParams: { patientId: r.patientId }, patientId: r.patientId, kind: "task", taskKey: `consent-unsigned:${r.id}` });
    }
  }
  for (const c of copies) {
    if (!c.endsOn || ends.has(c.id)) continue;
    const daysLeft = (+new Date(`${c.endsOn}T00:00:00Z`) - t) / DAY;
    if (daysLeft <= RENEWAL_LEAD_DAYS && daysLeft > 0) {
      const sender = requests.find((r) => r.id === c.requestId)?.sentBy;
      const target = sender?.staffId ? { recipientStaffId: sender.staffId } : { recipientRole: "clinical_coordinator" as StaffRole };
      AdelanteEHR.notify({ ...target, category: "patient_update", subject: "New task: Form renewal due", body: "A signed form ends within 30 days. Resend the current version from the client's Consents section.", linkRoute: "/record/$patientId", linkParams: { patientId: c.patientId }, patientId: c.patientId, kind: "task", taskKey: `consent-renew:${c.id}` });
    }
  }
}
export function renewalsDue(patientId: string, now = new Date()) {
  return listSignedCopies(patientId).filter((x) => !x.ended && x.copy.endsOn && (+new Date(`${x.copy.endsOn}T00:00:00Z`) - +now) / DAY <= RENEWAL_LEAD_DAYS).map((x) => x.copy);
}
export function resendCurrent(patientId: string, key: FormKey, actor: Actor) {
  return sendForms({ patientId, formKeys: [key], actor });
}

// ------------------------------------------------------------------ W7 intake packet
export interface PacketItem { key: FormKey; required: boolean; neededBefore: string }
export function intakePacketFor(pathway: Pathway): PacketItem[] {
  const out: PacketItem[] = [
    { key: "hipaa", required: true, neededBefore: "first visit" },
    { key: "telehealth", required: true, neededBefore: "first visit" },
    { key: "portal", required: true, neededBefore: "first visit" },
    { key: "sms", required: true, neededBefore: "first visit" },
  ];
  if (pathway === "sud" || pathway === "reentry_sud") out.push({ key: "part2", required: true, neededBefore: "any SUD information is shared" });
  if (pathway !== "general") out.push({ key: "group", required: true, neededBefore: "first group" });
  if (pathway === "reentry" || pathway === "reentry_sud") out.push({ key: "po_release", required: false, neededBefore: "offered only" });
  return out;
}
const packetPatients = new Set<string>();
export const hasIntakePacket = (patientId: string) => packetPatients.has(patientId);
/** Builds (or tops up after a pathway change) the patient's packet. Already-signed forms are skipped. */
export function buildIntakePacket(patientId: string, actor: Actor = { role: "system", name: "Intake packet" }): FormRequest[] {
  const items = intakePacketFor(patientPathway(patientId)).filter((i) => !hasSignedForm(patientId, i.key) && !requests.some((r) => r.patientId === patientId && r.formKey === i.key && r.status !== "expired"));
  packetPatients.add(patientId);
  if (!items.length) return [];
  return sendForms({ patientId, formKeys: items.map((i) => i.key), actor, packet: true, required: Object.fromEntries(items.map((i) => [i.key, i.required])) });
}
const lastPathway = new Map<string, Pathway>();
function sweepPathways() {
  for (const pid of packetPatients) {
    const now = patientPathway(pid);
    const before = lastPathway.get(pid);
    lastPathway.set(pid, now);
    if (before && before !== now) buildIntakePacket(pid);
  }
}

/** W7 decline outcomes, plain words for staff and patient. */
export const DECLINE_OUTCOME: Partial<Record<FormKey, string>> = {
  hipaa: "Care can't start until HIPAA is signed.",
  telehealth: "In-person visits only.",
  portal: "Staff-assisted only — no app forms or messages.",
  sms: "No text messages.",
  part2: "Substance-use information stays locked.",
  group: "Group booking unavailable.",
};
export const GROUP_CONSENT_NEEDED = "Group consent needed";
/** Group gate: only for patients whose packet requires Group participation. Never touches individual visits or MAT. */
export function groupConsentGate(patientId: string): string | undefined {
  const required = requests.some((r) => r.patientId === patientId && r.formKey === "group" && r.required);
  if (!required) return undefined;
  return hasSignedForm(patientId, "group") ? undefined : GROUP_CONSENT_NEEDED;
}
export function careStartBlocked(patientId: string): boolean {
  return requests.some((r) => r.patientId === patientId && r.formKey === "hipaa" && r.status === "declined") && !hasSignedForm(patientId, "hipaa");
}

/** Status chip label for a form on the chart/ledger. */
export const STATUS_LABEL: Record<RequestStatus, string> = { sent: "Sent", viewed: "Viewed", signed: "Signed", declined: "Declined", expired: "Expired" };

/** W8 — advocate forms: patient-side consent + advocate attestation, same workflow. */
export function sendAdvocateForms(patientId: string, linkId: string, actor: Actor = { role: "system", name: "Advocate invitation" }): FormRequest[] {
  if (requests.some((r) => r.patientId === patientId && r.formKey === "advocate_patient" && r.status !== "expired" && r.status !== "declined")) return [];
  const a = sendForms({ patientId, formKeys: ["advocate_patient"], actor });
  const b = sendForms({ patientId, formKeys: ["advocate_attestation"], actor, advocateId: linkId });
  return [...a, ...b];
}
const knownLinks = new Set<string>();
let linksPrimed = false;
function sweepAdvocateLinks() {
  for (const l of AdelanteEHR.listAdvocateLinks()) {
    if (knownLinks.has(l.id)) continue;
    knownLinks.add(l.id);
    // Seeded links at load are not re-sent; new invitations get both forms.
    if (linksPrimed && l.status === "invited") sendAdvocateForms(l.patientId, l.id);
  }
  linksPrimed = true;
}

setGroupConsentGate(groupConsentGate);
seedLibrary();
sweepAdvocateLinks();
AdelanteEHR.subscribe(() => {
  try {
    sweepPathways();
    sweepAdvocateLinks();
  } catch {
    /* never break the store */
  }
});

/** Test hook. */
export function _resetConsentForms(): void {
  requests.length = 0;
  copies.length = 0;
  ends.clear();
  smsLog.length = 0;
  migrated.clear();
  packetPatients.clear();
  lastPathway.clear();
}

/** W7 one-card prompt — the patient can reopen a form they declined (Group, by default). */
export function reopenForPatient(patientId: string, key: FormKey): FormRequest {
  const open = openReq(patientId, key);
  if (open) return { ...open };
  const v = publishedForm(key);
  if (!v) throw new Error("Only published forms can be signed.");
  const prev = [...requests].reverse().find((r) => r.patientId === patientId && r.formKey === key);
  const now = new Date().toISOString();
  const r: FormRequest = { id: id("cfr"), patientId, formKey: key, versionId: v.id, version: v.version, sentBy: prev?.sentBy ?? { role: "patient", name: "Patient prompt" }, sentAt: now, dueAt: new Date(+new Date(now) + 7 * DAY).toISOString(), status: "viewed", viewedAt: now, required: prev?.required ?? true };
  requests.push(r);
  audit("consent_form.reopened_by_patient", { role: "patient", name: "patient" }, { requestId: r.id, formKey: key }, patientId);
  return { ...r };
}
