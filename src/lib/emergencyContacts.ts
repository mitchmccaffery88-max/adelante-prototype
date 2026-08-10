/**
 * §Emergency contacts — multi-contact model.
 *
 * The record historically carried a single `patient.emergencyContact`
 * ({ name, relationship, phone }). Patients routinely have more than one, and
 * the fields were too thin to actually reach anyone. This module owns the
 * normalization between the legacy single field and the `emergencyContacts`
 * list, so every surface reads the same shape.
 *
 * No arbitrary cap: the only caps in this codebase are clinical/billing ones
 * (e.g. `CHW_MAX_UNITS_PER_DAY`, `MAX_UPLOAD_BYTES`) that encode a real rule.
 * There is no rule limiting how many people someone may list.
 */

import type { EmergencyContact, Patient } from "@/lib/ehr";

export function emptyEmergencyContact(): EmergencyContact {
  return { name: "", relationship: "", phone: "", email: "", address: "", notes: "" };
}

/** A contact is worth keeping if it names someone. */
export function isMeaningfulContact(c: EmergencyContact): boolean {
  return c.name.trim().length > 0;
}

/** Drop blank rows and trim. Order is preserved — the first is the primary. */
export function cleanEmergencyContacts(list: EmergencyContact[]): EmergencyContact[] {
  return list.filter(isMeaningfulContact).map((c) => ({
    name: c.name.trim(),
    relationship: c.relationship.trim(),
    phone: c.phone.trim(),
    ...(c.email?.trim() ? { email: c.email.trim() } : {}),
    ...(c.address?.trim() ? { address: c.address.trim() } : {}),
    ...(c.notes?.trim() ? { notes: c.notes.trim() } : {}),
  }));
}

/**
 * Read a patient's contacts as a list, falling back to the legacy single
 * field so records written before this change still display.
 */
export function readEmergencyContacts(
  patient: Pick<Patient, "emergencyContacts" | "emergencyContact"> | undefined,
): EmergencyContact[] {
  if (!patient) return [];
  if (patient.emergencyContacts?.length) return patient.emergencyContacts;
  return patient.emergencyContact ? [patient.emergencyContact] : [];
}
