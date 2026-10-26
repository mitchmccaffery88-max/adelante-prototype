// 26 Oct signup change (Mitch) — the ONLY approved source change to
// src/lib/ehr.ts for the Get started / Sign in batches: `enrollReferral`
// gains a `websiteSignup` option so the public signup path records
// matchSource "website_signup" and keeps referrer identity out of the
// enrollment audit. No dashboard, billing, stat-tile or permission behavior
// changes. Parity tests apply these exact substitutions to the rollback text;
// anything else must still match byte-for-byte. Each anchor must match
// exactly once or this throws.
const SIGNUP_OCT26: [
  ['        asam: !!input.asamTaskId,\n', '        asam: !!input.asamTaskId,\n        firstVisit: !appointments.some(a => a.patientId === input.patientId && a.status !== "cancelled"),\n'],string, string][] = [
  // 1. enrollReferral signature gains the websiteSignup option
  [
    "  enrollReferral(id: string, opts?: { createAnyway?: { reason: string; actorId?: string; actorRole?: string } }) {",
    "  enrollReferral(id: string, opts?: { createAnyway?: { reason: string; actorId?: string; actorRole?: string }; websiteSignup?: boolean }) {",
  ],
  // 2. matchSource records the website signup path
  [
    '      matchSource: "referral",',
    '      matchSource: opts?.websiteSignup ? "website_signup" : "referral",',
  ],
  // 3. website-signup enrollment audit carries ids only (no referrer identity)
  [
    "      detail: {\n        referralId: r.id,\n        referralSource: r.referralSource,\n        referringAgency: r.referringAgency,\n        referrerName: r.referrerName,\n      },",
    "      detail: {\n        referralId: r.id,\n        ...(!opts?.websiteSignup ? { referralSource: r.referralSource, referringAgency: r.referringAgency, referrerName: r.referrerName } : { simulated: true }),\n      },",
  ],
];

