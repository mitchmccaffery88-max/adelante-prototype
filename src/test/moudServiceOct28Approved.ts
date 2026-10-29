import { createHash } from "node:crypto";
// 28 Oct MOUD service type (Mitch, Draft): pre-approved exact-once re-pin of
// files changed by the batch; every anchor must occur exactly once.
const APPROVED: Record<string, { prior: string; updated: string; pairs: [string, string][] }> = {
 "src/lib/ehr.ts": {
  "prior": "262f2f3008eb7cdd5ac062c6c40d05c4b3fed590028eb0883568cb6792bf1296",
  "updated": "b3d4984f06a754c55d59b0df1577769a60f833b63d84e12872b727cf9ac1772d",
  "pairs": [
   [
    "  therapy: [\"therapy_individual\", \"intake\"],\n  medication: [\"med_management\"],\n  help_choose: [\"care_coordination\", \"case_management\"],\n",
    "  therapy: [\"therapy_individual\", \"intake\"],\n  medication: [\"med_management\", \"controlled_med_moud\"],\n  help_choose: [\"care_coordination\", \"case_management\"],\n"
   ],
   [
    "  | \"med_management\"\n  | \"peer_support\"\n",
    "  | \"med_management\"\n  // 28 Oct MOUD service type (Draft): the only controlled-substance entry.\n  | \"controlled_med_moud\"\n  | \"peer_support\"\n"
   ],
   [
    "    defaultDurationMin: 30,\n    // No dedicated buprenorphine/controlled-medication entries exist. Mitch\n    // approved a Draft flag on the matching catalog entry, pending confirmation.\n    controlledSubstanceDraft: true,\n",
    "    defaultDurationMin: 30,\n  },\n  {\n    // 28 Oct (Mitch, Draft): the controlled-substance flag lives here only;\n    // med_management is non-controlled again. Prescriber calendars only.\n    id: \"controlled_med_moud\",\n    label: \"Controlled medication / MOUD visit\",\n    helper: \"Meet with a prescriber about a controlled medication or MOUD.\",\n    allowedModalities: [\"video\", \"in_person\"],\n    defaultDurationMin: 30,\n    controlledSubstanceDraft: true,\n"
   ],
   [
    "      \"med_management\",\n      \"peer_support\",\n",
    "      \"med_management\",\n      \"controlled_med_moud\",\n      \"peer_support\",\n"
   ],
   [
    "    mediCalStatus: \"active\",\n    services: [\"med_management\", \"intake\", \"therapy_individual\"],\n    locationIds: [\"loc-porterville\"],\n",
    "    mediCalStatus: \"active\",\n    services: [\"med_management\", \"controlled_med_moud\", \"intake\", \"therapy_individual\"],\n    locationIds: [\"loc-porterville\"],\n"
   ],
   [
    "    mediCalStatus: \"active\",\n    services: [\"med_management\", \"intake\"],\n    locationIds: [\"loc-visalia\", \"loc-porterville\"],\n",
    "    mediCalStatus: \"active\",\n    services: [\"med_management\", \"controlled_med_moud\", \"intake\"],\n    locationIds: [\"loc-visalia\", \"loc-porterville\"],\n"
   ],
   [
    "  book(demoScenarioPatientId(\"combination\"), \"c3\", 180, \"med_management\");\n  book(\"p3\", \"c1\", 120, \"therapy_individual\");\n",
    "  book(demoScenarioPatientId(\"combination\"), \"c3\", 180, \"med_management\");\n  // 28 Oct MOUD service type (Draft): one fictional future controlled/MOUD\n  // visit with the fully credentialed prescriber, through the real booking call.\n  try {\n    AdelanteEHR.bookAppointment({ patientId: \"p1\", clinicianId: \"c3\", start: demoBusinessTime(Date.now() + 14 * 86400000, 2), durationMin: 30, serviceType: \"controlled_med_moud\", modality: \"video\", source: \"staff_scheduled\", allowPatientOverlap: true });\n  } catch (e) {\n    if (typeof console !== \"undefined\") console.warn(\"[demo seed] MOUD visit\", e);\n  }\n  book(\"p3\", \"c1\", 120, \"therapy_individual\");\n"
   ]
  ]
 },
 "src/lib/ehr-ext.ts": {
  "prior": "67028b818db123969bd01c45cc2cff98611817673c5191a6b349503eb195a651",
  "updated": "0a056e5a88748329a0e522bc494c6f39bf0fbfcb37e5a32c357d2fe2efe3072e",
  "pairs": [
   [
    "  type ServiceLine,\n} from \"./rates\";\n",
    "  type ServiceLine,\n  codeMappingNeedsReview,\n  CODE_MAPPING_NEEDS_REVIEW_LABEL,\n} from \"./rates\";\n"
   ],
   [
    "  if (r.boardCertification) credentials.push({ id: `demo-credential-${++credentialSeedId}`, clinicianId: r.clinicianId ?? r.staffId, kind: \"board_cert\", number: r.boardCertification, uploadedAt: iso(), seed: true });\n  for (const e of r.enrollments) payerEnrollments.push({ id: `demo-credential-${++credentialSeedId}`, clinicianId: r.clinicianId ?? r.staffId, payer: e.payer, serviceType: e.serviceType, status: ({ active: \"enrolled\", submitted: \"pending\", not_started: \"not_enrolled\", inactive: \"terminated\" } as const)[e.status], effectiveFrom: e.effectiveAt, caqhId: e.caqhId, billingTin: \"DEMO-TIN\" });\n",
    "  if (r.boardCertification) credentials.push({ id: `demo-credential-${++credentialSeedId}`, clinicianId: r.clinicianId ?? r.staffId, kind: \"board_cert\", number: r.boardCertification, uploadedAt: iso(), seed: true });\n  // 28 Oct MOUD service type (Draft): every clinician gets an explicit\n  // per-payer row for the new type, \"not started\" unless seeded otherwise.\n  for (const payer of [...new Set(r.enrollments.map((e) => e.payer))])\n    if (!r.enrollments.some((e) => e.payer === payer && e.serviceType === \"controlled_med_moud\"))\n      r.enrollments.push({ payer, serviceType: \"controlled_med_moud\", status: \"not_started\" });\n  if (!r.enrollments.length) r.enrollments.push({ payer: \"Medi-Cal FFS\", serviceType: \"controlled_med_moud\", status: \"not_started\" });\n  for (const e of r.enrollments) payerEnrollments.push({ id: `demo-credential-${++credentialSeedId}`, clinicianId: r.clinicianId ?? r.staffId, payer: e.payer, serviceType: e.serviceType, status: ({ active: \"enrolled\", submitted: \"pending\", not_started: \"not_enrolled\", inactive: \"terminated\" } as const)[e.status], effectiveFrom: e.effectiveAt, caqhId: e.caqhId, billingTin: \"DEMO-TIN\" });\n"
   ],
   [
    "      { payer: \"Medi-Cal FFS\", serviceType: \"med_management\", status: \"active\", effectiveAt: daysFromNow(-879) },\n      { payer: \"Medi-Cal FFS\", serviceType: \"therapy_individual\", status: \"active\", effectiveAt: daysFromNow(-879) },\n",
    "      { payer: \"Medi-Cal FFS\", serviceType: \"med_management\", status: \"active\", effectiveAt: daysFromNow(-879) },\n      // 28 Oct MOUD service type: the fully credentialed demo prescriber.\n      { payer: \"Medi-Cal FFS\", serviceType: \"controlled_med_moud\", status: \"active\", effectiveAt: daysFromNow(-879) },\n      { payer: \"Medi-Cal FFS\", serviceType: \"therapy_individual\", status: \"active\", effectiveAt: daysFromNow(-879) },\n"
   ],
   [
    "    license: { licenseType: \"MD\", number: \"DEMO-LIC-0005\", state: \"CA\", issuedAt: daysFromNow(-7789), expiresAt: daysFromNow(500), verificationSource: \"medical_board_ca\", verifiedAt: daysFromNow(-10), verifiedBy: \"s-cred1\", method: \"manual\" },\n        dea: { number: \"DEMO-LIC-0006\", expiresAt: daysFromNow(600), verifiedAt: daysFromNow(-30) },\n    boardCertification: \"Psychiatry\",\n",
    "    license: { licenseType: \"MD\", number: \"DEMO-LIC-0005\", state: \"CA\", issuedAt: daysFromNow(-7789), expiresAt: daysFromNow(500), verificationSource: \"medical_board_ca\", verifiedAt: daysFromNow(-10), verifiedBy: \"s-cred1\", method: \"manual\" },\n        // 28 Oct MOUD service type: DEA expires before controlled visits booked 21+ days out.\n    dea: { number: \"DEMO-LIC-0006\", expiresAt: daysFromNow(20), verifiedAt: daysFromNow(-30) },\n    boardCertification: \"Psychiatry\",\n"
   ],
   [
    "      const line = lineFor(appt.fundingLane, appt.serviceType, appt.patientId);\n      const code = defaultCodeFor(appt.serviceType, line);\n",
    "      const line = lineFor(appt.fundingLane, appt.serviceType, appt.patientId);\n      const needsReview = codeMappingNeedsReview(appt.serviceType);\n      const code = defaultCodeFor(appt.serviceType, line);\n"
   ],
   [
    "      claim.serviceDate = serviceDate;\n      claim.serviceCode = code;\n      claim.codeSource = \"default\";\n",
    "      claim.serviceDate = serviceDate;\n      if (!needsReview) claim.serviceCode = code;\n      claim.codeSource = \"default\";\n"
   ],
   [
    "      claim.unitsSource = noteMin !== undefined ? \"note\" : \"schedule\";\n      applyPricing(claim);\n    }\n    claims.push(claim);\n",
    "      claim.unitsSource = noteMin !== undefined ? \"note\" : \"schedule\";\n      applyPricing(claim);\n      if (needsReview) claim.noRateReason = CODE_MAPPING_NEEDS_REVIEW_LABEL;\n    }\n    claims.push(claim);\n"
   ]
  ]
 }
};
export function withApprovedMoudServiceOct28(path: string, source: string): string {
  const entry = APPROVED[path];
  if (!entry) return source;
  const digest = (text: string) => createHash("sha256").update(text).digest("hex");
  if (digest(source) !== entry.prior) throw new Error(`MOUD service prior source changed: ${path}`);
  let s = source;
  for (const [from, to] of entry.pairs) {
    if (s.split(from).length !== 2) throw new Error(`MOUD service anchor not exactly once: ${path}`);
    s = s.replace(from, () => to);
  }
  if (digest(s) !== entry.updated) throw new Error(`MOUD service replacement changed: ${path}`);
  return s;
}
