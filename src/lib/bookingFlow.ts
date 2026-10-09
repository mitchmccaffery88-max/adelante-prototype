// §Scheduling S1/S3 — read-only helpers for the "Book a visit" drawer.
// Separates ACTOR (who books), PATIENT (who it's for) and TARGET CLINICIAN
// (whose calendar). No writes here: booking goes through runAction →
// bookAppointment, which re-checks every rule below (the drawer only shows
// the reason early, inline).
import { AdelanteEHR, TELEHEALTH_CONSENT_CATEGORY, GROUP_SERVICE_TYPES, groupConsentBlock, type Appointment, type Clinician, type Patient, type ServiceType } from "./ehr";
import type { StaffRole } from "./roles";
import { bookingRightFor, checkBookingRights, isPrescriberServiceType, isSudServiceType } from "./bookingRights";
import { myCaseload, type ActingIdentity } from "./myWork";
import { availableSlots } from "./clinicianAvailability";
import { isActiveStaff } from "./staffLifecycle";
import { isBookableClinician } from "./staffProfile";

export interface BookingActor extends ActingIdentity {
  role: StaffRole;
}

/** Visit-type label with Part 2 masking: SUD types read "Clinical visit" to roles without SUD visit access. */
export function visitTypeLabel(serviceType: ServiceType | undefined, role: StaffRole | "patient"): string {
  if (!serviceType) return "Clinical visit";
  if (role !== "patient" && isSudServiceType(serviceType) && !bookingRightFor(role).sudVisits) return "Clinical visit";
  if (role === "billing" || role === "sys_admin") return "Clinical visit";
  return AdelanteEHR.getServiceType(serviceType)?.label ?? "Clinical visit";
}

/** Service types this role may book (SUD types hidden, not stubbed, for roles without SUD visit access). */
export function bookableServiceTypes(role: StaffRole) {
  const r = bookingRightFor(role);
  if (r.scope === "none") return [];
  return AdelanteEHR.listServiceTypes().filter((s) => r.sudVisits || !isSudServiceType(s.id));
}

/** Patients this actor may book for: caseload-scoped roles see their caseload only. */
export function bookablePatients(actor: BookingActor): Patient[] {
  const r = bookingRightFor(actor.role);
  if (r.scope === "none") return [];
  if (r.scope === "caseload") return myCaseload(actor);
  return AdelanteEHR.listPatients();
}

const PRESCRIBER_CRED = /PMHNP|\bM\.?D\.?\b|\bD\.?O\.?\b/i;

export interface ClinicianSuggestion {
  clinician: Clinician;
  languageFit: boolean;
  own: boolean;
  fit: string[];
}

/** Eligible clinicians for the service: offers the service, license valid, prescriber-only for med visits, language fit ranked first. */
export function eligibleClinicians(serviceType: ServiceType, patient: Patient | undefined, actor: BookingActor, modality?: "video" | "phone" | "in_person"): ClinicianSuggestion[] {
  const today = new Date().toISOString().slice(0, 10);
  const lang = patient?.preferredLanguage ?? "en";
  return AdelanteEHR.listClinicians()
    .filter((c) => isActiveStaff(c.id) && isBookableClinician(c.id))
    .filter((c) => (c.services ? c.services.includes(serviceType) : !isSudServiceType(serviceType)))
    .filter((c) => !c.licenseExpiresOn || c.licenseExpiresOn >= today)
    .filter((c) => !isPrescriberServiceType(serviceType) || PRESCRIBER_CRED.test(c.credential))
    .filter((c) => modality !== "in_person" || (c.locationIds?.length ?? 0) > 0 || !c.locationIds)
    .map((c) => {
      const languageFit = !c.languages || (c.languages as string[]).includes(lang);
      const fit = [c.credential, languageFit ? (lang === "es" ? "Speaks Spanish" : "Language fit") : "Interpreter needed"];
      return { clinician: c, languageFit, own: c.id === actor.clinicianId, fit };
    })
    .sort((a, b) => Number(b.own) - Number(a.own) || Number(b.languageFit) - Number(a.languageFit) || a.clinician.name.localeCompare(b.clinician.name));
}

/** Open slots from the clinician's real weekly availability (clinicianAvailability.ts), conflicts skipped. */
export function openSlots(clinicianId: string, opts: { serviceType?: ServiceType; modality?: "video" | "phone" | "in_person"; now?: Date; days?: number } = {}): string[] {
  return availableSlots(clinicianId, opts);
}

export type BookingPrecheck = { ok: true } | { ok: false; reason: string; next: string };

/** Same rules bookAppointment enforces, surfaced before the button is pressed. */
export function precheckBooking(input: { actor: BookingActor; patient?: Patient; serviceType: ServiceType; clinicianId?: string; modality: "video" | "phone" | "in_person"; asam?: boolean }): BookingPrecheck {
  if (!input.patient) return { ok: false, reason: "Pick a patient.", next: "Choose someone from the list." };
  const inCaseload = bookablePatients(input.actor).some((p) => p.id === input.patient!.id);
  const r = checkBookingRights({ role: input.actor.role, op: "book", inCaseload, serviceType: input.serviceType, asam: input.asam });
  if (!r.ok) return r;
  if (!input.clinicianId) return { ok: false, reason: "Choose whose calendar to book on.", next: "Pick a clinician from the suggestions." };
  if (input.modality !== "in_person" && !AdelanteEHR.isConsentCategoryAuthorized(input.patient.id, TELEHEALTH_CONSENT_CATEGORY))
    return { ok: false, reason: "No telehealth consent on file.", next: "Capture telehealth consent in the chart's Consents section, or book in person." };
  if (GROUP_SERVICE_TYPES.includes(input.serviceType)) {
    const g = groupConsentBlock(input.patient.id);
    if (g) return { ok: false, reason: g, next: "Send the Group participation form from the chart's Consents section." };
  }
  return { ok: true };
}

/** Upcoming visits for the actor's scheduling tile: coordinator → all; others → caseload (plus own calendar). */
export function upcomingForScheduling(actor: BookingActor, clinicianFilter?: string, now = Date.now()): Appointment[] {
  const r = bookingRightFor(actor.role);
  const ids = r.scope === "any" ? null : new Set(bookablePatients(actor).map((p) => p.id));
  return AdelanteEHR.listAppointments()
    .filter((a) => a.status === "scheduled" && +new Date(a.start) >= now)
    .filter((a) => !ids || ids.has(a.patientId) || (!!actor.clinicianId && a.clinicianId === actor.clinicianId))
    .filter((a) => !clinicianFilter || a.clinicianId === clinicianFilter)
    .sort((a, b) => +new Date(a.start) - +new Date(b.start));
}

/** Opens the global "Book a visit" drawer. */
export interface BookVisitRequest {
  patientId?: string;
  serviceType?: ServiceType;
  requestId?: string;
  asamTaskId?: string;
}
export const BOOK_VISIT_EVENT = "adelante:book-visit";
export function openBookVisit(detail: BookVisitRequest = {}) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent<BookVisitRequest>(BOOK_VISIT_EVENT, { detail }));
}
