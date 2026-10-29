import { createHash } from "node:crypto";
// 30 Oct patient scheduling finish (Mitch, Draft — pending Christi):
// pre-approved exact-once re-pin for CHW/nurse calendars, missing services
// list = none, category group capacity and ASAM visits on sud_assessment.
// Every anchor must occur exactly once.
const APPROVED: Record<string, { prior: string; updated: string; pairs: [string, string][] }> = {
 "src/lib/ehr.ts": {
  "prior": "55390a2d5e0e6f6ae1228511e4dc96931cf5c275cd3d61f9ec2a12e622a76c9e",
  "updated": "261983d2b85abbe687ef7d8b629a324ee82e36e5e149f3c9230212110e6c1269",
  "pairs": [
   [
    "      \"family_collateral\",\n    ],\n",
    "      \"family_collateral\",\n      // 30 Oct (Draft): LPHA \u2014 ASAM visits now book as the SUD assessment type.\n      \"sud_assessment\",\n    ],\n"
   ],
   [
    "export const GROUP_CAPACITY_MAX = 12;\n\n",
    "export const GROUP_CAPACITY_MAX = 12;\n/** 30 Oct: non-billable open groups \u2014 capacity set by the facilitator. */\nexport const OPEN_GROUP_CAPACITY_MIN = 1;\n/** Draft \u2014 pending clinical sign-off: pre-filled capacity for a new open group. */\nexport const OPEN_GROUP_CAPACITY_DEFAULT_DRAFT = 20;\nexport const OPEN_GROUP_CAPACITY_DRAFT_LABEL = \"Draft \u2014 pending clinical sign-off\";\n/** The capacity rule that applies to a group category. */\nexport function groupCapacityRule(category: GroupCategory): { min: number; max?: number; defaultCapacity: number; draft: boolean } {\n  return isBillableGroupCategory(category)\n    ? { min: GROUP_CAPACITY_MIN, max: GROUP_CAPACITY_MAX, defaultCapacity: 8, draft: false }\n    : { min: OPEN_GROUP_CAPACITY_MIN, defaultCapacity: OPEN_GROUP_CAPACITY_DEFAULT_DRAFT, draft: true };\n}\n\n"
   ],
   [
    " */\nfunction _assertGroupCapacity(capacity: number): void {\n  if (!Number.isFinite(capacity) || capacity < GROUP_CAPACITY_MIN)\n",
    " */\nfunction _assertGroupCapacity(capacity: number, category: GroupCategory = \"sud_clinical_preauth\"): void {\n  // 30 Oct (Mitch, Draft \u2014 pending Christi): only billable groups carry the\n  // DHCS 2\u201312 range. Non-billable open groups take a facilitator-set capacity.\n  if (!isBillableGroupCategory(category)) {\n    if (!Number.isInteger(capacity) || capacity < OPEN_GROUP_CAPACITY_MIN)\n      throw new Error(`Set a capacity of at least ${OPEN_GROUP_CAPACITY_MIN} for this open group.`);\n    return;\n  }\n  if (!Number.isFinite(capacity) || capacity < GROUP_CAPACITY_MIN)\n"
   ],
   [
    "  if (!c || !serviceType) return;\n  if (c.services && !c.services.includes(serviceType))\n    throw new Error(`${c.name} doesn't offer this visit type. Pick a suggested clinician.`);\n",
    "  if (!c || !serviceType) return;\n  // 30 Oct (Draft): a missing services list offers nothing.\n  if (!(c.services ?? []).includes(serviceType))\n    throw new Error(`${c.name} doesn't offer this visit type. Pick a suggested clinician.`);\n"
   ],
   [
    "    return clinicians.filter((c) => {\n      const svcOk = !serviceType || !c.services || c.services.includes(serviceType);\n      const locOk = !opts?.locationId || !c.locationIds || c.locationIds.includes(opts.locationId);\n",
    "    return clinicians.filter((c) => {\n      const svcOk = !serviceType || (c.services ?? []).includes(serviceType);\n      const locOk = !opts?.locationId || !c.locationIds || c.locationIds.includes(opts.locationId);\n"
   ],
   [
    "    if (!input.topic.trim()) throw new Error(\"Give the group a topic.\");\n    _assertGroupCapacity(input.capacity);\n    const row: GroupSession = {\n",
    "    if (!input.topic.trim()) throw new Error(\"Give the group a topic.\");\n    _assertGroupCapacity(input.capacity, input.category ?? \"sud_clinical_preauth\");\n    const row: GroupSession = {\n"
   ],
   [
    "    if (!row) throw new Error(\"Group not found.\");\n    if (patch.capacity !== undefined) _assertGroupCapacity(patch.capacity);\n    Object.assign(row, patch);\n",
    "    if (!row) throw new Error(\"Group not found.\");\n    if (patch.capacity !== undefined || patch.category !== undefined)\n      _assertGroupCapacity(patch.capacity ?? row.capacity, patch.category ?? row.category);\n    Object.assign(row, patch);\n"
   ],
   [
    "  const therapist = AdelanteEHR.listClinicians().find(\n    (c) => (!c.services || c.services.includes(\"therapy_individual\")) && AdelanteEHR.canBook(c.id).ok,\n  );\n",
    "  const therapist = AdelanteEHR.listClinicians().find(\n    (c) => (c.services ?? []).includes(\"therapy_individual\") && AdelanteEHR.canBook(c.id).ok,\n  );\n"
   ]
  ]
 },
 "src/routes/clinician.tsx": {
  "prior": "8a0a9d6f0f7afd9bf69ddae5c78f868ac9c6faafe940debdfb6c3c4c19bfc776",
  "updated": "39ed372e819d4da271829095c28bca6cbb2d51e40621220281516b74bbcd9de0",
  "pairs": [
   [
    "    if (!bookAsamTaskId || !asamTask) return;\n    openBookVisit({ patientId: asamTask.patientId, serviceType: \"intake\", asamTaskId: bookAsamTaskId });\n    navigate({ to: \"/clinician\", search: {} });\n",
    "    if (!bookAsamTaskId || !asamTask) return;\n    openBookVisit({ patientId: asamTask.patientId, serviceType: \"sud_assessment\", asamTaskId: bookAsamTaskId });\n    navigate({ to: \"/clinician\", search: {} });\n"
   ]
  ]
 }
};
export const PATIENT_SCHEDULING_OCT30_FILES = Object.keys(APPROVED);
export function withApprovedPatientSchedulingOct30(path: string, source: string): string {
  const entry = APPROVED[path];
  if (!entry) return source;
  const digest = (text: string) => createHash("sha256").update(text).digest("hex");
  if (digest(source) !== entry.prior) throw new Error(`Patient scheduling Oct 30 prior source changed: ${path}`);
  let s = source;
  for (const [from, to] of entry.pairs) {
    if (s.split(from).length !== 2) throw new Error(`Patient scheduling Oct 30 anchor not exactly once: ${path}`);
    s = s.replace(from, () => to);
  }
  if (digest(s) !== entry.updated) throw new Error(`Patient scheduling Oct 30 replacement changed: ${path}`);
  return s;
}
