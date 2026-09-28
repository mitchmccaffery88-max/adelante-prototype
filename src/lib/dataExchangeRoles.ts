import type { StaffRole } from "./roles";
/** Who may open the HIE operations hub. No compliance role exists in this build. */
export const DATA_EXCHANGE_ROLES: ReadonlySet<StaffRole> = new Set<StaffRole>(["sys_admin", "clinical_coordinator"]);
