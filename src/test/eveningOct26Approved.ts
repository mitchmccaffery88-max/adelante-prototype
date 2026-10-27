// 26 Oct evening (Mitch) decisions 2 and 5: open non-billable groups skip the
// care-plan eligibility gate through a hook; crisis owner falls back to the
// on-call clinician before the coordinator pool, with a visible gap notice.
const DELTAS: [string, string][] = [
  [
    "import { assertGroupApproval, assertGroupStaffRequest, groupRequestHooks } from \"./groupRequestBoundary\";",
    "import { assertGroupApproval, assertGroupStaffRequest, groupRequestHooks } from \"./groupRequestBoundary\";\nimport { ON_CALL_GAP, onCallOwnerFor } from \"./onCallBoundary\";",
  ],
  [
    "  if (!p.primaryClinicianId) return undefined;\n  return STAFF_ROSTER.find((m) => m.clinicianId === p.primaryClinicianId && active(m) && m.role !== \"sys_admin\");",
    "  // 26 Oct evening (Mitch): no assigned clinician → on-call clinician, then the coordinator pool.\n  if (!p.primaryClinicianId) return onCallOwnerFor();\n  return STAFF_ROSTER.find((m) => m.clinicianId === p.primaryClinicianId && active(m) && m.role !== \"sys_admin\") ?? onCallOwnerFor();",
  ],
  [
    "  ownerLane?: \"named\" | \"pool\";",
    "  ownerLane?: \"named\" | \"pool\";\n  /** 26 Oct evening (Mitch): visible notice when no on-call clinician was set. */\n  ownerGap?: string;",
  ],
  [
    "else row.ownerLane = \"pool\";",
    "else { row.ownerLane = \"pool\"; if (row.category !== \"sdoh\") row.ownerGap = ON_CALL_GAP; }",
  ],
  [
    "    if (!AdelanteEHR.isGroupEligible(patientId))\n      block(",
    "    if (!groupRequestHooks.skipsCarePlanEligibility?.(group) && !AdelanteEHR.isGroupEligible(patientId))\n      block(",
  ],
];
export function withEveningOct26(path: string, source: string): string {
  if (path !== "src/lib/ehr.ts") return source;
  for (const [from, to] of DELTAS) {
    if (source.split(from).length !== 2) throw new Error(`Evening 26 Oct anchor not found exactly once in ${path}`);
    source = source.replace(from, to);
  }
  return source;
}
