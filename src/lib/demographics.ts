// §Demographics & identifiers — pure edit rules shared by store and UI.
import type { StaffRole } from "@/lib/roles";

export type DemographicField =
  | "firstName"
  | "lastName"
  | "preferredName"
  | "dob"
  | "phone"
  | "email"
  | "address"
  | "preferredLanguage"
  | "emergencyContactName"
  | "emergencyContactPhone"
  | "cin"
  | "otherIds";

export const DEMOGRAPHIC_LABEL: Record<DemographicField, string> = {
  firstName: "Legal first name",
  lastName: "Legal last name",
  preferredName: "Preferred name",
  dob: "Date of birth",
  phone: "Phone",
  email: "Email",
  address: "Address",
  preferredLanguage: "Language",
  emergencyContactName: "Emergency contact name",
  emergencyContactPhone: "Emergency contact phone",
  cin: "Medi-Cal CIN",
  otherIds: "Other IDs",
};

export const DEMOGRAPHIC_FIELDS = Object.keys(DEMOGRAPHIC_LABEL) as DemographicField[];

/** Changing any of these needs a written reason. */
export const REASON_REQUIRED_FIELDS: readonly DemographicField[] = ["firstName", "lastName", "dob", "cin"];
/** Changing any of these re-runs the eligibility check flag (placeholder). */
export const ELIGIBILITY_FIELDS: readonly DemographicField[] = ["dob", "cin"];
/** The primary clinician may edit these only. */
export const CONTACT_FIELDS: readonly DemographicField[] = ["phone", "email", "address"];

/**
 * Full editors. "Intake" has no dedicated role in the roster; the ECM provider
 * runs intake today, so it stands in (assumption — change on request).
 */
export const DEMOGRAPHICS_EDITOR_ROLES: readonly StaffRole[] = [
  "ecm_provider",
  "clinical_coordinator",
  "sys_admin",
];

export function editableDemographicFields(
  role: StaffRole,
  isPrimaryClinician: boolean,
): readonly DemographicField[] {
  if (DEMOGRAPHICS_EDITOR_ROLES.includes(role)) return DEMOGRAPHIC_FIELDS;
  if (isPrimaryClinician) return CONTACT_FIELDS;
  return [];
}

export interface DemographicsChange {
  id: string;
  at: string;
  byName: string;
  role: string;
  reason?: string;
  changes: { field: DemographicField; before: string; after: string }[];
}

export const ELIGIBILITY_RECHECK_NOTE =
  "Identity details changed — eligibility re-check flagged (placeholder). Open claims may need review.";
