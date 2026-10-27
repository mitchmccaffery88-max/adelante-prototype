// 26 Oct (Mitch) — one coverage request type, many paths. Extends the Phase B
// Intake → Billing contract (requestIntakeEligibility / billing_intake_check /
// coverage-only projection). This module owns the request store, Billing's
// per-path processing and the projections. Financial detail (member IDs,
// copays, income, documents, tiers, COB notes) is Billing-only and never leaves
// `billingCoverageDetail`. Audits carry ids only. Draft — pending billing sign-off.
import { AdelanteEHR } from "./ehr";
import { getStaffMember, hasRoleAssignment, STAFF_ROSTER, type StaffRole } from "./roles";
import { isRestricted } from "./chartAccess";
import {
  coveragePath,
  isCoveragePath,
  listCountyPrograms,
  listFeeSchedules,
  listPayers,
  nextCheckDate,
  slidingTierFor,
  type CoveragePath,
} from "./eligibility/coverageConfig";
import { PAYER_UNREACHABLE, SIMULATED_VENDOR_NOTICE, runAdapter, selectedAdapter } from "./eligibility/coverageAdapters";
import type { CoverageCheckResponse } from "./eligibility/adapter";

export type CoverageStatus =
  | "Active"
  | "Inactive"
  | "Pending"
  | "Not found"
  | "Self-pay"
  | "Sliding scale — tier set"
  | "Application in progress";

export interface CoverageProjection {
  path: CoveragePath;
  pathLabel: string;
  status: CoverageStatus;
  checkedOn?: string;
  nextCheckOn?: string;
  notice?: string;
}

type Actor = { role: StaffRole; staffId?: string };
const BILLING_ROLES: StaffRole[] = ["billing", "billing_coordinator"];

interface CoverageRequest {
  key: string;
  referralId?: string;
  patientId: string;
  path: CoveragePath;
  programId?: string;
  requestedAt: string;
  requestedById: string;
  requestedByRole: StaffRole;
  baselineIds: string[];
  taskId: string;
  billingStaffId: string;
  applicationTaskId?: string;
}

interface BillingDetail {
  channel?: string;
  simulated?: boolean;
  transactionRef?: string;
  payerId?: string;
  payerName?: string;
  memberId?: string;
  groupNumber?: string;
  subscriberRelationship?: "self" | "spouse" | "child" | "other";
  planName?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  financial?: CoverageCheckResponse["financial"];
  carveOuts?: CoverageCheckResponse["carveOuts"];
  feeScheduleId?: string;
  selfPayAcknowledged?: boolean;
  screening?: { householdSize: number; annualIncomeCents: number; documentation: "received" | "attested" };
  tierId?: string;
  cobNote?: string;
}

export interface CoverageDetermination {
  id: string;
  requestKey: string;
  patientId: string;
  path: CoveragePath;
  programId?: string;
  status: CoverageStatus;
  checkedOn: string;
  nextCheckOn?: string;
  notice?: string;
  order: number;
  recordedById: string;
  billing: BillingDetail;
}

const requests = new Map<string, CoverageRequest>();
const determinations: CoverageDetermination[] = [];
let detSeq = 0;

const today = () => new Date().toISOString().slice(0, 10);
function billingOwner() {
  const owner = STAFF_ROSTER.find((s) => s.active !== false && hasRoleAssignment(s, "billing"));
  if (!owner) throw new Error("No active Billing owner; request not created.");
  return owner;
}
export function isBillingActor(actor: Actor) {
  const s = getStaffMember(actor.staffId);
  return !!s && s.active !== false && BILLING_ROLES.includes(actor.role) && hasRoleAssignment(s, actor.role);
}
function assertBilling(actor: Actor, reason: string) {
  if (!isBillingActor(actor) || !actor.staffId) throw new Error("Billing-owned coverage work only.");
  if (reason.trim().length < 3) throw new Error("Give a reason.");
}
function audit(action: string, actor: Actor, patientId: string, detail: Record<string, unknown>) {
  AdelanteEHR.recordBillingAudit({ action, actorId: actor.staffId ?? actor.role, actorRole: actor.role, patientId, detail });
}

