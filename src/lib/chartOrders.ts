// §Chart redesign turn 2 — lab orders (placeholder, never sent), screener
// requests and metabolic measures. One store; every write role-checks,
// audits through AdelanteEHR._recordAudit and wakes the UI. The chart action
// registry calls the SAME checks exported here.
//
// Part 2: the urine drug screen is SUD-related — ordering, results and the
// "Result pending" item are hidden from roles failing roleSeesAsamSection.
// AUDIT / DAST-10 requests need the same check plus SUD consent.
// Thresholds are "Draft — pending clinical sign-off".
import { AdelanteEHR, type Patient } from "@/lib/ehr";
import { isPrescriberRole, canAccess, type StaffRole } from "@/lib/roles";
import { roleSeesAsamSection } from "@/lib/asamReporting";
import { canSignNotes } from "@/lib/notes";
import { isPart2Screener } from "@/lib/screeners";

export const LAB_PLACEHOLDER_LABEL = "Placeholder lab — not sent";
export const METABOLIC_DRAFT_LABEL = "Thresholds: Draft — pending clinical sign-off";
const DAY = 86400000;
const uid = () => Math.random().toString(36).slice(2, 10);

type Actor = { name: string; role: StaffRole | string };

// ---------------------------------------------------------------- labs
export interface LabTest {
  id: string;
  label: string;
  unit: string;
  sud: boolean;
}
export const LAB_PANEL: LabTest[] = [
  { id: "lithium", label: "Lithium level", unit: "mEq/L", sud: false },
  { id: "valproate", label: "Valproate level", unit: "mcg/mL", sud: false },
  { id: "cbc_anc", label: "CBC with ANC (clozapine)", unit: "cells/µL", sud: false },
  { id: "cmp", label: "CMP", unit: "", sud: false },
  { id: "lipid", label: "Lipid panel", unit: "mg/dL", sud: false },
  { id: "a1c", label: "Hemoglobin A1c", unit: "%", sud: false },
  { id: "tsh", label: "TSH", unit: "mIU/L", sud: false },
  { id: "hcg", label: "Pregnancy test", unit: "", sud: false },
  { id: "uds", label: "Urine drug screen", unit: "", sud: true },
];
export const labTest = (id: string) => LAB_PANEL.find((t) => t.id === id);

export type LabPriority = "routine" | "urgent" | "stat";
export type LabFlag = "high" | "low" | "normal";
export interface LabOrder {
  id: string;
  patientId: string;
  testId: string;
  reason: string;
  priority: LabPriority;
  dueAt: string;
  orderedBy: string;
  orderedAt: string;
  status: "pending" | "resulted";
  result?: { value: string; unit: string; flag: LabFlag; date: string; enteredBy: string };
}

const labs: LabOrder[] = [];

/** Same rule the registry shows: prescribers order labs. */
export const canOrderLabs = (role: string) => isPrescriberRole(role as StaffRole);
/** A lab is visible to this role on this patient (UDS is Part 2). */
export function roleSeesLab(role: string, patient: Patient | undefined, testId: string): boolean {
  if (!labTest(testId)?.sud) return true;
  return !!patient && roleSeesAsamSection(role as StaffRole, patient);
}
/** Lab tests this role may order for this patient. */
export function orderableLabs(role: string, patient?: Patient): LabTest[] {
  if (!canOrderLabs(role)) return [];
  return LAB_PANEL.filter((t) => roleSeesLab(role, patient, t.id));
}

function audit(category: string, action: string, patientId: string, actor: Actor, detail: Record<string, unknown>) {
  AdelanteEHR._recordAudit({ category, action, patientId, actorId: actor.name, actorRole: actor.role, detail } as never);
  AdelanteEHR._emit();
}
function patientOf(id: string): Patient {
  const p = AdelanteEHR.getPatient(id);
  if (!p) throw new Error("Patient not found.");
  return p;
}

