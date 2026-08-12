// §Adelante Journey Phase 5 — ENGAGEMENT STORE (architecture correction).
//
// Self-help Library/Exercise progress is engagement/experience data, not
// clinical documentation: nobody authors it as a clinician, nothing bills off
// it, and it must NOT inherit the RBAC / export / Part 2 assumptions that the
// designated clinical record carries. So it does not live on `Patient` — it
// lives here, in its own store, keyed by `patientId` as a FOREIGN REFERENCE.
//
// Separate, not isolated: `engagementRecords()` / `engagementSummary()` are
// deliberately queryable by patient id so population-health and outcomes
// reporting can JOIN engagement against clinical data (screener trends etc.)
// without special-case filtering wherever the clinical record is read,
// exported or disclosed.
//
// Behaviour is a straight relocation of the previous patient-field version:
// completion is idempotent, finishing a lesson auto-saves its toolkit
// takeaway, and every first-time completion is audited exactly once — through
// the sink `src/lib/ehr.ts` registers, so audit stays in the one audit stream.
import { getRecoveryLesson, TOOL_FLOW_LIMITS } from "./recovery";
import { getExercise, getLibraryItem, type SavedToolkitItem, type ToolkitOrigin } from "./library";

/** One patient's engagement row. `patientId` is a foreign key, not ownership. */
export interface PatientEngagement {
  patientId: string;
  /** Lesson ids completed. Idempotent set, append-only. */
  completedLibraryItems: string[];
  /** Exercise ids completed. Separate namespace from lessons. */
  completedExercises: string[];
  /** §Phase 5b — Recovery module lesson ids completed. Own namespace again. */
  completedRecoveryLessons: string[];
  /** §Phase 5b — structured tool-flow selections, keyed by recovery lesson id. */
  recoveryToolFlows: Record<string, RecoveryToolFlowSelection>;
  /** Saved takeaways, one per source lesson/exercise. */
  savedToolkitItems: SavedToolkitItem[];
  firstActivityAt?: string;
  lastActivityAt?: string;
}

/**
 * What a patient selected in steps 7–9 of a recovery lesson. Structured, not
 * free text — so it can be counted, joined and re-shown, exactly like the rest
 * of engagement data, and equally NOT part of the clinical record.
 */
export interface RecoveryToolFlowSelection {
  warningSigns: string[];
  supportPeople: string[];
  /** Single select — one action for today. */
  todayAction?: string;
  updatedAt: string;
}

const records = new Map<string, PatientEngagement>();

type Listener = () => void;
const listeners = new Set<Listener>();
const notify = () => listeners.forEach((l) => l());

