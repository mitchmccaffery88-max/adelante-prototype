// §Batch G1 — "SUD reporting access": a narrow, grantable capability.
// Holders may see and prepare CLIENT-LEVEL county reporting data only:
// CalOMS admission/discharge/annual-update fields and blockers, DMC-ODS
// export rows, the TPS client list and returned CalOMS error detail.
// It NEVER grants notes, therapy content, ASAM narrative/dimension ratings,
// care plans or medication detail — it is deliberately separate from
// roleSeesAsam / screeners_sud, and no role's record-class access widens.
// Every client-level view/export still goes through disclose() / access log.
import type { StaffRole } from "@/lib/roles";

export const SUD_REPORTING_ACCESS_LABEL = "SUD reporting access";

/** THE grant list. Adding a role later is one line here (covered by the snapshot test). */
// §Privacy P1 — billing_coordinator removed: billing roles see no SUD/CalOMS
// client detail. The list is intentionally empty (deny by default).
export const SUD_REPORTING_ACCESS_ROLES: readonly StaffRole[] = [];

export const SUD_REPORTING_POST_MVP_NOTE =
  "Post-MVP candidates — requires executive RBAC approval: a future Data & Outcomes Analyst role and a future Compliance Officer role (not created).";

export function hasSudReportingAccess(role: StaffRole): boolean {
  return SUD_REPORTING_ACCESS_ROLES.includes(role);
}
