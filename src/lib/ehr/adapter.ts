// Native EHR adapter port.
//
// This is the seam between UI/feature code and whatever backend stores
// patient, appointment, and clinician data. Today the only implementation
// wraps the in-memory `AdelanteEHR` store (see ./adapters/native-memory.ts).
// Tomorrow it can be swapped for a real persistence backend without
// touching call sites — implement `EhrAdapter` and call
// `registerEhrAdapter()` at boot.
//
// Scope is deliberately narrow: only the read/write operations used across
// the app today for these three domains. Anything else keeps going through
// `AdelanteEHR` directly until it earns a place in the port.

import { AdelanteEHR } from "@/lib/ehr";

type EHR = typeof AdelanteEHR;

/** Patient reads and profile writes. */
export interface PatientAdapter {
  listPatients: EHR["listPatients"];
  getPatient: EHR["getPatient"];
  createPatient: EHR["createPatient"];
  updateProfile: EHR["updateProfile"];
}

/** Appointment lifecycle: read, book, reschedule, status changes. */
export interface AppointmentAdapter {
  listAppointments: EHR["listAppointments"];
  bookAppointment: EHR["bookAppointment"];
  rescheduleAppointment: EHR["rescheduleAppointment"];
  /** Cancellation flows through the shared status transition today. */
  updateAppointmentStatus: EHR["updateAppointmentStatus"];
}

/** Clinician directory + availability lookups used by scheduling surfaces. */
export interface ClinicianAdapter {
  listClinicians: EHR["listClinicians"];
  cliniciansForService: EHR["cliniciansForService"];
  getClinicianAvailability: EHR["getClinicianAvailability"];
}

export interface EhrAdapter extends PatientAdapter, AppointmentAdapter, ClinicianAdapter {}

let currentAdapter: EhrAdapter | null = null;

/** Register the active adapter. Call once at boot. */
export function registerEhrAdapter(adapter: EhrAdapter): void {
  currentAdapter = adapter;
}

/** Read the active adapter. Throws if none has been registered yet. */
export function getEhrAdapter(): EhrAdapter {
  if (!currentAdapter) {
    throw new Error(
      "No EhrAdapter registered. Import '@/lib/ehr/index' (which registers the default) at app boot.",
    );
  }
  return currentAdapter;
}