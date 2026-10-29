import { createHash } from "node:crypto";
// 29 Oct patient scheduling (Mitch, Draft — pending Christi): pre-approved
// exact-once re-pin of files changed by the scheduling batch; every anchor
// must occur exactly once.
const APPROVED: Record<string, { prior: string; updated: string; pairs: [string, string][] }> = {
 "src/lib/ehr.ts": {
  "prior": "8a53351ef1c96fb6826e8266deb85122abd5f226ef1f7fc3060af2ed42fb077f",
  "updated": "55390a2d5e0e6f6ae1228511e4dc96931cf5c275cd3d61f9ec2a12e622a76c9e",
  "pairs": [
   [
    "import type { StaffRole } from \"./roles\";\nimport { bookingRightFor, canScheduleRole, checkBookingRights, isPrescriberServiceType } from \"./bookingRights\";\nimport { credentialedForService, credentialingRecordForClinician, isBillableServiceType, CREDENTIALING_NEUTRAL_LABEL, registerBookedVisitSource, registerCredentialingServiceCatalog } from \"./credentialing\";\n",
    "import type { StaffRole } from \"./roles\";\nimport { bookingRightFor, canScheduleRole, checkBookingRights, isPrescriberServiceType, serviceRoleFit } from \"./bookingRights\";\nimport { credentialedForService, credentialingRecordForClinician, isBillableServiceType, CREDENTIALING_NEUTRAL_LABEL, registerBookedVisitSource, registerCredentialingServiceCatalog } from \"./credentialing\";\n"
   ],
   [
    "export const APPT_REQUEST_SERVICE_TYPES: Record<AppointmentRequestKind, ServiceType[]> = {\n  therapy: [\"therapy_individual\", \"intake\"],\n  medication: [\"med_management\", \"controlled_med_moud\"],\n  help_choose: [\"care_coordination\", \"case_management\"],\n",
    "export const APPT_REQUEST_SERVICE_TYPES: Record<AppointmentRequestKind, ServiceType[]> = {\n  therapy: [\"therapy_individual\", \"intake\", \"family_collateral\"],\n  medication: [\"med_management\", \"controlled_med_moud\", \"psychiatric_evaluation\"],\n  help_choose: [\"care_coordination\", \"case_management\"],\n"
   ],
   [
    "  | \"sud_group_odf\"\n  | \"sud_group_iot\";\n\n",
    "  | \"sud_group_odf\"\n  | \"sud_group_iot\"\n  // 29 Oct (Mitch, Draft \u2014 pending Christi): five patient-scheduling types.\n  | \"psychiatric_evaluation\"\n  | \"sud_assessment\"\n  | \"chw_visit\"\n  | \"family_collateral\"\n  | \"nurse_visit\";\n\n"
   ],
   [
    "  deliverySystemDraft: DeliverySystemDraft;\n}\n",
    "  deliverySystemDraft: DeliverySystemDraft;\n  /**\n   * 29 Oct (Draft \u2014 pending Christi): what a patient may do with this type on\n   * /schedule. book = self-book; request = \"Ask my team\" (existing request\n   * flow); staff_only = never shown to patients (groups use the Groups tab).\n   */\n  patientAccess: PatientAccess;\n  /** Request kind used for \"Ask my team\" (request types and first-time asks). */\n  patientRequestKind?: AppointmentRequestKind;\n  /**\n   * Draft condition for patient self-booking. established = only clinicians the\n   * patient already sees for this type (first visit asks the team);\n   * asam_placement = a signed ASAM with a recorded level, otherwise hidden.\n   */\n  patientCondition?: \"established\" | \"asam_placement\";\n}\n"
   ],
   [
    "}\n\nexport interface ClinicLocation {\n  id: string;\n",
    "}\n\nexport type PatientAccess = \"book\" | \"request\" | \"staff_only\";\n/** Calm refusal when a self-booking names a group, staff-only or request type. */\nexport const SELF_BOOKING_REFUSED = \"This visit is set up by your care team. Use \u201cAsk my team\u201d or the Groups tab.\";\n\nexport interface ClinicLocation {\n  id: string;\n"
   ],
   [
    "    defaultDurationMin: 60,\n    deliverySystemDraft: { tag: \"smhs_or_nsmhs\", confirm: \"SMHS determination picks county MHP vs plan/FFS\" },\n  },\n",
    "    defaultDurationMin: 60,\n    patientAccess: \"staff_only\", deliverySystemDraft: { tag: \"smhs_or_nsmhs\", confirm: \"SMHS determination picks county MHP vs plan/FFS\" },\n  },\n"
   ],
   [
    "    defaultDurationMin: 50,\n    deliverySystemDraft: { tag: \"smhs_or_nsmhs\" },\n  },\n",
    "    defaultDurationMin: 50,\n    patientAccess: \"book\", patientCondition: \"established\", patientRequestKind: \"therapy\", deliverySystemDraft: { tag: \"smhs_or_nsmhs\" },\n  },\n"
   ],
   [
    "    defaultDurationMin: 60,\n    deliverySystemDraft: { tag: \"smhs_or_nsmhs\" },\n  },\n",
    "    defaultDurationMin: 60,\n    patientAccess: \"staff_only\", deliverySystemDraft: { tag: \"smhs_or_nsmhs\" },\n  },\n"
   ],
   [
    "    defaultDurationMin: 30,\n    deliverySystemDraft: { tag: \"nsmhs\" },\n  },\n",
    "    defaultDurationMin: 30,\n    patientAccess: \"book\", patientCondition: \"established\", patientRequestKind: \"medication\", deliverySystemDraft: { tag: \"nsmhs\" },\n  },\n"
   ],
   [
    "    defaultDurationMin: 30,\n    deliverySystemDraft: { tag: \"county_dmc_ods\", confirm: \"Confirm Tulare/Kings DMC-ODS participation; plan or FFS billing needs review\" },\n    controlledSubstanceDraft: true,\n",
    "    defaultDurationMin: 30,\n    patientAccess: \"book\", patientCondition: \"established\", patientRequestKind: \"medication\", deliverySystemDraft: { tag: \"county_dmc_ods\", confirm: \"Confirm Tulare/Kings DMC-ODS participation; plan or FFS billing needs review\" },\n    controlledSubstanceDraft: true,\n"
   ],
   [
    "    defaultDurationMin: 45,\n    deliverySystemDraft: { tag: \"county_peer\", confirm: \"Confirm county opt-in\" },\n  },\n",
    "    defaultDurationMin: 45,\n    patientAccess: \"book\", deliverySystemDraft: { tag: \"county_peer\", confirm: \"Confirm county opt-in\" },\n  },\n"
   ],
   [
    "    defaultDurationMin: 30,\n    deliverySystemDraft: { tag: \"ecm_mcp\", confirm: \"ECM enrollment only; otherwise not billed\" },\n  },\n",
    "    defaultDurationMin: 30,\n    patientAccess: \"book\", deliverySystemDraft: { tag: \"ecm_mcp\", confirm: \"ECM enrollment only; otherwise not billed\" },\n  },\n"
   ],
   [
    "    defaultDurationMin: 30,\n    deliverySystemDraft: { tag: \"non_billable\" },\n  },\n",
    "    defaultDurationMin: 30,\n    patientAccess: \"book\", deliverySystemDraft: { tag: \"non_billable\" },\n  },\n"
   ],
   [
    "  },\n  { id: \"sud_counseling\", label: \"Individual counseling (SUD)\", helper: \"One-on-one substance-use counseling.\", allowedModalities: [\"video\", \"phone\", \"in_person\"], defaultDurationMin: 50, sud: true, deliverySystemDraft: { tag: \"county_dmc_ods\", confirm: \"Confirm Tulare/Kings DMC-ODS participation\" } },\n  { id: \"sud_group_odf\", label: \"ODF group\", helper: \"Outpatient drug-free group.\", allowedModalities: [\"in_person\", \"video\"], defaultDurationMin: 90, sud: true, deliverySystemDraft: { tag: \"county_dmc_ods\", confirm: \"Confirm Tulare/Kings DMC-ODS participation\" } },\n  { id: \"sud_group_iot\", label: \"IOT group\", helper: \"Intensive outpatient group.\", allowedModalities: [\"in_person\", \"video\"], defaultDurationMin: 180, sud: true, deliverySystemDraft: { tag: \"county_dmc_ods\", confirm: \"Confirm Tulare/Kings DMC-ODS participation\" } },\n];\n",
    "  },\n  { id: \"sud_counseling\", label: \"Individual counseling (SUD)\", helper: \"One-on-one substance-use counseling.\", allowedModalities: [\"video\", \"phone\", \"in_person\"], defaultDurationMin: 50, sud: true, patientAccess: \"book\", patientCondition: \"asam_placement\", deliverySystemDraft: { tag: \"county_dmc_ods\", confirm: \"Confirm Tulare/Kings DMC-ODS participation\" } },\n  { id: \"sud_group_odf\", label: \"ODF group\", helper: \"Outpatient drug-free group.\", allowedModalities: [\"in_person\", \"video\"], defaultDurationMin: 90, sud: true, patientAccess: \"staff_only\", deliverySystemDraft: { tag: \"county_dmc_ods\", confirm: \"Confirm Tulare/Kings DMC-ODS participation\" } },\n  // 29 Oct (Mitch, Draft \u2014 pending Christi): durations, modalities and tags are Draft; no codes or rates.\n  { id: \"psychiatric_evaluation\", label: \"Psychiatric evaluation\", helper: \"A first full visit with a prescriber about your mental health and any medications.\", allowedModalities: [\"video\", \"in_person\"], defaultDurationMin: 60, patientAccess: \"request\", patientRequestKind: \"medication\", deliverySystemDraft: { tag: \"smhs_or_nsmhs\", confirm: \"SMHS determination picks county MHP vs plan/FFS\" } },\n  { id: \"sud_assessment\", label: \"ASAM assessment (SUD)\", helper: \"A substance-use assessment that finds the right level of care.\", allowedModalities: [\"video\", \"in_person\"], defaultDurationMin: 60, sud: true, patientAccess: \"staff_only\", deliverySystemDraft: { tag: \"county_dmc_ods\", confirm: \"Confirm Tulare/Kings DMC-ODS participation\" } },\n  { id: \"chw_visit\", label: \"Community health worker visit\", helper: \"Get help with health needs, benefits and getting to care.\", allowedModalities: [\"video\", \"phone\", \"in_person\"], defaultDurationMin: 30, patientAccess: \"book\", deliverySystemDraft: { tag: \"non_billable\", confirm: \"Billable CHW benefit only once credential checks are approved; otherwise not billed\" } },\n  { id: \"family_collateral\", label: \"Family session\", helper: \"A session with family or people who support you.\", allowedModalities: [\"video\", \"in_person\"], defaultDurationMin: 50, patientAccess: \"request\", patientRequestKind: \"therapy\", deliverySystemDraft: { tag: \"smhs_or_nsmhs\", confirm: \"Collateral billing needs review\" } },\n  { id: \"nurse_visit\", label: \"Nurse visit\", helper: \"A visit with a nurse for vitals, injections or health checks.\", allowedModalities: [\"in_person\"], defaultDurationMin: 20, patientAccess: \"staff_only\", deliverySystemDraft: { tag: \"nsmhs\", confirm: \"Nurse visit billing needs review\" } },\n  { id: \"sud_group_iot\", label: \"IOT group\", helper: \"Intensive outpatient group.\", allowedModalities: [\"in_person\", \"video\"], defaultDurationMin: 180, sud: true, patientAccess: \"staff_only\", deliverySystemDraft: { tag: \"county_dmc_ods\", confirm: \"Confirm Tulare/Kings DMC-ODS participation\" } },\n];\n"
   ],
   [
    "      \"sud_group_iot\",\n    ],\n",
    "      \"sud_group_iot\",\n      \"psychiatric_evaluation\",\n      \"sud_assessment\",\n      \"chw_visit\",\n      \"family_collateral\",\n      \"nurse_visit\",\n    ],\n"
   ],
   [
    "      \"care_coordination\",\n    ],\n",
    "      \"care_coordination\",\n      \"family_collateral\",\n    ],\n"
   ],
   [
    "    mediCalStatus: \"active\",\n    services: [\"med_management\", \"controlled_med_moud\", \"intake\", \"therapy_individual\"],\n    locationIds: [\"loc-porterville\"],\n",
    "    mediCalStatus: \"active\",\n    services: [\"med_management\", \"controlled_med_moud\", \"intake\", \"therapy_individual\", \"psychiatric_evaluation\"],\n    locationIds: [\"loc-porterville\"],\n"
   ],
   [
    "    mediCalStatus: \"pending\",\n    services: [\"therapy_individual\", \"case_management\"],\n    locationIds: [\"loc-visalia\"],\n",
    "    mediCalStatus: \"pending\",\n    services: [\"therapy_individual\", \"case_management\", \"family_collateral\"],\n    locationIds: [\"loc-visalia\"],\n"
   ],
   [
    "    mediCalStatus: \"active\",\n    services: [\"med_management\", \"controlled_med_moud\", \"intake\"],\n    locationIds: [\"loc-visalia\", \"loc-porterville\"],\n",
    "    mediCalStatus: \"active\",\n    services: [\"med_management\", \"controlled_med_moud\", \"intake\", \"psychiatric_evaluation\"],\n    locationIds: [\"loc-visalia\", \"loc-porterville\"],\n"
   ],
   [
    "    mediCalStatus: \"pending\",\n    services: [\"therapy_individual\"],\n    locationIds: [\"loc-visalia\"],\n",
    "    mediCalStatus: \"pending\",\n    services: [\"therapy_individual\", \"family_collateral\"],\n    locationIds: [\"loc-visalia\"],\n"
   ],
   [
    "    mediCalStatus: \"active\",\n    services: [\"sud_counseling\", \"sud_group_odf\", \"sud_group_iot\"],\n    locationIds: [\"loc-visalia\"],\n",
    "    mediCalStatus: \"active\",\n    services: [\"sud_counseling\", \"sud_group_odf\", \"sud_group_iot\", \"sud_assessment\"],\n    locationIds: [\"loc-visalia\"],\n"
   ],
   [
    "    if (!prescriber) throw new Error(\"Medication visits can only be booked with a physician or PMHNP.\");\n  }\n}\n/** Audit + clinician + patient notices for a staff booking. Part 2-neutral. */\n",
    "    if (!prescriber) throw new Error(\"Medication visits can only be booked with a physician or PMHNP.\");\n  }\n  const fit = serviceRoleFit(serviceType, STAFF_ROSTER.find((s) => s.clinicianId === clinicianId)?.role, c.credential);\n  if (!fit) throw new Error(`${c.name} doesn't offer this visit type. Pick a suggested clinician.`);\n}\n/** Audit + clinician + patient notices for a staff booking. Part 2-neutral. */\n"
   ],
   [
    "      }\n      _assertClinicianFit(input.clinicianId, input.serviceType);\n",
    "      }\n    }\n    // 29 Oct (Mitch, Draft \u2014 pending Christi): ONE booking rule for patients\n    // and staff. A self-scheduled visit must be a patient \"book\" type and never\n    // a group; then the same fit, telehealth and group-consent checks apply to\n    // everyone (credentialing for the resolved funding source and conflicts\n    // above/below already run for every booking).\n    const isSelfBooking = input.source === \"self_scheduled\" || bookRole === (\"patient\" as StaffRole);\n    if (isSelfBooking) {\n      const svcInfo = SERVICE_TYPES.find((s) => s.id === input.serviceType);\n      if (!svcInfo || svcInfo.patientAccess !== \"book\" || GROUP_SERVICE_TYPES.includes(input.serviceType ?? \"\"))\n        throw new Error(SELF_BOOKING_REFUSED);\n    }\n    if (isStaffBooking || isSelfBooking) {\n      _assertClinicianFit(input.clinicianId, input.serviceType);\n"
   ]
  ]
 },
 "src/lib/ehr-ext.ts": {
  "prior": "8b8d44ce06d322b84fbaf3d864a91ebba6696faa6c08c3a84aed174e7b9e1fa3",
  "updated": "83df6de4a25cde47f04bab6ea2ed77d6e9810343bcaef01a833571171e6e17a5",
  "pairs": [
   [
    "      { payer: \"Medi-Cal FFS\", serviceType: \"therapy_individual\", status: \"active\", effectiveAt: daysFromNow(-879) },\n      { payer: \"Tulare County DMC-ODS\", serviceType: \"sud_counseling\", status: \"not_started\" },\n",
    "      { payer: \"Medi-Cal FFS\", serviceType: \"therapy_individual\", status: \"active\", effectiveAt: daysFromNow(-879) },\n      // 29 Oct patient scheduling (fictional demo row, Draft): psychiatric evaluation enrollment.\n      { payer: \"Medi-Cal FFS\", serviceType: \"psychiatric_evaluation\", status: \"active\", effectiveAt: daysFromNow(-879) },\n      { payer: \"Tulare County DMC-ODS\", serviceType: \"sud_counseling\", status: \"not_started\" },\n"
   ]
  ]
 }
};
export const PATIENT_SCHEDULING_OCT29_FILES = Object.keys(APPROVED);
export function withApprovedPatientSchedulingOct29(path: string, source: string): string {
  const entry = APPROVED[path];
  if (!entry) return source;
  const digest = (text: string) => createHash("sha256").update(text).digest("hex");
  if (digest(source) !== entry.prior) throw new Error(`Patient scheduling prior source changed: ${path}`);
  let s = source;
  for (const [from, to] of entry.pairs) {
    if (s.split(from).length !== 2) throw new Error(`Patient scheduling anchor not exactly once: ${path}`);
    s = s.replace(from, () => to);
  }
  if (digest(s) !== entry.updated) throw new Error(`Patient scheduling replacement changed: ${path}`);
  return s;
}
