// §Phase 10d-1 — ASAM clinical worklists and reporting (staff).
//
// Read-only over the existing store: ASAM assessments, "ASAM assessment
// needed" case tasks, DMC-ODS claims and the staff roster. No new write paths.
//
// PART 2: every row and every aggregate is computed only over patients the
// viewing role passes `canAccess(role, "screeners_sud", patient)` for. A role
// that fails the check at role level gets `null` — the surface is HIDDEN, never
// shown as zero.
//
// COHORT GUARD: aggregates carry the shared `cohortGuard` (11). Prototype runs
// in caveat mode; hard suppression is required before any real pilot data.
//
// WORDING: association only — figures describe what was recorded, never why.
//
// DRAFT: due windows, the reassessment interval and the timeliness windows are
// drafts pending clinical sign-off (`ASAM_DRAFT_NOTE`).
import { AdelanteEHR, type CaseTask, type Patient } from "@/lib/ehr";
import { AdelanteEHRExt } from "@/lib/ehr-ext";
import { canAccess, STAFF_ROSTER, type StaffRole } from "@/lib/roles";
import { ASAM_DEDUPE_PREFIX, dmcOdsLevelLabel, type AsamAssessment } from "@/lib/asam";
import { cohortGuard, type CohortGuard } from "@/lib/cohortGuard";

const DAY = 86_400_000;

/** DRAFT timeliness windows (days). */
export const ASAM_TIMELINESS_DRAFT = {
  triggerToAssessmentDays: 7,
  assessmentToFirstServiceDays: 14,
} as const;

export const ASAM_REPORTING_ASSOCIATION_NOTE =
  "These figures describe what was recorded. They show association only and do not explain why a level or a delay occurred.";

export function roleSeesAsam(role: StaffRole, patient?: Patient): boolean {
  const g = canAccess(role, "screeners_sud", patient);
  return g.level !== "none" && !g.locked;
}

/**
 * §10d-2 coordinator rule — DRAFT pending compliance review.
 * The clinical coordinator fails the role-level Part 2 check, but may see
 * ASAM/SUD TOTALS (counts, timeliness, level mix — no names, no drill-down).
 * No patient names at all until consents can name recipient roles.
 * No other role is widened.
 */
export const ACCESS_RULE_DRAFT_NOTE = "Access rule: draft pending compliance review.";
export const TOTALS_ONLY_NOTE =
  "Totals only. Named rows need a consent that names your role, not yet supported. Access rule: draft pending compliance review.";
export const TOTALS_ONLY_ROLES: StaffRole[] = ["clinical_coordinator"];

export type AsamAccessMode = "full" | "totals";

/** Role-level: "full" (rows + totals), "totals" (aggregate only), or null (hidden). */
export function asamAccessMode(role: StaffRole): AsamAccessMode | null {
  if (roleSeesAsam(role)) return "full";
  if (TOTALS_ONLY_ROLES.includes(role)) return "totals";
  return null;
}

/** May this role see a NAMED ASAM row for this patient? */
export function roleSeesAsamRow(role: StaffRole, patient: Patient): boolean {
  // Totals-only roles never see names: the consent model cannot yet record
  // which roles a Part 2 consent covers (draft pending compliance review).
  return roleSeesAsam(role, patient);
}

/** Patients whose named rows the role may see. */
function visiblePatients(role: StaffRole): Patient[] {
  return AdelanteEHR.listPatients().filter((p) => roleSeesAsamRow(role, p));
}

/** Patients counted in aggregates: totals-only roles count everyone (no names leave). */
export function aggregatePatients(role: StaffRole): Patient[] {
  const mode = asamAccessMode(role);
  if (mode === "totals") return AdelanteEHR.listPatients();
  if (mode === "full") return AdelanteEHR.listPatients().filter((p) => roleSeesAsam(role, p));
  return [];
}

const TEAM_BY_ROLE: Partial<Record<StaffRole, string>> = {
  therapist: "Therapy",
  pmhnp: "Psychiatry",
  sud_counselor: "SUD counseling",
  clinical_trainee: "Trainees",
};

