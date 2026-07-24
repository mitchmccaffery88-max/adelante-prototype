// Shared fixtures for the EhrAdapter contract suite. Kept minimal — only
// what the adapter methods need, so any future backend can satisfy them
// without inventing extra schema.

import type { EhrAdapter } from "../adapter";
import type { ServiceType } from "@/lib/ehr";

export interface PatientDraft {
  firstName: string;
  lastName: string;
  dob?: string;
  phone?: string;
  cin?: string;
}

export function makePatientDraft(overrides: Partial<PatientDraft> = {}): PatientDraft {
  return {
    firstName: "Test",
    lastName: "Patient",
    dob: "1990-01-01",
    phone: "+15595550000",
    cin: "99999999A",
    ...overrides,
  };
}

/**
 * Ask the adapter for a real open availability slot instead of hardcoding a
 * date. The in-memory adapter derives slots from `Date.now()`, so any fixed
 * ISO string would either be in the past or collide with the taken-slot
 * rules. This keeps the contract test portable across adapters.
 */
export function pickOpenSlot(
  adapter: EhrAdapter,
  clinicianId: string,
): { start: string; durationMin: number } {
  const slots = adapter.getClinicianAvailability(clinicianId, 14);
  const open = slots.find((s) => !s.taken);
  if (!open) throw new Error(`No open availability slot for clinician ${clinicianId}`);
  return { start: open.start, durationMin: open.durationMin };
}

export interface AppointmentDraft {
  patientId: string;
  clinicianId: string;
  start: string;
  durationMin: number;
  serviceType?: ServiceType;
  modality?: "video" | "phone" | "in_person";
  locationId?: string;
}

export function makeAppointmentDraft(
  adapter: EhrAdapter,
  patientId: string,
  clinicianId: string,
  overrides: Partial<AppointmentDraft> = {},
): AppointmentDraft {
  const slot = overrides.start
    ? { start: overrides.start, durationMin: overrides.durationMin ?? 50 }
    : pickOpenSlot(adapter, clinicianId);
  return {
    patientId,
    clinicianId,
    start: slot.start,
    durationMin: slot.durationMin,
    serviceType: "therapy_individual",
    modality: "video",
    ...overrides,
  };
}

/** First seeded clinician whose services include `serviceType`. */
export function pickClinicianForService(
  adapter: EhrAdapter,
  serviceType: ServiceType,
): { id: string; name: string } {
  const list = adapter.cliniciansForService(serviceType);
  const c = list[0];
  if (!c) throw new Error(`No clinician offers ${serviceType}`);
  return { id: c.id, name: c.name };
}