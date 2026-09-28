// §Chart redesign — single action registry. Source of truth for every chart
// "create / act" action. Each `allowed()` calls the SAME function-level check
// the store enforces; it never re-types a role list of its own.
import { AdelanteEHR, APPT_REQUEST_BOOKING_ROLES, REFILL_PRESCRIBER_ROLES, type Patient } from "@/lib/ehr";
import { canAccess, canFlagCrisis, getStaffMember, isPrescriberRole, type RecordClass, type StaffRole } from "@/lib/roles";
import { roleSeesAsamSection } from "@/lib/asamReporting";
import { ASAM_AUTHOR_ROLES, asamNeedsCosign } from "@/lib/asam";
import { canSignNotes } from "@/lib/notes";
import { ADDENDUM_ROLES } from "@/lib/noteRevisions";
import { editableDemographicFields } from "@/lib/demographics";
import { canEditPlan, PLAN_COSIGN_ROLES } from "@/lib/structuredCarePlan";
import { canOrderLabs, canRecordMetabolic, canRequestScreener } from "@/lib/chartOrders";
import { EPISODE_ROLES, HLOC_REFERRAL_ROLES } from "@/lib/outpatientCare";
import { canUseCaseloadReview } from "@/lib/caseloadRoles";

export type ChartActionGroup = "document" | "clinical" | "care" | "coordination";
export type ChartActionState = "allowed" | "cosign" | "hidden";
export interface ChartActionAnswer {
  state: ChartActionState;
  reason?: string;
}
export interface ChartActor {
  role: StaffRole;
  staffId?: string;
  clinicianId?: string;
}

export interface ChartAction {
  id: string;
  label: { en: string; es: string };
  group: ChartActionGroup;
  /** Chart section this action lives in (used for section visibility). */
  sectionId?: string;
  /** Store function the action calls. */
  store: string;
  /** Not built yet (lab order, screener request — chart redesign turn 2). */
  pending?: boolean;
  allowed: (actor: ChartActor, patient?: Patient) => ChartActionAnswer;
}

const ok = (): ChartActionAnswer => ({ state: "allowed" });
const cosign = (reason: string): ChartActionAnswer => ({ state: "cosign", reason });
const hide = (reason: string): ChartActionAnswer => ({ state: "hidden", reason });
const writes = (role: StaffRole, cls: RecordClass, p?: Patient) => {
  const a = canAccess(role, cls, p);
  return a.level === "write" && !a.locked;
};
const inList = (list: readonly string[], role: string) => list.includes(role);
/** "Routes to [supervisor name] for cosign" — the acting person's supervisor. */
export function cosignRouteLabel(staffId?: string): string {
  const sup = getStaffMember(getStaffMember(staffId)?.supervisedBy);
  return sup ? `Routes to ${sup.name} for cosign` : "Routes to a cosigner";
}