export function resolveStaff(assignee: string | undefined): { id: string; name: string; team: string } {
  const m = STAFF_ROSTER.find(
    (s) => s.id === assignee || s.clinicianId === assignee || s.name === assignee,
  );
  if (!m) return { id: assignee ?? "unassigned", name: assignee ?? "Unassigned", team: "Clinical supervisor queue" };
  return { id: m.id, name: m.name, team: TEAM_BY_ROLE[m.role] ?? "Other clinical" };
}

const isAsamTask = (t: CaseTask) =>
  t.origin === "asam_needed" && (t.taskType === "asam_assessment") && t.status !== "done";

export type AsamTaskState = "needed" | "due" | "overdue";

export interface AsamTaskRow {
  patientId: string;
  patientName: string;
  taskId: string;
  title: string;
  kind: "initial" | "reassessment";
  dueDate: string;
  state: AsamTaskState;
  assigneeId: string;
  assigneeName: string;
  team: string;
  reason: string;
}

/** DRAFT: "due" = within the next 7 days; "overdue" = past the due date. */
function taskState(dueDate: string, now: Date): AsamTaskState {
  const due = new Date(dueDate).getTime();
  const today = new Date(now.toISOString().slice(0, 10)).getTime();
  if (due < today) return "overdue";
  if (due - today <= 7 * DAY) return "due";
  return "needed";
}

const patientName = (p: Patient) => `${p.firstName} ${p.lastName}`.trim();

/** Every open ASAM task (initial and reassessment) the role may see. `null` = hidden. */
export function asamTaskRows(role: StaffRole, now: Date = new Date()): AsamTaskRow[] | null {
  if (!asamAccessMode(role)) return null;
  return taskRowsOver(visiblePatients(role), now);
}

