import { EXERCISES } from "./library";
import { RECOVERY_MODULES } from "./recovery";
import { getContentEntry, seedPublishedContent, publishedContentOfType, type ContentBody } from "./contentPublishing";
import type { ContentField, ContentTypeDescriptor } from "./contentTypes";
export interface CurriculumStep { type: "library_lesson" | "recovery_lesson" | "recovery_module" | "exercise"; id: string; required: boolean }
export interface Curriculum { id: string; title: string; description: string; unlock: "open" | "sequential"; steps: CurriculumStep[]; populations?: string[]; positiveSignal?: string; justiceInvolved?: boolean; reentryStage?: string; part2Sensitive?: boolean; es?: { title: string; description: string }; meta?: ContentBody }
const common: ContentField[] = [
  { key: "title", label: "Title", kind: "text", required: true },
  { key: "es.title", label: "Spanish title (Draft)", kind: "text" },
  { key: "populations", label: "Population gates", kind: "list" },
  { key: "part2Sensitive", label: "Part 2 sensitive", kind: "toggle" },
];
const exerciseKinds = ["timer", "breathing", "checklist", "worksheet", "mapper", "calculator", "scale"];
export const EXERCISE_CONTENT_TYPE: ContentTypeDescriptor = {
  typeId: "exercise", label: "Exercise", labelPlural: "Exercises", publishEffect: "Published practice appears in the patient library and assignment picker.",
  fields: [...common, { key: "purpose", label: "Purpose", kind: "textarea", required: true }, { key: "es.purpose", label: "Spanish purpose (Draft)", kind: "textarea" }, { key: "minutes", label: "Minutes", kind: "number" }, { key: "tags", label: "Practice tags", kind: "list" }, { key: "content", label: "Structured exercise", kind: "exercise" }, { key: "es.content", label: "Spanish exercise (Draft)", kind: "exercise" }],
  baselineIds: () => EXERCISES.map((e) => e.id), baselineBody: (id) => { const e = EXERCISES.find((e) => e.id === id); return e ? structuredClone(e) as unknown as ContentBody : undefined; },
  emptyBody: () => ({ title: "", subtitle: "", minutes: 3, purpose: "", tags: [], type: "breathing", content: { type: "breathing", inhaleSec: 4, holdSec: 4, exhaleSec: 4, holdAfterSec: 0, cycles: 3 } }),
  titleOf: (b) => String(b.title || "Untitled exercise"),
  validate: (b) => {
    const c = b.content as Record<string, unknown> | undefined;
    const errors = !b.title || !b.purpose ? ["Title and purpose are required."] : [];
    if (!c || !exerciseKinds.includes(String(c.type))) return [...errors, "Choose a supported exercise kind."];
    if (c.type === "breathing" && (![c.inhaleSec, c.exhaleSec, c.cycles].every((n) => typeof n === "number" && n > 0) || Number(c.cycles) > 12 || Number(c.holdSec) < 0 || Number(c.holdAfterSec) < 0)) errors.push("Breathing needs positive phases and 1–12 cycles.");
    if (c.type === "timer" && !(Number(c.seconds) > 0)) errors.push("Timer duration must be positive.");
    for (const [kind, key] of [["checklist", "items"], ["worksheet", "fields"], ["mapper", "columns"], ["calculator", "rows"], ["scale", "bands"]]) if (c.type === kind && (!Array.isArray(c[key]) || !(c[key] as unknown[]).length)) errors.push(`Add ${key}.`);
    if (c.type === "scale" && !(Number(c.max) > Number(c.min))) errors.push("Scale maximum must exceed minimum.");
    return errors;
  },
};
export const JOURNEY_CONTENT_TYPE: ContentTypeDescriptor = {
  typeId: "journey", label: "Journey", labelPlural: "Journeys", publishEffect: "Published ordered curriculum can be assigned to a patient.",
  fields: [...common, { key: "description", label: "Description", kind: "textarea", required: true }, { key: "es.description", label: "Spanish description (Draft)", kind: "textarea" }, { key: "unlock", label: "Unlock rule", kind: "select", options: [{ value: "open", label: "Open" }, { value: "sequential", label: "Sequential" }] }, { key: "justiceInvolved", label: "Justice-involved only", kind: "toggle" }, { key: "positiveSignal", label: "Positive-signal gate", kind: "text" }, { key: "reentryStage", label: "Reentry stage", kind: "select", options: ["pre_release", "first_30", "days_30_90", "after_90"].map((value) => ({ value, label: value })) }, { key: "steps", label: "Ordered steps", kind: "curriculum" }],
  baselineIds: () => [], baselineBody: () => undefined, emptyBody: () => ({ title: "", description: "", unlock: "sequential", steps: [] }), titleOf: (b) => String(b.title || "Untitled Journey"),
  validate: (b) => {
    const steps = Array.isArray(b.steps) ? b.steps as CurriculumStep[] : [];
    const errors = !b.title || !b.description ? ["Title and description are required."] : [];
    if (!steps.length || !steps.some((s) => s.required)) errors.push("Add at least one required step.");
    if (b.unlock !== "open" && b.unlock !== "sequential") errors.push("Choose an unlock rule.");
    if (steps.some((s) => !s.id || !["library_lesson", "recovery_lesson", "recovery_module", "exercise"].includes(s.type))) errors.push("Every step must reference a lesson, module or exercise.");
    return errors;
  },
};
export function initializePracticeContent() {
  const actor = { name: "Shipped content migration", role: "sys_admin" as const };
  for (const exercise of EXERCISES) if (!getContentEntry("exercise", exercise.id)) seedPublishedContent({ typeId: "exercise", id: exercise.id, body: { ...structuredClone(exercise), meta: { part2: exercise.part2Sensitive === true, clinical: true, esStatus: "missing", backfilled: true } } as unknown as ContentBody, actor, atISO: "2026-10-08T00:00:00.000Z", note: "Draft — migrated shipped practice, pending clinical and Spanish review" });
  const journeys: Curriculum[] = [
    { id: "reentry-curriculum", title: "Re-entry Journey", description: "An ordered path through recovery and reentry.", unlock: "open", part2Sensitive: true, steps: RECOVERY_MODULES.map((m) => ({ type: "recovery_module", id: m.id, required: true })), es: { title: "Camino de reintegración", description: "Un camino de recuperación y reintegración." } },
    { id: "first-days-curriculum", title: "My First Days Out", description: "Support for the first days back in the community.", unlock: "sequential", reentryStage: "first_30", part2Sensitive: true, steps: [{ type: "recovery_module", id: "first-days-out", required: true }], es: { title: "Mis primeros días afuera", description: "Apoyo para los primeros días en la comunidad." } },
  ];
  for (const journey of journeys) if (!getContentEntry("journey", journey.id)) seedPublishedContent({ typeId: "journey", id: journey.id, body: { ...journey, meta: { part2: true, clinical: true, esStatus: "draft", backfilled: true } } as unknown as ContentBody, actor, atISO: "2026-10-08T00:00:00.000Z", note: "Draft — curriculum migration, pending clinical sign-off" });
}
export function liveCurricula(): Curriculum[] { initializePracticeContent(); return publishedContentOfType("journey") as unknown as Curriculum[]; }