export const CHART_ACTIONS: ChartAction[] = [
  {
    id: "progress_note",
    label: { en: "Progress note", es: "Nota de progreso" },
    group: "document",
    sectionId: "notes",
    store: "AdelanteEHR.addProgressNote / signProgressNote",
    allowed: ({ role, staffId }, p) => {
      const canWrite = (["therapy_notes", "case_notes", "chw_notes", "peer_notes"] as RecordClass[]).some((c) =>
        writes(role, c, p),
      );
      if (canSignNotes(role)) return ok();
      if (canWrite) return cosign(cosignRouteLabel(staffId));
      return hide("Your role doesn't write notes.");
    },
  },
  {
    id: "addendum",
    label: { en: "Addendum", es: "Adenda" },
    group: "document",
    sectionId: "notes",
    store: "AdelanteEHR.addNoteAddendum",
    allowed: ({ role }) =>
      inList(ADDENDUM_ROLES, role) ? ok() : hide("Only the author or a treating clinician can add an addendum."),
  },
  {
    id: "med_order",
    label: { en: "Medication order", es: "Orden de medicamento" },
    group: "clinical",
    sectionId: "orders",
    store: "AdelanteEHR.addDraftOrder / signOrders",
    allowed: ({ role }) => (isPrescriberRole(role) ? ok() : hide("Only a prescriber can order medications.")),
  },
  {
    id: "refill_decision",
    label: { en: "Refill decision", es: "Decisión de resurtido" },
    group: "clinical",
    sectionId: "orders",
    store: "AdelanteEHR.reviewRefill",
    allowed: ({ role }) =>
      inList(REFILL_PRESCRIBER_ROLES, role) ? ok() : hide("Only a prescriber (physician or PMHNP) can review a refill."),
  },
  {
    id: "cures",
    label: { en: "CURES check", es: "Revisión de CURES" },
    group: "clinical",
    sectionId: "orders",
    store: "AdelanteEHR.recordCuresCheck / recordRefillCuresCheck",
    allowed: ({ role }) =>
      inList(REFILL_PRESCRIBER_ROLES, role) ? ok() : hide("Only a prescriber can record a CURES check."),
  },
  {
    id: "lab_order",
    label: { en: "Lab order", es: "Orden de laboratorio" },
    group: "clinical",
    sectionId: "orders",
    store: "placeLabOrder",
    allowed: ({ role }) => (canOrderLabs(role) ? ok() : hide("Only a prescriber can order labs.")),
  },
  {
    id: "screener_request",
    label: { en: "Request a screener", es: "Pedir un cuestionario" },
    group: "clinical",
    sectionId: "tracking",
    store: "requestScreener",
    allowed: ({ role }, p) => (canRequestScreener(role, p) ? ok() : hide("Your role doesn't request screeners.")),
  },
  {
    id: "metabolic",
    label: { en: "Metabolic measures", es: "Medidas metabólicas" },
    group: "clinical",
    sectionId: "tracking",
    store: "recordMetabolic",
    allowed: ({ role }) => (canRecordMetabolic(role) ? ok() : hide("Only a prescriber records metabolic measures.")),
  },
  {
    id: "asam",
    label: { en: "ASAM assessment", es: "Evaluación ASAM" },
    group: "clinical",
    sectionId: "asam",
    store: "AdelanteEHR ASAM draft / signAsam",
    allowed: ({ role, staffId }, p) => {
      if (!roleSeesAsamSection(role, p)) return hide("Not available for your role.");
      if (!inList(ASAM_AUTHOR_ROLES, role)) return hide("Your role can view, not author, an ASAM.");
      return asamNeedsCosign(role) ? cosign(cosignRouteLabel(staffId)) : ok();
    },
  },
  {
    id: "care_plan_goal",
    label: { en: "Care plan goal", es: "Meta del plan" },
    group: "care",
    sectionId: "care-plan",
    store: "addStructuredGoal",
    allowed: ({ role, staffId }) =>
      !canEditPlan(role)
        ? hide("Your role can't change the care plan.")
        : inList(PLAN_COSIGN_ROLES, role)
          ? cosign(cosignRouteLabel(staffId))
          : ok(),
  },
  {
    id: "activity_assignment",
    label: { en: "Assign activity", es: "Asignar actividad" },
    group: "care",
    sectionId: "care-plan",
    store: "assignToGoal",
    allowed: ({ role, staffId }) =>
      !canEditPlan(role)
        ? hide("Your role can't change the care plan.")
        : inList(PLAN_COSIGN_ROLES, role)
          ? cosign(cosignRouteLabel(staffId))
          : ok(),
  },
  {
    id: "sdoh_referral",
    label: { en: "SDOH referral", es: "Referido de necesidades" },
    group: "care",
    sectionId: "episodes",
    store: "AdelanteEHR.addResourceReferral",
    allowed: ({ role }, p) => (writes(role, "sdoh", p) ? ok() : hide("Your role can't make SDOH referrals.")),
  },
  {
    id: "hloc_referral",
    label: { en: "Higher-level referral", es: "Referido a nivel mayor" },
    group: "care",
    sectionId: "episodes",
    store: "createHlocReferral",
    allowed: ({ role }) => (inList(HLOC_REFERRAL_ROLES, role) ? ok() : hide("Your role can't create a clinical referral.")),
  },
  {
    id: "schedule_visit",
    label: { en: "Schedule visit", es: "Programar cita" },
    group: "coordination",
    sectionId: "appointments",
    store: "AdelanteEHR.bookAppointment",
    allowed: ({ role }) =>
      inList(AdelanteEHR.appointmentActionRoles(), role) ? ok() : hide("Your role does not book visits."),
  },
  {
    id: "message_patient",
    label: { en: "Message patient", es: "Mensaje al paciente" },
    group: "coordination",
    sectionId: "messages",
    store: "AdelanteEHR.sendStaffMessage",
    allowed: ({ role }, p) => (writes(role, "patient_messaging", p) ? ok() : hide("Your role can't message patients.")),
  },
  {
    id: "task",
    label: { en: "Task", es: "Tarea" },
    group: "coordination",
    sectionId: "tasks",
    store: "AdelanteEHR.createCaseTask",
    allowed: ({ role }, p) => (writes(role, "case_notes", p) ? ok() : hide("Your role can't add tasks.")),
  },
  {
    id: "document_upload",
    label: { en: "Upload document", es: "Subir documento" },
    group: "document",
    store: "AdelanteEHR.uploadPatientDocument",
    allowed: ({ role }, p) => (writes(role, "documents", p) ? ok() : hide("Your role can't upload documents.")),
  },
  {
    id: "consent_capture",
    label: { en: "Capture consent", es: "Registrar consentimiento" },
    group: "document",
    store: "AdelanteEHR consent ledger",
    allowed: ({ role }, p) => (writes(role, "consent_ledger", p) ? ok() : hide("Your role can't capture consents.")),
  },
  {
    id: "contact_log",
    label: { en: "Log contact", es: "Registrar contacto" },
    group: "coordination",
    store: "logContact",
    allowed: ({ role }) =>
      canUseCaseloadReview(role) ? ok() : hide("Only case managers and ECM providers can log contacts."),
  },
  {
    id: "crisis_flag",
    label: { en: "Raise crisis flag", es: "Marcar crisis" },
    group: "clinical",
    sectionId: "alerts",
    store: "AdelanteEHR.flagCrisis",
    allowed: ({ role }) => (canFlagCrisis(role) ? ok() : hide("Your role has no patient contact.")),
  },
  {
    id: "discharge_episode",
    label: { en: "Discharge episode", es: "Dar de alta" },
    group: "care",
    sectionId: "episodes",
    store: "dischargeEpisode",
    allowed: ({ role }) => (inList(EPISODE_ROLES, role) ? ok() : hide("Your role can't discharge an episode.")),
  },
  {
    id: "demographics_edit",
    label: { en: "Edit demographics", es: "Editar datos" },
    group: "coordination",
    sectionId: "contact",
    store: "AdelanteEHR.updatePatientDemographics",
    allowed: ({ role, staffId, clinicianId }, p) => {
      const isPrimary = !!p?.primaryClinicianId && [staffId, clinicianId].includes(p.primaryClinicianId);
      return editableDemographicFields(role, isPrimary).length
        ? ok()
        : hide("Your role can't edit this patient's details.");
    },
  },
];

// Keep the booking list import referenced (store-side list behind appointmentActionRoles).
void APPT_REQUEST_BOOKING_ROLES;

export function chartAction(id: string): ChartAction {
  const a = CHART_ACTIONS.find((x) => x.id === id);
  if (!a) throw new Error(`Unknown chart action: ${id}`);
  return a;
}

export function chartActionState(id: string, actor: ChartActor, patient?: Patient): ChartActionAnswer {
  return chartAction(id).allowed(actor, patient);
}

export const canDoChartAction = (id: string, actor: ChartActor, patient?: Patient) =>
  chartActionState(id, actor, patient).state !== "hidden";

/** Any non-pending action in this section is available to the actor. */
export function sectionHasAction(sectionId: string, actor: ChartActor, patient?: Patient): boolean {
  return CHART_ACTIONS.some(
    (a) => a.sectionId === sectionId && !a.pending && a.allowed(actor, patient).state !== "hidden",
  );
}
