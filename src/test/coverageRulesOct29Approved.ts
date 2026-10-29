import { createHash } from "node:crypto";
// 29 Oct coverage rules (Mitch, Draft): pre-approved exact-once re-pin of files
// changed by the payment-and-coverage batch (incl. the c5 demo rename); every
// anchor must occur exactly once.
const APPROVED: Record<string, { prior: string; updated: string; pairs: [string, string][] }> = {
 "src/components/credentials/CredentialingToday.tsx": {
  "prior": "cb0d6a6f8ed4f6d28d7f573d9d568db2d5fc6ee3c65b8d2c268a75915f826736",
  "updated": "6f97626e8b770e0c0c1a046e25aac822c4632ebbf41e41353b56fec28a89a1e9",
  "pairs": [
   [
    "  EXCLUSION_LISTS,\n} from \"@/lib/credentialing\";\n",
    "  EXCLUSION_LISTS,\n  roleCredentialGaps,\n  UNLICENSED_ROLE_REQUIREMENTS_DRAFT,\n} from \"@/lib/credentialing\";\n"
   ],
   [
    "  blocked: UserX,\n} as const;\n",
    "  blocked: UserX,\n  role_credentials: CircleAlert,\n} as const;\n"
   ],
   [
    "\n      <div className=\"grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5\" data-testid=\"cred-today-tiles\">\n        {tiles.map((t) => {\n",
    "\n      <div className=\"grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6\" data-testid=\"cred-today-tiles\">\n        {tiles.map((t) => {\n"
   ],
   [
    "\n      <Card className=\"space-y-2 p-4\" data-testid=\"cred-monitor-channels\">\n",
    "\n      <RoleCredentialsCard />\n\n      <Card className=\"space-y-2 p-4\" data-testid=\"cred-monitor-channels\">\n"
   ],
   [
    "    </Card>\n  );\n}\n",
    "    </Card>\n  );\n}\n\n/** 29 Oct (Draft \u2014 confirm with compliance): peer, CHW and ECM credentials. */\nfunction RoleCredentialsCard() {\n  const gaps = useCredentialing(() => roleCredentialGaps());\n  return (\n    <Card className=\"space-y-2 p-4\" id=\"cred-role_credentials\" data-testid=\"cred-role-credentials\">\n      <h3 className=\"font-semibold\">Peer, CHW and ECM credentials</h3>\n      <p className=\"text-xs text-muted-foreground\">\n        {UNLICENSED_ROLE_REQUIREMENTS_DRAFT.label}. Checked only when the service is billable for the visit&apos;s funding\n        source; non-billable peer and CHW work is never blocked.\n      </p>\n      {gaps.length === 0 ? (\n        <p className=\"text-sm text-muted-foreground\">Nothing missing or expiring.</p>\n      ) : (\n        <ul className=\"space-y-1 text-sm\">\n          {gaps.map((g) => (\n            <li key={g.staffId} className=\"flex flex-wrap items-center gap-2\">\n              <b>{nameOf(g.staffId)}</b>\n              <StatusChip lang=\"en\" state=\"yourturn\" label={g.reasons.length ? \"Your turn\" : `Expires in ${g.expiringDays} days`} />\n              {g.reasons.length > 0 && (\n                <span className=\"text-xs text-muted-foreground\">{g.reasons.map((r) => CREDENTIALING_REASON_LABEL[r]).join(\"; \")}</span>\n              )}\n            </li>\n          ))}\n        </ul>\n      )}\n    </Card>\n  );\n}\n"
   ]
  ]
 },
 "src/lib/billingProjection.ts": {
  "prior": "09a27240c4ae7559937251855818190d4cd1648ab857bb1f55fd3417aa7e230c",
  "updated": "1243e1e3780324c8fba5f31e6bc02f9d5c1f83b942a587b206b53fa58237d6a9",
  "pairs": [
   [
    "export const PAYMENT_KEYS = [\"id\", \"amountCents\", \"receivedOn\", \"method\", \"reference\", \"recordedById\", \"recordedByName\", \"recordedByRole\", \"recordedAt\", \"voidedAt\", \"voidedById\", \"voidedByName\", \"voidReason\"] as const;\nexport const APPOINTMENT_KEYS = [\"id\", \"patientId\", \"clinicianId\", \"start\", \"durationMin\", \"status\", \"fundingLane\", \"serviceType\", \"modality\", \"locationId\", \"chargeCents\", \"islReason\"] as const;\nexport const PLAN_KEYS = [\"id\", \"payer\", \"plan\", \"memberId\", \"from\", \"to\", \"source\", \"managedCarePlanId\", \"managedCarePlanName\", \"aidCode\", \"shareOfCostCents\", \"planNotOnList\"] as const;\n",
    "export const PAYMENT_KEYS = [\"id\", \"amountCents\", \"receivedOn\", \"method\", \"reference\", \"recordedById\", \"recordedByName\", \"recordedByRole\", \"recordedAt\", \"voidedAt\", \"voidedById\", \"voidedByName\", \"voidReason\"] as const;\nexport const APPOINTMENT_KEYS = [\"id\", \"patientId\", \"clinicianId\", \"start\", \"durationMin\", \"status\", \"fundingLane\", \"serviceType\", \"modality\", \"locationId\", \"chargeCents\", \"islReason\", \"fundingSource\"] as const;\nexport const PLAN_KEYS = [\"id\", \"payer\", \"plan\", \"memberId\", \"from\", \"to\", \"source\", \"managedCarePlanId\", \"managedCarePlanName\", \"aidCode\", \"shareOfCostCents\", \"planNotOnList\"] as const;\n"
   ]
  ]
 },
 "src/lib/careLifecycle.ts": {
  "prior": "16e2b04de5c18c7f59112245c9d0a7fb3f21290b63bd27d076f5a005b9524757",
  "updated": "d4c41f570d6bcb654a76bf15bc0c0fe1acf9267c2b59f05bd25fca18885a12ac",
  "pairs": [
   [
    "//    1\u20134, POST_ENROLLMENT_STALENESS_DRAFT for 5\u20138).\nimport { AdelanteEHR, type Patient, type Referral } from \"./ehr\";\n",
    "//    1\u20134, POST_ENROLLMENT_STALENESS_DRAFT for 5\u20138).\nimport { resolveFundingSource } from \"./fundingSource\";\nimport { AdelanteEHR, type Patient, type Referral } from \"./ehr\";\n"
   ],
   [
    "  const staff = signed ? STAFF_ROSTER.find((s) => s.clinicianId === signed.clinicianId) : undefined;\n  const payer = AdelanteEHR.activeCoveragePlan(pid)?.payer;\n  const check = signed\n    ? staff\n      ? credentialedForService(staff.id, payer, signed.serviceType, signed.start, { asOf: signed.start })\n      : ({ ok: false, reasons: [\"no_record\"] } as const)\n",
    "  const staff = signed ? STAFF_ROSTER.find((s) => s.clinicianId === signed.clinicianId) : undefined;\n  // 29 Oct (Draft): readiness uses the appointment's own funding source (stored, or resolved).\n  const funding = signed ? (signed.fundingSource?.source ? signed.fundingSource : resolveFundingSource(pid, signed.serviceType, signed.start)) : undefined;\n  const payer = funding?.payerKey ?? AdelanteEHR.activeCoveragePlan(pid)?.payer;\n  const check = signed\n    ? staff\n      ? credentialedForService(staff.id, payer, signed.serviceType, signed.start, { asOf: signed.start, ...(funding?.source ? { fundingSource: funding.source } : {}) })\n      : ({ ok: false, reasons: [\"no_record\"] } as const)\n"
   ]
  ]
 },
 "src/lib/chartOrders.ts": {
  "prior": "009ecba3d7e042ef2e3b8aaabc974686c74eb2d8592dda05c9c55bab6a3f7e57",
  "updated": "360d80e1d1398faa2784da32fe1a3af0e7cb02db483827697b027ddf89f7a00f",
  "pairs": [
   [
    "  const find = (n: string) => AdelanteEHR.listPatients().find((p) => p.firstName === n);\n  const bagga = { name: \"Dr. M. Bagga\", role: \"physician\" };\n  const luis = find(\"Luis\");\n",
    "  const find = (n: string) => AdelanteEHR.listPatients().find((p) => p.firstName === n);\n  const bagga = { name: \"Dr. R. Sample\", role: \"physician\" };\n  const luis = find(\"Luis\");\n"
   ]
  ]
 },
 "src/lib/credentialing.ts": {
  "prior": "70dbf47f44fa80417d43f9d84fbdf7c8936b36b9092aa13a0ba50b24b058c4a2",
  "updated": "9e5f26da17bd2dd1192a7e30fdf5d177d123ecca2f6c83fa9a0f3b9de5fbd4e2",
  "pairs": [
   [
    "import { canAssistCredentials } from \"./credentialAccess\";\n\n",
    "import { canAssistCredentials } from \"./credentialAccess\";\nimport { ADELANTE_POLICY_LABEL, fundingRequiresEnrollment, isAdelantePolicySource, type FundingFlag, type FundingSource } from \"./fundingSource\";\n\n"
   ],
   [
    "  documentStatus: CredentialDocumentStatus;\n  /** Seed rows are demo data; runtime rows come through registry actions. */\n",
    "  documentStatus: CredentialDocumentStatus;\n  /**\n   * 29 Oct (Mitch) \u2014 billable roles without a clinical license. Draft \u2014\n   * confirm with compliance. Checked only when the service is billable for\n   * the resolved funding source; non-billable peer/CHW work is never blocked.\n   */\n  peerCertification?: { number: string; issuingBody: string; issuedAt?: string; expiresAt?: string; verifiedAt?: string };\n  chwQualification?: { kind: \"certificate\" | \"experience_attestation\"; number?: string; issuingBody?: string; issuedAt?: string; expiresAt?: string; attestedAt?: string };\n  /** Supervising provider on file (peer: supervising provider; CHW: supervising licensed provider). */\n  supervisingProviderStaffId?: string;\n  ecmTraining?: { attestedAt: string; expiresAt?: string };\n  /** Seed rows are demo data; runtime rows come through registry actions. */\n"
   ],
   [
    "  | \"dea_not_verified\"\n  | \"dea_expired\";\n\n",
    "  | \"dea_not_verified\"\n  | \"dea_expired\"\n  // 29 Oct \u2014 billable roles without a clinical license (Draft, confirm with compliance).\n  | \"peer_certification_missing\"\n  | \"peer_certification_expired\"\n  | \"chw_qualification_missing\"\n  | \"chw_qualification_expired\"\n  | \"supervising_provider_missing\"\n  | \"ecm_training_missing\"\n  | \"ecm_contract_missing\";\n\n"
   ],
   [
    "  dea_expired: \"DEA registration expired or expiry not recorded on the date of service\",\n};\n\n",
    "  dea_expired: \"DEA registration expired or expiry not recorded on the date of service\",\n  peer_certification_missing: \"Peer Support Specialist certification not on file\",\n  peer_certification_expired: \"Peer Support Specialist certification expired before the date of service\",\n  chw_qualification_missing: \"CHW certificate or experience attestation not on file\",\n  chw_qualification_expired: \"CHW certificate expired before the date of service\",\n  supervising_provider_missing: \"No supervising provider on file\",\n  ecm_training_missing: \"ECM training attestation not on file\",\n  ecm_contract_missing: \"No organization ECM contract with this plan\",\n};\n\n/** Draft \u2014 confirm with compliance. Each requirement for billable roles without a clinical license. */\nexport const UNLICENSED_ROLE_REQUIREMENTS_DRAFT = {\n  label: \"Draft \u2014 confirm with compliance\",\n  peer_specialist: [\"Medi-Cal Peer Support Specialist certification (number, issuing body, issue and expiry dates)\", \"Supervising provider on file\"],\n  community_health_worker: [\"CHW certificate or qualifying-experience attestation\", \"Supervising licensed provider on file\"],\n  ecm_provider: [\"Required ECM training attestation\", \"Organization ECM contract with that plan (organization level, per plan)\"],\n} as const;\nexport type UnlicensedBillableRole = keyof Omit<typeof UNLICENSED_ROLE_REQUIREMENTS_DRAFT, \"label\">;\nexport const isUnlicensedBillableRole = (role?: string): role is UnlicensedBillableRole =>\n  role === \"peer_specialist\" || role === \"community_health_worker\" || role === \"ecm_provider\";\n\n/** Organization-level ECM contracts per plan (Draft, fictional demo rows). */\nexport const ECM_ORG_CONTRACTS_DRAFT: { payer: string; status: \"active\" | \"pending\"; effectiveAt?: string }[] = [\n  { payer: \"Health Net Medi-Cal\", status: \"active\", effectiveAt: \"2025-01-01\" },\n  { payer: \"Anthem Blue Cross Medi-Cal\", status: \"pending\" },\n];\n\n/** Reason label; private-pay and grant visits say exclusion screening is Adelante policy. */\nexport function credentialingReasonLabel(code: CredentialingReasonCode, source?: FundingSource): string {\n  const base = CREDENTIALING_REASON_LABEL[code];\n  return isAdelantePolicySource(source) && (code === \"exclusion_hit\" || code === \"exclusion_check_overdue\") ? `${base} \u2014 ${ADELANTE_POLICY_LABEL}` : base;\n}\n\n"
   ],
   [
    "  asOf?: string;\n}\n\nexport type CredentialingCheckResult = { ok: true } | { ok: false; reasons: CredentialingReasonCode[] };\n\n",
    "  asOf?: string;\n  /**\n   * 29 Oct (Mitch, Draft): the resolved funding source for this appointment.\n   * When present it decides which checks run; omitted = the earlier\n   * payer-string behaviour (kept for existing callers).\n   */\n  fundingSource?: FundingSource;\n}\n\n/** Neutral Billing flags the rule raises without blocking. */\nexport type CredentialingFlag = Extract<FundingFlag, \"out_of_network_review\" | \"medicare_review\">;\nexport type CredentialingCheckResult =\n  | { ok: true; flags?: CredentialingFlag[] }\n  | { ok: false; reasons: CredentialingReasonCode[]; flags?: CredentialingFlag[] };\n\n"
   ],
   [
    "  const reasons: CredentialingReasonCode[] = [];\n  if (!record) return { ok: false, reasons: [\"no_record\"] };\n  const dos = input.dateOfService;\n  const d = asDay(dos);\n\n  // License or registration, verified and unexpired on the date of service.\n  if (record.license) {\n    if (!record.license.verifiedAt || asDay(record.license.verifiedAt) > d) reasons.push(\"license_not_verified\");\n",
    "  const reasons: CredentialingReasonCode[] = [];\n  const flags: CredentialingFlag[] = [];\n  // 29 Oct: non-billable services get no credential check (role gates still apply upstream).\n  if (input.fundingSource === \"non_billable\") return { ok: true };\n  if (!record) return { ok: false, reasons: [\"no_record\"] };\n  const dos = input.dateOfService;\n  const d = asDay(dos);\n  const staffRole = getStaffMember(record.staffId)?.role;\n  const unlicensed = !record.license && !record.registration && isUnlicensedBillableRole(staffRole);\n\n  // License or registration, verified and unexpired on the date of service.\n  if (unlicensed) {\n    // 29 Oct (Draft \u2014 confirm with compliance): role credentials replace the license.\n    const notExpired = (e?: string) => !e || asDay(e) >= d;\n    if (staffRole === \"peer_specialist\") {\n      const c = record.peerCertification;\n      if (!c?.number.trim() || !c.issuingBody.trim()) reasons.push(\"peer_certification_missing\");\n      else if (!notExpired(c.expiresAt)) reasons.push(\"peer_certification_expired\");\n      if (!record.supervisingProviderStaffId) reasons.push(\"supervising_provider_missing\");\n    } else if (staffRole === \"community_health_worker\") {\n      const q = record.chwQualification;\n      if (!q || (q.kind === \"certificate\" ? !q.number?.trim() : !q.attestedAt)) reasons.push(\"chw_qualification_missing\");\n      else if (q.kind === \"certificate\" && !notExpired(q.expiresAt)) reasons.push(\"chw_qualification_expired\");\n      if (!record.supervisingProviderStaffId) reasons.push(\"supervising_provider_missing\");\n    } else if (staffRole === \"ecm_provider\") {\n      if (!record.ecmTraining?.attestedAt || !notExpired(record.ecmTraining.expiresAt)) reasons.push(\"ecm_training_missing\");\n      const contract = ECM_ORG_CONTRACTS_DRAFT.some((k) => k.payer === input.payer && k.status === \"active\" && (!k.effectiveAt || asDay(k.effectiveAt) <= d));\n      if (!contract) reasons.push(\"ecm_contract_missing\");\n    }\n  } else if (record.license) {\n    if (!record.license.verifiedAt || asDay(record.license.verifiedAt) > d) reasons.push(\"license_not_verified\");\n"
   ],
   [
    "\n  // 28 Oct credentialing reconciliation: unknown facts cannot silently pass.\n  if (!input.payer) reasons.push(\"payer_missing\");\n  if (!input.serviceType) reasons.push(\"service_missing\");\n  if (input.payer && input.serviceType) {\n    // 28 Oct MOUD service type: a service-specific row for this payer takes\n",
    "\n  // 29 Oct: payer enrollment only where the funding source requires it.\n  const enrollment = input.fundingSource ? (unlicensed ? \"none\" : fundingRequiresEnrollment(input.fundingSource)) : \"required\";\n  const enrolledFor = () => {\n    const specific = record.enrollments.some((e) => e.payer === input.payer && e.serviceType === input.serviceType);\n    return record.enrollments.some(\n      (e) =>\n        e.payer === input.payer &&\n        (specific ? e.serviceType === input.serviceType : e.serviceType === \"*\" || e.serviceType === input.serviceType) &&\n        e.status === \"active\" &&\n        (!e.effectiveAt || asDay(e.effectiveAt) <= d),\n    );\n  };\n  // 28 Oct credentialing reconciliation: unknown facts cannot silently pass.\n  if (enrollment === \"required\" && !input.payer) reasons.push(\"payer_missing\");\n  if (!input.serviceType) reasons.push(\"service_missing\");\n  if (enrollment === \"in_network_flag\") {\n    if (!input.payer || !input.serviceType || !enrolledFor()) flags.push(\"out_of_network_review\");\n  } else if (enrollment === \"review_flag\") {\n    flags.push(\"medicare_review\");\n  }\n  if (enrollment === \"required\" && input.payer && input.serviceType) {\n    // 28 Oct MOUD service type: a service-specific row for this payer takes\n"
   ],
   [
    "\n  return reasons.length ? { ok: false, reasons } : { ok: true };\n}\n",
    "\n  const f = flags.length ? { flags } : {};\n  return reasons.length ? { ok: false, reasons, ...f } : { ok: true, ...f };\n}\n"
   ],
   [
    "  dateOfService: string,\n  opts: { asOf?: string } = {},\n): CredentialingCheckResult {\n  const asOf = opts.asOf ?? new Date().toISOString();\n  return evaluateCredentialing(credentialingRecordForStaff(staffId), { payer, serviceType, dateOfService, asOf });\n}\n",
    "  dateOfService: string,\n  opts: { asOf?: string; fundingSource?: FundingSource } = {},\n): CredentialingCheckResult {\n  const asOf = opts.asOf ?? new Date().toISOString();\n  return evaluateCredentialing(credentialingRecordForStaff(staffId), { payer, serviceType, dateOfService, asOf, ...(opts.fundingSource ? { fundingSource: opts.fundingSource } : {}) });\n}\n"
   ],
   [
    "      { item: \"Malpractice coverage\", expiresAt: r.malpractice?.expiresAt },\n    ];\n",
    "      { item: \"Malpractice coverage\", expiresAt: r.malpractice?.expiresAt },\n      // 29 Oct (Draft \u2014 confirm with compliance): billable roles without a clinical license.\n      { item: \"Peer Support Specialist certification\", expiresAt: r.peerCertification?.expiresAt },\n      { item: \"CHW certificate\", expiresAt: r.chwQualification?.kind === \"certificate\" ? r.chwQualification.expiresAt : undefined },\n      { item: \"ECM training attestation\", expiresAt: r.ecmTraining?.expiresAt },\n    ];\n"
   ],
   [
    "    { key: \"blocked\", label: \"Blocked clinicians\", count: new Set(blocked.map((b) => b.staffId)).size, items: blocked },\n  ] as const;\n}\n",
    "    { key: \"blocked\", label: \"Blocked clinicians\", count: new Set(blocked.map((b) => b.staffId)).size, items: blocked },\n    // 29 Oct (Draft \u2014 confirm with compliance): peer / CHW / ECM credentials missing or expiring.\n    { key: \"role_credentials\", label: \"Peer, CHW and ECM credentials\", count: roleCredentialGaps(now).length, items: roleCredentialGaps(now) },\n  ] as const;\n}\n\n/** Peer / CHW / ECM staff whose Draft role credentials are missing, expired, or expiring within 90 days. */\nexport function roleCredentialGaps(now: Date = new Date()): { staffId: string; reasons: CredentialingReasonCode[]; expiringDays?: number }[] {\n  const out: { staffId: string; reasons: CredentialingReasonCode[]; expiringDays?: number }[] = [];\n  const today = asDay(now.toISOString());\n  for (const r of listCredentialingRecords()) {\n    const role = getStaffMember(r.staffId)?.role;\n    if (!isUnlicensedBillableRole(role) || r.license || r.registration) continue;\n    const res = evaluateCredentialing(r, { payer: ECM_ORG_CONTRACTS_DRAFT.find((k) => k.status === \"active\")?.payer, serviceType: \"case_management\", dateOfService: now.toISOString(), fundingSource: \"private_pay\" });\n    const own = res.ok ? [] : res.reasons.filter((x) => x.startsWith(\"peer_\") || x.startsWith(\"chw_\") || x.startsWith(\"ecm_\") || x === \"supervising_provider_missing\");\n    const exp = [r.peerCertification?.expiresAt, r.chwQualification?.expiresAt, r.ecmTraining?.expiresAt].filter(Boolean).map((e) => asDay(e!) - today).filter((n) => n >= 0 && n <= 90);\n    if (own.length || exp.length) out.push({ staffId: r.staffId, reasons: own, ...(exp.length ? { expiringDays: Math.min(...exp) } : {}) });\n  }\n  return out;\n}\n"
   ],
   [
    "  status: string;\n  serviceType?: string;\n}\ninterface ClaimLike {\n",
    "  status: string;\n  serviceType?: string;\n  fundingSource?: { source?: FundingSource; payerKey?: string };\n}\ninterface ClaimLike {\n"
   ],
   [
    "  for (const a of appointments) {\n    if (a.status !== \"scheduled\" || !isBillableServiceType(a.serviceType)) continue;\n    const member = STAFF_ROSTER.find((s) => s.clinicianId === a.clinicianId);\n",
    "  for (const a of appointments) {\n    // 29 Oct (Draft): a stored funding source decides; otherwise the earlier billable-type rule.\n    const fs = a.fundingSource?.source;\n    if (a.status !== \"scheduled\" || (fs ? fs === \"non_billable\" : !isBillableServiceType(a.serviceType))) continue;\n    const member = STAFF_ROSTER.find((s) => s.clinicianId === a.clinicianId);\n"
   ],
   [
    "    const now = new Date().toISOString();\n    const res = credentialedForService(member.id, payerForPatient(a.patientId), a.serviceType, a.start, { asOf: a.start < now ? a.start : now });\n    if (!res.ok) out.push({ kind: \"appointment\", id: a.id, staffId: member.id, reasons: res.reasons });\n",
    "    const now = new Date().toISOString();\n    const res = credentialedForService(member.id, fs ? a.fundingSource?.payerKey : payerForPatient(a.patientId), a.serviceType, a.start, { asOf: a.start < now ? a.start : now, ...(fs ? { fundingSource: fs } : {}) });\n    if (!res.ok) out.push({ kind: \"appointment\", id: a.id, staffId: member.id, reasons: res.reasons });\n"
   ]
  ]
 },
 "src/lib/demoInboxSeed.ts": {
  "prior": "1c11fd2e2515c0ae91eee9c682c4adcc9dc88db365765ade92c82b7672848317",
  "updated": "9e9554af7a8a9368f6c1784ba83897e193f450aff90c19266492e9c13c21f881",
  "pairs": [
   [
    "  readOne(\"Priya Raman\", \"clinical_coordinator\");\n  readOne(\"Dr. M. Bagga\", \"physician\");\n  // \u00a7A3 \u2014 realistic bell: at most 5 seeded role broadcasts per role.\n",
    "  readOne(\"Priya Raman\", \"clinical_coordinator\");\n  readOne(\"Dr. R. Sample\", \"physician\");\n  // \u00a7A3 \u2014 realistic bell: at most 5 seeded role broadcasts per role.\n"
   ]
  ]
 },
 "src/lib/ehr-ext.ts": {
  "prior": "0a056e5a88748329a0e522bc494c6f39bf0fbfcb37e5a32c357d2fe2efe3072e",
  "updated": "8b8d44ce06d322b84fbaf3d864a91ebba6696faa6c08c3a84aed174e7b9e1fa3",
  "pairs": [
   [
    "    license: { licenseType: \"PMHNP\", number: \"DEMO-LIC-0003\", state: \"CA\", issuedAt: daysFromNow(-2432), expiresAt: daysFromNow(320), verificationSource: \"brn\", verifiedAt: daysFromNow(-15), verifiedBy: \"s-cred1\", method: \"manual\" },\n        dea: { number: \"DEMO-LIC-0004\", expiresAt: daysFromNow(400), verifiedAt: daysFromNow(-30) },\n    boardCertification: \"PMHNP-BC\",\n",
    "    license: { licenseType: \"PMHNP\", number: \"DEMO-LIC-0003\", state: \"CA\", issuedAt: daysFromNow(-2432), expiresAt: daysFromNow(320), verificationSource: \"brn\", verifiedAt: daysFromNow(-15), verifiedBy: \"s-cred1\", method: \"manual\" },\n        // 29 Oct (Mitch): the \"DEA expires in 20 days\" demo case moved here from c5. c3 is fully\n    // credentialed and enrolled for the MOUD type, so DEA expiry is the ONLY thing blocking\n    // controlled visits booked 21+ days out.\n    dea: { number: \"DEMO-LIC-0004\", expiresAt: daysFromNow(20), verifiedAt: daysFromNow(-30) },\n    boardCertification: \"PMHNP-BC\",\n"
   ],
   [
    "      { payer: \"Tulare County DMC-ODS\", serviceType: \"sud_counseling\", status: \"not_started\" },\n    ],\n",
    "      { payer: \"Tulare County DMC-ODS\", serviceType: \"sud_counseling\", status: \"not_started\" },\n      // 29 Oct (Draft): MOUD resolves to the county DMC-ODS for Medi-Cal clients.\n      { payer: \"Tulare County DMC-ODS\", serviceType: \"controlled_med_moud\", status: \"active\", effectiveAt: daysFromNow(-879) },\n    ],\n"
   ],
   [
    "    license: { licenseType: \"MD\", number: \"DEMO-LIC-0005\", state: \"CA\", issuedAt: daysFromNow(-7789), expiresAt: daysFromNow(500), verificationSource: \"medical_board_ca\", verifiedAt: daysFromNow(-10), verifiedBy: \"s-cred1\", method: \"manual\" },\n        // 28 Oct MOUD service type: DEA expires before controlled visits booked 21+ days out.\n    dea: { number: \"DEMO-LIC-0006\", expiresAt: daysFromNow(20), verifiedAt: daysFromNow(-30) },\n    boardCertification: \"Psychiatry\",\n",
    "    license: { licenseType: \"MD\", number: \"DEMO-LIC-0005\", state: \"CA\", issuedAt: daysFromNow(-7789), expiresAt: daysFromNow(500), verificationSource: \"medical_board_ca\", verifiedAt: daysFromNow(-10), verifiedBy: \"s-cred1\", method: \"manual\" },\n        // 29 Oct: c5 stays the overdue-exclusion case only; the DEA-expiry case moved to c3.\n    dea: { number: \"DEMO-LIC-0006\", expiresAt: daysFromNow(400), verifiedAt: daysFromNow(-30) },\n    boardCertification: \"Psychiatry\",\n"
   ]
  ]
 },
 "src/lib/ehr.ts": {
  "prior": "b3d4984f06a754c55d59b0df1577769a60f833b63d84e12872b727cf9ac1772d",
  "updated": "f53073369ebf69f66e56c7f1b08b5bfe5565a638704b87d3296d2feb81996bd4",
  "pairs": [
   [
    "import { credentialedForService, credentialingRecordForClinician, isBillableServiceType, CREDENTIALING_NEUTRAL_LABEL, registerBookedVisitSource, registerCredentialingServiceCatalog } from \"./credentialing\";\nimport { assertIntakeBookingBoundary, assertIntakeGroupBoundary, type IntakeBookingProof } from \"./intakeBookingBoundary\";\n",
    "import { credentialedForService, credentialingRecordForClinician, isBillableServiceType, CREDENTIALING_NEUTRAL_LABEL, registerBookedVisitSource, registerCredentialingServiceCatalog } from \"./credentialing\";\nimport { canOverrideFundingSource, fundingRecordFrom, registerFundingFacts, resolveFundingSource, seriesOccurrences, SERIES_DRAFT, FUNDING_OVERRIDE_REASONS, FUNDING_SOURCES, type AppointmentFundingRecord, type CoverageOrder, type CoveragePlanType, type DeliverySystemDraft, type FundingOverrideReason, type FundingSource, type SeriesCadence } from \"./fundingSource\";\nimport { assertIntakeBookingBoundary, assertIntakeGroupBoundary, type IntakeBookingProof } from \"./intakeBookingBoundary\";\n"
   ],
   [
    "  planNotOnList?: boolean;\n}\n",
    "  planNotOnList?: boolean;\n  /** 29 Oct (Draft) \u2014 primary/secondary order when several spans overlap. */\n  order?: CoverageOrder;\n  /** 29 Oct (Draft) \u2014 plan type; older spans are read conservatively by payer name. */\n  planType?: CoveragePlanType;\n}\n"
   ],
   [
    "  islReason?: \"uninsured\" | \"benefit_exhausted\" | \"restricted_setting\";\n  /**\n",
    "  islReason?: \"uninsured\" | \"benefit_exhausted\" | \"restricted_setting\";\n  /** 29 Oct (Draft) \u2014 resolved funding source, stored at booking; Billing/Intake may change it with a reason code. */\n  fundingSource?: AppointmentFundingRecord;\n  /** 29 Oct \u2014 staff-only recurring series id (each occurrence is its own booking). */\n  seriesId?: string;\n  /**\n"
   ],
   [
    "  controlledSubstanceDraft?: boolean;\n}\n",
    "  controlledSubstanceDraft?: boolean;\n  /** 29 Oct (Draft \u2014 Mitch and Christi to confirm): the Medi-Cal delivery system that usually pays. */\n  deliverySystemDraft: DeliverySystemDraft;\n}\n"
   ],
   [
    "    allowedModalities: [\"video\", \"in_person\"],\n    defaultDurationMin: 60,\n  },\n  {\n",
    "    allowedModalities: [\"video\", \"in_person\"],\n    defaultDurationMin: 60,\n    deliverySystemDraft: { tag: \"smhs_or_nsmhs\", confirm: \"SMHS determination picks county MHP vs plan/FFS\" },\n  },\n  {\n"
   ],
   [
    "    defaultDurationMin: 50,\n  },\n",
    "    defaultDurationMin: 50,\n    deliverySystemDraft: { tag: \"smhs_or_nsmhs\" },\n  },\n"
   ],
   [
    "    defaultDurationMin: 60,\n  },\n",
    "    defaultDurationMin: 60,\n    deliverySystemDraft: { tag: \"smhs_or_nsmhs\" },\n  },\n"
   ],
   [
    "    allowedModalities: [\"video\", \"in_person\"],\n    defaultDurationMin: 30,\n  },\n  {\n",
    "    allowedModalities: [\"video\", \"in_person\"],\n    defaultDurationMin: 30,\n    deliverySystemDraft: { tag: \"nsmhs\" },\n  },\n  {\n"
   ],
   [
    "    defaultDurationMin: 30,\n    controlledSubstanceDraft: true,\n",
    "    defaultDurationMin: 30,\n    deliverySystemDraft: { tag: \"county_dmc_ods\", confirm: \"Confirm Tulare/Kings DMC-ODS participation; plan or FFS billing needs review\" },\n    controlledSubstanceDraft: true,\n"
   ],
   [
    "    defaultDurationMin: 45,\n  },\n",
    "    defaultDurationMin: 45,\n    deliverySystemDraft: { tag: \"county_peer\", confirm: \"Confirm county opt-in\" },\n  },\n"
   ],
   [
    "    allowedModalities: [\"video\", \"phone\", \"in_person\"],\n    defaultDurationMin: 30,\n  },\n  {\n",
    "    allowedModalities: [\"video\", \"phone\", \"in_person\"],\n    defaultDurationMin: 30,\n    deliverySystemDraft: { tag: \"ecm_mcp\", confirm: \"ECM enrollment only; otherwise not billed\" },\n  },\n  {\n"
   ],
   [
    "    defaultDurationMin: 30,\n  },\n  { id: \"sud_counseling\", label: \"Individual counseling (SUD)\", helper: \"One-on-one substance-use counseling.\", allowedModalities: [\"video\", \"phone\", \"in_person\"], defaultDurationMin: 50, sud: true },\n  { id: \"sud_group_odf\", label: \"ODF group\", helper: \"Outpatient drug-free group.\", allowedModalities: [\"in_person\", \"video\"], defaultDurationMin: 90, sud: true },\n  { id: \"sud_group_iot\", label: \"IOT group\", helper: \"Intensive outpatient group.\", allowedModalities: [\"in_person\", \"video\"], defaultDurationMin: 180, sud: true },\n];\n",
    "    defaultDurationMin: 30,\n    deliverySystemDraft: { tag: \"non_billable\" },\n  },\n  { id: \"sud_counseling\", label: \"Individual counseling (SUD)\", helper: \"One-on-one substance-use counseling.\", allowedModalities: [\"video\", \"phone\", \"in_person\"], defaultDurationMin: 50, sud: true, deliverySystemDraft: { tag: \"county_dmc_ods\", confirm: \"Confirm Tulare/Kings DMC-ODS participation\" } },\n  { id: \"sud_group_odf\", label: \"ODF group\", helper: \"Outpatient drug-free group.\", allowedModalities: [\"in_person\", \"video\"], defaultDurationMin: 90, sud: true, deliverySystemDraft: { tag: \"county_dmc_ods\", confirm: \"Confirm Tulare/Kings DMC-ODS participation\" } },\n  { id: \"sud_group_iot\", label: \"IOT group\", helper: \"Intensive outpatient group.\", allowedModalities: [\"in_person\", \"video\"], defaultDurationMin: 180, sud: true, deliverySystemDraft: { tag: \"county_dmc_ods\", confirm: \"Confirm Tulare/Kings DMC-ODS participation\" } },\n];\n"
   ],
   [
    "    id: \"c5\",\n    name: \"Dr. M. Bagga\",\n    credential: \"M.D.\",\n",
    "    id: \"c5\",\n    name: \"Dr. R. Sample\",\n    credential: \"M.D.\",\n"
   ],
   [
    "    context: \"Is the patient cleared to restart group therapy this week?\",\n    requestedBy: \"Dr. M. Bagga\",\n    requestedByRole: \"pmhnp\",\n",
    "    context: \"Is the patient cleared to restart group therapy this week?\",\n    requestedBy: \"Dr. R. Sample\",\n    requestedByRole: \"pmhnp\",\n"
   ],
   [
    "): string | undefined {\n  if (!isBillableServiceType(serviceType)) return undefined;\n  const member = credentialingRecordForClinician(clinicianId);\n  if (!member) return undefined; // authority self-registers after initial demo bookings\n  const payer = AdelanteEHR.activeCoveragePlan(patientId)?.payer;\n  if (!payer) return undefined;\n  // 28 Oct fix: booking judges exclusion screening as of now, end-dated items on the visit date.\n  const res = credentialedForService(member.staffId, payer, serviceType, start, { asOf: new Date().toISOString() });\n  return res.ok ? undefined : \"This clinician can't be booked for this service right now.\";\n",
    "): string | undefined {\n  // 29 Oct (Draft): every appointment resolves its own funding source; private\n  // pay is checked too. Non-billable work and undecided coverage never block here\n  // (undecided is stored as \"Coverage \u2014 needs review\" for Billing/Intake).\n  const funding = resolveFundingSource(patientId, serviceType, start);\n  if (!funding.source || funding.source === \"non_billable\") return undefined;\n  // Draft (Christi to confirm): for Adelante-policy sources (private pay, grant)\n  // the hard stop covers visits dated today or later; back-dated entries are\n  // flagged for Billing review instead, never blocked or cancelled.\n  if ((funding.source === \"private_pay\" || funding.source === \"grant_or_county_funded\") && start.slice(0, 10) < new Date().toISOString().slice(0, 10)) return undefined;\n  const member = credentialingRecordForClinician(clinicianId);\n  if (!member) return undefined; // authority self-registers after initial demo bookings\n  // 28 Oct fix: booking judges exclusion screening as of now, end-dated items on the visit date.\n  const res = credentialedForService(member.staffId, funding.payerKey, serviceType, start, { asOf: new Date().toISOString(), fundingSource: funding.source });\n  return res.ok ? undefined : \"This clinician can't be booked for this service right now.\";\n"
   ],
   [
    "registerCredentialingServiceCatalog(serviceType => SERVICE_TYPES.some(s => s.id === serviceType && s.controlledSubstanceDraft === true));\n\n",
    "registerCredentialingServiceCatalog(serviceType => SERVICE_TYPES.some(s => s.id === serviceType && s.controlledSubstanceDraft === true));\n// 29 Oct (Draft): the funding-source resolver reads coverage, the catalog tag and ECM enrollment here.\nregisterFundingFacts({\n  coverage: (pid) => AdelanteEHR.listCoveragePlans(pid),\n  paymentArrangement: (pid) => patients.find((x) => x.id === pid)?.paymentArrangement,\n  tag: (serviceType) => SERVICE_TYPES.find((x) => x.id === serviceType)?.deliverySystemDraft.tag,\n  ecmEnrolled: (pid, at) => (patients.find((x) => x.id === pid)?.episodes ?? []).some((e) => e.type === \"ecm\" && e.openedAt.slice(0, 10) <= at.slice(0, 10) && (!e.closedAt || e.closedAt.slice(0, 10) >= at.slice(0, 10))),\n});\n\n/** 29 Oct \u2014 named so the staff series loop can reuse it. */\nexport interface BookAppointmentInput {\n  patientId: string;\n  clinicianId: string;\n  start: string;\n  durationMin: number;\n  serviceType?: ServiceType;\n  modality?: \"video\" | \"phone\" | \"in_person\";\n  locationId?: string;\n  /** How this booking was created. Defaults to `staff_scheduled`. */\n  source?: AppointmentSource;\n  /**\n   * Staff-only escape hatch for a deliberate overlap on the patient's own\n   * calendar (e.g. a correction in progress, or a paired visit a human has\n   * judged to be fine). Never set from patient self-booking.\n   */\n  allowPatientOverlap?: boolean;\n  /** \u00a7Needs step 3 \u2014 booking FROM an appointment request closes it. */\n  requestId?: string;\n  /** Who booked (for request-close attribution). */\n  bookedBy?: { id: string; role: string };\n  /** 26 Oct Phase A: dedicated referral proof, never a generic scheduling grant. */\n  intakeBooking?: IntakeBookingProof;\n  /** Staff member who renders a contact visit (defaults to a contact-role booker). */\n  assignedStaffId?: string;\n  /** \u00a7ASAM visit \u2014 link to the open ASAM task. Linking never closes it. */\n  asamTaskId?: string;\n  /** 29 Oct \u2014 set only by bookAppointmentSeries. */\n  seriesId?: string;\n}\n\n"
   ],
   [
    "  },\n  bookAppointment(input: {\n    patientId: string;\n    clinicianId: string;\n    start: string;\n    durationMin: number;\n    serviceType?: ServiceType;\n    modality?: \"video\" | \"phone\" | \"in_person\";\n    locationId?: string;\n    /** How this booking was created. Defaults to `staff_scheduled`. */\n    source?: AppointmentSource;\n    /**\n     * Staff-only escape hatch for a deliberate overlap on the patient's own\n     * calendar (e.g. a correction in progress, or a paired visit a human has\n     * judged to be fine). Never set from patient self-booking.\n     */\n    allowPatientOverlap?: boolean;\n    /** \u00a7Needs step 3 \u2014 booking FROM an appointment request closes it. */\n    requestId?: string;\n    /** Who booked (for request-close attribution). */\n    bookedBy?: { id: string; role: string };\n    /** 26 Oct Phase A: dedicated referral proof, never a generic scheduling grant. */\n    intakeBooking?: IntakeBookingProof;\n    /** Staff member who renders a contact visit (defaults to a contact-role booker). */\n    assignedStaffId?: string;\n    /** \u00a7ASAM visit \u2014 link to the open ASAM task. Linking never closes it. */\n    asamTaskId?: string;\n  }) {\n    if (input.asamTaskId) {\n",
    "  },\n  bookAppointment(input: BookAppointmentInput) {\n    if (input.asamTaskId) {\n"
   ],
   [
    "      status: \"scheduled\",\n      ...(intakeBooking ? { intakeFirstVisit: { referralId: intakeBooking.referralId, kind: intakeBooking.kind as import(\"./intakePhaseA\").FirstVisitKind }, bookedBy } : {}),\n",
    "      status: \"scheduled\",\n      // 29 Oct (Draft): the resolved funding source is stored on the appointment.\n      fundingSource: fundingRecordFrom(resolveFundingSource(input.patientId, input.serviceType, input.start)),\n      ...(intakeBooking ? { intakeFirstVisit: { referralId: intakeBooking.referralId, kind: intakeBooking.kind as import(\"./intakePhaseA\").FirstVisitKind }, bookedBy } : {}),\n"
   ],
   [
    "    if (isStaffBooking) _announceStaffBooking(a, input.bookedBy!);\n    emit();\n",
    "    if (isStaffBooking) _announceStaffBooking(a, input.bookedBy!);\n    emit();\n    return a;\n  },\n  /**\n   * 29 Oct (Mitch, Draft) \u2014 staff-only recurring series for individual visits.\n   * A loop over bookAppointment: every occurrence runs the same rights,\n   * credential and coverage checks on its own date and gets its own audit row.\n   * Blocked occurrences are not booked; they come back with the neutral reason\n   * so staff can rebook them with another clinician. Never patient self-scheduling.\n   */\n  bookAppointmentSeries(\n    input: Omit<BookAppointmentInput, \"seriesId\" | \"start\" | \"source\"> & {\n      firstStart: string;\n      cadence: SeriesCadence;\n      endDate?: string;\n      count?: number;\n      source?: AppointmentSource;\n    },\n  ): { seriesId: string; booked: Appointment[]; blocked: { start: string; reason: string }[] } {\n    const role = input.bookedBy?.role as StaffRole | undefined;\n    if (!role || role === (\"patient\" as StaffRole) || input.source === \"self_scheduled\" || !canScheduleRole(role))\n      throw new Error(\"Only staff who book visits can book a series.\");\n    if (GROUP_SERVICE_TYPES.includes(input.serviceType ?? \"\")) throw new Error(\"Series booking is for individual visits.\");\n    const starts = seriesOccurrences({ firstStart: input.firstStart, cadence: input.cadence, endDate: input.endDate, count: input.count });\n    if (input.count && input.count > SERIES_DRAFT.maxVisitsPerSeries)\n      throw new Error(`A series can have at most ${SERIES_DRAFT.maxVisitsPerSeries} visits (Draft).`);\n    const seriesId = `series-${uid()}`;\n    const booked: Appointment[] = [];\n    const blocked: { start: string; reason: string }[] = [];\n    const { firstStart: _f, cadence, endDate: _e, count: _c, ...rest } = input;\n    for (const start of starts) {\n      try {\n        const a = AdelanteEHR.bookAppointment({ ...rest, start, source: \"staff_scheduled\", seriesId });\n        booked.push(a);\n        appendAudit({ category: \"clinical\", action: \"appointment_series_occurrence_booked\", patientId: a.patientId, actorId: input.bookedBy?.id ?? \"staff\", actorRole: role, detail: { seriesId, apptId: a.id, cadence } });\n      } catch (e) {\n        blocked.push({ start, reason: e instanceof Error ? e.message : \"This visit can't be booked.\" });\n        appendAudit({ category: \"clinical\", action: \"appointment_series_occurrence_blocked\", patientId: input.patientId, actorId: input.bookedBy?.id ?? \"staff\", actorRole: role, detail: { seriesId, start, cadence } });\n      }\n    }\n    emit();\n    return { seriesId, booked, blocked };\n  },\n  /**\n   * 29 Oct (Draft) \u2014 Billing or Intake changes an appointment's funding source\n   * with a reason code. One audit row, ids and reason code only.\n   */\n  setAppointmentFundingSource(\n    apptId: string,\n    input: { source: FundingSource; reasonCode: FundingOverrideReason; actorId: string; actorRole: StaffRole },\n  ): Appointment {\n    if (!canOverrideFundingSource(input.actorRole)) throw new Error(\"Only Billing or Intake can change who pays for a visit.\");\n    if (!FUNDING_SOURCES.includes(input.source)) throw new Error(\"Pick a funding source.\");\n    if (!FUNDING_OVERRIDE_REASONS.includes(input.reasonCode)) throw new Error(\"Pick a reason.\");\n    const a = appointments.find((x) => x.id === apptId);\n    if (!a) throw new Error(\"That visit no longer exists.\");\n    const before = a.fundingSource?.source;\n    a.fundingSource = { source: input.source, flags: (a.fundingSource?.flags ?? []).filter((f) => f === \"cob_review\"), set: \"override\", reasonCode: input.reasonCode };\n    appendAudit({ category: \"clinical\", action: \"appointment_funding_source_changed\", patientId: a.patientId, actorId: input.actorId, actorRole: input.actorRole, detail: { apptId: a.id, from: before ?? null, to: input.source, reasonCode: input.reasonCode } });\n    emit();\n"
   ],
   [
    "  const PATIENT_ID = \"p-demo-mar-seed\";\n  const PMHNP = \"Dr. M. Bagga, M.D.\";\n  const NURSE = \"Rosa T., LVN\";\n",
    "  const PATIENT_ID = \"p-demo-mar-seed\";\n  const PMHNP = \"Dr. R. Sample, M.D.\";\n  const NURSE = \"Rosa T., LVN\";\n"
   ],
   [
    "  const PATIENT_ID = \"p-demo-mar-seed-es\";\n  const PMHNP = \"Dr. M. Bagga, M.D.\";\n  const NURSE = \"Rosa T., LVN\";\n",
    "  const PATIENT_ID = \"p-demo-mar-seed-es\";\n  const PMHNP = \"Dr. R. Sample, M.D.\";\n  const NURSE = \"Rosa T., LVN\";\n"
   ],
   [
    "  const CM = \"Luz Herrera\";\n  const PMHNP = \"Dr. M. Bagga, M.D.\";\n  const NURSE = \"Rosa T., LVN\";\n",
    "  const CM = \"Luz Herrera\";\n  const PMHNP = \"Dr. R. Sample, M.D.\";\n  const NURSE = \"Rosa T., LVN\";\n"
   ],
   [
    "try {\n  const PRESCRIBER = \"Dr. M. Bagga, M.D.\";\n  const PRESCRIBER_ID = \"s-np1\";\n",
    "try {\n  const PRESCRIBER = \"Dr. R. Sample, M.D.\";\n  const PRESCRIBER_ID = \"s-np1\";\n"
   ],
   [
    "  // Prescriber of record split: the PMHNP (Anita Brooks) owns these patients'\n  // prescriptions and refill reviews; Dr. M. Bagga owns everyone else's.\n  const NP_PATIENTS = new Set(\n",
    "  // Prescriber of record split: the PMHNP (Anita Brooks) owns these patients'\n  // prescriptions and refill reviews; Dr. R. Sample owns everyone else's.\n  const NP_PATIENTS = new Set(\n"
   ],
   [
    "  if ((p.orders ?? []).some((o) => /buprenorphine/i.test(o.drugName) && o.curesCheck)) return;\n  if (!p.allergies?.length) AdelanteEHR.confirmNkda(patientId, \"Dr. M. Bagga\");\n  const draft = AdelanteEHR.addDraftOrder(patientId, {\n",
    "  if ((p.orders ?? []).some((o) => /buprenorphine/i.test(o.drugName) && o.curesCheck)) return;\n  if (!p.allergies?.length) AdelanteEHR.confirmNkda(patientId, \"Dr. R. Sample\");\n  const draft = AdelanteEHR.addDraftOrder(patientId, {\n"
   ],
   [
    "    note: \"Demo \u2014 placeholder, no live query.\",\n    by: \"Dr. M. Bagga\",\n    role: \"physician\",\n  });\n  AdelanteEHR.signOrders(patientId, [draft.id], \"Dr. M. Bagga\");\n}\n",
    "    note: \"Demo \u2014 placeholder, no live query.\",\n    by: \"Dr. R. Sample\",\n    role: \"physician\",\n  });\n  AdelanteEHR.signOrders(patientId, [draft.id], \"Dr. R. Sample\");\n}\n"
   ],
   [
    "  // 27 Oct credentialing (Draft): p1 has active Medi-Cal FFS coverage and\n  // Dr. Bagga's exclusion check is overdue, so the ONE credentialing rule\n  // blocks a NEW p1 booking with c5. The demo visit books with the other\n  // enrolled prescriber instead; Dr. Bagga keeps his uncovered-patient visit.\n  book(\"p1\", \"c3\", 150, \"med_management\");\n",
    "  // 27 Oct credentialing (Draft): p1 has active Medi-Cal FFS coverage and\n  // Dr. Sample's exclusion check is overdue, so the ONE credentialing rule\n  // blocks a NEW p1 booking with c5. The demo visit books with the other\n  // enrolled prescriber instead; Dr. Sample keeps his uncovered-patient visit.\n  book(\"p1\", \"c3\", 150, \"med_management\");\n"
   ]
  ]
 },
 "src/lib/outpatientCare.ts": {
  "prior": "f12b0b9343264c2c10c82373bb7ede134614ef84ee48a08b8d0c70a073679c5b",
  "updated": "7a650a17a2f1dc3bb4e76dad75e78c5d17b26607f04e4e208c17bac36986e54c",
  "pairs": [
   [
    "export function seedOrderSafetyDemo(): void {\n  const BAGGA = { by: \"Dr. M. Bagga\", role: \"physician\" };\n  try {\n",
    "export function seedOrderSafetyDemo(): void {\n  const BAGGA = { by: \"Dr. R. Sample\", role: \"physician\" };\n  try {\n"
   ]
  ]
 },
 "src/lib/roles.ts": {
  "prior": "7ad10e0be3dd8d9ec2e3e4e8c7faf1839ebeda4ec14a9f5d0d7cb418aee388c9",
  "updated": "cd54e6b48a2faac6e4bafea26fc8295e038510c72477ee5f28c26872a5e21e1e",
  "pairs": [
   [
    "  accessMode?: \"direct\" | \"proxy\";\n  /** Long display form, e.g. \"Dr. Mandeep Bagga, M.D.\" (header). */\n  fullName?: string;\n",
    "  accessMode?: \"direct\" | \"proxy\";\n  /** Long display form, e.g. \"Dr. Riley Sample, M.D.\" (header). */\n  fullName?: string;\n"
   ],
   [
    "    id: \"s-np1\",\n    name: \"Dr. M. Bagga\",\n    fullName: \"Dr. Mandeep Bagga, M.D.\",\n    role: \"physician\",\n",
    "    id: \"s-np1\",\n    name: \"Dr. R. Sample\",\n    fullName: \"Dr. Riley Sample, M.D.\",\n    role: \"physician\",\n"
   ]
  ]
 },
 "src/lib/structuredCarePlan.ts": {
  "prior": "037396a88cc824006695041b1802d4e5999f9caf8809199bcae32101c59d969b",
  "updated": "75ff1878ca083693d13a108c13952157efd75cb65b891c1d53f648495363ceac",
  "pairs": [
   [
    "import { roleSeesAsamSection } from \"./asamReporting\";\n\n",
    "import { roleSeesAsamSection } from \"./asamReporting\";\nimport { registerSmhsDeterminationSource, type SmhsDetermination } from \"./fundingSource\";\n\n"
   ],
   [
    "  review: PlanReview;\n}\n",
    "  review: PlanReview;\n  /**\n   * 29 Oct (Mitch, Draft): whether the client meets SMHS criteria \u2014 a dated\n   * clinical determination set by a clinician, never inferred. Picks county MHP\n   * vs managed care plan for therapy/psychiatry funding.\n   */\n  smhsDetermination?: SmhsDetermination;\n}\n"
   ],
   [
    "  audit(\"plan_goal_closed\", patientId, actor, { goalId, outcome });\n}\n\n/** Owner reassignment \u2014 the coordinator's only care-plan write. Reason required, audited. */\n",
    "  audit(\"plan_goal_closed\", patientId, actor, { goalId, outcome });\n}\n\n/** 29 Oct (Draft): licensed clinicians who may record the SMHS determination. */\nexport const SMHS_DETERMINATION_ROLES = [\"therapist\", \"pmhnp\", \"physician\"];\nexport const canSetSmhsDetermination = (role: string) => SMHS_DETERMINATION_ROLES.includes(role);\nexport function setSmhsDetermination(patientId: string, input: { meets: boolean; determinedAt: string }, actor: Actor) {\n  if (!canSetSmhsDetermination(actor.role)) throw new Error(\"Only a treating clinician records the SMHS determination.\");\n  if (!/^\\d{4}-\\d{2}-\\d{2}/.test(input.determinedAt)) throw new Error(\"Give the determination date.\");\n  const plan = getStructuredPlan(patientId);\n  plan.smhsDetermination = { meets: input.meets, determinedAt: input.determinedAt.slice(0, 10), determinedBy: actor.name };\n  touch(plan);\n  audit(\"plan_smhs_determination_set\", patientId, actor, { meets: input.meets, determinedAt: input.determinedAt.slice(0, 10) });\n}\nregisterSmhsDeterminationSource((pid) => plans.get(pid)?.smhsDetermination);\n\n/** Owner reassignment \u2014 the coordinator's only care-plan write. Reason required, audited. */\n"
   ]
  ]
 },
 "src/lib/chartActions.ts": {
  "prior": "ec541eb8c8e931860a42f99ddb4992964f765fb40c8b3f98515a8dc325534f69",
  "updated": "4e5cc4b48d5ab46624baf0c3bea2d73a0b4fd9fc7e664c9c80347479000fc4e8",
  "pairs": [
   [
    "import { credentialRecordCommand } from \"./credentialingActions\";\nimport { canReasonOpen, openChartWithReason, requestCareTeamAddition, roleCanSendConsent } from \"./chartAccess\";\n",
    "import { credentialRecordCommand } from \"./credentialingActions\";\nimport { canOverrideFundingSource } from \"./fundingSource\";\nimport { canSetSmhsDetermination, setSmhsDetermination } from \"@/lib/structuredCarePlan\";\nimport { canReasonOpen, openChartWithReason, requestCareTeamAddition, roleCanSendConsent } from \"./chartAccess\";\n"
   ],
   [
    "  { id: \"credential_monitor_run\", label: { en: \"Run monitoring channel\", es: \"Run monitoring channel\" }, group: \"admin\", menu: false, needsPatient: false, flags: [\"credential_monitor_simulated\"], simulated: true, check: \"canManageCredentialing; non-manual channels disabled and Simulated\", store: refs([\"runMonitorChannel\", runMonitorChannel]), allowed: ({ role }) => canManageCredentialing(role) ? ok() : hide(CREDENTIALING_DENIED) },\n  { id: \"credential_notice_ack\", label: { en: \"Acknowledge credentialing notice\", es: \"Acknowledge credentialing notice\" }, group: \"admin\", menu: false, needsPatient: false, check: \"clinical coordinator / sys_admin only; neutral ids-only notice\", store: refs([\"acknowledgeCredentialingNotice\", acknowledgeCredentialingNotice]), allowed: ({ role }) => role === \"clinical_coordinator\" || role === \"sys_admin\" ? ok() : hide(\"Only the clinical coordinator or a system administrator can acknowledge this.\") },\n",
    "  { id: \"credential_monitor_run\", label: { en: \"Run monitoring channel\", es: \"Run monitoring channel\" }, group: \"admin\", menu: false, needsPatient: false, flags: [\"credential_monitor_simulated\"], simulated: true, check: \"canManageCredentialing; non-manual channels disabled and Simulated\", store: refs([\"runMonitorChannel\", runMonitorChannel]), allowed: ({ role }) => canManageCredentialing(role) ? ok() : hide(CREDENTIALING_DENIED) },\n  // 29 Oct (Mitch, Draft) \u2014 payment and coverage rules per appointment.\n  { id: \"schedule_visit_series\", label: { en: \"Book a visit series\", es: \"Programar una serie de citas\" }, group: \"coordination\", sectionId: \"appointments\", menu: false, check: \"staff schedulers only; each occurrence re-runs bookAppointment (rights, credential, coverage) with its own audit row; never patient self-scheduling\", store: refs([\"bookAppointmentSeries\", (...a: any[]) => (AdelanteEHR.bookAppointmentSeries as any)(...a)]), allowed: ({ role }) => canScheduleRole(role) ? ok() : hide(\"Your role does not book visits.\") },\n  { id: \"appointment_funding_set\", label: { en: \"Change who pays\", es: \"Change who pays\" }, group: \"admin\", menu: false, check: \"Billing or Intake only; reason code required; ids-only audit\", store: refs([\"setAppointmentFundingSource\", (...a: any[]) => (AdelanteEHR.setAppointmentFundingSource as any)(...a)]), allowed: ({ role }) => canOverrideFundingSource(role) ? ok() : hide(\"Only Billing or Intake can change who pays for a visit.\") },\n  { id: \"smhs_determination_set\", label: { en: \"Record SMHS determination\", es: \"Record SMHS determination\" }, group: \"care\", sectionId: \"care-plan\", menu: false, check: \"treating licensed clinician (therapist, PMHNP, physician); dated, never inferred\", store: refs([\"setSmhsDetermination\", setSmhsDetermination]), allowed: ({ role }) => canSetSmhsDetermination(role) ? ok() : hide(\"Only a treating clinician records the SMHS determination.\") },\n  { id: \"credential_notice_ack\", label: { en: \"Acknowledge credentialing notice\", es: \"Acknowledge credentialing notice\" }, group: \"admin\", menu: false, needsPatient: false, check: \"clinical coordinator / sys_admin only; neutral ids-only notice\", store: refs([\"acknowledgeCredentialingNotice\", acknowledgeCredentialingNotice]), allowed: ({ role }) => role === \"clinical_coordinator\" || role === \"sys_admin\" ? ok() : hide(\"Only the clinical coordinator or a system administrator can acknowledge this.\") },\n"
   ]
  ]
 }
};
export const COVERAGE_RULES_OCT29_FILES = Object.keys(APPROVED);
export function withApprovedCoverageRulesOct29(path: string, source: string): string {
  const entry = APPROVED[path];
  if (!entry) return source;
  const digest = (text: string) => createHash("sha256").update(text).digest("hex");
  if (digest(source) !== entry.prior) throw new Error(`Coverage rules prior source changed: ${path}`);
  let s = source;
  for (const [from, to] of entry.pairs) {
    if (s.split(from).length !== 2) throw new Error(`Coverage rules anchor not exactly once: ${path}`);
    s = s.replace(from, () => to);
  }
  if (digest(s) !== entry.updated) throw new Error(`Coverage rules replacement changed: ${path}`);
  return s;
}
