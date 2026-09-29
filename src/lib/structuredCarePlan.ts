// §Structured care plan, phase 1 — one model, two views (staff editor and
// patient "My plan"). Problems are DERIVED live from the problem list, the
// SDOH needs and the reentry window; goals, assignments, suggestion decisions
// and the review/signature live here. Every write audits through
// AdelanteEHR._recordAudit and wakes the UI. Part 2: a goal linked to a SUD
// problem (and anything assigned under it) is `sud` and hidden from roles
// failing roleSeesAsamSection. Thresholds, Z-codes and patient wording are
// "Draft — pending clinical sign-off". Spanish pending bilingual review.
import { isJusticeInvolved } from "./justiceInvolvement";
import { AdelanteEHR, type Patient, type SdohStatus } from "./ehr";
import type { StaffRole } from "./roles";
import { roleSeesAsamSection } from "./asamReporting";

export const PLAN_DRAFT_LABEL = "Draft — pending clinical sign-off";
const DAY = 86400000;
const uid = () => Math.random().toString(36).slice(2, 10);

// ---------------------------------------------------------------- types
export type PlanProblemSource = "problem_list" | "sdoh" | "reentry";
export interface PlanProblem {
  id: string;
  source: PlanProblemSource;
  code?: string;
  /** Z-codes we attached ourselves are draft until clinical sign-off. */
  codeDraft: boolean;
  label: string;
  sud: boolean;
  /** SDOH problems point back at the need row. */
  needId?: string;
}
export type GoalOwner = "patient" | "clinician" | "case_manager";
export type GoalStatus = "active" | "met" | "closed";
export interface StructuredGoal {
  id: string;
  patientId: string;
  problemIds: string[];
  needIds: string[];
  owner: GoalOwner;
  targetDate?: string;
  measure: string;
  clinicalText: string;
  patientText: { en: string; es: string };
  status: GoalStatus;
  closedReason?: string;
  sud: boolean;
  createdAt: string;
  createdBy: string;
  /** Set when migrated from the old plain-text goal list. */
  legacyGoalId?: string;
}
export type Frequency = "daily" | "weekly" | "once";
export type AssignmentKind = "activity" | "sdoh_referral" | "visit_cadence";
export interface PlanAssignment {
  id: string;
  patientId: string;
  goalId: string;
  kind: AssignmentKind;
  activityId?: string;
  needId?: string;
  label: { en: string; es: string };
  frequency: Frequency;
  startAt: string;
  dueAt?: string;
  assignedBy: string;
  reason: "rule" | "ad_hoc";
  suggestionId?: string;
  completions: string[];
  active: boolean;
  sud: boolean;
}
export interface PlanVersion {
  version: number;
  at: string;
  by: string;
  goals: number;
  assignments: number;
}
export interface PlanReview {
  cadenceDays: number;
  reviewDueAt?: string;
  signedAt?: string;
  signedBy?: string;
  version: number;
  changedSinceSigned: boolean;
  acknowledgedAt?: string;
  acknowledgedVersion?: number;
  history: PlanVersion[];
}
export interface StructuredPlan {
  patientId: string;
  goals: StructuredGoal[];
  assignments: PlanAssignment[];
  decisions: Record<string, { decision: "accepted" | "dismissed"; at: string; by: string; reason?: string }>;
  review: PlanReview;
}

// ---------------------------------------------------------------- catalog
export interface PlanActivity {
  id: string;
  label: { en: string; es: string };
  /** Where the patient opens it. */
  to: "/library" | "/recovery-journey";
  exercise?: string;
  sud: boolean;
}
export const PLAN_ACTIVITIES: PlanActivity[] = [
  { id: "box-breathing", label: { en: "Box breathing", es: "Respiración en caja" }, to: "/library", exercise: "box-breathing", sud: false },
  { id: "behavioral-activation", label: { en: "Do one thing you enjoy", es: "Haga una cosa que disfrute" }, to: "/library", sud: false },
  { id: "reentry-journey", label: { en: "Re-entry Journey", es: "Camino de regreso" }, to: "/recovery-journey", sud: false },
  { id: "first-days-out", label: { en: "My First Days Out", es: "Mis primeros días afuera" }, to: "/recovery-journey", sud: false },
];
export const activityById = (id?: string) => PLAN_ACTIVITIES.find((a) => a.id === id);