export function placeLabOrder(input: {
  patientId: string;
  testId: string;
  reason: string;
  priority: LabPriority;
  dueAt: string;
  actor: Actor;
  at?: string;
}): LabOrder {
  if (!canOrderLabs(input.actor.role)) throw new Error("Only a prescriber can order labs.");
  const p = patientOf(input.patientId);
  const test = labTest(input.testId);
  if (!test) throw new Error("Pick a lab test.");
  if (!roleSeesLab(input.actor.role, p, test.id)) throw new Error("Not available for your role.");
  if (input.reason.trim().length < 3) throw new Error("Give a reason for the order.");
  if (!input.dueAt) throw new Error("Pick a due date.");
  const o: LabOrder = {
    id: uid(),
    patientId: p.id,
    testId: test.id,
    reason: input.reason.trim().slice(0, 300),
    priority: input.priority,
    dueAt: input.dueAt,
    orderedBy: input.actor.name,
    orderedAt: input.at ?? new Date().toISOString(),
    status: "pending",
  };
  labs.push(o);
  audit("lab_order", "lab_ordered", p.id, input.actor, { orderId: o.id, test: test.sud ? "restricted" : test.id, priority: o.priority, placeholder: true });
  return o;
}

export function enterLabResult(input: {
  orderId: string;
  value: string;
  unit?: string;
  flag: LabFlag;
  date: string;
  actor: Actor;
}): LabOrder {
  if (!canOrderLabs(input.actor.role)) throw new Error("Only a prescriber can enter lab results.");
  const o = labs.find((x) => x.id === input.orderId);
  if (!o) throw new Error("Lab order not found.");
  if (!roleSeesLab(input.actor.role, patientOf(o.patientId), o.testId)) throw new Error("Not available for your role.");
  if (!input.value.trim()) throw new Error("Enter the result value.");
  if (!input.date) throw new Error("Enter the result date.");
  o.result = {
    value: input.value.trim().slice(0, 60),
    unit: (input.unit ?? labTest(o.testId)?.unit ?? "").trim(),
    flag: input.flag,
    date: input.date,
    enteredBy: input.actor.name,
  };
  o.status = "resulted";
  audit("lab_order", "lab_result_entered", o.patientId, input.actor, { orderId: o.id, flag: input.flag });
  return o;
}

/** Lab orders for a patient, Part 2-filtered for the role. */
export function listLabOrders(patientId: string, role: string): LabOrder[] {
  const p = AdelanteEHR.getPatient(patientId);
  return labs
    .filter((o) => o.patientId === patientId && roleSeesLab(role, p, o.testId))
    .sort((a, b) => +new Date(b.orderedAt) - +new Date(a.orderedAt));
}
/** Open (unresulted) lab orders across the given patients, Part 2-filtered. */
export function pendingLabs(patientIds: string[], role: string, orderedBy?: Set<string>): LabOrder[] {
  const ids = new Set(patientIds);
  return labs.filter((o) => {
    if (o.status !== "pending") return false;
    if (!ids.has(o.patientId) && !(orderedBy && orderedBy.has(o.orderedBy))) return false;
    return roleSeesLab(role, AdelanteEHR.getPatient(o.patientId), o.testId);
  });
}

// ---------------------------------------------------------------- screener requests
export interface ScreenerOption {
  key: string;
  label: string;
  sud: boolean;
}
export const REQUESTABLE_SCREENERS: ScreenerOption[] = [
  { key: "phq-9", label: "PHQ-9", sud: false },
  { key: "gad-7", label: "GAD-7", sud: false },
  { key: "c-ssrs", label: "C-SSRS", sud: false },
  { key: "audit", label: "AUDIT", sud: true },
  { key: "dast-10", label: "DAST-10", sud: true },
  { key: "pcl-5-20", label: "PCL-5", sud: false },
  { key: "ahc-hrsn", label: "AHC-HRSN", sud: false },
];
export interface ScreenerRequest {
  id: string;
  patientId: string;
  key: string;
  requestedBy: string;
  requestedAt: string;
  dueAt: string;
}
const screenerRequests: ScreenerRequest[] = [];