const TASK_TITLE: Record<CoveragePath, string> = {
  medi_cal: "Medi-Cal status check requested",
  medicare: "Medicare coverage check requested",
  county_program: "County program coverage check requested",
  private: "Private insurance check requested",
  self_pay: "Self-pay acknowledgment requested",
  sliding_scale: "Sliding-scale screening requested",
  uninsured_apply: "Coverage check requested — uninsured",
  unknown: "Coverage path to determine",
};

/** Shared by the Intake and care-team entry points; callers have already checked access. */
export function createCoverageRequest(input: {
  key: string;
  referralId?: string;
  patientId: string;
  path: CoveragePath;
  programId?: string;
  actor: Actor;
}): { key: string; taskId: string } {
  if (!isCoveragePath(input.path)) throw new Error("Choose a coverage path.");
  if (input.path === "county_program" && !listCountyPrograms().some((p) => p.id === input.programId)) throw new Error("Choose a configured county or public program.");
  if (input.path !== "county_program" && input.programId) throw new Error("A program applies only to the county path.");
  const existing = requests.get(input.key);
  if (existing && existing.path === input.path && coverageProjection(input.key).status === "Pending") return { key: input.key, taskId: existing.taskId };
  const owner = billingOwner();
  const at = new Date().toISOString();
  const patient = AdelanteEHR.getPatient(input.patientId);
  const dedupe = input.referralId ? `intake-eligibility:${input.referralId}` : `coverage-request:${input.key}`;
  const task = AdelanteEHR.createCaseTask({
    patientId: input.patientId,
    assignedTo: owner.id,
    title: TASK_TITLE[input.path],
    detail: input.referralId ? `Referral reference: ${input.referralId}` : `Coverage request reference: ${input.key}`,
    dueDate: at.slice(0, 10),
    taskType: "intake_eligibility",
    source: input.referralId ? "intake_referral" : "coverage_request",
    allowedRoles: ["billing", "billing_coordinator"],
    dedupeKey: dedupe,
  } as never);
  if (!task) throw new Error("Billing task unavailable.");
  let applicationTaskId: string | undefined;
  if (input.path === "uninsured_apply") {
    const app = AdelanteEHR.createCaseTask({
      patientId: input.patientId,
      assignedTo: owner.id,
      title: "Medi-Cal application assistance",
      detail: `Coverage request reference: ${input.key}`,
      dueDate: at.slice(0, 10),
      taskType: "medi_cal_application",
      source: input.referralId ? "intake_referral" : "coverage_request",
      allowedRoles: ["billing", "billing_coordinator"],
      dedupeKey: `coverage-application:${input.key}`,
    } as never);
    applicationTaskId = app?.id;
  }
  requests.set(input.key, {
    key: input.key,
    referralId: input.referralId,
    patientId: input.patientId,
    path: input.path,
    programId: input.programId,
    requestedAt: at,
    requestedById: input.actor.staffId ?? input.actor.role,
    requestedByRole: input.actor.role,
    baselineIds: (patient?.coverage?.verifications ?? []).map((v) => v.id),
    taskId: task.id,
    billingStaffId: owner.id,
    applicationTaskId,
  });
  audit("coverage_request_created", input.actor, input.patientId, { requestKey: input.key, path: input.path, taskId: task.id, ...(applicationTaskId ? { applicationTaskId } : {}) });
  AdelanteEHR._emit();
  return { key: input.key, taskId: task.id };
}

export const getCoverageRequest = (key: string) => {
  const r = requests.get(key);
  return r ? { ...r } : undefined;
};

