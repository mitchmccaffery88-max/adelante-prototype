// §C1 — ASAM → care plan SUGGESTIONS. Adel drafts, the clinician decides.
// When an ASAM is FINAL (signed by an LPHA, or co-signed), each dimension
// whose clinician-assigned rating meets ASAM_PLAN_CONFIG.needRating gets one
// rule-based suggestion: problem statement, one measurable goal, 1–2
// interventions and a review date. Nothing is ever active until a clinician
// accepts it (optionally editing) through the registry + runAction.
// Part 2: every suggestion and every accepted goal is SUD-classified and
// hidden from roles failing roleSeesAsamSection (structuredCarePlan masking).
// Templates, thresholds and patient wording: Draft — pending clinical sign-off.
// No licensed ASAM text is used — only the public dimension names.
import { AdelanteEHR, type Patient } from "./ehr";
import { ASAM_DIMENSIONS, type AsamAssessment } from "./asam";
import type { StaffRole } from "./roles";
import { roleSeesAsamSection } from "./asamReporting";
import { assignToGoal, canEditPlan, getStructuredPlan, inReentryWindow, type StructuredGoal } from "./structuredCarePlan";

export const ASAM_PLAN_ADEL_LABEL = "Draft by Adel — verify";
export const ASAM_PLAN_DRAFT_LABEL = "Draft — pending clinical sign-off";
export const ASAM_REVIEW_FLAG_LABEL = "Review — ASAM changed";

/** One config. Draft — pending clinical sign-off. */
export const ASAM_PLAN_CONFIG = {
  /** A dimension rating at or above this indicates need → one suggestion. */
  needRating: 2,
  /** Review date = signature date + this many days. */
  reviewDays: 30,
} as const;

export interface AsamIntervention {
  text: string;
  /** Recovery-module activity id (PLAN_ACTIVITIES) — becomes an assignment on accept. */
  moduleId?: string;
}
interface Template {
  problem: string;
  goal: string;
  measure: string;
  interventions: AsamIntervention[];
  /** Plain language, low reading level, no codes or jargon. */
  patient: { en: string; es: string };
  steps: { en: string[]; es: string[] };
}

/** Rule-based templates per public dimension. Draft — pending clinical sign-off. */
export const ASAM_PLAN_TEMPLATES: Record<string, Template> = {
  d1: {
    problem: "Risk of withdrawal symptoms needing monitoring.",
    goal: "Complete withdrawal safely with no unplanned emergency visits over the next 30 days.",
    measure: "Withdrawal check at each visit; ED visits = 0",
    interventions: [{ text: "Medical check-in for withdrawal symptoms at each visit" }, { text: "Review medication support options with the prescriber" }],
    patient: { en: "Stay safe while my body heals.", es: "Mantenerme seguro mientras mi cuerpo sana." },
    steps: { en: ["Tell my care team how I feel.", "Call if I feel very sick."], es: ["Decirle a mi equipo cómo me siento.", "Llamar si me siento muy mal."] },
  },
  d2: {
    problem: "Physical health conditions affect recovery.",
    goal: "Attend a primary-care or medical follow-up within 30 days.",
    measure: "Medical visit kept (yes/no)",
    interventions: [{ text: "Coordinate a primary-care appointment" }, { text: "Review current medical conditions and medications" }],
    patient: { en: "Take care of my body.", es: "Cuidar mi cuerpo." },
    steps: { en: ["Go to my doctor visit.", "Bring my medicine list."], es: ["Ir a mi cita con el doctor.", "Llevar mi lista de medicinas."] },
  },
  d3: {
    problem: "Emotional or mental health symptoms affect recovery.",
    goal: "Lower PHQ-9 or GAD-7 score by 5 points by the review date.",
    measure: "PHQ-9 / GAD-7 change from baseline",
    interventions: [{ text: "Weekly individual counseling" }, { text: "Recovery lesson on handling hard moments", moduleId: "when-recovery-gets-hard" }],
    patient: { en: "Feel calmer and better each week.", es: "Sentirme más tranquilo y mejor cada semana." },
    steps: { en: ["Go to my counseling visits.", "Do my lesson on hard moments."], es: ["Ir a mis citas de consejería.", "Hacer mi lección sobre momentos difíciles."] },
  },
  d4: {
    problem: "Mixed readiness to make changes.",
    goal: "Name two personal reasons for change and attend 3 of 4 planned sessions in 30 days.",
    measure: "Sessions attended / planned",
    interventions: [{ text: "Motivational interviewing in sessions" }, { text: "Recovery lesson on understanding use", moduleId: "understanding-my-addiction" }],
    patient: { en: "Think about why change matters to me.", es: "Pensar por qué el cambio es importante para mí." },
    steps: { en: ["Write down two reasons.", "Go to my visits."], es: ["Escribir dos razones.", "Ir a mis citas."] },
  },
  d5: {
    problem: "Risk of continued use or return to use.",
    goal: "Use a written relapse-prevention plan and report use honestly at every visit for 30 days.",
    measure: "Plan completed; self-report at each visit",
    interventions: [{ text: "Build a relapse-prevention plan together" }, { text: "Recovery lesson on handling hard moments", moduleId: "when-recovery-gets-hard" }],
    patient: { en: "Have a plan for hard days.", es: "Tener un plan para los días difíciles." },
    steps: { en: ["Make my plan with my team.", "Use my plan when I have cravings."], es: ["Hacer mi plan con mi equipo.", "Usar mi plan cuando tenga antojos."] },
  },
  d6: {
    problem: "Living environment does not yet support recovery.",
    goal: "Take one step on each open social need (housing, food, transport) within 30 days.",
    measure: "Open social needs moved one step on the ladder",
    interventions: [{ text: "Work open social needs with the care manager" }, { text: "Recovery lesson on building support", moduleId: "finding-my-people" }],
    patient: { en: "Have a safe place and people who help.", es: "Tener un lugar seguro y personas que me ayuden." },
    steps: { en: ["Work on my needs with my care manager.", "Do my lesson on finding support."], es: ["Trabajar en mis necesidades con mi coordinador.", "Hacer mi lección sobre encontrar apoyo."] },
  },
};

