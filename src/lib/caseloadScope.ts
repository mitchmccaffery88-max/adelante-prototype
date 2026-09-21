/**
 * §EHR audit Phase 1g — caseload SCOPE (a default view, not a boundary).
 *
 * This module decides which patients a staff member sees FIRST on
 * `/case-manager`. It is deliberately NOT an access-control mechanism: every
 * patient remains openable through the broader view, search, and direct
 * links. Real caseload-based access enforcement is tracked separately as a
 * production requirement (SculptSoft `86bc4a5d5`) and is not solved here.
 *
 * Assignment today lives in two real fields on the patient record:
 *  - `caseManagerId`  → a `CaseManager` record (non-clinical assignment)
 *  - `primaryClinicianId` → a `Clinician` record (clinical assignment)
 * A staff roster identity links to those through `caseManagerId` /
 * `clinicianId` on `StaffMember`. Staff with neither link have no assignment
 * identity at all — that is reported honestly rather than guessed at.
 */

export type CaseloadScope = "mine" | "all";

export interface AssignmentIdentity {
  caseManagerId?: string | undefined;
  clinicianId?: string | undefined;
}

export interface AssignablePatient {
  caseManagerId?: string | undefined;
  primaryClinicianId?: string | undefined;
}

/** Honest label for the toggle — it filters the list, it does not restrict access. */
export const CASELOAD_SCOPE_NOTE =
  "Default view only. This changes what's listed, not what you're allowed to open.";

export function assignmentIdentityFor(staff: {
  caseManagerId?: string | undefined;
  clinicianId?: string | undefined;
}): AssignmentIdentity {
  return { caseManagerId: staff.caseManagerId, clinicianId: staff.clinicianId };
}

/** True when this staff identity can be matched against assignment fields at all. */
export function hasAssignmentIdentity(identity: AssignmentIdentity): boolean {
  return Boolean(identity.caseManagerId || identity.clinicianId);
}

export function isAssignedTo(
  patient: AssignablePatient,
  identity: AssignmentIdentity,
): boolean {
  if (identity.caseManagerId && patient.caseManagerId === identity.caseManagerId) return true;
  if (identity.clinicianId && patient.primaryClinicianId === identity.clinicianId) return true;
  return false;
}

/**
 * Applies the scope. `"all"` always returns everything. `"mine"` returns the
 * assigned subset — and for a staff member with no assignment identity it
 * returns an empty list rather than silently falling back to everyone, so the
 * UI can say plainly that nothing is assigned to them.
 */
export function scopeCaseload<T extends AssignablePatient>(
  patients: T[],
  identity: AssignmentIdentity,
  scope: CaseloadScope,
): T[] {
  if (scope === "all") return patients;
  return patients.filter((p) => isAssignedTo(p, identity));
}
