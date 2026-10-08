import { seedSimulatedContentSample } from "@/lib/contentAnalytics";
import { canBrowseContent } from "@/lib/contentStaff";
import { markContentReviewed } from "./contentPublishing";
import { patientSelfBook, patientReschedule, advocateReschedule, PATIENT_ACTOR_ROLE, ADVOCATE_ACTOR_ROLE } from "@/lib/patientBooking";
import { bookingRightFor, canScheduleRole } from "./bookingRights";
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
import { saveScreenerDraft } from "@/lib/screenerDrafts";
import { addStructuredGoal, assignToGoal } from "@/lib/structuredCarePlan";
import { acceptAsamSuggestion, dismissAsamSuggestion, editAsamSuggestion, markAsamGoalReviewed } from "@/lib/asamCarePlan";
import { canReviewSeverity, reviewSeverityFlag } from "@/lib/severityFlags";
import { createHlocReferral, dischargeEpisode } from "@/lib/outpatientCare";
import { logContact } from "@/lib/caseloadReview";
import { acceptNoteDraft, sendOutreach } from "@/lib/adelDrafts";
import { AdelanteEHRExt } from "@/lib/ehr-ext";
import { checkEligibility } from "@/lib/eligibility/eligibility";
import { setFeatureFlagWithReason, type FeatureId } from "@/lib/features";
import { exportClaimsCsv } from "@/lib/billingWorkspace";
import { mergePatients, reconfirmConsentAfterMerge, unmergePatients } from "@/lib/patientMerge";
import { canReviewMatches, linkAsRelated, markNotSamePerson } from "@/lib/patientMatching";
import { confirmMatch as confirmHieMatch, rejectMatch as rejectHieMatch } from "@/lib/dataExchange";
import { DATA_EXCHANGE_ROLES } from "@/lib/dataExchangeRoles";
import { canRunAssistedSignup } from "@/lib/roles";
import { canEditProviderRef, saveOrganization, saveProgram, saveSite } from "@/lib/providerReference";
import { canRecordCustodyDuration, recordCustodyDuration } from "@/lib/fspEligibility";
import { canRecordAfbi, decideAfbiLink, recordAfbiContact, requestAfbiLink } from "@/lib/afbiOutreach";
import { canViewCountyReporting, fixCountyError, generateReport, markTps, resendReport, seesClientLevel, sendTpsLink, setTpsWindow, simulateCountyResponse, submitReport, TPS_ADMIN_ROLES } from "@/lib/countyReporting";
import { canOverrideClassification, overrideServiceClassification } from "@/lib/serviceClassification";
import { addTimelyCorrection, canCorrectTimely, canRecordOffer, recordAppointmentOffer, recordServiceRequest } from "@/lib/timelyAccess";
import { administerClinicDose, canAdministerClinicMed, canCollectSpecimen, canCoordinateRefill, canCosignLvnDose, canNurseReview, canOrderClinicMed, canTriage, collectSpecimen, coordinateRefill, cosignClinicDose, nurseReviewOrder, orderClinicMedication, recordTriageCall } from "@/lib/nursing";
import { canEditPartnerDirectory, canLinkPartner, endPartnerLink, linkPartner, recordHandoff, savePartnerContact, savePartnerOrg } from "@/lib/carePartners";
import { canRecordExternalNtp, canReferToNtp, recordExternalNtpMedication, referToNtp } from "@/lib/ntpReferral";
import { acceptAiFollowUp, canCaptureScribe, canRecordAiConsent, confirmAiReview, deleteAiSentence, discardScribeSession, editAiSentence,
  setAiDraftVisitField, endScribeSession, canDictateScribe, createDictationDraft, pauseScribeSession, resumeScribeSession, saveAfbiFromScribe, grantAiRecordingConsent, keepAiSentence, openAiDraft, startScribeSession, withdrawAiRecordingConsent } from "@/lib/scribe";
import { assignReferralOwner, canAssignReferralOwner, canClaimChase, canFillChase, claimChaseTask, fillChaseField } from "@/lib/referralChase";
import { acknowledgeEscalation, canUseEscalations, handOffEscalation, isCoordinator as isEscalationCoordinator, reassignEscalation } from "@/lib/escalations";
import { canSetReleaseCoverage, setReleaseCoverageStatus, simulateEligibilityCheck } from "@/lib/coverageRelease";
import { addSiteClosedDay, addTimeOff, canEditSiteCalendar, canManageStaffCalendars, createSiteCalendarFromDefaults, markRescheduleHandled, removeSiteClosedDay, removeStaffHours, removeTimeOff, saveSiteHours, saveStaffHours, setExternalCalendarId } from "@/lib/workingCalendar";
import { calendarSync } from "@/lib/vendors/calendarSync";
import { addThreadParticipant, canMessageStaff, flagThreadSud, markMentionDone, markThreadRead, postThreadMessage, reopenStaffThread, resolveStaffThread, startStaffThread } from "@/lib/staffThreads";
import { addStaffMemberWithReason, deactivateStaffMember, reactivateStaffMember, updateStaffMember } from "@/lib/staffLifecycle";
import { canAuthorContent, canPublishContent, saveContentDraft, submitContentForReview, publishContent, returnContentForChanges, retireContent, discardContentDraft } from "@/lib/contentPublishing";
import { RESOURCE_VERIFIER_ROLES, updateResourceDetails, verifyResource, type VerifyInput } from "@/lib/communityResources";

