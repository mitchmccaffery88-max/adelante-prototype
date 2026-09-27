// §Item 7 — dependency-free role gate for the weekly caseload review.
import type { StaffRole } from "@/lib/roles";
export const CASELOAD_ROLES: StaffRole[] = ["ecm_provider", "cf_care_manager"];
export const ROLLUP_ROLES: StaffRole[] = ["clinical_coordinator", "sys_admin"];
export const canUseCaseloadReview = (r: StaffRole) => CASELOAD_ROLES.includes(r);
export const canSeeRollup = (r: StaffRole) => ROLLUP_ROLES.includes(r);
export const canOpenCaseloadReview = (r: StaffRole) => canUseCaseloadReview(r) || canSeeRollup(r);
