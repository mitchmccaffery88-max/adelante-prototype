// §Adelante Journey Phase 7 part 2 — PATIENT-REPORTED MEDICATION ADHERENCE.
//
// ─────────────────────────────────────────────────────────────────────────────
// ARCHITECTURE: this is NOT a parallel medication list. Every row here is a
// FOREIGN REFERENCE into the real medication record:
//   • `orderId`     -> a real `MedOrder` on the patient's chart
//   • `scheduledAt` -> a real derived MAR slot (`deriveMarDay` in mar.ts)
// A patient self-report is deliberately a DISTINCT layer from a charted
// `DoseAdministration`: only licensed staff may chart a dose (witness rules,
// late-entry reasons, PRN eligibility, void semantics all live there and are
// untouched). What the patient tells us is a self-report that is RECONCILED
// against the MAR — see `reconcileState` — so staff always see whether the two
// agree, disagree, or whether only the patient has said anything yet.
//
// Side-effect reports are genuinely new: nothing on the Orders/MAR side
// captured patient-reported tolerability. They are tied to a specific order
// and are pushed to a real staff work surface (a CaseTask) by the EHR facade,
// so they cannot sit unread.
// ─────────────────────────────────────────────────────────────────────────────
import type { DoseAdministration, MedOrder, Patient } from "./ehr";
import { deriveMarDay, isSuboxoneOrder } from "./mar";
import { facilityDateKey } from "./facilityTime";

/** Tone rule for this whole surface: encouraging, never punitive. */
export const ADHERENCE_TONE = {
  missedDay: "Let's get back on track",
  takenDay: "Taken",
  notYet: "Not marked yet",
  encouragement: "Every dose you take counts. Nothing here is a judgement.",
} as const;

export type SelfReportStatus = "taken" | "not_taken";
export type SideEffectSeverity = "mild" | "moderate" | "severe";

export interface DoseSelfReport {
  id: string;
  patientId: string;
  /** Real `MedOrder.id`. */
  orderId: string;
  /** Real derived MAR slot instant. */
  scheduledAt: string;
  /** Facility-local day the slot belongs to (YYYY-MM-DD). */
  facilityDate: string;
  status: SelfReportStatus;
  note?: string;
  reportedAt: string;
  reportedBy: string;
}

export interface SideEffectReport {
  id: string;
  patientId: string;
  orderId: string;
  /** Snapshot for display in staff queues; the order remains the source of truth. */
  drugName: string;
  severity: SideEffectSeverity;
  note: string;
  reportedAt: string;
  reportedBy: string;
  /** CaseTask created for staff — set by the EHR facade. */
  caseTaskId?: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
}

interface Row {
  patientId: string;
  selfReports: DoseSelfReport[];
  sideEffects: SideEffectReport[];
}

const rows = new Map<string, Row>();

type Listener = () => void;
const listeners = new Set<Listener>();
const notify = () => listeners.forEach((l) => l());

