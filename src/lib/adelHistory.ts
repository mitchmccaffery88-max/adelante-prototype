// §Adel chat persistence — the ONLY home of saved Adel conversations.
//
// Privacy model (Draft — counsel to confirm):
// - Threads are keyed by OWNER: a patient, or an advocate's own link. There is
//   no staff read path at all — staff only ever receive what the patient
//   explicitly shares, and that is a summary (topics), never the transcript.
// - Retention: 90 days from last activity, then auto-delete with a
//   content-free audit stub. Patient delete-one / delete-all write the same stub.
// - A chat mentioning substance use is Part 2-classified; sharing it goes
//   through disclose() (internal treatment-team recipient).
// - Crisis detection is NOT here: AdelChat still runs the Phase 1 scanner
//   before anything is saved or sent, exactly as before.
// - Prototype: the store is in-memory for the browser session. Production
//   storage is server-side and encrypted (docs/sculptsoft-adel-handoff.md).
import { AdelanteEHR } from "@/lib/ehr";
import { disclose } from "@/lib/part2Disclosure";
import { SimulatedAdelMemoryAdapter } from "@/lib/vendors/llm";

export const ADEL_RETENTION_DAYS = 90;
export const ADEL_RETENTION_DRAFT_LABEL = "Draft — counsel to confirm";

export type AdelOwner = { kind: "patient"; patientId: string } | { kind: "advocate"; linkId: string };
const ownerKey = (o: AdelOwner) => (o.kind === "patient" ? `patient:${o.patientId}` : `advocate:${o.linkId}`);

export interface AdelSavedTurn {
  role: "user" | "assistant";
  content: string;
  at: string;
  crisis?: boolean;
  /** "voice" when the patient confirmed a spoken answer as text. */
  via?: "text" | "voice";
}
export interface AdelThread {
  id: string;
  ownerKey: string;
  startedAt: string;
  updatedAt: string;
  title: { en: string; es: string };
  topics: string[];
  turns: AdelSavedTurn[];
  part2: boolean;
  sharedAt?: string;
}
export interface AdelDeletionStub {
  threadId: string;
  ownerKey: string;
  deletedAt: string;
  reason: "patient_deleted" | "patient_cleared_all" | "retention_expired";
}

