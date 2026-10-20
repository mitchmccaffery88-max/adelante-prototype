// One allowlisted projection for chart, search, export and agentic summaries.
// No raw Patient, screener answers, ASAM worksheets, group narrative or task text.
import { AdelanteEHR, type Patient, type ProgressNote } from "./ehr";
import { canAccess, getActingStaff } from "./roles";
import { getStructuredPlan } from "./structuredCarePlan";
import { listLabOrders } from "./chartOrders";
import { listEpisodes } from "./outpatientCare";
import { listSelfReports } from "./medAdherence";
import { isSudMedication } from "./sudMedClassifier";
import { coordinatorNoteCanRead, coordinatorSudCanRead, type SudViewer } from "./coordinatorSudAccess";

export const actingSudViewer = (): SudViewer => {
  const staff = getActingStaff();
  return { role: staff?.role ?? "clinical_coordinator", staffId: staff?.id, name: staff?.name };
};
export function coordinatorNoteProjection(note: ProgressNote) {
  return { id: note.id, date: note.date, category: note.category, restrictedTier: note.restrictedTier,
    subjective: note.subjective, objective: note.objective, assessment: note.assessment, plan: note.plan };
}
export function coordinatorSudView(patient: Patient, viewer: SudViewer, now = Date.now()) {
  const b = coordinatorSudCanRead(viewer, patient, "diagnoses", now);
  const orders = b ? AdelanteEHR.listOrders(patient.id).filter(isSudMedication) : [];
  const ids = new Set(orders.map((o) => o.id));
  const plan = b ? getStructuredPlan(patient.id) : undefined;
  const notes = (patient.progressNotes ?? []).filter((n) => coordinatorNoteCanRead(viewer, patient, n, now));
  return {
    diagnoses: b ? AdelanteEHR.listProblems(patient.id).filter((p) => p.category === "sud").map((p) => ({ id: p.id, description: p.description, code: p.icd10Code, status: p.status })) : [],
    treatmentPlans: plan ? plan.goals.filter((g) => g.sud).map((g) => ({ id: g.id, text: g.clinicalText, status: g.status, measure: g.measure, interventions: g.interventions, targetDate: g.targetDate })) : [],
    medications: orders.map((o) => ({ id: o.id, name: o.drugName, dose: o.dose ?? o.manualDose, sig: o.sigOverride ?? o.sig, frequency: o.frequency, status: o.status })),
    adherence: b ? [
      ...AdelanteEHR.listAdministrations(patient.id).filter((d) => ids.has(d.orderId) && !d.voided).map((d) => ({ id: d.id, orderId: d.orderId, at: d.scheduledAt, status: d.action, source: "Charted" })),
      ...listSelfReports(patient.id).filter((d) => ids.has(d.orderId)).map((d) => ({ id: d.id, orderId: d.orderId, at: d.scheduledAt, status: d.status, source: "Self-reported" })),
    ] : [],
    // Fetch from the existing fully-gated lab reader, then project results only.
    labs: b ? listLabOrders(patient.id, "pmhnp").map((l) => ({ id: l.id, testId: l.testId, status: l.status, dueAt: l.dueAt, result: l.result ? { value: l.result.value, unit: l.result.unit, flag: l.result.flag, date: l.result.date } : undefined })) : [],
    attendance: b ? AdelanteEHR.appointmentsForPatient(patient.id).map((a) => ({ id: a.id, start: a.start, status: a.status, serviceType: a.serviceType })) : [],
    dischargeSummaries: b ? listEpisodes(patient.id).filter((e) => e.program === "outpatient_sud" && !!e.dischargeSummary).map((e) => ({ id: e.id, closedAt: e.closedAt, summary: e.dischargeSummary })) : [],
    progressNotes: notes.filter((n) => n.restrictedTier !== "psychotherapy_notes").map(coordinatorNoteProjection),
    counselingNotes: notes.filter((n) => n.restrictedTier === "psychotherapy_notes").map(coordinatorNoteProjection),
  };
}
export function auditCoordinatorSudView(viewer: SudViewer, patient: Patient, surface: string) {
  if (viewer.role !== "clinical_coordinator" || !viewer.staffId ||
      (!coordinatorSudCanRead(viewer, patient, "diagnoses") && !coordinatorSudCanRead(viewer, patient, "counseling_notes"))) return false;
  AdelanteEHR._recordAuditQuiet({ category: "access", action: "record.viewed", patientId: patient.id,
    actorId: viewer.staffId, actorRole: viewer.role, detail: { actorName: viewer.name ?? viewer.staffId, sectionId: "coordinator-minimum-necessary", kind: surface, simulated: true } });
  return true;
}
/** Shared by old note paths; no widening of the generic screeners_sud class. */
export function coordinatorAwareNoteGate(role: SudViewer["role"], patient: Patient | undefined, note: Partial<ProgressNote>, staffId?: string) {
  if (role !== "clinical_coordinator") return undefined;
  const viewer = { ...actingSudViewer(), role, ...(staffId ? { staffId } : {}) };
  const allowed = coordinatorNoteCanRead(viewer, patient, note);
  return { level: allowed ? "read" as const : "none" as const, locked: !allowed };
}