export function subscribeMedAdherence(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export type MedAdherenceAuditEvent = {
  patientId: string;
  action: "dose_self_reported" | "med_side_effect_reported" | "med_side_effect_acknowledged";
  actorRole: string;
  detail: Record<string, unknown>;
};
type AuditSink = (evt: MedAdherenceAuditEvent) => void;
let auditSink: AuditSink | undefined;

/** The EHR store installs the real audit writer; this module never imports it. */
export function setMedAdherenceAuditSink(sink: AuditSink | undefined): void {
  auditSink = sink;
}

let seq = 0;
const nextId = (p: string) => `${p}_${Date.now().toString(36)}_${(seq++).toString(36)}`;

function row(patientId: string): Row {
  let r = rows.get(patientId);
  if (!r) {
    r = { patientId, selfReports: [], sideEffects: [] };
    rows.set(patientId, r);
  }
  return r;
}

// ---------------------------------------------------------------------------
// MAT identification — read off the REAL order, no separate MAT list.
// ---------------------------------------------------------------------------

const MAT_PATTERN = /buprenorphine|suboxone|zubsolv|sublocade|methadone|naltrexone|vivitrol/;

/** True when a real MedOrder is a MAT/MOUD medication. */
export function isMatOrder(order: MedOrder): boolean {
  const name = [order.drugName, order.productName, ...(order.ingredientNames ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return MAT_PATTERN.test(name) || isSuboxoneOrder(order);
}

// ---------------------------------------------------------------------------
// Refill runway — days of supply left on a REAL signed order.
//
// Computed ONLY from two first-class order fields: `startDate` (the facility
// date therapy begins) and `daysSupply`. There is no dispense/fill event
// stream in this build, so we never pretend to know when the pharmacy last
// filled it — an order with either field missing returns undefined and the UI
// says nothing rather than guessing.
// ---------------------------------------------------------------------------

export type RunwayTone = "ok" | "soon" | "out";

export interface RefillRunway {
  daysLeft: number;
  /** Facility-style YYYY-MM-DD the supply runs out. */
  runsOutOn: string;
  tone: RunwayTone;
}

export function refillRunway(order: MedOrder, now: Date = new Date()): RefillRunway | undefined {
  if (!order.startDate || !order.daysSupply || order.daysSupply <= 0) return undefined;
  const start = new Date(`${order.startDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) return undefined;
  const end = new Date(start.getTime() + order.daysSupply * 86_400_000);
  const daysLeft = Math.ceil((end.getTime() - now.getTime()) / 86_400_000);
  return {
    daysLeft,
    runsOutOn: end.toISOString().slice(0, 10),
    tone: daysLeft <= 0 ? "out" : daysLeft <= 7 ? "soon" : "ok",
  };
}


// ---------------------------------------------------------------------------
// Self-report layer
// ---------------------------------------------------------------------------

export function recordSelfReport(
  patientId: string,
  input: {
    orderId: string;
    scheduledAt: string;
    facilityDate: string;
    status: SelfReportStatus;
    note?: string;
    reportedBy?: string;
    actorRole?: string;
  },
): DoseSelfReport {
  const r = row(patientId);
  const now = new Date().toISOString();
  const existing = r.selfReports.find(
    (s) => s.orderId === input.orderId && s.scheduledAt === input.scheduledAt,
  );
  const reportedBy = input.reportedBy ?? "patient";
  const note = input.note?.trim();
  let report: DoseSelfReport;
  if (existing) {
    existing.status = input.status;
    if (note) existing.note = note;
    else delete existing.note;
    existing.reportedAt = now;
    existing.reportedBy = reportedBy;
    report = existing;
  } else {
    report = {
      id: nextId("dsr"),
      patientId,
      orderId: input.orderId,
      scheduledAt: input.scheduledAt,
      facilityDate: input.facilityDate,
      status: input.status,
      ...(note ? { note } : {}),
      reportedAt: now,
      reportedBy,
    };
    r.selfReports.push(report);
  }
  auditSink?.({
    patientId,
    action: "dose_self_reported",
    actorRole: input.actorRole ?? "patient",
    // No free text in audit detail — the note may contain clinical content.
    detail: {
      orderId: report.orderId,
      scheduledAt: report.scheduledAt,
      status: report.status,
      hasNote: Boolean(report.note),
    },
  });
  notify();
  return { ...report };
}

export function listSelfReports(
  patientId: string,
  opts?: { orderId?: string; facilityDate?: string },
): DoseSelfReport[] {
  return (rows.get(patientId)?.selfReports ?? [])
    .filter((s) => !opts?.orderId || s.orderId === opts.orderId)
    .filter((s) => !opts?.facilityDate || s.facilityDate === opts.facilityDate)
    .map((s) => ({ ...s }));
}

export type ReconcileState =
  | "agrees" // patient says taken, MAR has a live "given"
  | "conflicts" // patient and the MAR disagree
  | "self_report_only" // nothing charted yet
  | "mar_only" // charted, patient has not said anything
  | "none";

/** Reconcile ONE slot's self-report against the real charted administration. */
export function reconcileState(
  report: DoseSelfReport | undefined,
  administration: DoseAdministration | undefined,
): ReconcileState {
  const charted = administration && !administration.voided ? administration : undefined;
  if (!report && !charted) return "none";
  if (report && !charted) return "self_report_only";
  if (!report && charted) return "mar_only";
  const chartedTaken = charted!.action === "given";
  const patientTaken = report!.status === "taken";
  return chartedTaken === patientTaken ? "agrees" : "conflicts";
}

export interface AdherenceDay {
  dateKey: string;
  /** Real scheduled MAR slots on that day. */
  scheduled: number;
  /** Slots charted "given" on the real MAR. */
  chartedGiven: number;
  /** Slots the patient marked as taken. */
  selfTaken: number;
  /** Slots with neither a self-report nor a charted administration. */
  unmarked: number;
  /** Slots where the patient and the MAR disagree. */
  conflicts: number;
}

/**
 * Week strip. Reads REAL scheduled slots (deriveMarDay) and REAL charted
 * administrations, overlaid with the self-report layer.
 */
export function adherenceWeek(
  patient: Patient,
  opts?: { days?: number; endDate?: Date; orderId?: string },
): AdherenceDay[] {
  const days = opts?.days ?? 7;
  const end = opts?.endDate ?? new Date();
  const tz = patient.facilityTimezone;
  const out: AdherenceDay[] = [];
  const reports = rows.get(patient.id)?.selfReports ?? [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end.getTime() - i * 86_400_000);
    const dateKey = facilityDateKey(d, tz);
    const day = deriveMarDay(patient, dateKey);
    const slots = day.slots.filter((s) => !opts?.orderId || s.order.id === opts.orderId);
    let chartedGiven = 0;
    let selfTaken = 0;
    let unmarked = 0;
    let conflicts = 0;
    for (const slot of slots) {
      const report = reports.find(
        (r) => r.orderId === slot.order.id && r.scheduledAt === slot.scheduledAt,
      );
      const state = reconcileState(report, slot.administration);
      if (slot.administration && !slot.administration.voided && slot.administration.action === "given")
        chartedGiven++;
      if (report?.status === "taken") selfTaken++;
      if (state === "none") unmarked++;
      if (state === "conflicts") conflicts++;
    }
    out.push({ dateKey, scheduled: slots.length, chartedGiven, selfTaken, unmarked, conflicts });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Side-effect reports
// ---------------------------------------------------------------------------

export function addSideEffectReport(
  patientId: string,
  input: {
    orderId: string;
    drugName: string;
    severity: SideEffectSeverity;
    note: string;
    reportedBy?: string;
    actorRole?: string;
  },
): SideEffectReport {
  const note = input.note.trim();
  if (!note) throw new Error("Tell us a little about what you noticed.");
  const r = row(patientId);
  const report: SideEffectReport = {
    id: nextId("sfx"),
    patientId,
    orderId: input.orderId,
    drugName: input.drugName,
    severity: input.severity,
    note,
    reportedAt: new Date().toISOString(),
    reportedBy: input.reportedBy ?? "patient",
  };
  r.sideEffects.unshift(report);
  auditSink?.({
    patientId,
    action: "med_side_effect_reported",
    actorRole: input.actorRole ?? "patient",
    detail: { orderId: report.orderId, severity: report.severity, reportId: report.id },
  });
  notify();
  return { ...report };
}

/** Set by the facade once the staff CaseTask exists. */
export function attachSideEffectTask(patientId: string, reportId: string, taskId: string): void {
  const report = rows.get(patientId)?.sideEffects.find((s) => s.id === reportId);
  if (!report) return;
  report.caseTaskId = taskId;
  notify();
}

export function acknowledgeSideEffect(
  patientId: string,
  reportId: string,
  by: string,
  actorRole = "clinician",
): SideEffectReport | undefined {
  const report = rows.get(patientId)?.sideEffects.find((s) => s.id === reportId);
  if (!report) return undefined;
  report.acknowledgedAt = new Date().toISOString();
  report.acknowledgedBy = by;
  auditSink?.({
    patientId,
    action: "med_side_effect_acknowledged",
    actorRole,
    detail: { reportId, orderId: report.orderId, acknowledgedBy: by },
  });
  notify();
  return { ...report };
}

export function listSideEffectReports(
  patientId: string,
  opts?: { orderId?: string; openOnly?: boolean },
): SideEffectReport[] {
  return (rows.get(patientId)?.sideEffects ?? [])
    .filter((s) => !opts?.orderId || s.orderId === opts.orderId)
    .filter((s) => !opts?.openOnly || !s.acknowledgedAt)
    .map((s) => ({ ...s }));
}

/** Cross-patient staff read (crisis/med queues, reporting). */
export function allSideEffectReports(opts?: { openOnly?: boolean }): SideEffectReport[] {
  return [...rows.values()]
    .flatMap((r) => r.sideEffects)
    .filter((s) => !opts?.openOnly || !s.acknowledgedAt)
    .map((s) => ({ ...s }))
    .sort((a, b) => b.reportedAt.localeCompare(a.reportedAt));
}

/** Test/demo helper. */
export function __resetMedAdherence(): void {
  rows.clear();
  notify();
}

export interface ChecklistRow {
  slot: ReturnType<typeof deriveMarDay>["slots"][number];
  selfReport?: DoseSelfReport;
  isMat: boolean;
  reconcile: ReconcileState;
}

/**
 * Today's patient-facing checklist: REAL derived MAR slots (scheduled + PRN)
 * for one facility day, each with the patient's self-report and how it
 * reconciles with the charted administration.
 */
export function doseChecklist(patient: Patient, dateKey?: string): ChecklistRow[] {
  const day = deriveMarDay(patient, dateKey);
  const reports = listSelfReports(patient.id, { facilityDate: day.dateKey });
  return [...day.slots, ...day.prn].map((slot) => {
    const selfReport = reports.find(
      (r) => r.orderId === slot.order.id && r.scheduledAt === slot.scheduledAt,
    );
    return {
      slot,
      ...(selfReport ? { selfReport } : {}),
      isMat: isMatOrder(slot.order),
      reconcile: reconcileState(selfReport, slot.administration),
    };
  });
}
