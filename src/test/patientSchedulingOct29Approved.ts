import { createHash } from "node:crypto";
// 29 Oct patient scheduling (Mitch, Draft — pending Christi): pre-approved
// exact-once re-pin of files changed by the scheduling batch; every anchor
// must occur exactly once.
const APPROVED: Record<string, { prior: string; updated: string; pairs: [string, string][] }> = {
 "src/lib/ehr.ts": {
  "prior": "8a53351ef1c96fb6826e8266deb85122abd5f226ef1f7fc3060af2ed42fb077f",
  "updated": "5ffb24e45b947341f9855a11605a8734724b280421ce4968653ad436754f0698",
  "pairs": [
   [
    "  deliverySystemDraft: DeliverySystemDraft;\n}\n",
    "  deliverySystemDraft: DeliverySystemDraft;\n  /**\n   * 29 Oct (Draft \u2014 pending Christi): what a patient may do with this type on\n   * /schedule. book = self-book; request = \"Ask my team\" (existing request\n   * flow); staff_only = never shown to patients (groups use the Groups tab).\n   */\n  patientAccess: PatientAccess;\n  /** Request kind used for \"Ask my team\" (request types and first-time asks). */\n  patientRequestKind?: AppointmentRequestKind;\n  /**\n   * Draft condition for patient self-booking. established = only clinicians the\n   * patient already sees for this type (first visit asks the team);\n   * asam_placement = a signed ASAM with a recorded level, otherwise hidden.\n   */\n  patientCondition?: \"established\" | \"asam_placement\";\n}\n"
   ],
   [
    "}\n\nexport interface ClinicLocation {\n  id: string;\n",
    "}\n\nexport type PatientAccess = \"book\" | \"request\" | \"staff_only\";\n\nexport interface ClinicLocation {\n  id: string;\n"
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
    "  },\n  { id: \"sud_counseling\", label: \"Individual counseling (SUD)\", helper: \"One-on-one substance-use counseling.\", allowedModalities: [\"video\", \"phone\", \"in_person\"], defaultDurationMin: 50, sud: true, patientAccess: \"book\", patientCondition: \"asam_placement\", deliverySystemDraft: { tag: \"county_dmc_ods\", confirm: \"Confirm Tulare/Kings DMC-ODS participation\" } },\n  { id: \"sud_group_odf\", label: \"ODF group\", helper: \"Outpatient drug-free group.\", allowedModalities: [\"in_person\", \"video\"], defaultDurationMin: 90, sud: true, patientAccess: \"staff_only\", deliverySystemDraft: { tag: \"county_dmc_ods\", confirm: \"Confirm Tulare/Kings DMC-ODS participation\" } },\n  { id: \"sud_group_iot\", label: \"IOT group\", helper: \"Intensive outpatient group.\", allowedModalities: [\"in_person\", \"video\"], defaultDurationMin: 180, sud: true, patientAccess: \"staff_only\", deliverySystemDraft: { tag: \"county_dmc_ods\", confirm: \"Confirm Tulare/Kings DMC-ODS participation\" } },\n];\n"
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
