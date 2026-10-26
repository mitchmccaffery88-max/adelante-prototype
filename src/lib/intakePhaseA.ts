import { AdelanteEHR, type Appointment, type Referral, type ServiceType } from "./ehr";
import { AdelanteEHRExt } from "./ehr-ext";
import { getStaffMember, hasRoleAssignment, STAFF_ROSTER, type StaffRole } from "./roles";
import { isRestricted } from "./chartAccess";
import { availableSlots, isWithinAvailability, type BookingModality } from "./clinicianAvailability";
import { registerIntakeBookingBoundary, type IntakeBookingProof } from "./intakeBookingBoundary";
import { siteForBlock } from "./workingCalendar";
import { listSites } from "./providerReference";

export const INTAKE_PHASE_A_DRAFT = "Draft — pending clinical sign-off";
export type IntakePermission = "first_visit" | "group_request" | "completion" | "care_manager_assignment" | "clinician_assignment" | "safety_escalation";
export type IntakeActor = { role: StaffRole; staffId?: string; staffName?: string };
export function canIntakeAct(actor: IntakeActor, _permission: IntakePermission) {
  const staff = getStaffMember(actor.staffId);
  return actor.role === "intake_coordinator" && !!staff && staff.active !== false && hasRoleAssignment(staff, "intake_coordinator");
}
export function assertIntakeActor(actor: IntakeActor, permission: IntakePermission, reason: string) {
  if (!canIntakeAct(actor, permission)) throw new Error("Intake Coordinator assignment required.");
  if (reason.trim().length < 3) throw new Error("Give a reason.");
}
export type FirstVisitKind = "care_manager" | "peer" | "assessment" | "psych_evaluation" | "mat_intake";
export const FIRST_VISITS: Record<FirstVisitKind, { label: string; service: ServiceType; roles: StaffRole[] }> = {
  care_manager: { label: "First care manager contact", service: "case_management", roles: ["ecm_provider", "cf_care_manager"] },
  peer: { label: "First peer contact", service: "peer_support", roles: ["peer_specialist"] },
  assessment: { label: "Intake assessment", service: "intake", roles: ["therapist", "clinical_trainee", "pmhnp", "physician", "sud_counselor"] },
  psych_evaluation: { label: "Psych evaluation", service: "intake", roles: ["pmhnp", "physician"] },
  mat_intake: { label: "MAT intake", service: "med_management", roles: ["pmhnp", "physician"] },
};
declare module "./ehr" {
  interface Referral { intakeServices?: { source: "referral" | "packet"; kinds: FirstVisitKind[] }; }
  interface Appointment { intakeFirstVisit?: { referralId: string; kind: FirstVisitKind }; bookedBy?: { id: string; role: string }; }
}
export const CHECKLIST_KEYS = ["identity_link_checked", "contact_checked", "packet_received", "handoff_ready"] as const;
export type IntakeChecklist = Record<(typeof CHECKLIST_KEYS)[number], boolean>;
type IntakeState = { checklist: IntakeChecklist; completedAt?: string; completedBy?: string; assignments: Partial<Record<"care_manager" | "clinician", string>> };
const states = new Map<string, IntakeState>();
function state(id: string): IntakeState { return states.get(id) ?? { checklist: { identity_link_checked: false, contact_checked: false, packet_received: false, handoff_ready: false }, assignments: {} }; }
export function intakeState(id: string, actor: IntakeActor) { if (!canIntakeAct(actor, "completion")) throw new Error("Intake access required."); const s = state(id); return { ...s, checklist: { ...s.checklist }, assignments: { ...s.assignments } }; }
export function referralForIntake(id: string, allowRestricted = false): Referral {
  const r = AdelanteEHR.listReferrals().find(x => x.id === id);
  if (!r || r.status === "declined") throw new Error("Referral unavailable.");
  if (!allowRestricted && ((r.enrolledPatientId && isRestricted(r.enrolledPatientId)) || (r.substanceUseNeed && (!r.enrolledPatientId || !AdelanteEHR.isConsentCategoryAuthorized(r.enrolledPatientId, "sud_treatment"))))) throw new Error("Restricted — intake consent required.");
  return r;
}
function linked(id: string) { const r = referralForIntake(id); const p = r.enrolledPatientId ? AdelanteEHR.getPatient(r.enrolledPatientId) : undefined; if (!p || p.mergedInto) throw new Error("A confirmed patient link is required."); return { r, p }; }
export function indicatedFirstVisits(id: string, actor: IntakeActor): FirstVisitKind[] {
  if (!canIntakeAct(actor, "first_visit")) return [];
  const r = referralForIntake(id);
  return [...(r.intakeServices?.kinds ?? [])];
}
function targetFits(staffId: string, roles: StaffRole[]) { const s = getStaffMember(staffId); if (!s || s.active === false || !roles.some(role => hasRoleAssignment(s, role))) throw new Error("Active roster member with the required role needed."); return s; }
export function intakeRoster(actor: IntakeActor, roles: StaffRole[]) {
  if (!canIntakeAct(actor, "care_manager_assignment")) return [];
  return STAFF_ROSTER.filter(s => s.active !== false && roles.some(role => hasRoleAssignment(s, role))).map(s => {
    const c = s.clinicianId ? AdelanteEHR.getClinician(s.clinicianId) : undefined;
    const blocks = AdelanteEHRExt.availabilityBlocksForClinician(s.clinicianId ?? s.id);
    return { id: s.id, name: s.name, role: s.role, clinicianId: s.clinicianId, caseManagerId: s.caseManagerId,
      languages: c?.languages ?? [], locations: [...new Set([...blocks.map(b => listSites().find(x => x.id === siteForBlock(b))?.name).filter((x): x is string => !!x), ...(c?.locationIds ?? []).map(id => AdelanteEHR.listLocations().find(x => x.id === id)?.name ?? id)])],
      hours: blocks.map(b => `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][b.weekday]} ${b.start}–${b.end}`),
      caseloadCount: AdelanteEHR.listPatients().filter(p => (s.caseManagerId && p.caseManagerId === s.caseManagerId) || (s.clinicianId && p.primaryClinicianId === s.clinicianId)).length };
  });
}
export type FirstVisitSlot = { kind: FirstVisitKind; clinicianId: string; start: string; modality: BookingModality; locationId?: string };
type BookingInput = Parameters<typeof AdelanteEHR.bookAppointment>[0];
export function validateFirstVisit(input: BookingInput & { intakeBooking?: IntakeBookingProof }) {
  const proof = input.intakeBooking;
  if (!proof || !(proof.kind in FIRST_VISITS)) throw new Error("Referral-only first visit required.");
  const kind = proof.kind as FirstVisitKind;
  const actor: IntakeActor = { role: input.bookedBy?.role as StaffRole, staffId: input.bookedBy?.id };
  assertIntakeActor(actor, "first_visit", "Referral booking");
  const { r, p } = linked(proof.referralId);
  if (state(r.id).completedAt || p.id !== input.patientId || !r.intakeServices?.kinds.includes(kind)) throw new Error("This service is not indicated for this active intake.");
  const config = FIRST_VISITS[kind];
  if (input.serviceType !== config.service || input.allowPatientOverlap || input.asamTaskId || input.requestId) throw new Error("First-visit scope only.");
  if (AdelanteEHR.appointmentsForPatient(p.id).some(a => a.intakeFirstVisit?.kind === kind || (!a.intakeFirstVisit && a.serviceType === config.service))) throw new Error("A first visit of this kind already exists.");
  const staff = STAFF_ROSTER.find(s => s.clinicianId === input.clinicianId);
  if (!staff) throw new Error("An active eligible calendar is required.");
  targetFits(staff.id, config.roles);
  if (!input.modality || input.durationMin !== AdelanteEHR.getServiceType(config.service)?.defaultDurationMin || +new Date(input.start) <= Date.now() || !isWithinAvailability(input.clinicianId, input.start, { serviceType: config.service, modality: input.modality, stepMin: input.durationMin })) throw new Error("That slot is not available.");
  if (input.modality === "in_person" && (!input.locationId || !AdelanteEHR.locationsForService(config.service).some(l => l.id === input.locationId) || (AdelanteEHR.getClinician(input.clinicianId)?.locationIds && !AdelanteEHR.getClinician(input.clinicianId)?.locationIds?.includes(input.locationId)))) throw new Error("An eligible location is required.");
}
registerIntakeBookingBoundary(input => validateFirstVisit(input as BookingInput & { intakeBooking?: IntakeBookingProof }));
export function firstVisitSlots(id: string, kind: FirstVisitKind, actor: IntakeActor, modality: BookingModality) {
  if (!indicatedFirstVisits(id, actor).includes(kind)) return [];
  const c = FIRST_VISITS[kind];
  return intakeRoster(actor, c.roles).filter(s => s.clinicianId).flatMap(s => s.clinicianId ? availableSlots(s.clinicianId, { serviceType: c.service, modality, stepMin: AdelanteEHR.getServiceType(c.service)?.defaultDurationMin }).map(start => ({ clinicianId: s.clinicianId ?? "", name: s.name, start })) : []);
}
export function bookFirstVisit(actor: IntakeActor, referralId: string, slot: FirstVisitSlot, reason: string) {
  assertIntakeActor(actor, "first_visit", reason);
  const { p } = linked(referralId); const config = FIRST_VISITS[slot.kind];
  if (!config || !actor.staffId) throw new Error("First-visit scope only.");
  const a = AdelanteEHR.bookAppointment({ patientId: p.id, clinicianId: slot.clinicianId, start: slot.start, modality: slot.modality, locationId: slot.locationId, durationMin: AdelanteEHR.getServiceType(config.service)?.defaultDurationMin ?? 60, serviceType: config.service, source: "staff_scheduled", bookedBy: { id: actor.staffId, role: actor.role }, intakeBooking: { referralId, kind: slot.kind } });
  return { id: a.id, start: a.start, status: a.status };
}
export function intakeAppointmentDetail(actor: IntakeActor, referralId: string, appointmentId: string) {
  if (!canIntakeAct(actor, "first_visit")) return { restricted: true, reason: "Intake access required." } as const;
  const { p } = linked(referralId); const a = AdelanteEHR.appointmentsForPatient(p.id).find(x => x.id === appointmentId && x.intakeFirstVisit?.referralId === referralId);
  return a ? { id: a.id, start: a.start, status: a.status } : { restricted: true, reason: "Restricted — other appointments and clinical details are not available to Intake." };
}
function firstContactTask(referralId: string, patientId: string, staffId: string, dueDate: string, suffix: string) {
  const s = getStaffMember(staffId); if (!s) throw new Error("Assignee unavailable.");
  return AdelanteEHR.createCaseTask({ patientId, assignedTo: s.caseManagerId ?? s.id, title: `New patient assigned — first contact due by ${dueDate}`, dueDate, taskType: "intake_first_contact", source: "intake_referral", allowedRoles: [s.role], dedupeKey: `intake-contact:${referralId}:${staffId}:${suffix}` });
}
export function assignIntakeTeam(actor: IntakeActor, referralId: string, kind: "care_manager" | "clinician", staffId: string, dueDate: string, reason: string) {
  assertIntakeActor(actor, kind === "care_manager" ? "care_manager_assignment" : "clinician_assignment", reason);
  const { p } = linked(referralId); const s = state(referralId);
  if (s.completedAt || s.assignments[kind]) throw new Error("Intake cannot reassign after assignment or completion.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || !Number.isFinite(Date.parse(dueDate))) throw new Error("First contact due date required.");
  const target = targetFits(staffId, kind === "care_manager" ? ["ecm_provider", "cf_care_manager"] : ["therapist", "clinical_trainee", "pmhnp", "physician", "sud_counselor"]);
  if (kind === "care_manager") { if (!target.caseManagerId || p.caseManagerId) throw new Error("Only an initial care-manager assignment is allowed."); AdelanteEHR.assignCaseManager({ patientId: p.id, caseManagerId: target.caseManagerId, actorId: actor.staffId }); }
  else { if (!target.clinicianId || p.primaryClinicianId) throw new Error("Only an initial clinician assignment is allowed."); AdelanteEHR.reassignPrimaryClinician({ patientId: p.id, clinicianId: target.clinicianId, initiatedBy: "admin", context: "Intake initial assignment" }); }
  s.assignments[kind] = staffId; states.set(referralId, s);
  const task = firstContactTask(referralId, p.id, staffId, dueDate, kind); AdelanteEHR._emit();
  return { referralId, staffId, taskId: task?.id };
}
export function markIntakeComplete(actor: IntakeActor, referralId: string, checklist: IntakeChecklist, reason: string) {
  assertIntakeActor(actor, "completion", reason); const { p } = linked(referralId); const s = state(referralId);
  if (s.completedAt) throw new Error("Intake is already complete.");
  if (!CHECKLIST_KEYS.every(k => checklist[k] === true) || !p.caseManagerId || !p.primaryClinicianId) throw new Error("Complete the administrative checklist and care-team assignments first.");
  s.checklist = Object.fromEntries(CHECKLIST_KEYS.map(k => [k, true])) as IntakeChecklist; s.completedAt = new Date().toISOString(); s.completedBy = actor.staffId;
  states.set(referralId, s); AdelanteEHR._emit(); return { referralId, completedAt: s.completedAt };
}
export function requestIntakeGroup(actor: IntakeActor, referralId: string, sessionId: string, dueDate: string, reason: string) {
  assertIntakeActor(actor, "group_request", reason); const { p } = linked(referralId);
  if (state(referralId).completedAt || !actor.staffId) throw new Error("Active intake required.");
  const r = AdelanteEHR.requestJoinGroup({ patientId: p.id, sessionId, onBehalf: { referralId, staffId: actor.staffId, role: actor.role } });
  const g = AdelanteEHR.listGroupSessions().find(x => x.id === sessionId);
  const target = STAFF_ROSTER.find(s => s.active !== false && s.clinicianId === g?.clinicianId);
  if (target) firstContactTask(referralId, p.id, target.id, dueDate, `group:${r.id}`);
  return { id: r.id, status: r.status };
}