/** Subscribe to engagement changes (the EHR store re-broadcasts these to UI). */
export function subscribeEngagement(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export type EngagementAuditEvent = {
  patientId: string;
  action: "library_item_completed" | "library_exercise_completed";
  actorRole: string;
  detail: Record<string, unknown>;
};
type AuditSink = (evt: EngagementAuditEvent) => void;
let auditSink: AuditSink | undefined;

/** The EHR store installs the real audit writer; engagement never imports it. */
export function setEngagementAuditSink(sink: AuditSink | undefined): void {
  auditSink = sink;
}

function row(patientId: string): PatientEngagement {
  let r = records.get(patientId);
  if (!r) {
    r = {
      patientId,
      completedLibraryItems: [],
      completedExercises: [],
      completedRecoveryLessons: [],
      recoveryToolFlows: {},
      savedToolkitItems: [],
    };
    records.set(patientId, r);
  }
  return r;
}

function touch(r: PatientEngagement) {
  const now = new Date().toISOString();
  r.firstActivityAt ??= now;
  r.lastActivityAt = now;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function completedLibraryItems(patientId: string): string[] {
  return [...(records.get(patientId)?.completedLibraryItems ?? [])];
}

export function completedExercises(patientId: string): string[] {
  return [...(records.get(patientId)?.completedExercises ?? [])];
}

export function savedToolkitItems(patientId: string): SavedToolkitItem[] {
  return (records.get(patientId)?.savedToolkitItems ?? []).map((t) => ({ ...t }));
}

export function completedRecoveryLessons(patientId: string): string[] {
  return [...(records.get(patientId)?.completedRecoveryLessons ?? [])];
}

export function recoveryToolFlow(
  patientId: string,
  lessonId: string,
): RecoveryToolFlowSelection | undefined {
  const sel = records.get(patientId)?.recoveryToolFlows[lessonId];
  return sel ? structuredClone(sel) : undefined;
}

/** The whole row for one patient, or undefined when they have no activity. */
export function getEngagement(patientId: string): PatientEngagement | undefined {
  const r = records.get(patientId);
  return r ? structuredClone(r) : undefined;
}

/**
 * Population-health read: every engagement row, optionally narrowed to a
 * caller-supplied cohort of patient ids. Callers join these against clinical
 * data on `patientId` themselves — this module knows nothing about `Patient`.
 */
export function engagementRecords(patientIds?: string[]): PatientEngagement[] {
  const all = [...records.values()].map((r) => structuredClone(r));
  if (!patientIds) return all;
  const want = new Set(patientIds);
  return all.filter((r) => want.has(r.patientId));
}

/** Counts only — the shape reporting and the advocate DTO both build on. */
export function engagementSummary(patientId: string): {
  patientId: string;
  lessonsCompleted: number;
  recoveryLessonsCompleted: number;
  exercisesCompleted: number;
  toolkitSaved: number;
  lastActivityAt?: string;
} {
  const r = records.get(patientId);
  return {
    patientId,
    lessonsCompleted: r?.completedLibraryItems.length ?? 0,
    recoveryLessonsCompleted: r?.completedRecoveryLessons.length ?? 0,
    exercisesCompleted: r?.completedExercises.length ?? 0,
    toolkitSaved: r?.savedToolkitItems.length ?? 0,
    ...(r?.lastActivityAt ? { lastActivityAt: r.lastActivityAt } : {}),
  };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/** One saved entry per source id. Re-saving refreshes the label, not the count. */
export function saveToolkitItem(
  patientId: string,
  input: { id: string; label: string; from: ToolkitOrigin },
): SavedToolkitItem {
  const r = row(patientId);
  const existing = r.savedToolkitItems.find((t) => t.id === input.id);
  if (existing) {
    existing.label = input.label;
    touch(r);
    notify();
    return { ...existing };
  }
  const entry: SavedToolkitItem = { ...input, createdAt: new Date().toISOString() };
  r.savedToolkitItems.push(entry);
  touch(r);
  notify();
  return { ...entry };
}

export function removeToolkitItem(patientId: string, id: string): void {
  const r = records.get(patientId);
  if (!r) return;
  r.savedToolkitItems = r.savedToolkitItems.filter((t) => t.id !== id);
  notify();
}

/**
 * Mark a lesson complete. Idempotent. When the lesson carries a toolkit
 * takeaway it is saved in the same act — step 8 of the instructional sequence
 * IS the completion, not a second opt-in.
 */
export function completeLibraryItem(
  patientId: string,
  itemId: string,
  opts: { saveToolkit?: boolean; actorRole?: string } = {},
): { completed: boolean; alreadyComplete: boolean } {
  const item = getLibraryItem(itemId);
  if (!item) return { completed: false, alreadyComplete: false };
  const r = row(patientId);
  const already = r.completedLibraryItems.includes(itemId);
  if (!already) r.completedLibraryItems.push(itemId);
  if (opts.saveToolkit !== false) {
    saveToolkitItem(patientId, { id: itemId, label: item.toolkitLabel, from: "library" });
  }
  if (!already) {
    touch(r);
    auditSink?.({
      patientId,
      action: "library_item_completed",
      actorRole: opts.actorRole ?? "patient",
      detail: {
        itemId,
        categoryId: item.categoryId,
        title: item.title,
        minutes: item.minutes,
      },
    });
  }
  notify();
  return { completed: true, alreadyComplete: already };
}

/** Mark an exercise complete. Idempotent; same shape as lessons. */
export function completeExercise(
  patientId: string,
  exerciseId: string,
  opts: { saveToolkit?: boolean; actorRole?: string } = {},
): { completed: boolean; alreadyComplete: boolean } {
  const ex = getExercise(exerciseId);
  if (!ex) return { completed: false, alreadyComplete: false };
  const r = row(patientId);
  const already = r.completedExercises.includes(exerciseId);
  if (!already) r.completedExercises.push(exerciseId);
  if (opts.saveToolkit) {
    saveToolkitItem(patientId, { id: exerciseId, label: ex.title, from: "exercise" });
  }
  if (!already) {
    touch(r);
    auditSink?.({
      patientId,
      action: "library_exercise_completed",
      actorRole: opts.actorRole ?? "patient",
      detail: { exerciseId, title: ex.title, type: ex.type, minutes: ex.minutes },
    });
  }
  notify();
  return { completed: true, alreadyComplete: already };
}

/**
 * §Phase 5b — complete a recovery lesson, storing its tool-flow selections.
 * Idempotent like the Library equivalent; selections are re-saved on a revisit
 * so the most recent answers are the ones kept. Limits are enforced here too,
 * not only in the UI.
 */
export function completeRecoveryLesson(
  patientId: string,
  lessonId: string,
  selection: { warningSigns?: string[]; supportPeople?: string[]; todayAction?: string },
  opts: { saveToolkit?: boolean; actorRole?: string } = {},
): { completed: boolean; alreadyComplete: boolean } {
  const lesson = getRecoveryLesson(lessonId);
  if (!lesson) return { completed: false, alreadyComplete: false };
  const r = row(patientId);
  const already = r.completedRecoveryLessons.includes(lessonId);
  if (!already) r.completedRecoveryLessons.push(lessonId);
  const warningSigns = (selection.warningSigns ?? [])
    .filter((s) => lesson.toolFlow.warningSigns.includes(s))
    .slice(0, TOOL_FLOW_LIMITS.warningSigns);
  const supportPeople = (selection.supportPeople ?? [])
    .filter((s) => lesson.toolFlow.supportPeople.includes(s))
    .slice(0, TOOL_FLOW_LIMITS.supportPeople);
  r.recoveryToolFlows[lessonId] = {
    warningSigns,
    supportPeople,
    ...(selection.todayAction && lesson.toolFlow.todayActions.includes(selection.todayAction)
      ? { todayAction: selection.todayAction }
      : {}),
    updatedAt: new Date().toISOString(),
  };
  if (opts.saveToolkit !== false) {
    saveToolkitItem(patientId, { id: lessonId, label: lesson.toolkitLabel, from: "library" });
  }
  if (!already) {
    touch(r);
    auditSink?.({
      patientId,
      action: "recovery_lesson_completed",
      actorRole: opts.actorRole ?? "patient",
      detail: {
        lessonId,
        moduleId: lesson.moduleId,
        title: lesson.title,
        minutes: lesson.minutes,
        warningSignCount: warningSigns.length,
        supportPersonCount: supportPeople.length,
        hasTodayAction: Boolean(r.recoveryToolFlows[lessonId]?.todayAction),
      },
    });
  }
  notify();
  return { completed: true, alreadyComplete: already };
}

/** Test/demo helper — drops all engagement rows. */
export function __resetEngagement(): void {
  records.clear();
  notify();
}
