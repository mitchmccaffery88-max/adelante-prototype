// §Batch G3 — patient self-booking on the same engine as staff booking:
// eligible clinicians (bookingFlow.eligibleClinicians rules), real weekly
// availability (clinicianAvailability.ts), telehealth consent, conflicts
// (bookAppointment), and the timely-access "offered" stamp (the booking sweep
// in timelyAccess.ts stamps every new booked slot). SUD visit types are the
// patient's own information and are shown unmasked to the patient.
import { AdelanteEHR, TELEHEALTH_CONSENT_CATEGORY, type Appointment, type Clinician, type Patient, type ServiceType } from "./ehr";
import type { StaffRole } from "./roles";
import { eligibleClinicians } from "./bookingFlow";
import { availableSlots, hasAvailabilitySet, type BookingModality } from "./clinicianAvailability";

/** Pseudo-role used in audit rows when the patient acts for themselves. */
export const PATIENT_ACTOR_ROLE = "patient" as StaffRole;

export interface PatientClinicianOption {
  clinician: Clinician;
  assigned: boolean;
  hasHours: boolean;
}

/** The patient's assigned clinician first, then other eligible clinicians for the visit type. */
export function patientBookableClinicians(patient: Patient | undefined, serviceType: ServiceType | "", modality?: BookingModality): PatientClinicianOption[] {
  if (!patient || !serviceType) return [];
  const list = eligibleClinicians(serviceType, patient, { role: PATIENT_ACTOR_ROLE, clinicianId: patient.primaryClinicianId } as never, modality);
  return list
    .map((s) => ({ clinician: s.clinician, assigned: s.clinician.id === patient.primaryClinicianId, hasHours: hasAvailabilitySet(s.clinician.id) }))
    .sort((a, b) => Number(b.assigned) - Number(a.assigned) || Number(b.hasHours) - Number(a.hasHours));
}

export function patientSlots(clinicianId: string, serviceType: ServiceType | "", modality: BookingModality, excludeApptId?: string): string[] {
  if (!clinicianId || !serviceType) return [];
  return availableSlots(clinicianId, { serviceType, modality, excludeApptId });
}

export type PatientPrecheck = { ok: true } | { ok: false; reason: string; next: string };

export function patientPrecheck(patient: Patient | undefined, modality: BookingModality): PatientPrecheck {
  if (!patient) return { ok: false, reason: "noPatient", next: "" };
  if (modality !== "in_person" && !AdelanteEHR.isConsentCategoryAuthorized(patient.id, TELEHEALTH_CONSENT_CATEGORY))
    return { ok: false, reason: "telehealth_consent", next: "in_person_or_ask" };
  return { ok: true };
}

export interface PatientSelfBookInput {
  patientId: string;
  clinicianId: string;
  start: string;
  serviceType: ServiceType;
  modality: BookingModality;
  locationId?: string;
  durationMin?: number;
}

/** Store function for the `patient_self_book` registry action. Re-checks every rule. */
export function patientSelfBook(input: PatientSelfBookInput): Appointment {
  const patient = AdelanteEHR.getPatient(input.patientId);
  if (!patient) throw new Error("That person isn't in the record.");
  const options = patientBookableClinicians(patient, input.serviceType, input.modality);
  if (!options.some((o) => o.clinician.id === input.clinicianId)) throw new Error("That clinician can't be booked for this visit type.");
  const pre = patientPrecheck(patient, input.modality);
  if (!pre.ok) throw new Error("No telehealth consent on file. Choose in person, or ask your care team.");
  if (!patientSlots(input.clinicianId, input.serviceType, input.modality).includes(new Date(input.start).toISOString()))
    throw new Error("That time isn't open on this clinician's schedule. Please pick another time.");
  const svc = AdelanteEHR.getServiceType(input.serviceType);
  return AdelanteEHR.bookAppointment({
    patientId: patient.id,
    clinicianId: input.clinicianId,
    start: input.start,
    durationMin: input.durationMin ?? svc?.defaultDurationMin ?? 50,
    serviceType: input.serviceType,
    modality: input.modality,
    locationId: input.modality === "in_person" ? input.locationId : undefined,
    source: "self_scheduled",
    bookedBy: { id: patient.id, role: "patient" },
  });
}