export type AsamSuggestionStatus = "suggested" | "accepted" | "dismissed" | "superseded";
export interface AsamPlanSuggestion {
  id: string;
  patientId: string;
  asamId: string;
  asamVersion: number;
  dimensionKey: string;
  dimensionName: string;
  rating: number;
  problem: string;
  goal: string;
  measure: string;
  interventions: AsamIntervention[];
  reviewDate: string;
  /** D6: open SDOH needs cross-linked; reentry when in the reentry window. */
  needIds: string[];
  reentry: boolean;
  status: AsamSuggestionStatus;
  edited: boolean;
  goalId?: string;
  decidedBy?: string;
  decidedAt?: string;
  reason?: string;
  createdAt: string;
}
export type AsamSuggestionEdits = Partial<Pick<AsamPlanSuggestion, "problem" | "goal" | "measure" | "reviewDate">> & { interventions?: string[] };

const store = new Map<string, AsamPlanSuggestion[]>();
const uid = () => Math.random().toString(36).slice(2, 10);
type Actor = { name: string; role: StaffRole | string; staffId?: string };

/** Newest FINAL ASAM: status "signed" (LPHA sign, or co-signed). cosign_pending never counts. */
export function latestFinalAsam(p: Patient): AsamAssessment | undefined {
  return [...(p.asamAssessments ?? [])].filter((a) => a.status === "signed").sort((a, b) => b.version - a.version)[0];
}
const openNeedIds = (p: Patient) => (p.sdohPlan?.items ?? []).filter((i) => i.status !== "completed").map((i) => i.id);

function quietAudit(action: string, patientId: string, detail: Record<string, unknown>) {
  AdelanteEHR._recordAuditQuiet({ category: "care_plan", action, patientId, actorId: "system", detail });
}

/**
 * Idempotent sync from the newest final ASAM: drafts missing suggestions and
 * flags accepted goals whose dimension rating changed. Safe to call on read
 * (writes quietly, never emits).
 */