// Draft Z-codes for common social needs.
const NEED_CODES: Array<{ re: RegExp; code: string }> = [
  { re: /hous|shelter|homeless/i, code: "Z59.00" },
  { re: /food|hunger|meal/i, code: "Z59.41" },
  { re: /transport|ride|bus/i, code: "Z59.82" },
  { re: /employ|job|work/i, code: "Z56.0" },
  { re: /utilit/i, code: "Z59.12" },
];

// ---------------------------------------------------------------- store
const plans = new Map<string, StructuredPlan>();
type Actor = { name: string; role: StaffRole | string };
// Product-owner decision (chart redesign turn 2): ECM providers and care
// managers edit non-SUD items (ECM requires a care plan); trainees edit with
// cosign (a signer must sign the plan); the clinical coordinator only
// reassigns owners; sys_admin has no clinical care-plan editing.
export const PLAN_EDIT_ROLES = ["therapist", "pmhnp", "physician", "sud_counselor", "clinical_trainee", "ecm_provider", "cf_care_manager"];
export const PLAN_SIGN_ROLES = ["therapist", "pmhnp", "physician", "sud_counselor"];
/** Trainee plan edits need a signer (their supervisor) to sign the plan. */
export const PLAN_COSIGN_ROLES = ["clinical_trainee"];
/** May reassign a goal's owner (coordinator: owners only, no clinical edits). */
export const PLAN_OWNER_REASSIGN_ROLES = [...PLAN_EDIT_ROLES, "clinical_coordinator"];
export const canEditPlan = (role: string) => PLAN_EDIT_ROLES.includes(role);
export const canSignPlan = (role: string) => PLAN_SIGN_ROLES.includes(role);

function assertEdit(actor: Actor) {
  if (!canEditPlan(actor.role)) throw new Error("Your role can't change the care plan.");
}
/** SUD-linked items stay masked AND uneditable for roles failing the Part 2 check. */
function assertSudOk(actor: Actor, patientId: string, sud: boolean) {
  if (sud && !roleSeesAsamSection(actor.role as StaffRole, patientOf(patientId)))
    throw new Error("Your role can't change this item.");
}
function audit(action: string, patientId: string, actor: Actor, detail: Record<string, unknown>) {
  AdelanteEHR._recordAudit({ category: "care_plan", action, patientId, actorId: actor.name, actorRole: actor.role, detail });
  AdelanteEHR._emit();
}
function patientOf(id: string): Patient {
  const p = AdelanteEHR.getPatient(id);
  if (!p) throw new Error("Patient not found.");
  return p;
}
function touch(plan: StructuredPlan) {
  if (plan.review.signedAt) plan.review.changedSinceSigned = true;
}

/** Plan for a patient; migrates the old plain-text goals on first read, without loss. */
export function getStructuredPlan(patientId: string): StructuredPlan {
  let plan = plans.get(patientId);
  if (!plan) {
    plan = { patientId, goals: [], assignments: [], decisions: {}, review: { cadenceDays: 90, version: 0, changedSinceSigned: false, history: [] } };
    plans.set(patientId, plan);
  }
  const p = AdelanteEHR.getPatient(patientId);
  for (const g of p?.goals ?? []) {
    const existing = plan.goals.find((x) => x.legacyGoalId === g.id);
    if (existing) {
      // Old goal list stays the source of truth for migrated goal status.
      if (existing.status !== "closed") existing.status = g.status === "done" ? "met" : "active";
      continue;
    }
    plan.goals.push({
      id: `lg-${g.id}`,
      patientId,
      problemIds: [],
      needIds: [],
      owner: "patient",
      measure: "",
      clinicalText: g.text,
      patientText: { en: g.text, es: g.text },
      status: g.status === "done" ? "met" : "active",
      // A goal accepted from an ASAM-signed suggestion is Part 2 content.
      sud: (p?.suggestedGoals ?? []).some((sg) => sg.goalId === g.id && sg.reason === "asam_signed"),
      createdAt: g.createdAt,
      createdBy: g.createdBy ?? "Migrated goal",
      legacyGoalId: g.id,
    });
  }
  return plan;
}