/** Bumped whenever an action, its check or its store function changes. Recorded on every standard event. */
export const REGISTRY_VERSION = "2026-10-08.content-player";

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
  /** §Turn 6 — shown in the billing / admin / coordinator "+ New" (OpsActionLauncher). */
  opsMenu?: boolean;
  /** Shown disabled in "+ New" with this label (roadmap item, not built). */
  comingSoon?: string;
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
  { id: "content_simulated_sample", label: { en: "Load Simulated sample metrics", es: "Load Simulated sample metrics" }, group: "admin", menu: false, needsPatient: false, simulated: true, check: "canBrowseContent", store: refs(["seedSimulatedContentSample", seedSimulatedContentSample]), allowed: ({ role }) => canBrowseContent(role) ? ok() : hide("Content library access required.") },
  { id: "content_mark_reviewed", label: { en: "Mark content reviewed", es: "Marcar contenido revisado" }, group: "admin", menu: false, needsPatient: false, check: "canAuthorContent", store: refs(["markContentReviewed", markContentReviewed]), allowed: ({ role }) => canAuthorContent(role) ? ok() : hide("Content author access required.") },
  { id: "patient_lesson_response", label: { en: "Save lesson response", es: "Guardar respuesta" }, group: "care", menu: false, check: "patient self only", store: refs(["saveLessonResponse", AdelanteEHR.saveLessonResponse]), allowed: ({ role }, p) => role === PATIENT_ACTOR_ROLE && p?.id === AdelanteEHR.getCurrentPatientId() ? ok() : hide("Patient-only engagement action.") },
  { id: "patient_toolkit_save", label: { en: "Save toolkit", es: "Guardar herramienta" }, group: "care", menu: false, check: "patient self only", store: refs(["saveToolkitItem", AdelanteEHR.saveToolkitItem]), allowed: ({ role }, p) => role === PATIENT_ACTOR_ROLE && p?.id === AdelanteEHR.getCurrentPatientId() ? ok() : hide("Patient-only engagement action.") },
  { id: "patient_lesson_complete", label: { en: "Complete lesson", es: "Completar lección" }, group: "care", menu: false, check: "patient self only", store: refs(["completeExercise", AdelanteEHR.completeExercise], ["completeLibraryItem", AdelanteEHR.completeLibraryItem], ["completeRecoveryLesson", AdelanteEHR.completeRecoveryLesson]), allowed: ({ role }, p) => role === PATIENT_ACTOR_ROLE && p?.id === AdelanteEHR.getCurrentPatientId() ? ok() : hide("Patient-only engagement action.") },
  { id: "content_create", label: { en: "Create content", es: "Create content" }, group: "admin", menu: false, needsPatient: false,
    check: "canAuthorContent", store: refs(["saveContentDraft", saveContentDraft]),
    allowed: ({ role }) => canAuthorContent(role) ? ok() : hide("This role cannot take this content action."), },
  { id: "content_edit", label: { en: "Edit content", es: "Edit content" }, group: "admin", menu: false, needsPatient: false,
    check: "canAuthorContent", store: refs(["saveContentDraft", saveContentDraft]),
    allowed: ({ role }) => canAuthorContent(role) ? ok() : hide("This role cannot take this content action."), },
  { id: "content_submit", label: { en: "Submit content", es: "Submit content" }, group: "admin", menu: false, needsPatient: false,
    check: "canAuthorContent", store: refs(["submitContentForReview", submitContentForReview]),
    allowed: ({ role }) => canAuthorContent(role) ? ok() : hide("This role cannot take this content action."), },
  { id: "content_approve", label: { en: "Approve content", es: "Approve content" }, group: "admin", menu: false, needsPatient: false,
    check: "canPublishContent", store: refs(["publishContent", publishContent]),
    allowed: ({ role }) => canPublishContent(role) ? ok() : hide("This role cannot take this content action."), },
  { id: "content_publish", label: { en: "Publish content", es: "Publish content" }, group: "admin", menu: false, needsPatient: false,
    check: "canPublishContent", store: refs(["publishContent", publishContent]),
    allowed: ({ role }) => canPublishContent(role) ? ok() : hide("This role cannot take this content action."), },
  { id: "content_return", label: { en: "Return content", es: "Return content" }, group: "admin", menu: false, needsPatient: false,
    check: "canPublishContent", store: refs(["returnContentForChanges", returnContentForChanges]),
    allowed: ({ role }) => canPublishContent(role) ? ok() : hide("This role cannot take this content action."), },
  { id: "content_withdraw", label: { en: "Withdraw content", es: "Withdraw content" }, group: "admin", menu: false, needsPatient: false,
    check: "canPublishContent", store: refs(["retireContent", retireContent]),
    allowed: ({ role }) => canPublishContent(role) ? ok() : hide("This role cannot take this content action."), },
  { id: "content_discard", label: { en: "Discard content draft", es: "Discard content draft" }, group: "admin", menu: false, needsPatient: false,
    check: "canAuthorContent", store: refs(["discardContentDraft", discardContentDraft]),
    allowed: ({ role }) => canAuthorContent(role) ? ok() : hide("This role cannot take this content action."), },
  {
    id: "resource_verify",
    label: { en: "Verify and publish resource", es: "Verificar y publicar recurso" },
    group: "admin",
    menu: false,
    needsPatient: false,
    check: "RESOURCE_VERIFIER_ROLES",
    store: refs(["verifyResource", (input: VerifyInput & { details: Parameters<typeof updateResourceDetails>[1] }) => {
      updateResourceDetails(input.resourceId, input.details);
      return verifyResource(input);
    }]),
    allowed: ({ role }) => RESOURCE_VERIFIER_ROLES.includes(role) ? ok() : hide("This role cannot publish a community resource."),
  },
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
    flags: ["erx_simulated"],
    label: { en: "Medication order", es: "Orden de medicamento" },
    group: "clinical",
    sectionId: "orders",
    store: refs(["addDraftOrder", (...a: any[]) => (AdelanteEHR.addDraftOrder as any)(...a)], ["signOrders", (...a: any[]) => (AdelanteEHR.signOrders as any)(...a)]),
    allowed: ({ role }) => (isPrescriberRole(role) ? ok() : hide("Only a prescriber can order medications.")),
  },
  {
    id: "refill_decision",
    flags: ["cures_placeholder", "erx_simulated"],
    label: { en: "Refill decision", es: "Decisión de resurtido" },
    group: "clinical",
    sectionId: "orders",
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
  // §Batch E1 — outpatient nursing chain. Draft — pending clinical sign-off.
  {
    id: "clinic_med_order",
    label: { en: "Clinic-administered medication", es: "Medicamento administrado en clínica" },
    group: "clinical",
    sectionId: "nursing",
    check: "canOrderClinicMed",
    store: refs(["orderClinicMedication", (...a: any[]) => (orderClinicMedication as any)(...a)]),
    allowed: ({ role }) => (canOrderClinicMed(role) ? ok() : hide("Only a prescriber can order medications.")),
  },
  {
    id: "nurse_review",
    label: { en: "Nurse review of an order", es: "Revisión de enfermería" },
    group: "clinical",
    sectionId: "nursing",
    menu: false,
    check: "canNurseReview",
    store: refs(["nurseReviewOrder", (...a: any[]) => (nurseReviewOrder as any)(...a)]),
    allowed: ({ role }) => (canNurseReview(role) ? ok() : hide("Only a nurse (RN) reviews orders before they are given.")),
  },
  {
    id: "clinic_dose_give",
    label: { en: "Give clinic dose", es: "Dar dosis en clínica" },
    group: "clinical",
    sectionId: "nursing",
    menu: false,
    check: "canAdministerClinicMed",
    store: refs(["administerClinicDose", (...a: any[]) => (administerClinicDose as any)(...a)]),
    allowed: ({ role, staffId }) =>
      !canAdministerClinicMed(role) ? hide("Only a nurse (RN) or LVN gives clinic medications.") : role === "lvn" ? cosign(cosignRouteLabel(staffId)) : ok(),
  },
  {
    id: "clinic_dose_cosign",
    label: { en: "Cosign LVN dose", es: "Cofirmar dosis de LVN" },
    group: "clinical",
    sectionId: "nursing",
    menu: false,
    check: "canCosignLvnDose",
    store: refs(["cosignClinicDose", (...a: any[]) => (cosignClinicDose as any)(...a)]),
    allowed: ({ role }) => (canCosignLvnDose(role) ? ok() : hide("Only the supervising RN, physician or PMHNP cosigns.")),
  },
  {
    id: "specimen_collect",
    label: { en: "Collect specimen", es: "Tomar muestra" },
    group: "clinical",
    sectionId: "nursing",
    check: "canCollectSpecimen",
    store: refs(["collectSpecimen", (...a: any[]) => (collectSpecimen as any)(...a)]),
    allowed: ({ role }) => (canCollectSpecimen(role) ? ok() : hide("Only nursing collects specimens.")),
  },
  {
    id: "triage_call",
    label: { en: "Triage call", es: "Llamada de triaje" },
    group: "clinical",
    sectionId: "nursing",
    check: "canTriage",
    store: refs(["recordTriageCall", (...a: any[]) => (recordTriageCall as any)(...a)]),
    allowed: ({ role }) => (canTriage(role) ? ok() : hide("Only a nurse (RN) triages calls.")),
  },
  {
    id: "refill_coordinate",
    label: { en: "Coordinate a refill", es: "Coordinar resurtido" },
    group: "clinical",
    sectionId: "orders",
    menu: false,
    check: "canCoordinateRefill",
    store: refs(["coordinateRefill", (...a: any[]) => (coordinateRefill as any)(...a)]),
    allowed: ({ role }) => (canCoordinateRefill(role) ? ok() : hide("Only a nurse (RN) coordinates refills.")),
  },
  // §Batch F1 — NTP path (Draft — pending clinical sign-off).
  {
    id: "ntp_referral",
    label: { en: "Refer to an NTP", es: "Referir a un NTP" },
    group: "care",
    sectionId: "orders",
    check: "canReferToNtp + roleSeesAsamSection",
    store: refs(["referToNtp", (...a: any[]) => (referToNtp as any)(...a)]),
    allowed: ({ role }, p) =>
      canReferToNtp(role) && (!p || roleSeesAsamSection(role, p)) ? ok() : hide("Not available for your role."),
  },
  {
    id: "ntp_external_med",
    label: { en: "Record outside NTP medication", es: "Registrar medicamento de NTP externo" },
    group: "clinical",
    sectionId: "orders",
    check: "canRecordExternalNtp + roleSeesAsamSection",
    store: refs(["recordExternalNtpMedication", (...a: any[]) => (recordExternalNtpMedication as any)(...a)]),
    allowed: ({ role }, p) =>
      canRecordExternalNtp(role) && (!p || roleSeesAsamSection(role, p)) ? ok() : hide("Not available for your role."),
  },
  // §Batch E2 — External Care Partners (staff-facing only).
  {
    id: "partner_link",
    label: { en: "Link a care partner", es: "Vincular un socio de atención" },
    group: "coordination",
    sectionId: "care-partners",
    check: "canLinkPartner",
    store: refs(["linkPartner", (...a: any[]) => (linkPartner as any)(...a)], ["endPartnerLink", (...a: any[]) => (endPartnerLink as any)(...a)]),
    allowed: ({ role }) => (canLinkPartner(role) ? ok() : hide("Your role doesn't coordinate with care partners.")),
  },
  {
    id: "partner_handoff",
    label: { en: "Log a partner handoff", es: "Registrar entrega a socio" },
    group: "coordination",
    sectionId: "care-partners",
    menu: false,
    check: "canLinkPartner",
    store: refs(["recordHandoff", (...a: any[]) => (recordHandoff as any)(...a)]),
    allowed: ({ role }) => (canLinkPartner(role) ? ok() : hide("Your role doesn't coordinate with care partners.")),
  },
  {
    id: "partner_directory_edit",
    label: { en: "Edit care partner directory", es: "Editar directorio de socios" },
    group: "admin",
    menu: false,
    needsPatient: false,
    check: "canEditPartnerDirectory",
    store: refs(["savePartnerOrg", (...a: any[]) => (savePartnerOrg as any)(...a)], ["savePartnerContact", (...a: any[]) => (savePartnerContact as any)(...a)]),
    allowed: ({ role }) => (canEditPartnerDirectory(role) ? ok() : hide("Only a system administrator edits the directory.")),
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
    id: "screener_draft_save",
    label: { en: "Save screener draft (in progress)", es: "Guardar borrador del cuestionario (en curso)" },
    group: "clinical",
    sectionId: "tracking",
    store: refs(["saveScreenerDraft", (...a: any[]) => (saveScreenerDraft as any)(...a)]),
    allowed: ({ role }, p) => (canRequestScreener(role, p) ? ok() : hide("Your role doesn't enter screeners.")),
  },
  {
    id: "metabolic",
    label: { en: "Vitals / metabolic measures", es: "Signos vitales / medidas metabólicas" },
    group: "clinical",
    sectionId: "tracking",
    store: refs(["recordMetabolic", (...a: any[]) => (recordMetabolic as any)(...a)]),
    allowed: ({ role }) => (canRecordMetabolic(role) ? ok() : hide("Only a prescriber or nurse records vitals.")),
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
    // §C1 — Adel's ASAM-derived care-plan suggestions: accept (optionally edited), edit, dismiss, clear "Review — ASAM changed".
    id: "asam_plan_suggestion",
    label: { en: "Care plan suggestion", es: "Sugerencia del plan" },
    group: "care",
    sectionId: "care-plan",
    menu: false,
    store: refs(
      ["acceptAsamSuggestion", (...a: any[]) => (acceptAsamSuggestion as any)(...a)],
      ["editAsamSuggestion", (...a: any[]) => (editAsamSuggestion as any)(...a)],
      ["dismissAsamSuggestion", (...a: any[]) => (dismissAsamSuggestion as any)(...a)],
      ["markAsamGoalReviewed", (...a: any[]) => (markAsamGoalReviewed as any)(...a)],
    ),
    check: "canEditPlan + roleSeesAsamSection",
    allowed: ({ role, staffId }, p) => {
      if (!roleSeesAsamSection(role, p)) return hide("Not available for your role.");
      if (!canEditPlan(role)) return hide("Your role can't change the care plan.");
      return inList(PLAN_COSIGN_ROLES, role) ? cosign(cosignRouteLabel(staffId)) : ok();
    },
  },
  {
    // §C3 — mark a re-screen severity flag reviewed (clears the Needs my action row).
    id: "severity_flag_review",
    label: { en: "Review score change", es: "Revisar cambio de puntaje" },
    group: "clinical",
    sectionId: "tracking",
    menu: false,
    store: refs(["reviewSeverityFlag", (...a: any[]) => (reviewSeverityFlag as any)(...a)]),
    check: "canReviewSeverity",
    allowed: ({ role }, p) => (canReviewSeverity(role, p) ? ok() : hide("Your role can't review score changes.")),
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
      canScheduleRole(role) ? ok() : hide("Your role does not book visits."),
  },
  {
    id: "patient_self_book",
    label: { en: "Book my visit", es: "Reservar mi cita" },
    group: "coordination",
    sectionId: "appointments",
    check: "patient acting for self; patientSelfBook re-checks eligible clinician, real availability, telehealth consent, conflicts",
    store: refs(["patientSelfBook", (...a: any[]) => (patientSelfBook as any)(...a)]),
    allowed: ({ role }) => (role === PATIENT_ACTOR_ROLE ? ok() : hide("Only the patient books their own visit here.")),
  },
  {
    id: "patient_reschedule",
    label: { en: "Reschedule my visit", es: "Cambiar mi cita" },
    group: "coordination",
    sectionId: "appointments",
    check: "patient acting for self; patientReschedule re-checks real availability, eligible clinician, telehealth consent, conflicts",
    store: refs(["patientReschedule", (...a: any[]) => (patientReschedule as any)(...a)]),
    allowed: ({ role }) => (role === PATIENT_ACTOR_ROLE ? ok() : hide("Only the patient reschedules their own visit here.")),
  },
  {
    id: "scribe_consent_grant",
    label: { en: "AI recording consent", es: "Consentimiento de grabación con IA" },
    group: "document",
    sectionId: "notes",
    menu: false,
    check: "patient for self, or canRecordAiConsent (assisted); Part 2 line required for SUD patients",
    
    store: refs(["grantAiRecordingConsent", (...a: any[]) => (grantAiRecordingConsent as any)(...a)]),
    allowed: ({ role }) => (role === PATIENT_ACTOR_ROLE || canRecordAiConsent(role) ? ok() : hide("Your role doesn't record AI recording consent.")),
  },
  {
    id: "scribe_consent_withdraw",
    label: { en: "Withdraw AI recording consent", es: "Retirar consentimiento de grabación con IA" },
    group: "document",
    sectionId: "notes",
    menu: false,
    check: "patient for self, or canRecordAiConsent; discards live capture",
    
    store: refs(["withdrawAiRecordingConsent", (...a: any[]) => (withdrawAiRecordingConsent as any)(...a)]),
    allowed: ({ role }) => (role === PATIENT_ACTOR_ROLE || canRecordAiConsent(role) ? ok() : hide("Your role doesn't record AI recording consent.")),
  },
  {
    id: "scribe_start",
    label: { en: "Start AI scribe", es: "Iniciar escriba IA" },
    group: "document",
    sectionId: "notes",
    menu: false,
    check: "canCaptureScribe (captureBlocker re-checks consent + all-party in the store)",
    flags: ["scribe_simulated"],
    store: refs(["startScribeSession", (...a: any[]) => (startScribeSession as any)(...a)]),
    allowed: ({ role }) => (canCaptureScribe(role) ? ok() : hide("Your role doesn't use the AI scribe in this phase (Phase 2 decision).")),
  },
  {
    id: "scribe_discard",
    label: { en: "Stop and discard capture", es: "Detener y descartar" },
    group: "document",
    sectionId: "notes",
    menu: false,
    check: "canCaptureScribe",
    
    store: refs(["discardScribeSession", (...a: any[]) => (discardScribeSession as any)(...a)]),
    allowed: ({ role }) => (canCaptureScribe(role) ? ok() : hide("Your role doesn't use the AI scribe in this phase (Phase 2 decision).")),
  },
  {
    id: "scribe_pause",
    label: { en: "Pause capture", es: "Pausar captura" },
    group: "document",
    sectionId: "notes",
    menu: false,
    check: "canCaptureScribe",
    flags: ["scribe_simulated"],
    store: refs(["pauseScribeSession", (...a: any[]) => (pauseScribeSession as any)(...a)]),
    allowed: ({ role }) => (canCaptureScribe(role) ? ok() : hide("Live capture isn't available for your role.")),
  },
  {
    id: "scribe_resume",
    label: { en: "Resume capture", es: "Reanudar captura" },
    group: "document",
    sectionId: "notes",
    menu: false,
    check: "canCaptureScribe",
    flags: ["scribe_simulated"],
    store: refs(["resumeScribeSession", (...a: any[]) => (resumeScribeSession as any)(...a)]),
    allowed: ({ role }) => (canCaptureScribe(role) ? ok() : hide("Live capture isn't available for your role.")),
  },
  {
    id: "scribe_dictate",
    label: { en: "Dictate after the encounter", es: "Dictar después del encuentro" },
    group: "document",
    sectionId: "notes",
    menu: false,
    needsPatient: false,
    check: "canDictateScribe (+ own-contact scope in dictationBlocker, refused as action.blocked)",
    flags: ["scribe_simulated"],
    store: refs(["createDictationDraft", (...a: any[]) => (createDictationDraft as any)(...a)]),
    allowed: ({ role }) => (canDictateScribe(role) ? ok() : hide("Your role doesn't use the AI scribe or dictation.")),
  },
  {
    id: "scribe_afbi_save",
    label: { en: "Save AFBI contact from AI draft", es: "Guardar contacto AFBI del borrador IA" },
    group: "coordination",
    menu: false,
    needsPatient: false,
    check: "canDictateScribe && canRecordAfbi",
    flags: ["scribe_simulated"],
    store: refs(["saveAfbiFromScribe", (...a: any[]) => (saveAfbiFromScribe as any)(...a)]),
    allowed: ({ role }) => (canDictateScribe(role) && canRecordAfbi(role) ? ok() : hide("Only outreach roles that use the scribe save AFBI drafts.")),
  },
  {
    id: "scribe_end",
    label: { en: "End session (AI draft)", es: "Terminar sesión (borrador IA)" },
    group: "document",
    sectionId: "notes",
    menu: false,
    check: "canCaptureScribe",
    flags: ["scribe_simulated"],
    store: refs(["endScribeSession", (...a: any[]) => (endScribeSession as any)(...a)]),
    allowed: ({ role }) => (canCaptureScribe(role) ? ok() : hide("Your role doesn't use the AI scribe in this phase (Phase 2 decision).")),
  },
  {
    id: "scribe_open_draft",
    label: { en: "Open AI draft", es: "Abrir borrador IA" },
    group: "document",
    sectionId: "notes",
    menu: false,
    check: "canDictateScribe",
    
    store: refs(["openAiDraft", (...a: any[]) => (openAiDraft as any)(...a)]),
    allowed: ({ role }) => (canDictateScribe(role) ? ok() : hide("Your role doesn't use the AI scribe or dictation.")),
  },
  {
    id: "scribe_sentence_edit",
    label: { en: "Edit AI sentence", es: "Editar oración IA" },
    group: "document",
    sectionId: "notes",
    menu: false,
    check: "canDictateScribe",
    
    store: refs(["editAiSentence", (...a: any[]) => (editAiSentence as any)(...a)]),
    allowed: ({ role }) => (canDictateScribe(role) ? ok() : hide("Your role doesn't use the AI scribe or dictation.")),
  },
  {
    id: "scribe_visit_field",
    label: { en: "Fill AI draft visit details", es: "Completar datos de la visita (borrador IA)" },
    group: "document",
    sectionId: "notes",
    menu: false,
    check: "canDictateScribe",
    
    store: refs(["setAiDraftVisitField", (...a: any[]) => (setAiDraftVisitField as any)(...a)]),
    allowed: ({ role }) => (canDictateScribe(role) ? ok() : hide("Your role doesn't use the AI scribe or dictation.")),
  },
  {
    id: "scribe_sentence_keep",
    label: { en: "Keep AI sentence with reason", es: "Conservar oración IA con motivo" },
    group: "document",
    sectionId: "notes",
    menu: false,
    check: "canDictateScribe",
    
    store: refs(["keepAiSentence", (...a: any[]) => (keepAiSentence as any)(...a)]),
    allowed: ({ role }) => (canDictateScribe(role) ? ok() : hide("Your role doesn't use the AI scribe or dictation.")),
  },
  {
    id: "scribe_sentence_delete",
    label: { en: "Delete AI sentence", es: "Borrar oración IA" },
    group: "document",
    sectionId: "notes",
    menu: false,
    check: "canDictateScribe",
    
    store: refs(["deleteAiSentence", (...a: any[]) => (deleteAiSentence as any)(...a)]),
    allowed: ({ role }) => (canDictateScribe(role) ? ok() : hide("Your role doesn't use the AI scribe or dictation.")),
  },
  {
    id: "scribe_review_confirm",
    label: { en: "Confirm AI draft review", es: "Confirmar revisión del borrador IA" },
    group: "document",
    sectionId: "notes",
    menu: false,
    check: "canDictateScribe",
    
    store: refs(["confirmAiReview", (...a: any[]) => (confirmAiReview as any)(...a)]),
    allowed: ({ role }) => (canDictateScribe(role) ? ok() : hide("Your role doesn't use the AI scribe or dictation.")),
  },
  {
    id: "scribe_followup_accept",
    label: { en: "Accept suggested follow-up", es: "Aceptar seguimiento sugerido" },
    group: "document",
    sectionId: "notes",
    menu: false,
    check: "canDictateScribe",
    
    store: refs(["acceptAiFollowUp", (...a: any[]) => (acceptAiFollowUp as any)(...a)]),
    allowed: ({ role }) => (canDictateScribe(role) ? ok() : hide("Your role doesn't use the AI scribe or dictation.")),
  },
  {
    id: "advocate_reschedule",
    label: { en: "Reschedule (advocate)", es: "Cambiar cita (representante)" },
    group: "coordination",
    sectionId: "appointments",
    check: "authorised advocate; tier gate advocateCanActOnSchedule (AHCD agent / conservator) + same booking engine",
    store: refs(["advocateReschedule", (...a: any[]) => (advocateReschedule as any)(...a)]),
    allowed: ({ role }) => (role === ADVOCATE_ACTOR_ROLE ? ok() : hide("Only an authorised advocate uses this path.")),
  },
  {
    id: "visit_request_cancel",
    label: { en: "Request visit cancellation", es: "Solicitar cancelación de cita" },
    group: "coordination",
    sectionId: "appointments",
    store: refs(["staffRequestCancel", (...a: any[]) => (AdelanteEHR.staffRequestCancel as any)(...a)]),
    allowed: ({ role }) =>
      bookingRightFor(role).cancel === "request" ? ok() : hide("Your role cancels directly or not at all."),
  },
  {
    id: "message_patient",
    flags: ["notifications_simulated"],
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
    allowed: ({ role }) => canScheduleRole(role) ? ok() : hide("Your role does not book visits."),
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
    opsMenu: true,
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
    opsMenu: true,
    flags: ["payments_simulated"],
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
    opsMenu: true,
    flags: ["payments_simulated"],
    label: { en: "Record payment", es: "Registrar pago" },
    group: "billing",
    menu: false,
    check: "canAccess(billing) = write",
    needsPatient: false,
    store: refs(["recordPatientPayment", (...a: any[]) => (AdelanteEHRExt.recordPatientPayment as any)(...a)]),
    allowed: ({ role }) => (writes(role, "billing") ? ok() : hide("Only billing staff can record payments.")),
  },
  {
    id: "payment_void",
    flags: ["payments_simulated"],
    label: { en: "Void payment", es: "Anular pago" },
    group: "billing",
    menu: false,
    check: "canAccess(billing) = write",
    store: refs(["voidPatientPayment", (...a: any[]) => (AdelanteEHRExt.voidPatientPayment as any)(...a)]),
    allowed: ({ role }) => (writes(role, "billing") ? ok() : hide("Only billing staff can void payments.")),
  },
  {
    id: "payment_arrangement",
    opsMenu: true,
    needsPatient: true,
    flags: ["payments_simulated"],
    label: { en: "Payment arrangement", es: "Acuerdo de pago" },
    group: "billing",
    menu: false,
    check: "canAccess(billing) = write",
    store: refs(["setPaymentArrangement", (...a: any[]) => (AdelanteEHRExt.setPaymentArrangement as any)(...a)]),
    allowed: ({ role }) => (writes(role, "billing") ? ok() : hide("Only billing staff can set payment arrangements.")),
  },
  {
    id: "eligibility_check",
    opsMenu: true,
    needsPatient: true,
    flags: ["eligibility_simulated"],
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
    opsMenu: true,
    flags: ["caloms_export_simulated"],
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
    opsMenu: k === "create" || k === "clone",
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
    opsMenu: k === "save",
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
    opsMenu: true,
    needsPatient: false,
    flags: ["notifications_simulated"],
    label: { en: "Resend notification", es: "Reenviar notificación" },
    group: "admin",
    menu: false,
    check: "canAccess(population_health) = write",
    store: refs(["resendNotification", (...a: any[]) => (AdelanteEHR.resendNotification as any)(...a)]),
    allowed: ({ role }) => (writes(role, "population_health") ? ok() : hide("Only program administrators can resend notifications.")),
  },
  // ---- §Calendars — location + staff calendars (store re-checks roles) ----
  ...([
    ["calendar_site_hours_save", "Save location hours", "Guardar horario de la sede", "saveSiteHours", saveSiteHours],
    ["calendar_site_closed_add", "Add clinic closed day", "Agregar día cerrado", "addSiteClosedDay", addSiteClosedDay],
    ["calendar_site_closed_remove", "Remove clinic closed day", "Quitar día cerrado", "removeSiteClosedDay", removeSiteClosedDay],
    ["calendar_site_create", "Create location calendar", "Crear calendario de sede", "createSiteCalendarFromDefaults", createSiteCalendarFromDefaults],
  ] as const).map(([id, en, es, name, fn]): ChartAction => ({
    id, label: { en, es }, group: "admin", menu: false, needsPatient: false,
    check: "canEditSiteCalendar (sys_admin)",
    store: refs([name, fn as StoreFn]),
    allowed: ({ role }) => (canEditSiteCalendar(role) ? ok() : hide("Only a system administrator can change a location calendar.")),
  })),
  ...([
    ["calendar_staff_hours_save", "Save working hours", "Guardar horario", "saveStaffHours", saveStaffHours],
    ["calendar_staff_hours_remove", "Remove working hours", "Quitar horario", "removeStaffHours", removeStaffHours],
    ["calendar_time_off_add", "Enter time off", "Registrar tiempo libre", "addTimeOff", addTimeOff],
    ["calendar_time_off_remove", "Withdraw time off", "Retirar tiempo libre", "removeTimeOff", removeTimeOff],
    ["calendar_external_id_set", "Set external calendar id", "Definir calendario externo", "setExternalCalendarId", setExternalCalendarId],
  ] as const).map(([id, en, es, name, fn]): ChartAction => ({
    id, label: { en, es }, group: "admin", menu: false, needsPatient: false,
    check: "own calendar, or canManageStaffCalendars (coordinator / sys_admin)",
    store: refs([name, fn as StoreFn]),
    // Every staff member has a calendar; the store refuses edits to someone else's.
    allowed: () => ok(),
  })),
  {
    id: "calendar_reschedule_done", label: { en: "Mark reschedule handled", es: "Marcar reprogramación atendida" }, group: "admin", menu: false, needsPatient: false,
    check: "canManageStaffCalendars (coordinator / sys_admin)",
    store: refs(["markRescheduleHandled", markRescheduleHandled as StoreFn]),
    allowed: ({ role }) => (canManageStaffCalendars(role) ? ok() : hide("Only a coordinator can close a reschedule item.")),
  },
  {
    id: "calendar_sync_run", label: { en: "Sync calendar (Simulated)", es: "Sincronizar calendario (Simulado)" }, group: "admin", menu: false, needsPatient: false,
    simulated: true, flags: ["calendar_sync_simulated"],
    check: "canManageStaffCalendars (coordinator / sys_admin)",
    store: refs(["calendarSync.sync", ((...a: Parameters<typeof calendarSync.sync>) => calendarSync.sync(...a)) as StoreFn]),
    allowed: ({ role }) => (canManageStaffCalendars(role) ? ok() : hide("Only a coordinator or system administrator can run calendar sync.")),
  },
  // ---- §B2 — coverage at release ----
  {
    id: "coverage_release_status_set", label: { en: "Update coverage at release", es: "Actualizar cobertura al salir" }, group: "admin", menu: false, needsPatient: false,
    check: "canSetReleaseCoverage (coordinator / sys_admin / CF care manager / ECM)",
    store: refs(["setReleaseCoverageStatus", setReleaseCoverageStatus as StoreFn]),
    allowed: ({ role }) => (canSetReleaseCoverage(role) ? ok() : hide("Your role can't update coverage at release.")),
  },
  {
    id: "coverage_release_check", label: { en: "Check eligibility (Simulated)", es: "Verificar elegibilidad (Simulado)" }, group: "admin", menu: false, needsPatient: false,
    simulated: true,
    check: "canSetReleaseCoverage (coordinator / sys_admin / CF care manager / ECM)",
    store: refs(["simulateEligibilityCheck", simulateEligibilityCheck as StoreFn]),
    allowed: ({ role }) => (canSetReleaseCoverage(role) ? ok() : hide("Your role can't check eligibility.")),
  },
  // ---- §B6 — staff lifecycle (sys_admin only, reason required, audited) ----
  ...([
    ["staff_add", "Add staff member", "Agregar miembro del personal", "addStaffMemberWithReason", addStaffMemberWithReason],
    ["staff_update", "Change staff role / sites", "Cambiar rol / sedes", "updateStaffMember", updateStaffMember],
    ["staff_deactivate", "Deactivate staff member", "Desactivar miembro del personal", "deactivateStaffMember", deactivateStaffMember],
    ["staff_reactivate", "Reactivate staff member", "Reactivar miembro del personal", "reactivateStaffMember", reactivateStaffMember],
  ] as const).map(([id, en, es, name, fn]): ChartAction => ({
    id, label: { en, es }, group: "admin", menu: false, needsPatient: false,
    check: "actor.role === sys_admin (staffLifecycle.ts)",
    store: refs([name, fn as StoreFn]),
    allowed: ({ role }) => (role === "sys_admin" ? ok() : hide("Only a system administrator can manage staff.")),
  })),
  // ---- §Batch E — patient identity (coordinator / sys_admin) ----
  {
    id: "patient_merge",
    label: { en: "Merge patient records", es: "Unir expedientes" },
    group: "admin",
    menu: false,
    check: "canReviewMatches(role)",
    store: refs(
      ["mergePatients", (...a: any[]) => (mergePatients as any)(...a)],
      ["unmergePatients", (...a: any[]) => (unmergePatients as any)(...a)],
      ["reconfirmConsentAfterMerge", (...a: any[]) => (reconfirmConsentAfterMerge as any)(...a)],
    ),
    allowed: ({ role }) => (canReviewMatches(role) ? ok() : hide("Only a clinical coordinator or system admin can merge records.")),
  },
  {
    id: "patient_match_decide",
    label: { en: "Decide a possible duplicate", es: "Decidir posible duplicado" },
    group: "admin",
    menu: false,
    check: "canReviewMatches(role)",
    store: refs(
      ["markNotSamePerson", (...a: any[]) => (markNotSamePerson as any)(...a)],
      ["linkAsRelated", (...a: any[]) => (linkAsRelated as any)(...a)],
    ),
    allowed: ({ role }) => (canReviewMatches(role) ? ok() : hide("Only a clinical coordinator or system admin can decide matches.")),
  },
  {
    id: "hie_match_decide",
    label: { en: "Outside record match", es: "Coincidencia de registro externo" },
    group: "admin",
    menu: false,
    needsPatient: false,
    flags: ["hie_simulated"],
    check: "DATA_EXCHANGE_ROLES",
    store: refs(
      ["confirmMatch", (...a: any[]) => (confirmHieMatch as any)(...a)],
      ["rejectMatch", (...a: any[]) => (rejectHieMatch as any)(...a)],
    ),
    allowed: ({ role }) => (DATA_EXCHANGE_ROLES.has(role) ? ok() : hide("Only a clinical coordinator or system admin can decide outside-record matches.")),
  },
  {
    id: "patient_create_anyway",
    label: { en: "Create record despite a match", es: "Crear expediente a pesar de coincidencia" },
    group: "admin",
    menu: false,
    needsPatient: false,
    check: "canRunAssistedSignup(role)",
    store: refs(["createPatient", (...a: any[]) => (AdelanteEHR.createPatient as any)(...a)]),
    allowed: ({ role }) => (canRunAssistedSignup(role) ? ok() : hide("Your role can't create patient records.")),
  },
  // ---- §Turn 6 — billing / admin / coordinator "+ New" ----
  {
    id: "claim_duplicate_review",
    opsMenu: true,
    label: { en: "Review duplicate-claim holds", es: "Revisar reclamos retenidos por duplicado" },
    group: "billing",
    menu: false,
    needsPatient: false,
    check: "canAccess(billing) = write",
    store: refs(["clearDuplicateClaimReview", (...a: any[]) => (AdelanteEHRExt.clearDuplicateClaimReview as any)(...a)]),
    allowed: ({ role }) => (writes(role, "billing") ? ok() : hide("Only billing staff can review claim holds.")),
  },
  {
    id: "claims_export",
    opsMenu: true,
    label: { en: "Export (ISL / claims)", es: "Exportar (ISL / reclamos)" },
    group: "billing",
    menu: false,
    needsPatient: false,
    check: "canAccess(billing) ≥ read",
    store: refs(["exportClaimsCsv", (...a: any[]) => (exportClaimsCsv as any)(...a)]),
    allowed: ({ role }) => (canAccess(role, "billing").level !== "none" ? ok() : hide("Your role can't export billing reports.")),
  },
  ...([["superbill", "Superbill", "Superfactura"], ["good_faith_estimate", "Good-faith estimate", "Estimado de buena fe"]] as const).map(([id, en, es]): ChartAction => ({
    id,
    opsMenu: true,
    pending: true,
    comingSoon: "Coming in billing phase 7e",
    label: { en, es },
    group: "billing",
    menu: false,
    needsPatient: false,
    check: "canAccess(billing) = write",
    store: [],
    allowed: ({ role }) => (writes(role, "billing") ? ok() : hide("Only billing staff.")),
  })),
  {
    id: "feature_flag_set",
    opsMenu: true,
    label: { en: "Toggle a feature flag", es: "Cambiar un interruptor" },
    group: "admin",
    menu: false,
    needsPatient: false,
    check: "role = sys_admin",
    store: refs(["setFeatureFlagWithReason", (...a: any[]) => (setFeatureFlagWithReason as any)(...a)]),
    allowed: ({ role }) => (role === "sys_admin" ? ok() : hide("Only a system administrator can change feature flags.")),
  },
  {
    id: "open_permissions",
    opsMenu: true,
    label: { en: "Open Permissions & features", es: "Abrir permisos y funciones" },
    group: "admin",
    menu: false,
    needsPatient: false,
    check: "role = sys_admin",
    store: refs(["openScreen", () => ({ opened: "/admin-permissions" })]),
    allowed: ({ role }) => (role === "sys_admin" ? ok() : hide("Opened from the admin menu.")),
  },
  {
    id: "review_matching",
    opsMenu: true,
    label: { en: "Review patient matching", es: "Revisar coincidencias de pacientes" },
    group: "admin",
    menu: false,
    needsPatient: false,
    check: "canReviewMatches(role)",
    store: refs(["openScreen", () => ({ opened: "/data-exchange" })]),
    allowed: ({ role }) => (canReviewMatches(role) ? ok() : hide("Only a clinical coordinator or system admin can review matches.")),
  },
  {
    id: "reconfirm_consent_merged",
    opsMenu: true,
    label: { en: "Re-confirm consent (merged records)", es: "Reconfirmar consentimiento (expedientes unidos)" },
    group: "admin",
    menu: false,
    needsPatient: false,
    check: "canReviewMatches(role)",
    store: refs(["reconfirmConsentAfterMerge", (...a: any[]) => (reconfirmConsentAfterMerge as any)(...a)]),
    allowed: ({ role }) => (canReviewMatches(role) ? ok() : hide("Only a clinical coordinator or system admin can re-confirm consent.")),
  },
  // §Batch D — County reporting hub (prototype; nothing is submitted anywhere).
  ...([
    ["county_generate", "Generate county report draft", "Generar borrador de informe al condado", "generateReport", generateReport, "canViewCountyReporting(role); CalOMS needs hasSudReportingAccess"],
    ["county_submit", "Submit county report (Simulated)", "Enviar informe al condado (simulado)", "submitReport", submitReport, "canViewCountyReporting(role)"],
    ["county_simulate_response", "Simulate county response", "Simular respuesta del condado", "simulateCountyResponse", simulateCountyResponse, "canViewCountyReporting(role)"],
    ["county_fix_error", "Mark county error fixed", "Marcar error del condado corregido", "fixCountyError", fixCountyError, "canViewCountyReporting(role)"],
    ["county_resend", "Resend county report (Simulated)", "Reenviar informe al condado (simulado)", "resendReport", resendReport, "canViewCountyReporting(role)"],
  ] as const).map(([id, en, es, name, fn, check]): ChartAction => ({
    id,
    label: { en, es },
    group: "admin" as const,
    menu: false,
    needsPatient: false,
    check,
    flags: ["caloms_export_simulated"] as FeatureId[],
    store: refs([name, (...a: any[]) => (fn as any)(...a)]),
    allowed: ({ role }) => (canViewCountyReporting(role) ? ok() : hide("Your role can't use county reporting.")),
  })),
  {
    id: "tps_set_window",
    label: { en: "Set Treatment Perception Survey window", es: "Fijar periodo de la encuesta TPS" },
    group: "admin",
    menu: false,
    needsPatient: false,
    check: "TPS_ADMIN_ROLES (sys_admin)",
    store: refs(["setTpsWindow", (...a: any[]) => (setTpsWindow as any)(...a)]),
    allowed: ({ role }) => (TPS_ADMIN_ROLES.includes(role) ? ok() : hide("Only a system administrator sets the survey window.")),
  },
  {
    id: "tps_mark",
    label: { en: "Mark survey offered / completed / declined", es: "Marcar encuesta ofrecida / completada / rechazada" },
    group: "admin",
    menu: false,
    needsPatient: false,
    check: "seesClientLevel(role)",
    store: refs(["markTps", (...a: any[]) => (markTps as any)(...a)]),
    allowed: ({ role }) => (seesClientLevel(role) ? ok() : hide("Client-level survey tracking needs substance-use record access.")),
  },
  {
    id: "tps_send_link",
    label: { en: "Send survey link (Simulated)", es: "Enviar enlace de encuesta (simulado)" },
    group: "admin",
    menu: false,
    needsPatient: false,
    check: "seesClientLevel(role)",
    flags: ["caloms_export_simulated"],
    store: refs(["sendTpsLink", (...a: any[]) => (sendTpsLink as any)(...a)]),
    allowed: ({ role }) => (seesClientLevel(role) ? ok() : hide("Client-level survey tracking needs substance-use record access.")),
  },
  // §Batch A — data foundations (Premier DMC-ODS gaps).
  {
    id: "provider_ref_save",
    label: { en: "Edit provider & site reference", es: "Editar referencia de proveedor y sitio" },
    group: "admin",
    menu: false,
    needsPatient: false,
    check: "canEditProviderRef(role)",
    store: refs(["saveSite", (...a: any[]) => (saveSite as any)(...a)], ["saveProgram", (...a: any[]) => (saveProgram as any)(...a)], ["saveOrganization", (...a: any[]) => (saveOrganization as any)(...a)]),
    allowed: ({ role }) => (canEditProviderRef(role) ? ok() : hide("Only a system administrator can edit provider & site reference.")),
  },
  {
    id: "fsp_custody_record",
    label: { en: "Record custody duration (FSP)", es: "Registrar tiempo en custodia (FSP)" },
    group: "care",
    menu: false,
    needsPatient: true,
    check: "custody_tracking write + isJusticeInvolved",
    store: refs(["recordCustodyDuration", (...a: any[]) => (recordCustodyDuration as any)(...a)]),
    allowed: ({ role }, p) => (canRecordCustodyDuration(role, p) ? ok() : hide("Your role can't record custody information for this patient.")),
  },
  {
    id: "afbi_contact",
    label: { en: "Field outreach contact (AFBI)", es: "Contacto de alcance en campo (AFBI)" },
    group: "coordination",
    needsPatient: false,
    check: "canRecordAfbi(role)",
    store: refs(["recordAfbiContact", (...a: any[]) => (recordAfbiContact as any)(...a)], ["requestAfbiLink", (...a: any[]) => (requestAfbiLink as any)(...a)]),
    allowed: ({ role }) => (canRecordAfbi(role) ? ok() : hide("Only outreach, case management and clinical roles record field outreach.")),
  },
  {
    id: "afbi_link_decide",
    label: { en: "Confirm field outreach link", es: "Confirmar vínculo de alcance" },
    group: "admin",
    menu: false,
    needsPatient: false,
    check: "canReviewMatches(role)",
    store: refs(["decideAfbiLink", (...a: any[]) => (decideAfbiLink as any)(...a)]),
    allowed: ({ role }) => (canReviewMatches(role) ? ok() : hide("Only a clinical coordinator or system admin can confirm a link.")),
  },
  {
    id: "service_classification_override",
    label: { en: "Override funding / category", es: "Cambiar financiamiento / categoría" },
    group: "billing",
    menu: false,
    needsPatient: false,
    check: "canOverrideClassification(role)",
    store: refs(["overrideServiceClassification", (...a: any[]) => (overrideServiceClassification as any)(...a)]),
    allowed: ({ role }) => (canOverrideClassification(role) ? ok() : hide("Only a billing or clinical coordinator can override funding or category.")),
  },
  // ---- §Batch B — intake integrity ----
  {
    id: "timely_offer_record",
    label: { en: "Record appointment offer", es: "Registrar cita ofrecida" },
    group: "visit",
    menu: false,
    needsPatient: false,
    check: "canRecordOffer(role)",
    store: refs(["recordAppointmentOffer", (...a: any[]) => (recordAppointmentOffer as any)(...a)], ["recordServiceRequest", (...a: any[]) => (recordServiceRequest as any)(...a)]),
    allowed: ({ role }) => (canRecordOffer(role) ? ok() : hide("Your role can't record appointment offers.")),
  },
  {
    id: "timely_correction",
    label: { en: "Timely access correction note", es: "Nota de corrección de acceso oportuno" },
    group: "admin",
    menu: false,
    needsPatient: true,
    check: "canCorrectTimely(role)",
    store: refs(["addTimelyCorrection", (...a: any[]) => (addTimelyCorrection as any)(...a)]),
    allowed: ({ role }) => (canCorrectTimely(role) ? ok() : hide("Only a clinical coordinator or system admin can add a correction note.")),
  },
  {
    id: "referral_chase_fill",
    label: { en: "Record missing referral detail", es: "Registrar dato faltante de referencia" },
    group: "coordination",
    menu: false,
    needsPatient: false,
    check: "canFillChase(role)",
    store: refs(["fillChaseField", (...a: any[]) => (fillChaseField as any)(...a)]),
    allowed: ({ role }) => (canFillChase(role) ? ok() : hide("Your role can't update referral details.")),
  },
  {
    id: "referral_chase_claim",
    label: { en: "Take referral follow-up", es: "Tomar seguimiento de referencia" },
    group: "coordination",
    menu: false,
    needsPatient: false,
    check: "canClaimChase(role)",
    store: refs(["claimChaseTask", (...a: any[]) => (claimChaseTask as any)(...a)]),
    allowed: ({ role }) => (canClaimChase(role) ? ok() : hide("Only a clinical coordinator can take a referral follow-up from the pool.")),
  },
  {
    id: "referral_assign_owner",
    label: { en: "Assign referral", es: "Asignar referencia" },
    group: "coordination",
    menu: false,
    needsPatient: false,
    check: "canAssignReferralOwner(role)",
    store: refs(["assignReferralOwner", (...a: any[]) => (assignReferralOwner as any)(...a)]),
    allowed: ({ role }) => (canAssignReferralOwner(role) ? ok() : hide("Only a clinical coordinator can assign a referral.")),
  },
  {
    id: "crisis_handoff",
    label: { en: "Hand off crisis", es: "Transferir crisis" },
    group: "coordination",
    menu: false,
    needsPatient: true,
    check: "crisis owner or clinical coordinator (store-checked)",
    store: refs(["handOffCrisisEscalation", (...a: any[]) => (AdelanteEHR.handOffCrisisEscalation as any)(...a)]),
    allowed: ({ role }) => (role === "billing" || role === "credentialing_coordinator" ? hide("Crisis handoff is for the care team.") : ok()),
  },
  // §U1 — shared escalation actions (crisis rows delegate to the crisis store).
  ...([
    ["escalation_acknowledge", "Acknowledge escalation", "Reconocer escalamiento", "acknowledgeEscalation", acknowledgeEscalation, "owner or clinical coordinator (store-checked)"],
    ["escalation_handoff", "Hand off escalation", "Transferir escalamiento", "handOffEscalation", handOffEscalation, "owner or clinical coordinator (store-checked)"],
  ] as const).map(([id, en, es, name, fn, check]): ChartAction => ({
    id,
    label: { en, es },
    group: "coordination",
    menu: false,
    needsPatient: true,
    check,
    store: refs([name, (...a: any[]) => (fn as any)(...a)]),
    allowed: ({ role }) => (canUseEscalations(role) ? ok() : hide("Escalations are for the care team.")),
  })),
  {
    id: "escalation_reassign",
    label: { en: "Reassign escalation", es: "Reasignar escalamiento" },
    group: "coordination",
    menu: false,
    needsPatient: true,
    check: "clinical_coordinator / sys_admin",
    store: refs(["reassignEscalation", (...a: any[]) => (reassignEscalation as any)(...a)]),
    allowed: ({ role }) => (isEscalationCoordinator(role) ? ok() : hide("Only a clinical coordinator can reassign an escalation.")),
  },
  // §U2 — staff-to-staff messaging. "Message team" shows in "+ New".
  {
    id: "message_team",
    label: { en: "Message team", es: "Mensaje al equipo" },
    group: "coordination",
    needsPatient: false,
    check: "canMessageStaff(role) + patient scope (store-checked)",
    store: refs(["startStaffThread", (...a: any[]) => (startStaffThread as any)(...a)]),
    allowed: ({ role }) => (canMessageStaff(role) ? ok() : hide("Your role doesn't use team messaging.")),
  },
  ...([
    ["staff_thread_post", "Reply in team thread", "Responder en hilo", "postThreadMessage", postThreadMessage],
    ["staff_thread_add_participant", "Add to team thread", "Agregar al hilo", "addThreadParticipant", addThreadParticipant],
    ["staff_thread_flag_sud", "Flag thread as SUD", "Marcar hilo como SUD", "flagThreadSud", flagThreadSud],
    ["staff_thread_resolve", "Resolve team thread", "Resolver hilo", "resolveStaffThread", resolveStaffThread],
    ["staff_thread_reopen", "Reopen team thread", "Reabrir hilo", "reopenStaffThread", reopenStaffThread],
    ["staff_thread_read", "Mark team thread read", "Marcar hilo leído", "markThreadRead", markThreadRead],
    ["staff_thread_mention_done", "Mark reply done", "Marcar respuesta hecha", "markMentionDone", markMentionDone],
  ] as const).map(([id, en, es, name, fn]): ChartAction => ({
    id,
    label: { en, es },
    group: "coordination",
    menu: false,
    needsPatient: false,
    check: "thread participant (store-checked)",
    store: refs([name, (...a: any[]) => (fn as any)(...a)]),
    allowed: ({ role }) => (canMessageStaff(role) ? ok() : hide("Your role doesn't use team messaging.")),
  })),
  ...([["staff_add_user", "Add user", "Agregar usuario"], ["staff_reset_signin", "Reset sign-in", "Restablecer acceso"], ["staff_edit_roles", "Edit staff roles", "Editar roles"]] as const).map(([id, en, es]): ChartAction => ({
    id,
    opsMenu: true,
    pending: true,
    comingSoon: "Requires identity backend (SculptSoft)",
    label: { en, es },
    group: "admin",
    menu: false,
    needsPatient: false,
    check: "role = sys_admin",
    store: [],
    allowed: ({ role }) => (role === "sys_admin" ? ok() : hide("Only a system administrator.")),
  })),
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
