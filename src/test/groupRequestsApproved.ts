// 26 Oct (Mitch) group requests: exact-once join-rule fields, invite-only refusal,
// care-team on-behalf dispatch, routing and per-type approval hooks only.
const DELTAS: [string, string][] = [
  [
    "import { assertIntakeBookingBoundary, assertIntakeGroupBoundary, type IntakeBookingProof } from \"./intakeBookingBoundary\";",
    "import { assertIntakeBookingBoundary, assertIntakeGroupBoundary, type IntakeBookingProof } from \"./intakeBookingBoundary\";\nimport { assertGroupApproval, assertGroupStaffRequest, groupRequestHooks } from \"./groupRequestBoundary\";"
  ],
  [
    "  cancelledAt?: string;\n  cancellationReason?: string;\n}\n\n/** Standing enrollment in a recurring group",
    "  cancelledAt?: string;\n  cancellationReason?: string;\n  /** 26 Oct (Mitch): \"Who it's for\" audiences; empty = everyone. */\n  audiences?: import(\"./contentAudience\").ContentAudience[];\n  /** 26 Oct (Mitch): open | care_team_approval | invite_only. Absent = care_team_approval. */\n  joinRule?: \"open\" | \"care_team_approval\" | \"invite_only\";\n  /** 26 Oct (Mitch): group TYPE whose requirement list lives in groupRequests.ts. */\n  groupType?: string;\n  /** Informational for billing only; billing logic is unchanged. */\n  billable?: boolean;\n  language?: \"en\" | \"es\" | \"both\";\n}\n\n/** Standing enrollment in a recurring group"
  ],
  [
    "    if (input.onBehalf) assertIntakeGroupBoundary(input);",
    "    if (input.onBehalf) (input.onBehalf.role === \"intake_coordinator\" ? assertIntakeGroupBoundary : assertGroupStaffRequest)(input);"
  ],
  [
    "    if (g.status === \"cancelled\") throw new Error(\"That group is cancelled.\");\n    if (AdelanteEHR.groupsForPatient(input.patientId).some((x) => x.id === g.id))\n      throw new Error(\"You're already in this group.\");",
    "    if (g.status === \"cancelled\") throw new Error(\"That group is cancelled.\");\n    // 26 Oct (Mitch): invite-only groups are staff-enrolled, never requested by the patient.\n    if (g.joinRule === \"invite_only\" && !input.onBehalf) throw new Error(\"This group is by invitation from your care team.\");\n    if (AdelanteEHR.groupsForPatient(input.patientId).some((x) => x.id === g.id))\n      throw new Error(\"You're already in this group.\");"
  ],
  [
    "    for (const role of roles) AdelanteEHR.notify({ recipientRole: role as StaffRole, ...common });\n    emit();\n    return row;",
    "    for (const role of roles) AdelanteEHR.notify({ recipientRole: role as StaffRole, ...common });\n    groupRequestHooks.afterRequest?.(row);\n    emit();\n    return row;"
  ],
  [
    "    _assertGroupJoinReviewer(r, actor);\n    { const g = groupConsentBlock(r.patientId); if (g) throw new Error(g); }",
    "    _assertGroupJoinReviewer(r, actor);\n    assertGroupApproval(r, !!groupSessions.find((x) => x.id === r.sessionId)?.groupType, actor);\n    { const g = groupConsentBlock(r.patientId); if (g) throw new Error(g); }"
  ]
];
export function withGroupRequests(path: string, source: string): string {
  if (path !== "src/lib/ehr.ts") return source;
  for (const [from, to] of DELTAS) {
    if (source.split(from).length !== 2) throw new Error(`Group request anchor not found exactly once in ${path}`);
    source = source.replace(from, to);
  }
  return source;
}