// ---------------------------------------------------------------- problems & needs
export function buildPlanProblems(patient: Patient, now = new Date()): PlanProblem[] {
  const out: PlanProblem[] = [];
  for (const pr of patient.problems ?? []) {
    if (pr.status !== "active") continue;
    out.push({ id: `pl-${pr.id}`, source: "problem_list", code: pr.icd10Code, codeDraft: false, label: pr.description, sud: pr.category === "sud" });
  }
  for (const it of patient.sdohPlan?.items ?? []) {
    const code = NEED_CODES.find((c) => c.re.test(it.need))?.code;
    out.push({ id: `sd-${it.id}`, source: "sdoh", code, codeDraft: true, label: it.need, sud: false, needId: it.id });
  }
  if (inReentryWindow(patient, now, 365) && !out.some((x) => x.code === "Z65.2")) {
    out.push({ id: "reentry", source: "reentry", code: "Z65.2", codeDraft: true, label: "Reentry adjustment after release", sud: false });
  }
  return out;
}
/** Release date, or the onset of an active Z65.2 (release from prison) problem. */
export function inReentryWindow(patient: Patient, now = new Date(), days = 90): boolean {
  if (!isJusticeInvolved(patient)) return false;
  const z = (patient.problems ?? []).find((x) => x.status === "active" && x.icd10Code === "Z65.2");
  const when = patient.releaseDate || z?.onsetDate || (z ? z.createdAt : undefined);
  if (!when) return false;
  const t = +new Date(when);
  return !Number.isNaN(t) && t <= +now && +now - t <= days * DAY;
}

export type NeedStep = "Screened" | "Referred" | "Scheduled" | "Completed";
export const NEED_LADDER: NeedStep[] = ["Screened", "Referred", "Scheduled", "Completed"];
export const NEED_LADDER_ES: Record<NeedStep, string> = { Screened: "Revisado", Referred: "Referido", Scheduled: "Con cita", Completed: "Completado" };
export function needStep(status: SdohStatus): NeedStep {
  if (status === "completed") return "Completed";
  if (status === "scheduled") return "Scheduled";
  if (status === "sent" || status === "accepted" || status === "not_completed") return "Referred";
  return "Screened";
}
export function planNeeds(patientId: string) {
  const p = patientOf(patientId);
  const plan = getStructuredPlan(patientId);
  return (p.sdohPlan?.items ?? [])
    .map((i) => ({
      id: i.id,
      need: i.need,
      status: i.status,
      step: needStep(i.status),
      visibleToPatient: i.visibleToPatient !== false,
      goalIds: plan.goals.filter((g) => g.needIds.includes(i.id)).map((g) => g.id),
    }));
}