function taskRowsOver(patients: Patient[], now: Date): AsamTaskRow[] {
  const byId = new Map(patients.map((p) => [p.id, p]));
  return AdelanteEHR.listCaseTasks()
    .filter(isAsamTask)
    .filter((t) => byId.has(t.patientId))
    .map((t) => {
      const p = byId.get(t.patientId)!;
      const s = resolveStaff(t.assignedTo);
      return {
        patientId: p.id,
        patientName: patientName(p),
        taskId: t.id,
        title: t.title,
        kind: t.dedupeKey?.startsWith(ASAM_DEDUPE_PREFIX) ? ("initial" as const) : ("reassessment" as const),
        dueDate: t.dueDate.slice(0, 10),
        state: taskState(t.dueDate, now),
        assigneeId: s.id,
        assigneeName: s.name,
        team: s.team,
        reason: (t.detail ?? "").split(". Due date")[0] ?? "",
      };
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export interface AsamCountRow {
  key: string;
  label: string;
  needed: number;
  due: number;
  overdue: number;
}

function countBy(rows: AsamTaskRow[], key: (r: AsamTaskRow) => [string, string]): AsamCountRow[] {
  const m = new Map<string, AsamCountRow>();
  for (const r of rows) {
    const [k, label] = key(r);
    const row = m.get(k) ?? { key: k, label, needed: 0, due: 0, overdue: 0 };
    row[r.state] += 1;
    m.set(k, row);
  }
  return [...m.values()].sort((a, b) => b.overdue - a.overdue || a.label.localeCompare(b.label));
}

export interface AsamCosignRow {
  patientId: string;
  patientName: string;
  asamId: string;
  authorName: string;
  authorId: string;
  ageDays: number;
}

export function asamCosignRows(role: StaffRole, now: Date = new Date()): AsamCosignRow[] | null {
  if (!asamAccessMode(role)) return null;
  return AdelanteEHR.listAsamAwaitingCosign()
    .filter(({ patient }) => roleSeesAsamRow(role, patient))
    .map(({ patient, asam }) => ({
      patientId: patient.id,
      patientName: patientName(patient),
      asamId: asam.id,
      authorName: asam.authoredBy.name,
      authorId: asam.authoredBy.staffId,
      ageDays: Math.max(0, Math.floor((now.getTime() - +new Date(asam.signedAt ?? asam.authoredAt)) / DAY)),
    }));
}

export interface AsamLevelDifferenceRow {
  patientId: string;
  patientName: string;
  asamId: string;
  version: number;
  recommended: string;
  actual: string;
  reason: string;
  signedAt: string;
}

const finalAt = (a: AsamAssessment) => (a.status === "signed" ? a.cosignedAt ?? a.signedAt : undefined);

export function asamLevelDifferences(role: StaffRole): AsamLevelDifferenceRow[] | null {
  if (!asamAccessMode(role)) return null;
  const out: AsamLevelDifferenceRow[] = [];
  for (const p of visiblePatients(role)) {
    for (const a of p.asamAssessments ?? []) {
      const at = finalAt(a);
      if (!at || !a.recommendedLevel || a.recommendedLevel === a.actualLevel) continue;
      out.push({
        patientId: p.id,
        patientName: patientName(p),
        asamId: a.id,
        version: a.version,
        recommended: dmcOdsLevelLabel(a.recommendedLevel),
        actual: dmcOdsLevelLabel(a.actualLevel),
        reason: a.levelDifferenceReason ?? "",
        signedAt: at,
      });
    }
  }
  return out;
}

export interface AsamLevelHistoryEntry {
  asamId: string;
  version: number;
  level: string;
  recommended?: string;
  reason?: string;
  signedAt: string;
  signer: string;
  amendsId?: string;
}

/** Signed versions for one patient, oldest first. `null` when the role can't see ASAM for them. */
export function asamLevelHistory(role: StaffRole, patient: Patient): AsamLevelHistoryEntry[] | null {
  if (!roleSeesAsamRow(role, patient)) return null;
  return (patient.asamAssessments ?? [])
    .filter((a) => finalAt(a))
    .map((a) => ({
      asamId: a.id,
      version: a.version,
      level: dmcOdsLevelLabel(a.actualLevel),
      recommended:
        a.recommendedLevel && a.recommendedLevel !== a.actualLevel ? dmcOdsLevelLabel(a.recommendedLevel) : undefined,
      reason: a.levelDifferenceReason,
      signedAt: finalAt(a)!,
      signer: a.cosignedBy ?? a.authoredBy.name,
      amendsId: a.amendsId,
    }))
    .sort((a, b) => a.version - b.version || a.signedAt.localeCompare(b.signedAt));
}

export interface TimelinessFigure extends CohortGuard {
  /** Median days, or null when nothing has been measured yet. */
  medianDays: number | null;
  withinWindow: number;
  windowDays: number;
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : Math.round(((s[m - 1]! + s[m]!) / 2) * 10) / 10;
}

function figure(values: number[], windowDays: number): TimelinessFigure {
  return {
    ...cohortGuard(values.length),
    medianDays: median(values),
    withinWindow: values.filter((v) => v <= windowDays).length,
    windowDays,
  };
}

/** Trigger → first final-signed assessment; signed → first DMC-ODS treatment service (non-H0001 claim). */
export function asamTimeliness(role: StaffRole): { triggerToAssessment: TimelinessFigure; assessmentToService: TimelinessFigure } | null {
  if (!asamAccessMode(role)) return null;
  const tasks = AdelanteEHR.listCaseTasks();
  const claims = AdelanteEHRExt.listClaims();
  const t2a: number[] = [];
  const a2s: number[] = [];
  for (const p of aggregatePatients(role)) {
    const signed = (p.asamAssessments ?? [])
      .filter((a) => a.version === 1 && finalAt(a))
      .sort((a, b) => finalAt(a)!.localeCompare(finalAt(b)!))[0];
    if (!signed) continue;
    const signedAt = +new Date(finalAt(signed)!);
    const trig = tasks.find((t) => t.dedupeKey === `${ASAM_DEDUPE_PREFIX}${p.id}`);
    if (trig) t2a.push(Math.max(0, Math.round((signedAt - +new Date(trig.createdAt)) / DAY)));
    const service = claims
      .filter(
        (c) =>
          c.patientId === p.id &&
          c.serviceCode !== "H0001" &&
          c.program === "dmc_ods" &&
          c.serviceDate &&
          +new Date(c.serviceDate) >= new Date(finalAt(signed)!.slice(0, 10)).getTime(),
      )
      .map((c) => +new Date(c.serviceDate!))
      .sort((a, b) => a - b)[0];
    if (service !== undefined) a2s.push(Math.max(0, Math.round((service - signedAt) / DAY)));
  }
  return {
    triggerToAssessment: figure(t2a, ASAM_TIMELINESS_DRAFT.triggerToAssessmentDays),
    assessmentToService: figure(a2s, ASAM_TIMELINESS_DRAFT.assessmentToFirstServiceDays),
  };
}

export interface AsamClinicalReport {
  mode: AsamAccessMode;
  guard: CohortGuard;
  /** Aggregate task rows — for COUNTING only; in totals mode names are blanked. */
  tasks: AsamTaskRow[];
  cosignCount: number;
  differenceCount: number;
  byClinician: AsamCountRow[];
  byTeam: AsamCountRow[];
  cosign: AsamCosignRow[];
  differences: AsamLevelDifferenceRow[];
  reassessmentsDue30: AsamTaskRow[];
  timeliness: NonNullable<ReturnType<typeof asamTimeliness>>;
}

/** The whole "ASAM (clinical)" reporting section. `null` = hidden for this role. */
export function asamClinicalReport(role: StaffRole, now: Date = new Date()): AsamClinicalReport | null {
  const mode = asamAccessMode(role);
  if (!mode) return null;
  const agg = aggregatePatients(role);
  const named = new Set(visiblePatients(role).map((p) => p.id));
  const tasks = taskRowsOver(agg, now).map((t) =>
    named.has(t.patientId) ? t : { ...t, patientId: "", patientName: "", reason: "" },
  );
  const withAsam = agg.filter(
    (p) => (p.asamAssessments?.length ?? 0) > 0 || AdelanteEHR.listCaseTasks().some((t) => isAsamTask(t) && t.patientId === p.id),
  );
  const aggIds = new Set(agg.map((p) => p.id));
  const differenceCount = agg.reduce(
    (n, p) =>
      n +
      (p.asamAssessments ?? []).filter((a) => finalAt(a) && a.recommendedLevel && a.recommendedLevel !== a.actualLevel).length,
    0,
  );
  return {
    mode,
    guard: cohortGuard(withAsam.length),
    tasks,
    cosignCount: AdelanteEHR.listAsamAwaitingCosign().filter(({ patient }) => aggIds.has(patient.id)).length,
    differenceCount,
    byClinician: countBy(tasks, (r) => [r.assigneeId, r.assigneeName]),
    byTeam: countBy(tasks, (r) => [r.team, r.team]),
    cosign: asamCosignRows(role, now) ?? [],
    differences: asamLevelDifferences(role) ?? [],
    reassessmentsDue30: tasks.filter(
      (t) => t.kind === "reassessment" && +new Date(t.dueDate) - now.getTime() <= 30 * DAY,
    ),
    timeliness: asamTimeliness(role)!,
  };
}

/** My Work "ASAM" group for the acting person. `null` = hidden for this role. */
export function myAsamWork(
  actor: { role: StaffRole; staffId: string; staffName: string; clinicianId?: string },
  now: Date = new Date(),
): { tasks: AsamTaskRow[]; myDraftsAwaitingCosign: AsamCosignRow[]; cosignsForMe: AsamCosignRow[] } | null {
  const tasks = asamTaskRows(actor.role, now);
  if (!tasks) return null;
  const mine = new Set([actor.staffId, actor.staffName, actor.clinicianId].filter(Boolean) as string[]);
  const cosign = asamCosignRows(actor.role, now) ?? [];
  const lpha = actor.role === "therapist" || actor.role === "pmhnp";
  return {
    tasks: tasks.filter(
      (t) =>
        mine.has(t.assigneeId) ||
        AdelanteEHR.listCaseTasks().some((ct) => ct.id === t.taskId && mine.has(ct.assignedTo)),
    ),
    myDraftsAwaitingCosign: cosign.filter((c) => c.authorId === actor.staffId),
    cosignsForMe: lpha ? cosign.filter((c) => c.authorId !== actor.staffId) : [],
  };
}
