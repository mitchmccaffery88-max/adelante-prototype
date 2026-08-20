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
import {
  getExercise,
  getLibraryItem,
  type LibraryItem,
  type SavedToolkitItem,
  type ToolkitOrigin,
} from "./library";
import type { RecoveryLesson } from "./recovery";

/**
 * §Content Management — LESSON RESOLUTION, INJECTED.
 *
 * A lesson published through the admin content tool exists in the content
 * store, not in the baseline arrays, so completing one must still find its
 * toolkit label and tool-flow option sets. This store cannot import
 * `contentCatalog` directly — `ehr.ts` imports this module, and the catalog
 * reaches `roles.ts` which reaches `ehr.ts`. Same solution the audit sink
 * already uses: the catalog registers itself, and until it does the shipped
 * baseline is the answer.
 */
export interface ContentResolver {
  libraryItem: (id: string) => LibraryItem | undefined;
  recoveryLesson: (id: string) => RecoveryLesson | undefined;
}

let contentResolver: ContentResolver | undefined;

export function setContentResolver(r: ContentResolver | undefined): void {
  contentResolver = r;
}

function resolveLibraryItem(id: string): LibraryItem | undefined {
  return contentResolver?.libraryItem(id) ?? getLibraryItem(id);
}

function resolveRecoveryLesson(id: string): RecoveryLesson | undefined {
  return contentResolver?.recoveryLesson(id) ?? getRecoveryLesson(id);
}

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
  /**
   * §Lesson-player Build 2 — what the patient actually typed/selected inside a
   * lesson, keyed `"<surface>:<lessonId>"`. Same store, same rule: engagement
   * data, never a field on `Patient`. Free text here is PATIENT-AUTHORED and
   * is redacted out of the cohort read (`engagementRecords`) for the same
   * reason the advocate DTO has never carried reflections.
   */
  lessonResponses: Record<string, LessonResponse>;
  /** Saved takeaways, one per source lesson/exercise. */
  savedToolkitItems: SavedToolkitItem[];
  firstActivityAt?: string;
  lastActivityAt?: string;
}

/** Which lesson system a response belongs to — ids live in separate namespaces. */
export type LessonSurface = "library" | "recovery";

export function lessonResponseKey(surface: LessonSurface, lessonId: string): string {
  return `${surface}:${lessonId}`;
}

/**
 * One lesson's in-progress work. Everything is optional because a patient can
 * leave at any step; `stepIndex` is what makes resume-on-return real.
 *
 * `text` is free text (reflect answer, `write` activity, `grounding` senses)
 * keyed by a caller-chosen field key. The rest mirror the activity controls
 * one-for-one so nothing a patient touches is thrown away on unmount.
 */
export interface LessonResponse {
  /** Last step the patient was on (0-based). */
  stepIndex?: number;
  /**
   * §Lesson-player Phase A — position WITHIN the current step, for steps that
   * paginate internally (Part A/B, one scenario at a time). One value per
   * lesson, not per step: it is a resume cursor for wherever the patient last
   * was, and it is reset by the step-level navigation, not persisted per step.
   */
  subIndex?: number;
  /** Free text, keyed by field (`reflect`, `activity`, `grounding:<sense>`). */
  text?: Record<string, string>;

  /** Checklist / tap-to-select cards / check-in options. */
  checked?: string[];
  /** `rate` activity. */
  rating?: number;
  /** `sort` activity — card → bucket. */
  sorted?: Record<string, string>;
  /** `sliders` activity — slider id → score. */
  scores?: Record<string, number>;
  /** `decision` activity — the chosen label. */
  choice?: string;
  updatedAt: string;
}

/** A patch is any subset; `text` merges key-by-key rather than replacing. */
export type LessonResponsePatch = Partial<Omit<LessonResponse, "updatedAt">>;

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
  action:
    | "library_item_completed"
    | "library_exercise_completed"
    | "recovery_lesson_completed"
    | "lesson_response_started";
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
      lessonResponses: {},
      savedToolkitItems: [],
    };
    records.set(patientId, r);
  }
  // Rows created before this field existed (or restored from a fixture) still
  // have to answer reads without a guard at every call site.
  r.lessonResponses ??= {};
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

/**
 * §Lesson-player Build 2 — the patient's own saved work for one lesson.
 * Undefined until they touch something. Cloned, so callers cannot mutate the
 * store by editing what they read.
 */
export function lessonResponse(
  patientId: string,
  surface: LessonSurface,
  lessonId: string,
): LessonResponse | undefined {
  const r = records.get(patientId)?.lessonResponses?.[lessonResponseKey(surface, lessonId)];
  return r ? structuredClone(r) : undefined;
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
  // Cohort read. Lesson responses are stripped here on purpose: population
  // health counts activity, it never needs what a patient wrote. The only
  // read that returns free text is `lessonResponse` (the patient's own
  // player) and `getEngagement` (single-row, patient-scoped).
  const all = [...records.values()].map((r) => ({
    ...structuredClone(r),
    lessonResponses: {},
  }));
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
 * §Lesson-player Build 2 — save in-progress lesson work.
 *
 * Merge semantics, not replace: the player writes one control at a time
 * (a keystroke-debounced textarea, a slider, the current step), so a patch
 * must never clear the fields it does not mention. `text` merges per key for
 * the same reason.
 *
 * Audit discipline matches completion: this is written constantly, so it is
 * audited ONCE per lesson — the first time a patient records anything — and
 * the event carries no patient text, only which lesson it was.
 */
export function saveLessonResponse(
  patientId: string,
  surface: LessonSurface,
  lessonId: string,
  patch: LessonResponsePatch,
  opts: { actorRole?: string } = {},
): LessonResponse {
  const r = row(patientId);
  const key = lessonResponseKey(surface, lessonId);
  const prev = r.lessonResponses[key];
  const next: LessonResponse = {
    ...(prev ?? {}),
    ...patch,
    ...(patch.text ? { text: { ...(prev?.text ?? {}), ...patch.text } } : {}),
    updatedAt: new Date().toISOString(),
  };
  r.lessonResponses[key] = next;
  touch(r);
  if (!prev) {
    auditSink?.({
      patientId,
      action: "lesson_response_started",
      actorRole: opts.actorRole ?? "patient",
      detail: { surface, lessonId },
    });
  }
  notify();
  return structuredClone(next);
}

/** Drop one lesson's saved work (patient-initiated clear). */
export function clearLessonResponse(
  patientId: string,
  surface: LessonSurface,
  lessonId: string,
): void {
  const r = records.get(patientId);
  if (!r?.lessonResponses) return;
  delete r.lessonResponses[lessonResponseKey(surface, lessonId)];
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
  const item = resolveLibraryItem(itemId);
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
  const lesson = resolveRecoveryLesson(lessonId);
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