/** Billing work list (Billing roles only). Contains no financial detail. */
export function billingCoverageRequests(actor: Actor) {
  if (!isBillingActor(actor)) return [];
  return [...requests.values()].map((r) => ({
    key: r.key,
    referralId: r.referralId,
    patientId: r.patientId,
    path: r.path,
    pathLabel: coveragePath(r.path).label,
    programId: r.programId,
    requestedAt: r.requestedAt,
    taskId: r.taskId,
    applicationTaskId: r.applicationTaskId,
    status: coverageProjection(r.key).status,
  }));
}

function latestDetermination(key: string) {
  return determinations.filter((d) => d.requestKey === key).at(-1);
}

/** Coverage-only projection: path label, status, dates. Nothing else ever. */
export function coverageProjection(key: string): CoverageProjection {
  const req = requests.get(key);
  if (!req) return { path: "unknown", pathLabel: coveragePath("unknown").short, status: "Pending" };
  const program = req.programId ? listCountyPrograms({ includeRetired: true }).find((p) => p.id === req.programId) : undefined;
  const d = latestDetermination(key);
  const path = d?.path ?? req.path;
  const pathLabel = path === "county_program" && (d?.programId ?? req.programId)
    ? (listCountyPrograms({ includeRetired: true }).find((p) => p.id === (d?.programId ?? req.programId))?.label ?? program?.label ?? coveragePath(path).short)
    : coveragePath(path).short;
  // A Billing manual check through the existing recordCoverageCheck path.
  const v = AdelanteEHR.getPatient(req.patientId)?.coverage?.verifications?.find(
    (x) => !req.baselineIds.includes(x.id) && !x.reportSource && x.channel !== "reported" && BILLING_ROLES.includes(x.checkedByRole as StaffRole),
  );
  const vOn = v?.checkedAt.slice(0, 10);
  if (d && (!vOn || d.checkedOn >= vOn)) {
    return { path, pathLabel, status: d.status, checkedOn: d.checkedOn, ...(d.nextCheckOn ? { nextCheckOn: d.nextCheckOn } : {}), ...(d.notice ? { notice: d.notice } : {}) };
  }
  if (!v || !vOn) return { path, pathLabel, status: "Pending" };
  const status: CoverageStatus =
    v.electronic?.responseStatus === "active" || v.statusConfirmed === "active"
      ? "Active"
      : v.electronic?.responseStatus === "inactive" || ["suspended", "uninsured"].includes(v.statusConfirmed ?? "")
        ? "Inactive"
        : v.result === "not_found"
          ? "Not found"
          : "Pending";
  const next = status === "Active" ? nextCheckDate(path, vOn, { programId: req.programId }) : undefined;
  return { path, pathLabel, status, checkedOn: vOn, ...(next ? { nextCheckOn: next } : {}) };
}

function addDetermination(req: CoverageRequest, actor: Actor, input: Omit<CoverageDetermination, "id" | "requestKey" | "patientId" | "order" | "recordedById" | "checkedOn"> & { checkedOn?: string }) {
  const others = determinations.filter((d) => d.patientId === req.patientId && d.requestKey !== req.key);
  const prior = latestDetermination(req.key);
  const det: CoverageDetermination = {
    id: `cov-det-${++detSeq}`,
    requestKey: req.key,
    patientId: req.patientId,
    order: prior?.order ?? others.length + 1,
    recordedById: actor.staffId ?? actor.role,
    checkedOn: input.checkedOn ?? today(),
    ...input,
  };
  determinations.push(det);
  AdelanteEHR._emit();
  return det;
}
function reqFor(actor: Actor, key: string, reason: string) {
  assertBilling(actor, reason);
  const req = requests.get(key);
  if (!req) throw new Error("Coverage request not found.");
  return req;
}

/** Unknown path: Billing picks the real path before processing. */
export function billingDetermineCoveragePath(actor: Actor, key: string, path: CoveragePath, programId: string | undefined, reason: string) {
  const req = reqFor(actor, key, reason);
  if (path === "unknown" || !isCoveragePath(path)) throw new Error("Choose the coverage path Billing found.");
  if (path === "county_program" && !listCountyPrograms().some((p) => p.id === programId)) throw new Error("Choose a configured county or public program.");
  req.path = path;
  req.programId = path === "county_program" ? programId : undefined;
  audit("coverage_path_determined", actor, req.patientId, { requestKey: key, path });
  AdelanteEHR._emit();
  return { key, path };
}

