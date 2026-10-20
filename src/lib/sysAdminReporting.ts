// Privacy P3 (Mitch, Oct 20) — sys_admin sees reporting SUD / CalOMS / ASAM as
// de-identified TOTALS over the same consent-permitted cohort as the clinical
// coordinator, hidden entirely below 11. Never rows, names or chart access.
// Draft — pending clinical sign-off.
import type { Patient } from "./ehr";
import { aggregatePatients, asamAccessMode, coordinatorConsentedPatients, type AsamAccessMode } from "./asamReporting";
import { belowMinimumCohort } from "./cohortGuard";
import type { StaffRole } from "./roles";

export const SYS_ADMIN_TOTALS_ROLES: readonly StaffRole[] = ["sys_admin"];

export function reportingSudMode(role: StaffRole): AsamAccessMode | null {
  const mode = asamAccessMode(role);
  if (mode) return mode;
  if (SYS_ADMIN_TOTALS_ROLES.includes(role) && !belowMinimumCohort(coordinatorConsentedPatients().length)) return "totals";
  return null;
}

/** Patients counted in reporting SUD totals for this role ([] when hidden). */
export function reportingSudCohort(role: StaffRole): Patient[] {
  if (asamAccessMode(role)) return aggregatePatients(role);
  return reportingSudMode(role) === "totals" ? coordinatorConsentedPatients() : [];
}
