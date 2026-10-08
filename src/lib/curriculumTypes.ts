import { EXERCISES } from "./library";
import { RECOVERY_MODULES, RECOVERY_LESSONS } from "./recovery";
import { AUTHORED_FIRST_DAYS_OUT_LESSONS } from "./recovery.firstDaysOut.authored";
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
    if (!c || !exerciseKinds.includes(String(c.type))) return [...errors, "Choose what kind of exercise this is."];
    if (c.type === "breathing" && (![c.inhaleSec, c.exhaleSec, c.cycles].every((n) => typeof n === "number" && n > 0) || Number(c.cycles) > 12 || Number(c.holdSec) < 0 || Number(c.holdAfterSec) < 0)) errors.push("Breathing needs seconds above zero for breathing in and out, and between 1 and 12 cycles.");
    if (c.type === "timer" && !(Number(c.seconds) > 0)) errors.push("Set how many minutes the timer runs.");
    for (const [kind, plain] of [["checklist", "Add at least one checklist item."], ["worksheet", "Add at least one question."], ["mapper", "Add at least one column."], ["calculator", "Add at least one expense row."], ["scale", "Add at least one level."]] as const) { const k = { checklist: "items", worksheet: "fields", mapper: "columns", calculator: "rows", scale: "bands" }[kind]; if (c.type === kind && (!Array.isArray(c[k]) || !(c[k] as unknown[]).length)) errors.push(plain); }
    if (c.type === "scale" && !(Number(c.max) > Number(c.min))) errors.push("The highest number must be bigger than the lowest number.");
    return errors;
  },
};
export const JOURNEY_CONTENT_TYPE: ContentTypeDescriptor = {
  typeId: "journey", label: "Journey", labelPlural: "Journeys", publishEffect: "Published ordered curriculum can be assigned to a patient.",
  fields: [...common, { key: "description", label: "Description", kind: "textarea", required: true }, { key: "es.description", label: "Spanish description (Draft)", kind: "textarea" }, { key: "unlock", label: "Unlock rule", kind: "select", options: [{ value: "open", label: "Open" }, { value: "sequential", label: "Sequential" }] }, { key: "justiceInvolved", label: "Justice-involved only", kind: "toggle" }, { key: "positiveSignal", label: "Positive-signal gate", kind: "text" }, { key: "meta.sdoh", label: "What this addresses — needs (Draft tags)", kind: "list" }, { key: "meta.stages", label: "What this addresses — reentry stages (Draft tags)", kind: "list" }, { key: "meta.flags", label: "What this addresses — care-plan flags: justice_involved, sud (Draft; adds the Journey automatically)", kind: "list" }, { key: "reentryStage", label: "Reentry stage", kind: "select", options: ["pre_release", "first_30", "days_30_90", "after_90"].map((value) => ({ value, label: value })) }, { key: "steps", label: "Ordered steps", kind: "curriculum" }],
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
/** §F6 "My First Days Out" = the module's lessons in order, each a step. */
export function firstDaysSteps(): CurriculumStep[] {
  return [...RECOVERY_LESSONS, ...AUTHORED_FIRST_DAYS_OUT_LESSONS].filter((l) => l.moduleId === "first-days-out").sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((l) => ({ type: "recovery_lesson" as const, id: l.id, required: true }));
}
/** §F6 The Re-entry Journey drives /recovery-journey module order. */
export const REENTRY_JOURNEY_ID = "reentry-curriculum";
export function initializePracticeContent() {
  const actor = { name: "Shipped content migration", role: "sys_admin" as const };
  for (const exercise of EXERCISES) if (!getContentEntry("exercise", exercise.id)) seedPublishedContent({ typeId: "exercise", id: exercise.id, body: { ...structuredClone(exercise), meta: { part2: exercise.part2Sensitive === true, clinical: true, esStatus: "missing", backfilled: true } } as unknown as ContentBody, actor, atISO: "2026-10-08T00:00:00.000Z", note: "Draft — migrated shipped practice, pending clinical and Spanish review" });
  const journeys: Curriculum[] = [
    { id: "reentry-curriculum", title: "Re-entry Journey", description: "Nine short modules, one step at a time. You start with your first days out and work toward a life that feels steady. Go at your own pace. Each step saves your place.", unlock: "open", part2Sensitive: true, steps: RECOVERY_MODULES.map((m) => ({ type: "recovery_module", id: m.id, required: true })), es: { title: "Camino de reintegración", description: "Borrador — Nueve módulos cortos, un paso a la vez. Empieza con tus primeros días afuera y avanza hacia una vida más estable. Ve a tu ritmo. Cada paso guarda tu lugar." } },
    { id: "first-days-curriculum", title: "My First Days Out", description: "Ten short lessons for your first days back. Find a safe place to sleep, get your papers, handle urges and make a plan for each day. Do them in order. Each one opens the next.", unlock: "sequential", reentryStage: "first_30", part2Sensitive: true, steps: firstDaysSteps(), es: { title: "Mis primeros días afuera", description: "Borrador — Diez lecciones cortas para tus primeros días de regreso. Encuentra un lugar seguro, consigue tus papeles, maneja los antojos y haz un plan para cada día. Hazlas en orden. Cada una abre la siguiente." } },
  ];
  // §Group 1 C2 Draft flag tags: "My First Days Out" ↔ justice-involved; the nine-module Re-entry Journey (recovery modules) ↔ SUD recovery.
  const FLAG_TAGS: Record<string, ("justice_involved" | "sud")[]> = { "first-days-curriculum": ["justice_involved"], "reentry-curriculum": ["sud"] };
  for (const journey of journeys) if (!getContentEntry("journey", journey.id)) seedPublishedContent({ typeId: "journey", id: journey.id, body: { ...journey, meta: { part2: true, clinical: true, esStatus: "draft", backfilled: true, flags: FLAG_TAGS[journey.id] ?? [] } } as unknown as ContentBody, actor, atISO: "2026-10-08T00:00:00.000Z", note: "Draft — curriculum migration, pending clinical sign-off" });
}
export function liveCurricula(): Curriculum[] { initializePracticeContent(); return publishedContentOfType("journey") as unknown as Curriculum[]; }