// ---------------------------------------------------------------- goals
export function addStructuredGoal(input: {
  patientId: string;
  problemIds?: string[];
  needIds?: string[];
  owner: GoalOwner;
  targetDate?: string;
  measure: string;
  clinicalText: string;
  patientText?: { en?: string; es?: string };
  actor: Actor;
}): StructuredGoal {
  assertEdit(input.actor);
  const p = patientOf(input.patientId);
  const clinical = input.clinicalText.trim().slice(0, 300);
  if (clinical.length < 3) throw new Error("Write the goal.");
  const problems = buildPlanProblems(p);
  const problemIds = (input.problemIds ?? []).filter((id) => problems.some((x) => x.id === id));
  const needIds = input.needIds ?? [];
  const sud = problemIds.some((id) => problems.find((x) => x.id === id)?.sud);
  assertSudOk(input.actor, input.patientId, sud);
  const plan = getStructuredPlan(input.patientId);
  const en = input.patientText?.en?.trim() || clinical;
  const g: StructuredGoal = {
    id: uid(),
    patientId: input.patientId,
    problemIds,
    needIds,
    owner: input.owner,
    targetDate: input.targetDate,
    measure: input.measure.trim().slice(0, 200),
    clinicalText: clinical,
    patientText: { en, es: input.patientText?.es?.trim() || en },
    status: "active",
    sud,
    createdAt: new Date().toISOString(),
    createdBy: input.actor.name,
  };
  plan.goals.push(g);
  touch(plan);
  audit("plan_goal_added", input.patientId, input.actor, { goalId: g.id, problemIds, needIds, owner: g.owner, sud });
  return g;
}
export function updateStructuredGoal(
  patientId: string,
  goalId: string,
  patch: Partial<Pick<StructuredGoal, "owner" | "targetDate" | "measure" | "clinicalText" | "patientText" | "problemIds" | "needIds">>,
  actor: Actor,
) {
  assertEdit(actor);
  const plan = getStructuredPlan(patientId);
  const g = plan.goals.find((x) => x.id === goalId);
  if (!g) throw new Error("Goal not found.");
  assertSudOk(actor, patientId, g.sud);
  const problems = buildPlanProblems(patientOf(patientId));
  const nextIds = patch.problemIds ?? g.problemIds;
  assertSudOk(actor, patientId, nextIds.some((id) => problems.find((x) => x.id === id)?.sud));
  Object.assign(g, patch);
  g.sud = g.problemIds.some((id) => problems.find((x) => x.id === id)?.sud);
  touch(plan);
  audit("plan_goal_updated", patientId, actor, { goalId, fields: Object.keys(patch) });
}
export function closeStructuredGoal(patientId: string, goalId: string, outcome: "met" | "closed", reason: string, actor: Actor) {
  assertEdit(actor);
  if (reason.trim().length < 3) throw new Error("Give a reason for closing the goal.");
  const plan = getStructuredPlan(patientId);
  const g = plan.goals.find((x) => x.id === goalId);
  if (!g) throw new Error("Goal not found.");
  assertSudOk(actor, patientId, g.sud);
  g.status = outcome;
  g.closedReason = reason.trim().slice(0, 300);
  for (const a of plan.assignments) if (a.goalId === goalId) a.active = false;
  touch(plan);
  audit("plan_goal_closed", patientId, actor, { goalId, outcome });
}

/** Owner reassignment — the coordinator's only care-plan write. Reason required, audited. */
export function reassignGoalOwner(patientId: string, goalId: string, owner: GoalOwner, reason: string, actor: Actor) {
  if (!PLAN_OWNER_REASSIGN_ROLES.includes(actor.role)) throw new Error("Your role can't reassign plan owners.");
  if (reason.trim().length < 3) throw new Error("Give a reason for the reassignment.");
  const plan = getStructuredPlan(patientId);
  const g = plan.goals.find((x) => x.id === goalId);
  if (!g) throw new Error("Goal not found.");
  assertSudOk(actor, patientId, g.sud);
  const from = g.owner;
  g.owner = owner;
  touch(plan);
  audit("plan_goal_owner_reassigned", patientId, actor, { goalId, from, to: owner, reason: reason.trim().slice(0, 300) });
}

