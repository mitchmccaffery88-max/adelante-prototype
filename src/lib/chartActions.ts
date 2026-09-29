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
import { placeLabOrder, requestScreener, recordMetabolic } from "@/lib/chartOrders";
import { addStructuredGoal, assignToGoal } from "@/lib/structuredCarePlan";
import { createHlocReferral, dischargeEpisode } from "@/lib/outpatientCare";
import { logContact } from "@/lib/caseloadReview";
import { acceptNoteDraft, sendOutreach } from "@/lib/adelDrafts";
import { AdelanteEHRExt } from "@/lib/ehr-ext";
import { checkEligibility } from "@/lib/eligibility/eligibility";
import type { FeatureId } from "@/lib/features";

/** Bumped whenever an action, its check or its store function changes. Recorded on every standard event. */
export const REGISTRY_VERSION = "2026-09-29.e1";

export type ChartActionGroup = "document" | "clinical" | "care" | "coordination" | "visit" | "billing" | "admin";
/** Groups shown in the chart / dashboard "+ New" menus. Visit, billing and admin actions run from their own screens. */
export const MENU_GROUPS: readonly ChartActionGroup[] = ["document", "clinical", "care", "coordination"];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type StoreFn = (...args: any[]) => unknown;
export interface StoreRef {
  name: string;
  fn: StoreFn;
}
function refs(...list: [string, StoreFn][]): StoreRef[] {
  return list.map(([name, fn]) => ({ name, fn }));
}
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
  /** Store function(s) the action calls, by reference. The first is the default; runAction picks another with `input.via`. */
  store: StoreRef[];
  /** Name of the check `allowed()` delegates to (shown in Permissions & features). */
  check?: string;
  /** Feature flags this action depends on. */
  flags?: FeatureId[];
  /** Not shown in the "+ New" menus (runs from its own screen). */
  menu?: false;
  /** Not built yet (lab order, screener request — chart redesign turn 2). */
  pending?: boolean;
  /** False for dashboard actions that can begin without a patient context. */
  needsPatient?: boolean;
  /** The store only simulates the work (no live connection) — the audit records `simulated: true`. */
  simulated?: boolean;
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
    store: refs(["addProgressNote", (...a: any[]) => (AdelanteEHR.addProgressNote as any)(...a)], ["acceptNoteDraft", (...a: any[]) => (acceptNoteDraft as any)(...a)], ["signProgressNote", (...a: any[]) => (AdelanteEHR.signProgressNote as any)(...a)]),
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
    store: refs(["addNoteAddendum", (...a: any[]) => (AdelanteEHR.addNoteAddendum as any)(...a)]),
    allowed: ({ role }) =>
      inList(ADDENDUM_ROLES, role) ? ok() : hide("Only the author or a treating clinician can add an addendum."),
  },
  {
    id: "med_order",
    label: { en: "Medication order", es: "Orden de medicamento" },
    group: "clinical",
    sectionId: "orders",
    store: refs(["addDraftOrder", (...a: any[]) => (AdelanteEHR.addDraftOrder as any)(...a)], ["signOrders", (...a: any[]) => (AdelanteEHR.signOrders as any)(...a)]),
    allowed: ({ role }) => (isPrescriberRole(role) ? ok() : hide("Only a prescriber can order medications.")),
  },
  {
    id: "refill_decision",
    label: { en: "Refill decision", es: "Decisión de resurtido" },
    group: "clinical",
    sectionId: "orders",
    flags: ["cures_placeholder"],
    store: refs(["reviewRefill", (...a: any[]) => (AdelanteEHR.reviewRefill as any)(...a)]),
    allowed: ({ role }) =>
      inList(REFILL_PRESCRIBER_ROLES, role) ? ok() : hide("Only a prescriber (physician or PMHNP) can review a refill."),
  },
  {
    id: "cures",
    label: { en: "CURES check", es: "Revisión de CURES" },
    group: "clinical",
    sectionId: "orders",
    flags: ["cures_placeholder"],
    store: refs(["recordCuresCheck", (...a: any[]) => (AdelanteEHR.recordCuresCheck as any)(...a)], ["recordRefillCuresCheck", (...a: any[]) => (AdelanteEHR.recordRefillCuresCheck as any)(...a)]),
    allowed: ({ role }) =>
      inList(REFILL_PRESCRIBER_ROLES, role) ? ok() : hide("Only a prescriber can record a CURES check."),
  },
  {
    id: "lab_order",
    label: { en: "Lab order", es: "Orden de laboratorio" },
    group: "clinical",
    sectionId: "orders",
    flags: ["placeholder_lab"],
    store: refs(["placeLabOrder", (...a: any[]) => (placeLabOrder as any)(...a)]),
    allowed: ({ role }) => (canOrderLabs(role) ? ok() : hide("Only a prescriber can order labs.")),
  },
  {
    id: "screener_request",
    label: { en: "Request a screener", es: "Pedir un cuestionario" },
    group: "clinical",
    sectionId: "tracking",
    store: refs(["requestScreener", (...a: any[]) => (requestScreener as any)(...a)]),
    allowed: ({ role }, p) => (canRequestScreener(role, p) ? ok() : hide("Your role doesn't request screeners.")),
  },
  {
    id: "metabolic",
    label: { en: "Metabolic measures", es: "Medidas metabólicas" },
    group: "clinical",
    sectionId: "tracking",
    store: refs(["recordMetabolic", (...a: any[]) => (recordMetabolic as any)(...a)]),
    allowed: ({ role }) => (canRecordMetabolic(role) ? ok() : hide("Only a prescriber records metabolic measures.")),
  },
  {
    id: "asam",
    label: { en: "ASAM assessment", es: "Evaluación ASAM" },
    group: "clinical",
    sectionId: "asam",
    store: refs(["asamPanel", () => undefined]),
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
    store: refs(["addStructuredGoal", (...a: any[]) => (addStructuredGoal as any)(...a)]),
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
    store: refs(["assignToGoal", (...a: any[]) => (assignToGoal as any)(...a)]),
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
    store: refs(["addResourceReferral", (...a: any[]) => (AdelanteEHR.addResourceReferral as any)(...a)]),
    allowed: ({ role }, p) => (writes(role, "sdoh", p) ? ok() : hide("Your role can't make SDOH referrals.")),
  },
  {
    id: "hloc_referral",
    label: { en: "Higher-level referral", es: "Referido a nivel mayor" },
    group: "care",
    sectionId: "episodes",
    store: refs(["createHlocReferral", (...a: any[]) => (createHlocReferral as any)(...a)]),
    allowed: ({ role }) => (inList(HLOC_REFERRAL_ROLES, role) ? ok() : hide("Your role can't create a clinical referral.")),
  },
  {
    id: "schedule_visit",
    label: { en: "Schedule visit", es: "Programar cita" },
    group: "coordination",
    sectionId: "appointments",
    store: refs(["bookAppointment", (...a: any[]) => (AdelanteEHR.bookAppointment as any)(...a)]),
    allowed: ({ role }) =>
      inList(AdelanteEHR.appointmentActionRoles(), role) ? ok() : hide("Your role does not book visits."),
  },
  {
    id: "message_patient",
    label: { en: "Message patient", es: "Mensaje al paciente" },
    group: "coordination",
    sectionId: "messages",
    store: refs(["sendStaffMessage", (...a: any[]) => (AdelanteEHR.sendStaffMessage as any)(...a)], ["sendOutreach", (...a: any[]) => (sendOutreach as any)(...a)]),
    allowed: ({ role }, p) => (writes(role, "patient_messaging", p) ? ok() : hide("Your role can't message patients.")),
  },
  {
    id: "task",
    label: { en: "Task", es: "Tarea" },
    group: "coordination",
    sectionId: "tasks",
    store: refs(["createCaseTask", (...a: any[]) => (AdelanteEHR.createCaseTask as any)(...a)]),
    allowed: ({ role }, p) => (writes(role, "case_notes", p) ? ok() : hide("Your role can't add tasks.")),
  },
  {
    id: "document_upload",
    label: { en: "Upload document", es: "Subir documento" },
    group: "document",
    store: refs(["uploadPatientDocument", (...a: any[]) => (AdelanteEHR.uploadPatientDocument as any)(...a)]),
    allowed: ({ role }, p) => (writes(role, "documents", p) ? ok() : hide("Your role can't upload documents.")),
  },
  {
    id: "consent_capture",
    label: { en: "Capture consent", es: "Registrar consentimiento" },
    group: "document",
    sectionId: "advocates",
    store: refs(["consentLedger", () => undefined]),
    allowed: ({ role }, p) => (writes(role, "consent_ledger", p) ? ok() : hide("Your role can't capture consents.")),
  },
  {
    id: "contact_log",
    label: { en: "Log contact", es: "Registrar contacto" },
    group: "coordination",
    store: refs(["logContact", (...a: any[]) => (logContact as any)(...a)]),
    allowed: ({ role }) =>
      canUseCaseloadReview(role) ? ok() : hide("Only case managers and ECM providers can log contacts."),
  },
  {
    id: "crisis_flag",
    label: { en: "Raise crisis flag", es: "Marcar crisis" },
    group: "clinical",
    sectionId: "alerts",
    store: refs(["flagCrisis", (...a: any[]) => (AdelanteEHR.flagCrisis as any)(...a)]),
    allowed: ({ role }) => (canFlagCrisis(role) ? ok() : hide("Your role has no patient contact.")),
  },
  {
    id: "discharge_episode",
    label: { en: "Discharge episode", es: "Dar de alta" },
    group: "care",
    sectionId: "episodes",
    store: refs(["dischargeEpisode", (...a: any[]) => (dischargeEpisode as any)(...a)]),
    allowed: ({ role }) => (inList(EPISODE_ROLES, role) ? ok() : hide("Your role can't discharge an episode.")),
  },
  {
    id: "demographics_edit",
    label: { en: "Edit demographics", es: "Editar datos" },
    group: "coordination",
    sectionId: "contact",
    store: refs(["updatePatientDemographics", (...a: any[]) => (AdelanteEHR.updatePatientDemographics as any)(...a)]),
    allowed: ({ role, staffId, clinicianId }, p) => {
      const isPrimary = !!p?.primaryClinicianId && [staffId, clinicianId].includes(p.primaryClinicianId);
      return editableDemographicFields(role, isPrimary).length
        ? ok()
        : hide("Your role can't edit this patient's details.");
    },
  },
  {
    id: "dashboard_task",
    label: { en: "Task for me / my team", es: "Tarea para mí / mi equipo" },
    group: "coordination",
    store: refs(["createCaseTask", (...a: any[]) => (AdelanteEHR.createCaseTask as any)(...a)]),
    needsPatient: false,
    allowed: ({ role }) => {
      const useful = canAccess(role, "case_notes").level !== "none" || canAccess(role, "care_coordination").level !== "none";
      return useful ? ok() : hide("Your role doesn't create clinical tasks.");
    },
  },
  {
    id: "dashboard_book",
    label: { en: "Book a visit", es: "Programar una cita" },
    group: "coordination",
    store: refs(["bookAppointment", (...a: any[]) => (AdelanteEHR.bookAppointment as any)(...a)]),
    needsPatient: false,
    allowed: ({ role }) => inList(AdelanteEHR.appointmentActionRoles(), role) ? ok() : hide("Your role does not book visits."),
  },
  {
    id: "dashboard_contact",
    label: { en: "Log contact", es: "Registrar contacto" },
    group: "coordination",
    store: refs(["logContact", (...a: any[]) => (logContact as any)(...a)]),
    needsPatient: false,
    allowed: ({ role }) => canUseCaseloadReview(role) ? ok() : hide("Only case managers and ECM providers can log contacts."),
  },
  {
    id: "dashboard_referral",
    label: { en: "Referral from resource directory", es: "Referencia del directorio de recursos" },
    group: "care",
    store: refs(["addResourceReferral", (...a: any[]) => (AdelanteEHR.addResourceReferral as any)(...a)]),
    needsPatient: false,
    allowed: ({ role }) => writes(role, "sdoh") ? ok() : hide("Your role can't make SDOH referrals."),
  },
  // ---- §Batch D — visit actions (dashboard schedule / Needs my action) ----
  ...visitActions(),
  // ---- §Batch D — billing actions (hidden from "+ New" until turn 6) ----
  {
    id: "claim_correct",
    label: { en: "Correct claim", es: "Corregir reclamo" },
    group: "billing",
    menu: false,
    check: "canAccess(billing) = write",
    store: refs(["correctClaim", (...a: any[]) => (AdelanteEHRExt.correctClaim as any)(...a)]),
    needsPatient: false,
    allowed: ({ role }) => (writes(role, "billing") ? ok() : hide("Only billing staff can change claims.")),
  },
  {
    id: "claim_status",
    label: { en: "Change claim status", es: "Cambiar estado del reclamo" },
    group: "billing",
    menu: false,
    check: "canAccess(billing) = write",
    store: refs(["transitionClaim", (...a: any[]) => (AdelanteEHRExt.transitionClaim as any)(...a)]),
    needsPatient: false,
    allowed: ({ role }) => (writes(role, "billing") ? ok() : hide("Only billing staff can change claims.")),
  },
  {
    id: "payment_record",
    label: { en: "Record payment", es: "Registrar pago" },
    group: "billing",
    menu: false,
    check: "canAccess(billing) = write",
    store: refs(["recordPatientPayment", (...a: any[]) => (AdelanteEHRExt.recordPatientPayment as any)(...a)]),
    allowed: ({ role }) => (writes(role, "billing") ? ok() : hide("Only billing staff can record payments.")),
  },
  {
    id: "payment_void",
    label: { en: "Void payment", es: "Anular pago" },
    group: "billing",
    menu: false,
    check: "canAccess(billing) = write",
    store: refs(["voidPatientPayment", (...a: any[]) => (AdelanteEHRExt.voidPatientPayment as any)(...a)]),
    allowed: ({ role }) => (writes(role, "billing") ? ok() : hide("Only billing staff can void payments.")),
  },
  {
    id: "payment_arrangement",
    label: { en: "Payment arrangement", es: "Acuerdo de pago" },
    group: "billing",
    menu: false,
    check: "canAccess(billing) = write",
    store: refs(["setPaymentArrangement", (...a: any[]) => (AdelanteEHRExt.setPaymentArrangement as any)(...a)]),
    allowed: ({ role }) => (writes(role, "billing") ? ok() : hide("Only billing staff can set payment arrangements.")),
  },
  {
    id: "eligibility_check",
    simulated: true,
    label: { en: "Eligibility check", es: "Verificar elegibilidad" },
    group: "billing",
    menu: false,
    check: "canAccess(eligibility) = write",
    store: refs(["checkEligibility", (...a: any[]) => (checkEligibility as any)(...a)]),
    allowed: ({ role }, p) => {
      const a = canAccess(role, "eligibility", p);
      return a.level === "write" && !a.locked ? ok() : hide("Your role can't check coverage.");
    },
  },
  {
    id: "isl_export",
    label: { en: "ISL export", es: "Exportar ISL" },
    group: "billing",
    menu: false,
    check: "canAccess(billing) ≥ read",
    store: refs(["exportIslReport", (...a: any[]) => (AdelanteEHR.exportIslReport as any)(...a)]),
    needsPatient: false,
    allowed: ({ role }) => (canAccess(role, "billing").level !== "none" ? ok() : hide("Your role can't export billing reports.")),
  },
  // ---- §Batch D — admin actions (hidden from "+ New" until turn 6) ----
  ...(["create", "update", "activate", "clone"] as const).map((k): ChartAction => ({
    id: `note_template_${k}`,
    label: {
      en: { create: "Create note template", update: "Update note template", activate: "Activate / deactivate note template", clone: "Clone note template" }[k],
      es: { create: "Crear plantilla", update: "Actualizar plantilla", activate: "Activar / desactivar plantilla", clone: "Copiar plantilla" }[k],
    },
    group: "admin",
    menu: false,
    needsPatient: false,
    check: k === "clone" ? "canAccess(note_templates) ≥ read" : "canAccess(note_templates) = write",
    store: {
      create: refs(["createNoteTemplate", (...a: any[]) => (AdelanteEHR.createNoteTemplate as any)(...a)]),
      update: refs(["updateNoteTemplate", (...a: any[]) => (AdelanteEHR.updateNoteTemplate as any)(...a)]),
      activate: refs(["setNoteTemplateActive", (...a: any[]) => (AdelanteEHR.setNoteTemplateActive as any)(...a)]),
      clone: refs(["cloneNoteTemplateToPersonal", (...a: any[]) => (AdelanteEHR.cloneNoteTemplateToPersonal as any)(...a)]),
    }[k],
    allowed: ({ role }) =>
      k === "clone"
        ? canAccess(role, "note_templates").level !== "none" ? ok() : hide("Your role can't use note templates.")
        : writes(role, "note_templates") ? ok() : hide("Only template administrators can change note templates."),
  })),
  ...(["save", "deactivate", "run"] as const).map((k): ChartAction => ({
    id: `scheduling_rule_${k}`,
    label: {
      en: { save: "Save scheduling rule", deactivate: "Deactivate scheduling rule", run: "Run scheduling rules" }[k],
      es: { save: "Guardar regla", deactivate: "Desactivar regla", run: "Ejecutar reglas" }[k],
    },
    group: "admin",
    menu: false,
    needsPatient: false,
    check: "canAccess(scheduling_rules) = write",
    store: {
      save: refs(["saveSchedulingRule", (...a: any[]) => (AdelanteEHR.saveSchedulingRule as any)(...a)], ["reactivateSchedulingRule", (...a: any[]) => (AdelanteEHR.reactivateSchedulingRule as any)(...a)]),
      deactivate: refs(["deactivateSchedulingRule", (...a: any[]) => (AdelanteEHR.deactivateSchedulingRule as any)(...a)]),
      run: refs(["runSchedulingRulesNow", (...a: any[]) => (AdelanteEHR.runSchedulingRulesNow as any)(...a)]),
    }[k],
    allowed: ({ role }) => (writes(role, "scheduling_rules") ? ok() : hide("Only administrators can change scheduling rules.")),
  })),
  {
    id: "notification_resend",
    label: { en: "Resend notification", es: "Reenviar notificación" },
    group: "admin",
    menu: false,
    check: "canAccess(population_health) = write",
    store: refs(["resendNotification", (...a: any[]) => (AdelanteEHR.resendNotification as any)(...a)]),
    allowed: ({ role }) => (writes(role, "population_health") ? ok() : hide("Only program administrators can resend notifications.")),
  },
];