export function syncAsamPlan(patientId: string): void {
  const p = AdelanteEHR.getPatient(patientId);
  if (!p) return;
  const a = latestFinalAsam(p);
  if (!a) return;
  const list = store.get(patientId) ?? [];
  const plan = getStructuredPlan(patientId);
  const asamGoals = plan.goals.filter((g) => g.source?.kind === "asam" && g.status === "active");
  const added: string[] = [];
  for (const dim of a.dimensions) {
    const goal = asamGoals.find((g) => g.source!.dimensionKey === dim.key);
    // Re-signed version: flag the accepted goal when its dimension rating changed.
    if (goal && goal.source!.asamVersion < a.version && goal.source!.rating !== dim.rating && goal.reviewFlag?.asamVersion !== a.version) {
      goal.reviewFlag = { label: ASAM_REVIEW_FLAG_LABEL, asamVersion: a.version, fromRating: goal.source!.rating, toRating: dim.rating, at: new Date().toISOString() };
      quietAudit("plan_goal_review_flagged", patientId, { goalId: goal.id, sourceVersion: a.version });
    }
    if (dim.rating < ASAM_PLAN_CONFIG.needRating || goal) continue;
    if (list.some((s) => s.asamId === a.id && s.dimensionKey === dim.key)) continue;
    const t = ASAM_PLAN_TEMPLATES[dim.key];
    if (!t) continue;
    // A newer version replaces still-open suggestions for the same dimension.
    for (const old of list) if (old.dimensionKey === dim.key && old.status === "suggested") old.status = "superseded";
    const signed = new Date(a.cosignedAt ?? a.signedAt ?? Date.now());
    const reentry = inReentryWindow(p) && (dim.key === "d5" || dim.key === "d6");
    const interventions = [...t.interventions];
    if (reentry && interventions.length < 2) interventions.push({ text: "Re-entry Journey", moduleId: "reentry-journey" });
    list.push({
      id: uid(),
      patientId,
      asamId: a.id,
      asamVersion: a.version,
      dimensionKey: dim.key,
      dimensionName: ASAM_DIMENSIONS.find((d) => d.key === dim.key)?.name ?? dim.key,
      rating: dim.rating,
      problem: t.problem,
      goal: t.goal,
      measure: t.measure,
      interventions: interventions.slice(0, 2),
      reviewDate: new Date(+signed + ASAM_PLAN_CONFIG.reviewDays * 86400000).toISOString().slice(0, 10),
      needIds: dim.key === "d6" ? openNeedIds(p) : [],
      reentry,
      status: "suggested",
      edited: false,
      createdAt: new Date().toISOString(),
    });
    added.push(dim.key);
  }
  store.set(patientId, list);
  if (added.length) quietAudit("plan_rule_suggestions_drafted", patientId, { sourceId: a.id, sourceVersion: a.version, count: added.length });
}

/** Role-filtered list. Roles failing the Part 2 check get nothing — hidden, not stubbed. */
export function listAsamSuggestions(patientId: string, role: StaffRole, opts: { all?: boolean } = {}): AsamPlanSuggestion[] {
  const p = AdelanteEHR.getPatient(patientId);
  if (!p || !roleSeesAsamSection(role, p)) return [];
  syncAsamPlan(patientId);
  const list = store.get(patientId) ?? [];
  return opts.all ? list : list.filter((s) => s.status === "suggested");
}

function guard(actor: Actor, patientId: string): Patient {
  const p = AdelanteEHR.getPatient(patientId);
  if (!p) throw new Error("Patient not found.");
  if (!canEditPlan(actor.role)) throw new Error("Your role can't change the care plan.");
  if (!roleSeesAsamSection(actor.role as StaffRole, p)) throw new Error("Your role can't change this item.");
  return p;
}
function open(patientId: string, id: string): AsamPlanSuggestion {
  syncAsamPlan(patientId);
  const s = (store.get(patientId) ?? []).find((x) => x.id === id);
  if (!s || s.status !== "suggested") throw new Error("That suggestion is no longer open.");
  return s;
}
function applyEdits(s: AsamPlanSuggestion, e: AsamSuggestionEdits): string[] {
  const changed: string[] = [];
  for (const k of ["problem", "goal", "measure", "reviewDate"] as const) {
    const v = e[k]?.trim();
    if (v && v !== s[k]) { s[k] = v.slice(0, 300); changed.push(k); }
  }
  if (e.interventions) {
    const next = e.interventions.map((x) => x.trim()).filter(Boolean).slice(0, 2);
    if (!next.length) throw new Error("Keep at least one intervention.");
    if (next.join("|") !== s.interventions.map((i) => i.text).join("|")) {
      s.interventions = next.map((text) => ({ text, moduleId: s.interventions.find((i) => i.text === text)?.moduleId }));
      changed.push("interventions");
    }
  }
  if (s.goal.length < 3) throw new Error("Write the goal.");
  if (changed.length) s.edited = true;
  return changed;
}
const audit = (action: string, patientId: string, actor: Actor, detail: Record<string, unknown>) =>
  AdelanteEHR._recordAudit({ category: "care_plan", action, patientId, actorId: actor.staffId ?? actor.name, actorRole: actor.role, detail });