// ---------------------------------------------------------------- assignments
export function assignToGoal(input: {
  patientId: string;
  goalId: string;
  kind: AssignmentKind;
  activityId?: string;
  needId?: string;
  label?: { en: string; es: string };
  frequency: Frequency;
  dueAt?: string;
  reason?: "rule" | "ad_hoc";
  suggestionId?: string;
  actor: Actor;
  at?: string;
}): PlanAssignment {
  assertEdit(input.actor);
  const plan = getStructuredPlan(input.patientId);
  const g = plan.goals.find((x) => x.id === input.goalId && x.status === "active");
  if (!g) throw new Error("Pick an open goal.");
  assertSudOk(input.actor, input.patientId, g.sud);
  const act = activityById(input.activityId);
  if (input.kind === "activity" && !act) throw new Error("Pick an activity.");
  const need = input.needId ? patientOf(input.patientId).sdohPlan?.items.find((i) => i.id === input.needId) : undefined;
  if (input.kind === "sdoh_referral" && !need) throw new Error("Pick a need.");
  const label =
    input.label ??
    (act
      ? act.label
      : need
        ? { en: `${need.need} referral`, es: `Referido: ${need.need}` }
        : { en: "Visits", es: "Citas" });
  if (need && !g.needIds.includes(need.id)) g.needIds.push(need.id);
  const a: PlanAssignment = {
    id: uid(),
    patientId: input.patientId,
    goalId: g.id,
    kind: input.kind,
    activityId: act?.id,
    needId: need?.id,
    label,
    frequency: input.frequency,
    startAt: input.at ?? new Date().toISOString(),
    dueAt: input.dueAt,
    assignedBy: input.actor.name,
    reason: input.reason ?? "ad_hoc",
    suggestionId: input.suggestionId,
    completions: [],
    active: true,
    sud: g.sud || !!act?.sud,
  };
  plan.assignments.push(a);
  touch(plan);
  audit("plan_assignment_added", input.patientId, input.actor, { assignmentId: a.id, goalId: g.id, kind: a.kind, frequency: a.frequency, reason: a.reason });
  return a;
}

const weekStart = (now: Date) => {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
};
/** "3 of 7 done" for this week (daily), "0 of 1" (weekly/once). */
export function assignmentWeek(a: PlanAssignment, now = new Date()) {
  const from = +weekStart(now);
  const done = a.frequency === "once" ? Math.min(1, a.completions.length) : a.completions.filter((c) => +new Date(c) >= from).length;
  const target = a.frequency === "daily" ? 7 : 1;
  const today = a.completions.some((c) => new Date(c).toDateString() === now.toDateString());
  return { done: Math.min(done, target), target, today };
}
export function completeAssignment(patientId: string, assignmentId: string, by: Actor, at = new Date()) {
  const plan = getStructuredPlan(patientId);
  const a = plan.assignments.find((x) => x.id === assignmentId && x.active);
  if (!a) throw new Error("Activity not found.");
  if (assignmentWeek(a, at).today && a.frequency !== "once") return;
  if (a.frequency === "once" && a.completions.length) return;
  a.completions.push(at.toISOString());
  audit("plan_assignment_completed", patientId, by, { assignmentId, goalId: a.goalId });
}

/** Goal progress 0–100 from its assignments (referrals by ladder step). */
export function goalProgress(patientId: string, goalId: string, now = new Date()): number {
  const plan = getStructuredPlan(patientId);
  const g = plan.goals.find((x) => x.id === goalId);
  if (!g) return 0;
  if (g.status === "met") return 100;
  const p = AdelanteEHR.getPatient(patientId);
  const parts = plan.assignments
    .filter((a) => a.goalId === goalId && a.active)
    .map((a) => {
      if (a.kind === "sdoh_referral") {
        const it = p?.sdohPlan?.items.find((i) => i.id === a.needId);
        return it ? NEED_LADDER.indexOf(needStep(it.status)) / 3 : 0;
      }
      const w = assignmentWeek(a, now);
      return w.done / w.target;
    });
  if (!parts.length) return 0;
  return Math.round((parts.reduce((s, x) => s + x, 0) / parts.length) * 100);
}

// ---------------------------------------------------------------- Adel suggestions
export interface PlanSuggestion {
  id: string;
  rule: string;
  why: string;
  kind: AssignmentKind;
  activityId?: string;
  needId?: string;
  frequency: Frequency;
  label: string;
}
export const SUGGESTION_THRESHOLDS = { gad7: 10, phq9: 10, reentryDays: 90 } as const;