// 26 Oct intake role: exact source deltas for the new role and held-role field only.
const INTAKE_OCT26: [string, string][] = [
  [
    "  | \"billing\"\n  | \"clinical_coordinator\"\n  | \"credentialing_coordinator\"\n  | \"billing_coordinator\"\n",
    "  | \"billing\"\n  | \"clinical_coordinator\"\n  | \"intake_coordinator\"\n  | \"credentialing_coordinator\"\n  | \"billing_coordinator\"\n"
  ],
  [
    "  { key: \"billing\", label: \"Billing coordinator\" },\n  { key: \"clinical_coordinator\", label: \"Clinical coordinator\" },\n  { key: \"credentialing_coordinator\", label: \"Credentialing coordinator\" },\n  { key: \"billing_coordinator\", label: \"Billing coordinator (expanded)\" },\n",
    "  { key: \"billing\", label: \"Billing coordinator\" },\n  { key: \"clinical_coordinator\", label: \"Clinical coordinator\" },\n  { key: \"intake_coordinator\", label: \"Intake Coordinator\" },\n  { key: \"credentialing_coordinator\", label: \"Credentialing coordinator\" },\n  { key: \"billing_coordinator\", label: \"Billing coordinator (expanded)\" },\n"
  ],
  [
    "\nexport type RecordClass =\n  | \"demographics\"\n  | \"screeners_mh\"\n",
    "\nexport type RecordClass =\n  | \"account_support\"\n  | \"demographics\"\n  | \"screeners_mh\"\n"
  ],
  [
    "// matching Part-2 consent is currently granted.\nconst MATRIX: Record<RecordClass, Partial<Record<StaffRole, AccessLevel>>> = {\n  demographics: {\n    ecm_provider: \"write\",\n",
    "// matching Part-2 consent is currently granted.\nconst MATRIX: Record<RecordClass, Partial<Record<StaffRole, AccessLevel>>> = {\n  // 26 Oct intake role: account support is independent, not inherited by intake.\n  account_support: { sys_admin: \"write\" },\n  demographics: {\n    ecm_provider: \"write\",\n"
  ],
  [
    "\n/** §Batch E1 — outpatient nursing roles. */\nexport const NURSING_ROLES: StaffRole[] = [\"nurse_rn\", \"lvn\"];\n\n",
    "\n/** §Batch E1 — outpatient nursing roles. */\nexport const INTAKE_ROLE_DRAFT = \"Draft — pending go-live permissions audit\";\nexport const INTAKE_ROLE_PURPOSE = \"Owns the non-clinical front door from first contact through the first scheduled visit and intake handoff.\";\nexport const INTAKE_GRANTS: Partial<Record<RecordClass, AccessLevel>> = {\n  demographics: \"write\", documents: \"write\", eligibility: \"write\", consent_ledger: \"write\",\n  assisted_signup: \"write\", worklist: \"write\", sdoh: \"read\", pre_release: \"read\",\n  screeners_sud: \"consent_gated\", sud_treatment: \"consent_gated\",\n};\nfor (const [cls, level] of Object.entries(INTAKE_GRANTS) as [RecordClass, AccessLevel][]) MATRIX[cls].intake_coordinator = level;\nexport const NURSING_ROLES: StaffRole[] = [\"nurse_rn\", \"lvn\"];\n\n"
  ],
  [
    "  name: string;\n  role: StaffRole;\n  credential?: string;\n  /** Links this staff member to a clinical provider record in AdelanteEHR. */\n",
    "  name: string;\n  role: StaffRole;\n  /** Held roles, never unioned; permissions use the one acting role. */\n  additionalRoles?: StaffRole[];\n  credential?: string;\n  /** Links this staff member to a clinical provider record in AdelanteEHR. */\n"
  ],
  [
    '  const level = MATRIX[cls]?.[permissionRole(role)] ?? "none";\n',
    '  const level = MATRIX[cls]?.[permissionRole(role)] ?? "none";\n  // Intake collects paperwork, never reads assessment scores or treatment content.\n  if (role === "intake_coordinator" && (cls === "screeners_sud" || cls === "sud_treatment")) return {level:"none",locked:true,reason:"42 CFR Part 2 — consent required"};\n'
  ],
  [
    "export function roleAssignmentsOf(m: StaffMember | undefined, opts: { includeHidden?: boolean } = {}): RoleAssignment[] {\n  if (!m) return [];\n  const list = m.roleAssignments ?? [{ role: m.role, accessMode: m.accessMode }];\n  return opts.includeHidden ? list : list.filter((a) => !a.inFacility || isFeatureEnabled(\"in_facility\"));\n}\n",
    "export function roleAssignmentsOf(m: StaffMember | undefined, opts: { includeHidden?: boolean } = {}): RoleAssignment[] {\n  if (!m) return [];\n  const legacy = m.roleAssignments ?? [{ role: m.role, accessMode: m.accessMode }];\n  // Explicit additionalRoles replaces legacy assignments, so removing a held role really removes it.\n  const list: RoleAssignment[] = m.additionalRoles === undefined ? legacy : [...new Set([m.role, ...m.additionalRoles])].map(role => legacy.find(a => a.role === role) ?? {role});\n  return opts.includeHidden ? list : list.filter((a) => !a.inFacility || isFeatureEnabled(\"in_facility\"));\n}\n"
  ],
  [
    "  { id: \"s-cred1\", name: \"Marcus Webb\", role: \"credentialing_coordinator\" },\n  { id: \"s-bc1\", name: \"Deneen Ford\", role: \"billing_coordinator\" },\n  { id: \"s-admin1\", name: \"Adelante System Admin\", role: \"sys_admin\" },\n];\n\n",
    "  { id: \"s-cred1\", name: \"Marcus Webb\", role: \"credentialing_coordinator\" },\n  { id: \"s-bc1\", name: \"Deneen Ford\", role: \"billing_coordinator\" },\n  { id: \"s-admin1\", name: \"Adelante System Admin\", role: \"sys_admin\", additionalRoles: [\"intake_coordinator\"] },\n];\n\n"
  ],
  [
    "    role === \"ecm_provider\" ||\n    role === \"clinical_coordinator\" ||\n    role === \"sys_admin\"\n  );\n",
    "    role === \"ecm_provider\" ||\n    role === \"clinical_coordinator\" ||\n    role === \"intake_coordinator\" ||\n    role === \"sys_admin\"\n  );\n"
  ],
  [
    "  persist(STAFF_KEY, m.id);\n  // §Batch E — the active role must be one of this person's assignments.\n  const next = activeRole && hasRoleAssignment(m, activeRole) ? activeRole : hasRoleAssignment(m, acting) && m.roleAssignments ? acting : m.role;\n  if (acting !== next) {\n    acting = next;\n",
    "  persist(STAFF_KEY, m.id);\n  // §Batch E — the active role must be one of this person's assignments.\n  const next = activeRole && hasRoleAssignment(m, activeRole) ? activeRole : m.role;\n  if (acting !== next) {\n    acting = next;\n"
  ]
];

/** Rollback text with only the approved 26 Oct signup substitutions applied (each must match exactly once). */
export function withApprovedSignupOct26(path: string, rollbackText: string): string {
  let s = rollbackText;
  const subs = path === "src/lib/ehr.ts" ? SIGNUP_OCT26 : path === "src/lib/roles.ts" ? INTAKE_OCT26 : [];
  for (const [from, to] of subs) {
    if (s.split(from).length !== 2) throw new Error(`Approved anchor not found once in ${path}`);
    s = s.replace(from, to);
  }
  return s;
}
