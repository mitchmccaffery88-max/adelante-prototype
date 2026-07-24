// In-memory native EHR adapter — wraps the existing `AdelanteEHR` store so
// today's behavior is preserved 1:1. Swap this for a real persistence
// adapter (Supabase, REST, etc.) when the native Adelante EHR backend is
// wired up; call sites don't change.

import { AdelanteEHR } from "@/lib/ehr";
import type { EhrAdapter } from "../adapter";

export const nativeMemoryEhrAdapter: EhrAdapter = {
  // Patient
  listPatients: AdelanteEHR.listPatients,
  getPatient: AdelanteEHR.getPatient,
  createPatient: AdelanteEHR.createPatient.bind(AdelanteEHR),
  updateProfile: AdelanteEHR.updateProfile.bind(AdelanteEHR),

  // Appointment
  listAppointments: AdelanteEHR.listAppointments,
  bookAppointment: AdelanteEHR.bookAppointment.bind(AdelanteEHR),
  rescheduleAppointment: AdelanteEHR.rescheduleAppointment.bind(AdelanteEHR),
  updateAppointmentStatus: AdelanteEHR.updateAppointmentStatus.bind(AdelanteEHR),

  // Clinician
  listClinicians: AdelanteEHR.listClinicians,
  cliniciansForService: AdelanteEHR.cliniciansForService.bind(AdelanteEHR),
  getClinicianAvailability: AdelanteEHR.getClinicianAvailability.bind(AdelanteEHR),
};