function latestScore(p: Patient, key: string): number | undefined {
  const rows = (p.screenerHistory ?? []).filter((h) => h.key === key).sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  return rows[0]?.score;
}
/** Rule-based, human approves. Thresholds are draft. */
export function planSuggestions(patientId: string, now = new Date()): PlanSuggestion[] {
  const p = patientOf(patientId);
  const plan = getStructuredPlan(patientId);
  const has = (activityId: string) => plan.assignments.some((a) => a.active && a.activityId === activityId);
  const out: PlanSuggestion[] = [];
  const gad = latestScore(p, "gad-7");
  if (gad !== undefined && gad >= SUGGESTION_THRESHOLDS.gad7 && !has("box-breathing"))
    out.push({ id: "gad7-box-breathing", rule: `GAD-7 ≥ ${SUGGESTION_THRESHOLDS.gad7}`, why: `Latest GAD-7 is ${gad}.`, kind: "activity", activityId: "box-breathing", frequency: "daily", label: "Anxiety skills: box breathing (daily)" });
  const phq = latestScore(p, "phq-9");
  if (phq !== undefined && phq >= SUGGESTION_THRESHOLDS.phq9 && !has("behavioral-activation"))
    out.push({ id: "phq9-activation", rule: `PHQ-9 ≥ ${SUGGESTION_THRESHOLDS.phq9}`, why: `Latest PHQ-9 is ${phq}.`, kind: "activity", activityId: "behavioral-activation", frequency: "weekly", label: "Behavioral activation module (weekly)" });
  if (inReentryWindow(p, now, SUGGESTION_THRESHOLDS.reentryDays) && !has("reentry-journey"))
    out.push({ id: "reentry-journey", rule: `Within ${SUGGESTION_THRESHOLDS.reentryDays} days of release`, why: "Released recently.", kind: "activity", activityId: "reentry-journey", frequency: "weekly", label: "Re-entry Journey (weekly)" });
  for (const it of p.sdohPlan?.items ?? []) {
    if (!/hous|shelter|homeless/i.test(it.need) || it.status === "completed") continue;
    if (plan.assignments.some((a) => a.active && a.needId === it.id)) continue;
    out.push({ id: `housing-${it.id}`, rule: "Open housing need", why: `Need: ${it.need}.`, kind: "sdoh_referral", needId: it.id, frequency: "once", label: "Housing referral" });
  }
  return out.filter((s) => !plan.decisions[s.id]);
}
export function acceptSuggestion(patientId: string, suggestionId: string, goalId: string, actor: Actor, at?: string): PlanAssignment {
  assertEdit(actor);
  const s = planSuggestions(patientId).find((x) => x.id === suggestionId);
  if (!s) throw new Error("That suggestion is no longer open.");
  const a = assignToGoal({ patientId, goalId, kind: s.kind, activityId: s.activityId, needId: s.needId, frequency: s.frequency, reason: "rule", suggestionId, actor, at });
  const plan = getStructuredPlan(patientId);
  plan.decisions[suggestionId] = { decision: "accepted", at: new Date().toISOString(), by: actor.name };
  audit("plan_suggestion_accepted", patientId, actor, { suggestionId, rule: s.rule, assignmentId: a.id });
  return a;
}
export function dismissSuggestion(patientId: string, suggestionId: string, reason: string, actor: Actor) {
  assertEdit(actor);
  if (reason.trim().length < 3) throw new Error("Give a reason for dismissing.");
  const plan = getStructuredPlan(patientId);
  plan.decisions[suggestionId] = { decision: "dismissed", at: new Date().toISOString(), by: actor.name, reason: reason.trim().slice(0, 300) };
  audit("plan_suggestion_dismissed", patientId, actor, { suggestionId, reason: reason.trim().slice(0, 300) });
}

// ---------------------------------------------------------------- review
export function signPlan(patientId: string, actor: Actor, opts: { cadenceDays?: number; reviewDueAt?: string } = {}) {
  if (!canSignPlan(actor.role)) throw new Error("Your role can't sign the care plan.");
  const plan = getStructuredPlan(patientId);
  if (!plan.goals.some((g) => g.status === "active")) throw new Error("Add at least one open goal before signing.");
  const now = new Date();
  const r = plan.review;
  r.cadenceDays = opts.cadenceDays ?? r.cadenceDays;
  r.version += 1;
  r.signedAt = now.toISOString();
  r.signedBy = actor.name;
  r.changedSinceSigned = false;
  r.reviewDueAt = opts.reviewDueAt ?? new Date(+now + r.cadenceDays * DAY).toISOString();
  r.history.push({ version: r.version, at: r.signedAt, by: actor.name, goals: plan.goals.filter((g) => g.status === "active").length, assignments: plan.assignments.filter((a) => a.active).length });
  audit("plan_signed", patientId, actor, { version: r.version, reviewDueAt: r.reviewDueAt });
}
export function acknowledgePlan(patientId: string, by: Actor) {
  const plan = getStructuredPlan(patientId);
  if (!plan.review.signedAt) throw new Error("Your care team hasn't signed this plan yet.");
  plan.review.acknowledgedAt = new Date().toISOString();
  plan.review.acknowledgedVersion = plan.review.version;
  audit("plan_acknowledged", patientId, by, { version: plan.review.version });
}
export function planReviewDue(patientId: string, now = new Date()): boolean {
  const due = getStructuredPlan(patientId).review.reviewDueAt;
  if (!due) return false;
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return +new Date(due) <= +end;
}

