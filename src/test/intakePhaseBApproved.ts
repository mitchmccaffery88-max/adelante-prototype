// 26 Oct Phase B (Mitch): exact-once Intake-only result-entry denials.
// Every existing-role result writer and all other EHR bytes remain pinned.
export function withIntakePhaseB(path: string, source: string): string {
  if (path !== "src/lib/ehr.ts") return source;
  const deltas: [string, string][] = [
    ['import { disclose } from "./part2Disclosure";', 'import { disclose } from "./part2Disclosure";\nimport { assertIntakeStagingBoundary } from "./intakeStagingBoundary";'],
    ['      requestManualOutreach?: boolean;\n      /** Which form was used.', '      requestManualOutreach?: boolean;\n      stagingActor?: { role: StaffRole; staffId?: string };\n      /** Which form was used.'],
    ['    const { requestManualOutreach, channel, ...rest } = input;', '    const { requestManualOutreach, channel, stagingActor, ...rest } = input;\n    if (stagingActor) assertIntakeStagingBoundary(rest, stagingActor);'],
    ['      channel === "staff" ? { kind: "staff", actor: _referralActor() } : { kind: "external" };', '      stagingActor ? { kind: "staff", actor: { staffId: stagingActor.staffId ?? "", name: "Staging operator", role: stagingActor.role } } : channel === "staff" ? { kind: "staff", actor: _referralActor() } : { kind: "external" };'],
    ['        referralSource: r.referralSource,\n        referringAgency: r.referringAgency,\n        referrerName: r.referrerName,', '        ...(!stagingActor ? { referralSource: r.referralSource, referringAgency: r.referringAgency, referrerName: r.referrerName } : { staging: true }),'],
    ['  /**\n   * §Batch B2 — fill non-critical referral fields', '  /** 26 Oct Phase B: referral-only staging writes, no clinical cascade. */\n  updateIntakeStagingReferral(id: string, fields: Partial<Referral>, actor: { role: StaffRole; staffId?: string }): Referral {\n    assertIntakeStagingBoundary(fields, actor);\n    const r = referrals.find(x => x.id === id);\n    if (!r || r.enrolledPatientId || !["submitted", "contacted"].includes(r.status)) throw new Error("Unlinked open staging referral required.");\n    Object.assign(r, fields);\n    emit();\n    return r;\n  },\n  /**\n   * §Batch B2 — fill non-critical referral fields'],
    [
      '  ): { ok: boolean; error?: string } {\n    const p = patients.find((x) => x.id === patientId);\n    if (!p) return { ok: false, error: "Patient not found." };\n    // §Phase 8b — "reported" is reserved for recordIntakeBenefits;',
      '  ): { ok: boolean; error?: string } {\n    // 26 Oct Phase B: Intake requests checks; never enters results.\n    if (input.actorRole === "intake_coordinator") return { ok: false, error: "Billing-owned results only." };\n    const p = patients.find((x) => x.id === patientId);\n    if (!p) return { ok: false, error: "Patient not found." };\n    // §Phase 8b — "reported" is reserved for recordIntakeBenefits;'
    ],
    [
      '  ): { ok: boolean; error?: string; recordId?: string; spanId?: string; spanAction?: "added" | "updated" | "none"; taskId?: string } {\n    const p = patients.find((x) => x.id === patientId);',
      '  ): { ok: boolean; error?: string; recordId?: string; spanId?: string; spanAction?: "added" | "updated" | "none"; taskId?: string } {\n    // 26 Oct Phase B: no electronic result-entry capability for Intake.\n    if (input.actorRole === "intake_coordinator") return { ok: false, error: "Billing-owned results only." };\n    const p = patients.find((x) => x.id === patientId);'
    ],
  ];
  for (const [from, to] of deltas) { if (source.split(from).length !== 2) throw new Error(`Phase B anchor not found exactly once in ${path}`); source = source.replace(from, to); }
  return source;
}