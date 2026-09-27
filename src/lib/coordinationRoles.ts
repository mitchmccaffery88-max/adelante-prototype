// §Item 6 — who may act on Clinical Coordination. Dependency-free so the nav
// registry can import it without pulling in the store.
import type { StaffRole } from "@/lib/roles";

export const COORDINATION_ROLES: StaffRole[] = ["clinical_coordinator", "sys_admin"];
export function canActOnCoordination(role: StaffRole): boolean {
  return COORDINATION_ROLES.includes(role);
}

/** Read-only viewers (product owner approved): status, coverage, Unassigned. No actions, no audit list. */
export const COORDINATION_VIEW_ROLES: StaffRole[] = ["therapist", "pmhnp", "ecm_provider"];
export function canViewCoordination(role: StaffRole): boolean {
  return canActOnCoordination(role) || COORDINATION_VIEW_ROLES.includes(role);
}
