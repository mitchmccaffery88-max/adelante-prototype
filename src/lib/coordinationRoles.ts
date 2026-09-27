// §Item 6 — who may act on Clinical Coordination. Dependency-free so the nav
// registry can import it without pulling in the store.
import type { StaffRole } from "@/lib/roles";

export const COORDINATION_ROLES: StaffRole[] = ["clinical_coordinator", "sys_admin"];
export function canActOnCoordination(role: StaffRole): boolean {
  return COORDINATION_ROLES.includes(role);
}