/** Private / commercial details: collected by Billing only. */
export function billingRecordInsuranceDetails(
  actor: Actor,
  key: string,
  input: { payerId: string; memberId: string; groupNumber?: string; subscriberRelationship: BillingDetail["subscriberRelationship"] },
  reason: string,
) {
  const req = reqFor(actor, key, reason);
  if (!["private", "medicare"].includes(req.path)) throw new Error("Insurance details apply to private or Medicare coverage.");
  const payer = listPayers().find((p) => p.id === input.payerId);
  if (!payer || !input.memberId.trim() || !input.subscriberRelationship) throw new Error("Payer, member ID and subscriber relationship required.");
  insurance.set(key, { payerId: payer.id, payerName: payer.name, memberId: input.memberId.trim(), groupNumber: input.groupNumber?.trim() || undefined, subscriberRelationship: input.subscriberRelationship });
  audit("coverage_insurance_details_recorded", actor, req.patientId, { requestKey: key, payerId: payer.id });
  AdelanteEHR._emit();
  return { key };
}
const insurance = new Map<string, Pick<BillingDetail, "payerId" | "payerName" | "memberId" | "groupNumber" | "subscriberRelationship">>();

/** Run the configured adapter for an insurance/program path. */
// Validation is synchronous so the registry refuses bad calls; only the adapter call is async.
export function billingRunCoverageCheck(actor: Actor, key: string, input: { payerId?: string; memberRef?: string }, reason: string) {
  const req = reqFor(actor, key, reason);
  if (coveragePath(req.path).processing !== "check" && req.path !== "uninsured_apply") throw new Error("This coverage path has no payer check.");
  return runCheck(actor, req, key, selectedAdapter(), input);
}
async function runCheck(actor: Actor, req: CoverageRequest, key: string, adapter: ReturnType<typeof selectedAdapter>, input: { payerId?: string; memberRef?: string }) {
  const ins = insurance.get(key);
  const payerId = input.payerId ?? ins?.payerId;
  const res = await runAdapter(adapter, { requestKey: key, patientId: req.patientId, path: req.path, programId: req.programId, payerId, memberRef: input.memberRef ?? ins?.memberId, serviceDate: today() });
  audit("coverage_check_run", actor, req.patientId, { requestKey: key, channel: res.channel, outcome: res.outcome, ...(res.errorKind ? { errorKind: res.errorKind } : {}), ...(res.transactionRef ? { transactionRef: res.transactionRef } : {}), simulated: res.simulated });
  if (res.outcome === "manual_required") {
    return { key, outcome: res.outcome, notice: res.errorKind === "not_connected" ? SIMULATED_VENDOR_NOTICE : "Record the result with a manual check." };
  }
  if (res.outcome === "error") {
    const owner = billingOwner();
    AdelanteEHR.createCaseTask({ patientId: req.patientId, assignedTo: owner.id, title: "Manual coverage check needed", detail: `Coverage request reference: ${key}`, dueDate: today(), taskType: "intake_eligibility", source: "coverage_request", allowedRoles: ["billing", "billing_coordinator"], dedupeKey: `coverage-manual:${key}` } as never);
    addDetermination(req, actor, { path: req.path, programId: req.programId, status: "Pending", notice: PAYER_UNREACHABLE, billing: { channel: res.channel, simulated: res.simulated, transactionRef: res.transactionRef, payerId } });
    return { key, outcome: res.outcome, notice: PAYER_UNREACHABLE };
  }
  const status: CoverageStatus = res.outcome === "active" ? "Active" : res.outcome === "inactive" ? "Inactive" : "Not found";
  const checkedOn = today();
  const det = addDetermination(req, actor, {
    path: req.path,
    programId: req.programId,
    status,
    checkedOn,
    nextCheckOn: status === "Active" ? nextCheckDate(req.path, checkedOn, { programId: req.programId, payerId }) : undefined,
    billing: { ...(ins ?? {}), channel: res.channel, simulated: res.simulated, transactionRef: res.transactionRef, payerId, planName: res.planName, effectiveFrom: res.effectiveFrom, effectiveTo: res.effectiveTo, financial: res.financial, carveOuts: res.carveOuts },
  });
  return { key, outcome: res.outcome, determinationId: det.id };
}

