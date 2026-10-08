// §Access A1 — dependency-free so the nav registry can import it.
import type { StaffRole } from "./roles";
/** Compliance monitoring viewers (Quality & compliance). Draft — pending exec RBAC review. */
export const COMPLIANCE_ROLES: readonly StaffRole[] = ["sys_admin", "credentialing_coordinator"];