/** Registry `asam_plan_suggestion` → editAsamSuggestion. Stays "Suggested". */
export function editAsamSuggestion(patientId: string, id: string, edits: AsamSuggestionEdits, actor: Actor): AsamPlanSuggestion {
  guard(actor, patientId);
  const s = open(patientId, id);
  const fields = applyEdits(s, edits);
  audit("plan_rule_suggestion_edited", patientId, actor, { suggestionId: id, fields });
  return s;
}

/** Registry `asam_plan_suggestion` → acceptAsamSuggestion. Creates ONE SUD-classified goal with provenance. */
export function acceptAsamSuggestion(patientId: string, id: string, actor: Actor, edits: AsamSuggestionEdits = {}): StructuredGoal {
  const p = guard(actor, patientId);
  const s = open(patientId, id);
  const fields = applyEdits(s, edits);
  const t = ASAM_PLAN_TEMPLATES[s.dimensionKey];
  const plan = getStructuredPlan(patientId);
  const sudProblems = (p.problems ?? []).filter((x) => x.status === "active" && x.category === "sud").map((x) => `pl-${x.id}`);
  const g: StructuredGoal = {
    id: uid(),
    patientId,
    problemIds: sudProblems,
    needIds: [...s.needIds],
    owner: "clinician",
    targetDate: s.reviewDate,
    measure: s.measure,
    clinicalText: s.goal,
    patientText: { en: t?.patient.en ?? s.goal, es: t?.patient.es ?? s.goal },
    status: "active",
    sud: true,
    createdAt: new Date().toISOString(),
    createdBy: actor.name,
    source: { kind: "asam", suggestionId: s.id, asamId: s.asamId, asamVersion: s.asamVersion, dimensionKey: s.dimensionKey, dimensionName: s.dimensionName, rating: s.rating },
    problemStatement: s.problem,
    interventions: s.interventions.map((i) => i.text),
    steps: t ? { en: [...t.steps.en], es: [...t.steps.es] } : undefined,
  };
  plan.goals.push(g);
  if (plan.review.signedAt) plan.review.changedSinceSigned = true;
  s.status = "accepted";
  s.goalId = g.id;
  s.decidedBy = actor.name;
  s.decidedAt = new Date().toISOString();
  for (const i of s.interventions)
    if (i.moduleId) assignToGoal({ patientId, goalId: g.id, kind: "activity", activityId: i.moduleId, frequency: "weekly", reason: "rule", suggestionId: s.id, actor });
  audit("plan_rule_suggestion_accepted", patientId, actor, { suggestionId: id, goalId: g.id, edited: fields.length > 0, fields, linkedNeeds: s.needIds.length });
  return g;
}

/** Registry `asam_plan_suggestion` → dismissAsamSuggestion. Reason required. */
export function dismissAsamSuggestion(patientId: string, id: string, reason: string, actor: Actor): AsamPlanSuggestion {
  guard(actor, patientId);
  if (reason.trim().length < 3) throw new Error("Give a reason for dismissing.");
  const s = open(patientId, id);
  s.status = "dismissed";
  s.reason = reason.trim().slice(0, 300);
  s.decidedBy = actor.name;
  s.decidedAt = new Date().toISOString();
  audit("plan_rule_suggestion_dismissed", patientId, actor, { suggestionId: id, reason: s.reason });
  return s;
}

/** Registry `asam_plan_suggestion` → markAsamGoalReviewed. Clears "Review — ASAM changed". */
export function markAsamGoalReviewed(patientId: string, goalId: string, actor: Actor): StructuredGoal {
  const p = guard(actor, patientId);
  const g = getStructuredPlan(patientId).goals.find((x) => x.id === goalId);
  if (!g?.reviewFlag || !g.source) throw new Error("Nothing to review on this goal.");
  const a = latestFinalAsam(p);
  const dim = a?.dimensions.find((d) => d.key === g.source!.dimensionKey);
  if (a && dim) g.source = { ...g.source, asamId: a.id, asamVersion: a.version, rating: dim.rating };
  g.reviewFlag = undefined;
  audit("plan_goal_review_cleared", patientId, actor, { goalId });
  return g;
}

/** Provenance chip text, e.g. "ASAM v2 · Dimension 6 (rating 3)". Staff-only, Part 2. */
export function asamProvenanceLabel(g: StructuredGoal): string | undefined {
  if (g.source?.kind !== "asam") return undefined;
  return `ASAM v${g.source.asamVersion} · Dimension ${g.source.dimensionKey.slice(1)} (rating ${g.source.rating})`;
}

export function _resetAsamPlan() {
  store.clear();
}