// ---------------------------------------------------------------- Part 2 views
export function staffPlanView(patientId: string, role: StaffRole) {
  const p = patientOf(patientId);
  const plan = getStructuredPlan(patientId);
  const seesSud = roleSeesAsamSection(role, p);
  const goals = plan.goals.filter((g) => seesSud || !g.sud);
  const ids = new Set(goals.map((g) => g.id));
  return {
    plan,
    goals,
    assignments: plan.assignments.filter((a) => ids.has(a.goalId) && (seesSud || !a.sud)),
    problems: buildPlanProblems(p).filter((x) => seesSud || !x.sud),
    hiddenCount: plan.goals.length - goals.length,
    seesSud,
  };
}
/** Today's first open activity — for Adel's greeting. */
export function todaysActivity(patientId: string, now = new Date()): PlanAssignment | undefined {
  if (!AdelanteEHR.getPatient(patientId)) return undefined;
  return getStructuredPlan(patientId).assignments.find((a) => a.active && a.kind === "activity" && !assignmentWeek(a, now).today && (a.frequency === "daily" || assignmentWeek(a, now).done < 1));
}

// ---------------------------------------------------------------- demo seed
export function seedStructuredCarePlanDemo(): void {
  const actor = { name: "Marisol Reyes", role: "therapist" };
  const find = (n: string) => AdelanteEHR.listPatients().find((p) => p.firstName === n);
  const luis = find("Luis");
  if (luis && !getStructuredPlan(luis.id).review.signedAt) {
    // Problem list through the normal function: anxiety + reentry (released 45 days ago).
    if (!(luis.problems ?? []).some((x) => x.icd10Code === "F41.1"))
      AdelanteEHR.addProblem(luis.id, { description: "Generalized anxiety disorder", icd10Code: "F41.1", category: "mental_health", onsetDate: new Date(Date.now() - 200 * DAY).toISOString().slice(0, 10), enteredBy: "therapist" });
    if (!(luis.problems ?? []).some((x) => x.icd10Code === "Z65.2"))
      AdelanteEHR.addProblem(luis.id, { description: "Reentry adjustment after release from prison", icd10Code: "Z65.2", category: "medical", onsetDate: new Date(Date.now() - 45 * DAY).toISOString().slice(0, 10), enteredBy: "therapist" });
    let housing = luis.sdohPlan?.items.find((i) => /hous/i.test(i.need));
    if (!housing) {
      AdelanteEHR.addSdohItem(luis.id, { need: "Housing", note: "Staying with a cousin; needs a stable place." }, { staffName: actor.name, role: "therapist" });
      housing = AdelanteEHR.getPatient(luis.id)?.sdohPlan?.items.find((i) => /hous/i.test(i.need));
    }
    const probs = buildPlanProblems(AdelanteEHR.getPatient(luis.id)!);
    const mh = probs.find((x) => x.code === "F41.1") ?? probs.find((x) => x.source === "problem_list" && !x.sud && x.code !== "Z65.2");
    const g1 = addStructuredGoal({ patientId: luis.id, problemIds: mh ? [mh.id] : [], owner: "patient", measure: "GAD-7 below 5", targetDate: new Date(Date.now() + 60 * DAY).toISOString(), clinicalText: "Reduce anxiety symptoms using daily coping skills", patientText: { en: "Feel calmer day to day", es: "Sentirme más tranquilo cada día" }, actor });
    const g2 = addStructuredGoal({ patientId: luis.id, problemIds: housing ? [`sd-${housing.id}`] : [], needIds: housing ? [housing.id] : [], owner: "case_manager", measure: "Housing secured", targetDate: new Date(Date.now() + 90 * DAY).toISOString(), clinicalText: "Secure stable housing", patientText: { en: "Have a safe, steady place to live", es: "Tener un lugar seguro y estable para vivir" }, actor });
    const reentryProb = probs.find((x) => x.code === "Z65.2");
    const g3 = addStructuredGoal({ patientId: luis.id, problemIds: reentryProb ? [reentryProb.id] : [], owner: "clinician", measure: "Attend 4 of 4 visits", targetDate: new Date(Date.now() + 30 * DAY).toISOString(), clinicalText: "Maintain engagement through reentry transition", patientText: { en: "Come to my 4 visits this month", es: "Ir a mis 4 citas este mes" }, actor });
    const bb = assignToGoal({ patientId: luis.id, goalId: g1.id, kind: "activity", activityId: "box-breathing", frequency: "daily", actor });
    // Two past days of practice (never today, so the patient can tick today).
    for (const d of [2, 1]) bb.completions.push(new Date(Date.now() - d * DAY).toISOString());
    const sugg = planSuggestions(luis.id);
    const rj = sugg.find((s) => s.id === "reentry-journey");
    if (rj) acceptSuggestion(luis.id, rj.id, g3.id, actor);
    else {
      assignToGoal({ patientId: luis.id, goalId: g3.id, kind: "activity", activityId: "reentry-journey", frequency: "weekly", actor });
      const other = sugg.find((s) => s.id === "phq9-activation") ?? sugg.find((s) => s.id === "gad7-box-breathing");
      if (other) acceptSuggestion(luis.id, other.id, g1.id, actor);
    }
    if (housing) {
      assignToGoal({ patientId: luis.id, goalId: g2.id, kind: "sdoh_referral", needId: housing.id, frequency: "once", actor });
      if (housing.status === "identified") AdelanteEHR.setSdohStatus(luis.id, housing.id, "sent", "Referred to county housing navigator", { staffName: actor.name, role: "therapist" });
    }
    assignToGoal({ patientId: luis.id, goalId: g3.id, kind: "visit_cadence", frequency: "weekly", label: { en: "Weekly visit", es: "Cita semanal" }, actor });
    signPlan(luis.id, actor, { reviewDueAt: new Date(Date.now() + 30 * DAY).toISOString() });
  }
  const rosa = find("Rosa");
  if (rosa && !getStructuredPlan(rosa.id).review.signedAt) {
    const probs = buildPlanProblems(rosa);
    const dep = probs.find((x) => x.source === "problem_list" && !x.sud);
    const g1 = addStructuredGoal({ patientId: rosa.id, problemIds: dep ? [dep.id] : [], owner: "patient", measure: "PHQ-9 below 5", targetDate: new Date(Date.now() + 60 * DAY).toISOString(), clinicalText: "Reduce depressive symptoms", patientText: { en: "Feel more like myself", es: "Sentirme más como yo misma" }, actor });
    addStructuredGoal({ patientId: rosa.id, problemIds: dep ? [dep.id] : [], owner: "clinician", measure: "Attend 4 of 4 visits", targetDate: new Date(Date.now() + 30 * DAY).toISOString(), clinicalText: "Attend scheduled therapy sessions", patientText: { en: "Come to my visits", es: "Ir a mis citas" }, actor });
    assignToGoal({ patientId: rosa.id, goalId: g1.id, kind: "activity", activityId: "behavioral-activation", frequency: "weekly", actor });
    signPlan(rosa.id, actor, { reviewDueAt: new Date().toISOString() });
  }
}

/** Test helper. */
export function _resetStructuredPlans() {
  plans.clear();
}

/** §Batch E — the plan store a merge re-keys (patient merge only). */
export function _mergePlanStore(): Map<string, StructuredPlan> {
  return plans;
}