function visitActions(): ChartAction[] {
  const visitCheck = ({ role }: ChartActor) =>
    inList(AdelanteEHR.appointmentActionRoles(), role) ? ok() : hide("Your role does not manage visits.");
  const mk = (id: string, en: string, es: string, name: string, fn: StoreFn): ChartAction => ({
    id,
    label: { en, es },
    group: "visit",
    menu: false,
    sectionId: "appointments",
    check: "appointmentActionRoles",
    store: refs([name, fn]),
    allowed: visitCheck,
  });
  return [
    mk("visit_check_in", "Check in", "Registrar llegada", "checkInAppointment", (...a: any[]) => (AdelanteEHR.checkInAppointment as any)(...a)),
    mk("visit_attended", "Mark attended", "Marcar asistida", "markAppointmentAttended", (...a: any[]) => (AdelanteEHR.markAppointmentAttended as any)(...a)),
    mk("visit_no_show", "Mark no-show", "Marcar no asistió", "markAppointmentNoShow", (...a: any[]) => (AdelanteEHR.markAppointmentNoShow as any)(...a)),
    {
      id: "rescreen_send",
      label: { en: "Send re-screen", es: "Enviar re-evaluación" },
      group: "visit",
      menu: false,
      sectionId: "tracking",
      check: "canRequestScreener",
      store: refs(["sendRescreenTask", (...a: any[]) => (AdelanteEHR.sendRescreenTask as any)(...a)]),
      allowed: ({ role }, p) => (canRequestScreener(role, p) ? ok() : hide("Your role doesn't request screeners.")),
    },
  ];
}

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