export function billingRecordSelfPay(actor: Actor, key: string, input: { feeScheduleId: string; acknowledged: boolean }, reason: string) {
  const req = reqFor(actor, key, reason);
  if (req.path !== "self_pay") throw new Error("Self-pay path only.");
  if (!input.acknowledged || !listFeeSchedules().some((f) => f.id === input.feeScheduleId)) throw new Error("Self-pay acknowledgment and a fee schedule are required.");
  const det = addDetermination(req, actor, { path: "self_pay", status: "Self-pay", billing: { feeScheduleId: input.feeScheduleId, selfPayAcknowledged: true } });
  audit("coverage_self_pay_recorded", actor, req.patientId, { requestKey: key, determinationId: det.id, feeScheduleId: input.feeScheduleId });
  return { key, determinationId: det.id };
}

export function billingRecordSlidingScale(
  actor: Actor,
  key: string,
  input: { householdSize: number; annualIncomeCents: number; documentation: "received" | "attested" },
  reason: string,
) {
  const req = reqFor(actor, key, reason);
  if (req.path !== "sliding_scale") throw new Error("Sliding-scale path only.");
  if (!["received", "attested"].includes(input.documentation)) throw new Error("Record whether income documents were received or attested.");
  const tier = slidingTierFor(input.householdSize, input.annualIncomeCents);
  const checkedOn = today();
  const det = addDetermination(req, actor, {
    path: "sliding_scale",
    status: "Sliding scale — tier set",
    checkedOn,
    nextCheckOn: nextCheckDate("sliding_scale", checkedOn),
    billing: { screening: { ...input }, tierId: tier.id },
  });
  audit("coverage_sliding_tier_set", actor, req.patientId, { requestKey: key, determinationId: det.id, tierId: tier.id });
  return { key, determinationId: det.id, tierId: tier.id };
}

export function billingMarkApplicationInProgress(actor: Actor, key: string, reason: string) {
  const req = reqFor(actor, key, reason);
  if (req.path !== "uninsured_apply") throw new Error("Medi-Cal application path only.");
  const checkedOn = today();
  const det = addDetermination(req, actor, { path: "uninsured_apply", status: "Application in progress", checkedOn, nextCheckOn: nextCheckDate("uninsured_apply", checkedOn), billing: {} });
  audit("coverage_application_started", actor, req.patientId, { requestKey: key, determinationId: det.id });
  return { key, determinationId: det.id };
}

/** Primary / secondary order and coordination-of-benefits note (Billing-only). */
export function billingSetCoverageOrder(actor: Actor, patientId: string, orderedIds: string[], cobNote: string, reason: string) {
  assertBilling(actor, reason);
  const current = billingCoverageDetail(actor, patientId);
  const ids = current.map((d) => d.id);
  if (orderedIds.length !== ids.length || orderedIds.some((id) => !ids.includes(id)) || new Set(orderedIds).size !== orderedIds.length) throw new Error("Order every current coverage exactly once.");
  orderedIds.forEach((id, i) => {
    for (const d of determinations) if (d.requestKey === determinations.find((x) => x.id === id)!.requestKey) d.order = i + 1;
  });
  const primary = determinations.find((d) => d.id === orderedIds[0]);
  if (primary && cobNote.trim()) primary.billing.cobNote = cobNote.trim();
  audit("coverage_order_set", actor, patientId, { determinationIds: orderedIds });
  AdelanteEHR._emit();
  return { patientId, order: orderedIds };
}