/** Clinical roles who may request a screener (same rule the registry shows). */
export function canRequestScreener(role: string, patient?: Patient): boolean {
  const a = canAccess(role as StaffRole, "screeners_mh", patient);
  return (a.level === "write" && !a.locked) || canSignNotes(role as StaffRole) || isPrescriberRole(role as StaffRole);
}
/** Instruments this role may request for this patient (SUD ones Part 2-gated + consent). */
export function requestableScreeners(role: string, patient?: Patient): ScreenerOption[] {
  if (!canRequestScreener(role, patient)) return [];
  return REQUESTABLE_SCREENERS.filter((s) => {
    if (!s.sud) return true;
    return !!patient && roleSeesAsamSection(role as StaffRole, patient) &&
      AdelanteEHR.isConsentCategoryAuthorized(patient.id, "sud_treatment");
  });
}

export function requestScreener(input: { patientId: string; key: string; dueAt?: string; actor: Actor; at?: string }): ScreenerRequest {
  if (!canRequestScreener(input.actor.role)) throw new Error("Your role doesn't request screeners.");
  const p = patientOf(input.patientId);
  const opt = requestableScreeners(input.actor.role, p).find((s) => s.key === input.key);
  if (!opt) throw new Error("That questionnaire isn't available for this patient.");
  const at = input.at ?? new Date().toISOString();
  const r: ScreenerRequest = {
    id: uid(),
    patientId: p.id,
    key: opt.key,
    requestedBy: input.actor.name,
    requestedAt: at,
    dueAt: input.dueAt ?? new Date(+new Date(at) + 7 * DAY).toISOString(),
  };
  screenerRequests.push(r);
  // Reuse the patient-side paths: the re-screen task (home tile) or C-SSRS request.
  if (opt.key === "c-ssrs") AdelanteEHR.requestCssrs(p.id, `Requested by ${input.actor.name}`);
  else AdelanteEHR.sendRescreenTask(p.id, opt.key);
  audit("screener_request", "screener_requested", p.id, input.actor, { requestId: r.id, instrument: opt.sud ? "restricted" : opt.key });
  return r;
}

export type ScreenerRequestStatus = "open" | "completed" | "overdue";
export function screenerRequestStatus(r: ScreenerRequest, now = new Date()): ScreenerRequestStatus {
  const p = AdelanteEHR.getPatient(r.patientId);
  const histKey = r.key === "c-ssrs" ? "c-ssrs-screener" : r.key;
  const done = (p?.screenerHistory ?? []).some(
    (h) => (h.key === histKey || h.key.startsWith(r.key)) && +new Date(h.completedAt) >= +new Date(r.requestedAt),
  );
  if (done) return "completed";
  return +new Date(r.dueAt) < +now ? "overdue" : "open";
}
/** Requests for a patient, SUD instruments removed for roles failing the check. */
export function listScreenerRequests(patientId: string, role?: string): ScreenerRequest[] {
  const p = AdelanteEHR.getPatient(patientId);
  return screenerRequests.filter(
    (r) => r.patientId === patientId && (!role || !isPart2Screener(r.key) || (!!p && roleSeesAsamSection(role as StaffRole, p))),
  );
}
/** Open requests the patient sees on home ("Your care team asked you to fill this out"). */
export function openScreenerRequestsForPatient(patientId: string): ScreenerRequest[] {
  return screenerRequests.filter((r) => r.patientId === patientId && screenerRequestStatus(r) !== "completed");
}

// ---------------------------------------------------------------- metabolic
export interface MetabolicSet {
  id: string;
  patientId: string;
  at: string;
  bpSystolic: number;
  bpDiastolic: number;
  weightKg: number;
  heightCm: number;
  bmi: number;
  recordedBy: string;
}
const metabolic: MetabolicSet[] = [];
/** Prescribers only — the app has no nurse role. */
export const canRecordMetabolic = (role: string) => isPrescriberRole(role as StaffRole);
export const computeBmi = (weightKg: number, heightCm: number) =>
  Math.round((weightKg / Math.pow(heightCm / 100, 2)) * 10) / 10;