const threads: AdelThread[] = [];
const stubs: AdelDeletionStub[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
export function subscribeAdelHistory(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Substance-use mention → Part 2-classified thread. Plain words, EN + ES. */
const SUD_MENTION =
  /\b(drink(ing)?|alcohol|beer|drunk|high|using|relapse|sober|sobriety|meth|heroin|fentanyl|opioids?|pills|weed|cannabis|cocaine|crack|suboxone|buprenorphine|methadone|naloxone|narcan|aa|na meeting|recovery meeting|beber|borracho|alcohol|droga(s)?|recaída|sobrio|metanfetamina|cristal)\b/i;
export function mentionsSubstanceUse(text: string): boolean {
  return SUD_MENTION.test(text);
}

function audit(action: string, o: { ownerKey: string; threadId?: string; detail?: Record<string, unknown> }) {
  const patientId = o.ownerKey.startsWith("patient:") ? o.ownerKey.slice(8) : undefined;
  AdelanteEHR._recordAudit({
    category: "access",
    action,
    ...(patientId ? { patientId } : {}),
    actorId: o.ownerKey.startsWith("patient:") ? "patient" : "advocate",
    detail: { ...(o.threadId ? { threadId: o.threadId } : {}), ...(o.detail ?? {}) },
  });
}

/** Auto-delete anything older than the retention window. Idempotent. */
export function purgeExpiredAdelThreads(now = new Date()): number {
  const cutoff = now.getTime() - ADEL_RETENTION_DAYS * 86_400_000;
  let n = 0;
  for (let i = threads.length - 1; i >= 0; i--) {
    const t = threads[i]!;
    if (new Date(t.updatedAt).getTime() < cutoff) {
      threads.splice(i, 1);
      stubs.push({ threadId: t.id, ownerKey: t.ownerKey, deletedAt: now.toISOString(), reason: "retention_expired" });
      audit("adel_thread_deleted", { ownerKey: t.ownerKey, threadId: t.id, detail: { reason: "retention_expired" } });
      n++;
    }
  }
  if (n) emit();
  return n;
}

/** The owner's own threads, newest first. There is no other read path. */
export function listAdelThreads(owner: AdelOwner, now = new Date()): AdelThread[] {
  purgeExpiredAdelThreads(now);
  const k = ownerKey(owner);
  return threads.filter((t) => t.ownerKey === k).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export function getAdelThread(owner: AdelOwner, threadId: string): AdelThread | undefined {
  return threads.find((t) => t.id === threadId && t.ownerKey === ownerKey(owner));
}

/** Save one turn; creates the thread on the first patient message. */
export function saveAdelTurn(owner: AdelOwner, threadId: string | undefined, turn: Omit<AdelSavedTurn, "at"> & { at?: string }): AdelThread {
  const at = turn.at ?? new Date().toISOString();
  let t = threadId ? getAdelThread(owner, threadId) : undefined;
  if (!t) {
    t = {
      id: `adel-${++seq}`,
      ownerKey: ownerKey(owner),
      startedAt: at,
      updatedAt: at,
      title: { en: "Chat with Adel", es: "Conversación con Adel" },
      topics: [],
      turns: [],
      part2: false,
    };
    threads.push(t);
    audit("adel_thread_started", { ownerKey: t.ownerKey, threadId: t.id });
  }
  t.turns.push({ ...turn, at });
  t.updatedAt = at;
  if (turn.role === "user") {
    if (mentionsSubstanceUse(turn.content)) t.part2 = true;
    const userText = t.turns.filter((x) => x.role === "user").map((x) => x.content);
    t.topics = SimulatedAdelMemoryAdapter.topics(userText);
    t.title = SimulatedAdelMemoryAdapter.title(t.topics);
  }
  emit();
  return t;
}

export function deleteAdelThread(owner: AdelOwner, threadId: string, now = new Date()): boolean {
  const i = threads.findIndex((t) => t.id === threadId && t.ownerKey === ownerKey(owner));
  if (i < 0) return false;
  threads.splice(i, 1);
  stubs.push({ threadId, ownerKey: ownerKey(owner), deletedAt: now.toISOString(), reason: "patient_deleted" });
  audit("adel_thread_deleted", { ownerKey: ownerKey(owner), threadId, detail: { reason: "patient_deleted" } });
  emit();
  return true;
}

export function clearAdelHistory(owner: AdelOwner, now = new Date()): number {
  const k = ownerKey(owner);
  const mine = threads.filter((t) => t.ownerKey === k);
  for (const t of mine) {
    threads.splice(threads.indexOf(t), 1);
    stubs.push({ threadId: t.id, ownerKey: k, deletedAt: now.toISOString(), reason: "patient_cleared_all" });
  }
  audit("adel_history_cleared", { ownerKey: k, detail: { count: mine.length } });
  emit();
  return mine.length;
}

export function adelDeletionStubs(): AdelDeletionStub[] {
  return stubs.map((s) => ({ ...s }));
}

/** Simulated continuity line from the owner's OWN previous conversation. */
export function adelRecallLine(owner: AdelOwner, lang: "en" | "es", excludeThreadId?: string, now = new Date()): string | undefined {
  const prev = listAdelThreads(owner, now).find((t) => t.id !== excludeThreadId && t.topics.length > 0);
  if (!prev) return undefined;
  return SimulatedAdelMemoryAdapter.recall(prev.topics[0]!, prev.updatedAt, now, lang);
}

/** Recent own-history context (topics only) for the assistant prompt. */
export function adelHistoryContext(owner: AdelOwner, excludeThreadId?: string): string[] {
  return listAdelThreads(owner).filter((t) => t.id !== excludeThreadId).slice(0, 3).flatMap((t) => t.topics).slice(0, 5);
}

export type AdelShareResult = { ok: true; summary: string; messageId: string; disclosed: boolean } | { ok: false; reason: string };

/**
 * Patient taps "Share with my care team": a Simulated summary (topics only —
 * never the transcript) lands in the care-team message thread. Part 2 threads
 * are disclosed through disclose() first and the message is SUD-flagged so the
 * existing masking hides it from roles without SUD access.
 */
export function shareAdelThread(patientId: string, threadId: string, now = new Date()): AdelShareResult {
  const owner: AdelOwner = { kind: "patient", patientId };
  const t = getAdelThread(owner, threadId);
  if (!t) return { ok: false, reason: "That conversation is no longer saved." };
  const p = AdelanteEHR.getPatient(patientId);
  if (!p) return { ok: false, reason: "Patient not found." };
  const summary = SimulatedAdelMemoryAdapter.summary(t.topics, t.startedAt);
  let disclosed = false;
  if (t.part2) {
    const r = disclose({
      patientId,
      actor: { name: `${p.firstName} ${p.lastName}`, role: "patient" },
      recipient: { name: "Assigned care team", type: "internal" },
      purpose: "Patient-initiated share of an Adel conversation summary",
      channel: "adel_share",
      recordClasses: ["SUD-related Adel conversation summary"],
      simulated: true,
      at: now.toISOString(),
    });
    if (!r.ok) return { ok: false, reason: r.reason };
    disclosed = true;
  }
  const msg = AdelanteEHR.sendPatientMessage(patientId, summary, t.part2);
  if (!msg) return { ok: false, reason: "Could not send." };
  t.sharedAt = now.toISOString();
  audit("adel_thread_shared", { ownerKey: t.ownerKey, threadId, detail: { messageId: msg.id, part2: t.part2, simulated: true } });
  emit();
  return { ok: true, summary, messageId: msg.id, disclosed };
}

export const ADEL_HISTORY_COPY = {
  en: {
    tab: "Adel",
    heading: "Your chats with Adel",
    privacy: "Your chats with Adel are private. Your care team sees them only if you share them, or if you might be in danger.",
    retention: `Chats are deleted automatically after ${ADEL_RETENTION_DAYS} days.`,
    continueLatest: "Continue",
    newChat: "New chat",
    none: "No saved chats yet.",
    share: "Share with my care team",
    shareConfirm: "Send a short summary of this chat to your care team? They see the topics, not your words.",
    shared: "Summary sent to your care team",
    sharedBadge: "Shared",
    delete: "Delete",
    deleteConfirm: "Delete this chat? This can't be undone.",
    clearAll: "Delete my Adel history",
    clearAllConfirm: "Delete all your chats with Adel? This can't be undone.",
    deleted: "Deleted",
    confirm: "Yes, continue",
    cancel: "Cancel",
    history: "Past chats",
  },
  es: {
    tab: "Adel",
    heading: "Tus conversaciones con Adel",
    privacy: "Tus conversaciones con Adel son privadas. Tu equipo de atención las ve solo si tú las compartes, o si podrías estar en peligro.",
    retention: `Las conversaciones se borran automáticamente después de ${ADEL_RETENTION_DAYS} días.`,
    continueLatest: "Continuar",
    newChat: "Nueva conversación",
    none: "Todavía no hay conversaciones guardadas.",
    share: "Compartir con mi equipo de atención",
    shareConfirm: "¿Enviar un resumen corto de esta conversación a tu equipo? Ven los temas, no tus palabras.",
    shared: "Resumen enviado a tu equipo de atención",
    sharedBadge: "Compartida",
    delete: "Borrar",
    deleteConfirm: "¿Borrar esta conversación? No se puede deshacer.",
    clearAll: "Borrar mi historial con Adel",
    clearAllConfirm: "¿Borrar todas tus conversaciones con Adel? No se puede deshacer.",
    deleted: "Borrado",
    confirm: "Sí, continuar",
    cancel: "Cancelar",
    history: "Conversaciones anteriores",
  },
} as const;
export const ADEL_HISTORY_ES_DRAFT_LABEL = "Borrador — traducción pendiente de revisión";

export function _resetAdelHistoryForTests() {
  threads.length = 0;
  stubs.length = 0;
  seq = 0;
}
