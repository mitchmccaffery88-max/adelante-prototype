// §B7 — screener save and resume. A draft is a PARTIAL set of answers for one
// instrument, one patient, saved as the person goes. A draft is NEVER scored
// and NEVER written to screenerHistory — only `completeRescreen` /
// `recordScreener` (unchanged) produce a scored result. Safety is not
// deferred: the same trigger conditions as the existing crisis path (PHQ-9
// item 9 above 0, any C-SSRS positive answer) fire the moment they're saved,
// even mid-draft, via the EXISTING `AdelanteEHR.flagCrisis` — once per draft.
import { AdelanteEHR } from "@/lib/ehr";
import { DRAFT_LABEL } from "@/lib/screeners";
import { CSSRS_KEY } from "@/lib/cssrs";

/** Resume window: a draft older than this expires into a content-free stub. */
export const SCREENER_DRAFT_DAYS = 7;
export const SCREENER_DRAFT_LABEL = DRAFT_LABEL;

export interface ScreenerDraft {
  patientId: string;
  key: string;
  /** Item-score answers, same shape as `ScreenerItems` — undefined = unanswered. */
  answers: (number | undefined)[];
  /** Chosen option index per item (instruments with shared-score choices). */
  choices: Record<number, number>;
  /** "patient" for self-entry, else the staff id who entered it. */
  enteredBy: "patient" | string;
  savedAt: string;
  /** True once the existing crisis path has been triggered for this draft. */
  crisisTriggered?: boolean;
  /** True once expired past `SCREENER_DRAFT_DAYS` — answers are wiped. */
  expired?: boolean;
}

const drafts = new Map<string, ScreenerDraft>();

// §C6 Survive the one-time stale-chunk reload (and any slow-load reload):
// drafts mirror into this tab's sessionStorage and rehydrate on load. Cleared
// when the tab closes; nothing leaves the device. Server-side storage is the
// SculptSoft handoff.
const SESSION_KEY = "__adelante_screener_drafts";
function persistDrafts(): void {
  try {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify([...drafts.entries()]));
  } catch {
    /* storage unavailable — in-memory only */
  }
}
try {
  if (typeof window !== "undefined") {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (raw) for (const [k, v] of JSON.parse(raw) as [string, ScreenerDraft][]) drafts.set(k, v);
  }
} catch {
  /* ignore corrupt storage */
}
const draftId = (patientId: string, key: string) => `${patientId}::${key}`;

/** Safety first — mirrors the existing PHQ-9 item 9 / C-SSRS positive rule. Idempotent per draft. */
function checkCrisis(patientId: string, key: string, answers: (number | undefined)[], draft: ScreenerDraft): void {
  if (draft.crisisTriggered) return;
  let detail: string | undefined;
  if (key === "phq-9" && (answers[8] ?? 0) > 0) {
    detail = "PHQ-9 item 9 answered above 0 (draft, unscored, pending sign-off)";
  } else if (key === CSSRS_KEY && answers.some((a) => a === 1)) {
    detail = "C-SSRS Screener — positive item answered (draft, unscored, pending sign-off)";
  }
  if (!detail) return;
  draft.crisisTriggered = true;
  const staffName = draft.enteredBy === "patient" ? "Patient self-report (draft)" : draft.enteredBy;
  AdelanteEHR.flagCrisis(patientId, staffName, detail, { triggerSource: "screener_score" });
}

/** Save/overwrite the draft for this patient + instrument. Answers as given so far save every call. */
export function saveScreenerDraft(
  patientId: string,
  key: string,
  data: { answers: (number | undefined)[]; choices?: Record<number, number> },
  enteredBy: "patient" | string,
): ScreenerDraft {
  const id = draftId(patientId, key);
  const existing = drafts.get(id);
  const draft: ScreenerDraft = {
    patientId,
    key,
    answers: [...data.answers],
    choices: { ...(data.choices ?? {}) },
    enteredBy,
    savedAt: new Date().toISOString(),
    crisisTriggered: existing?.crisisTriggered,
  };
  drafts.set(id, draft);
  persistDrafts();
  checkCrisis(patientId, key, draft.answers, draft);
  return draft;
}

/** Undefined once expired or never started — callers never see a stub's (empty) answers as live. */
export function getScreenerDraft(patientId: string, key: string): ScreenerDraft | undefined {
  const d = drafts.get(draftId(patientId, key));
  return d && !d.expired ? d : undefined;
}

export function discardScreenerDraft(patientId: string, key: string): void {
  drafts.delete(draftId(patientId, key));
  persistDrafts();
}

/** Active (non-expired) drafts for a patient, across instruments. */
export function listScreenerDrafts(patientId: string): ScreenerDraft[] {
  return Array.from(drafts.values()).filter((d) => d.patientId === patientId && !d.expired);
}

/**
 * Sweep drafts older than `SCREENER_DRAFT_DAYS`: wipe answers and leave a
 * content-free audit stub (instrument key only, never an answer). Returns the
 * ids expired, for tests.
 */
export function expireScreenerDrafts(now: Date = new Date()): string[] {
  const expiredIds: string[] = [];
  for (const [id, d] of drafts.entries()) {
    if (d.expired) continue;
    const ageDays = (+now - +new Date(d.savedAt)) / 86_400_000;
    if (ageDays < SCREENER_DRAFT_DAYS) continue;
    drafts.set(id, { ...d, answers: [], choices: {}, expired: true });
    persistDrafts();
    AdelanteEHR.recordActionEvent({
      action: "screener_draft_expired",
      actorId: "system",
      patientId: d.patientId,
      detail: { screenerKey: d.key },
    });
    expiredIds.push(id);
  }
  return expiredIds;
}

/** EN/ES patient-facing resume copy. Spanish marked Draft per existing conventions. */
export const SCREENER_DRAFT_COPY = {
  en: {
    resumeHeading: "Pick up where you left off",
    resumeBody: "You started this questionnaire and didn't finish. Your answers were saved as a draft.",
    draftLabel: SCREENER_DRAFT_LABEL,
  },
  es: {
    resumeHeading: "Continúa donde lo dejaste",
    resumeBody: "Empezaste este cuestionario y no lo terminaste. Tus respuestas se guardaron como borrador.",
    draftLabel: SCREENER_DRAFT_LABEL,
  },
} as const;

/** Staff-facing chart badge text — never shows answers or a score. */
export const SCREENER_DRAFT_IN_PROGRESS_LABEL = "In progress";