/** Draft thresholds — pending clinical sign-off. */
export function metabolicFlags(m: Pick<MetabolicSet, "bmi" | "bpSystolic" | "bpDiastolic">) {
  return {
    bmi: m.bmi >= 30 ? "high" : m.bmi < 18.5 ? "low" : "normal",
    bp: m.bpSystolic >= 130 || m.bpDiastolic >= 80 ? "high" : "normal",
  } as const;
}

export function recordMetabolic(input: {
  patientId: string;
  bpSystolic: number;
  bpDiastolic: number;
  weightKg: number;
  heightCm: number;
  actor: Actor;
  at?: string;
}): MetabolicSet {
  if (!canRecordMetabolic(input.actor.role)) throw new Error("Only a prescriber can record metabolic measures.");
  const p = patientOf(input.patientId);
  const ok = (n: number, lo: number, hi: number) => Number.isFinite(n) && n >= lo && n <= hi;
  if (!ok(input.bpSystolic, 60, 260) || !ok(input.bpDiastolic, 30, 160)) throw new Error("Enter a valid blood pressure.");
  if (!ok(input.weightKg, 20, 400)) throw new Error("Enter a valid weight.");
  if (!ok(input.heightCm, 100, 230)) throw new Error("Enter a valid height.");
  const m: MetabolicSet = {
    id: uid(),
    patientId: p.id,
    at: input.at ?? new Date().toISOString(),
    bpSystolic: input.bpSystolic,
    bpDiastolic: input.bpDiastolic,
    weightKg: input.weightKg,
    heightCm: input.heightCm,
    bmi: computeBmi(input.weightKg, input.heightCm),
    recordedBy: input.actor.name,
  };
  metabolic.push(m);
  audit("metabolic", "metabolic_recorded", p.id, input.actor, { id: m.id });
  return m;
}
export function listMetabolic(patientId: string): MetabolicSet[] {
  return metabolic.filter((m) => m.patientId === patientId).sort((a, b) => +new Date(a.at) - +new Date(b.at));
}

// ---------------------------------------------------------------- demo seed
export function seedChartOrdersDemo(): void {
  const find = (n: string) => AdelanteEHR.listPatients().find((p) => p.firstName === n);
  const bagga = { name: "Dr. M. Bagga", role: "physician" };
  const luis = find("Luis");
  if (luis && !labs.some((o) => o.patientId === luis.id)) {
    const li = placeLabOrder({ patientId: luis.id, testId: "lithium", reason: "Lithium maintenance — trough level", priority: "routine", dueAt: new Date(Date.now() - 10 * DAY).toISOString(), actor: bagga, at: new Date(Date.now() - 14 * DAY).toISOString() });
    enterLabResult({ orderId: li.id, value: "0.8", flag: "normal", date: new Date(Date.now() - 9 * DAY).toISOString().slice(0, 10), actor: bagga });
    placeLabOrder({ patientId: luis.id, testId: "a1c", reason: "Metabolic monitoring on antipsychotic", priority: "routine", dueAt: new Date(Date.now() + 5 * DAY).toISOString(), actor: bagga });
  }
  const marcus = find("Marcus");
  if (marcus && !metabolic.some((m) => m.patientId === marcus.id)) {
    recordMetabolic({ patientId: marcus.id, bpSystolic: 134, bpDiastolic: 86, weightKg: 98, heightCm: 180, actor: bagga, at: new Date(Date.now() - 2 * DAY).toISOString() });
  }
  const jordan = find("Jordan");
  if (jordan && !screenerRequests.some((r) => r.patientId === jordan.id)) {
    requestScreener({ patientId: jordan.id, key: "gad-7", actor: { name: "Marisol Reyes", role: "therapist" } });
  }
}

export function _resetChartOrders() {
  labs.length = 0;
  screenerRequests.length = 0;
  metabolic.length = 0;
}