/** Billing-only full view: current (latest per request) determinations in coverage order. */
export function billingCoverageDetail(actor: Actor, patientId: string) {
  if (!isBillingActor(actor)) return [];
  const latest = new Map<string, CoverageDetermination>();
  for (const d of determinations) if (d.patientId === patientId) latest.set(d.requestKey, d);
  return [...latest.values()]
    .filter((d) => d.status !== "Inactive" && d.status !== "Not found")
    .sort((a, b) => a.order - b.order)
    .map((d) => ({ ...d, billing: structuredClone(d.billing), rank: d.order === 1 ? "primary" : d.order === 2 ? "secondary" : "additional" }));
}

/** Creates one Billing task per active coverage whose next-check date has arrived. */
export function sweepCoverageReverification(onDate = today()) {
  const created: string[] = [];
  for (const req of requests.values()) {
    const p = coverageProjection(req.key);
    if (!p.nextCheckOn || p.nextCheckOn > onDate || ["Inactive", "Not found", "Pending"].includes(p.status)) continue;
    const dedupeKey = `coverage-recheck:${req.key}:${p.nextCheckOn}`;
    if (AdelanteEHR.listCaseTasks().some((t) => t.dedupeKey === dedupeKey)) continue;
    const owner = billingOwner();
    const t = AdelanteEHR.createCaseTask({ patientId: req.patientId, assignedTo: owner.id, title: `Re-verify coverage — ${p.pathLabel}`, detail: `Coverage request reference: ${req.key}`, dueDate: p.nextCheckOn, taskType: "coverage_reverification", source: "coverage_request", allowedRoles: ["billing", "billing_coordinator"], dedupeKey } as never);
    if (t) {
      created.push(t.id);
      audit("coverage_recheck_due", { role: "billing", staffId: owner.id }, req.patientId, { requestKey: req.key, taskId: t.id });
    }
  }
  if (created.length) AdelanteEHR._emit();
  return created;
}

/** Billing-run sweep through the registry. */
export function billingSweepReverification(actor: Actor, reason: string) {
  assertBilling(actor, reason);
  return { created: sweepCoverageReverification() };
}

/** Ready for the patient portal (not mounted yet): plain words, no amounts. */
export function patientCoverageSummary(patientId: string, lang: "en" | "es" = "en") {
  if (isRestricted(patientId)) return [];
  const es: Record<CoverageStatus, string> = {
    Active: "activa",
    Inactive: "inactiva",
    Pending: "en revisión",
    "Not found": "no encontrada — tu equipo te va a ayudar",
    "Self-pay": "pago propio",
    "Sliding scale — tier set": "lista",
    "Application in progress": "solicitud en proceso",
  };
  const en: Record<CoverageStatus, string> = { ...Object.fromEntries(Object.keys(es).map((k) => [k, k.toLowerCase()])) as Record<CoverageStatus, string>, "Sliding scale — tier set": "set up", "Not found": "not found — your team will help" };
  return [...requests.values()]
    .filter((r) => r.patientId === patientId)
    .map((r) => {
      const p = coverageProjection(r.key);
      const name = p.path === "sliding_scale" ? (lang === "es" ? "Escala móvil" : "Sliding scale") : p.pathLabel;
      return lang === "es" ? `Tu cobertura: ${name} — ${es[p.status]}` : `Your coverage: ${name} — ${en[p.status]}`;
    });
}

/** Request keys for a patient — read-only, used by the lifecycle projection. */
export function coverageKeysForPatient(patientId: string): string[] {
  return [...requests.values()].filter((r) => r.patientId === patientId).map((r) => r.key);
}

/** Test-only reset hook. */
export function __resetCoverageRequestsForTests() {
  requests.clear();
  determinations.length = 0;
  insurance.clear();
}
