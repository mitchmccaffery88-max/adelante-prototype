// Mitch's 27 Oct referral fix: exact staff attribution and staff-only audit
// privacy deltas. All unrelated selector/store bytes stay pinned.
export function withReferralSubmitOct27(path: string, source: string): string {
  if (path !== "src/lib/ehr.ts") return source;
  const deltas: [string, string][] = [
    ['      stagingActor?: { role: StaffRole; staffId?: string };', '      stagingActor?: { role: StaffRole; staffId?: string };\n      /** Verified by the shared referral submission gate; never inferred from a viewed workspace. */\n      staffSubmitActor?: { role: StaffRole; staffId?: string };'],
    ['    const { requestManualOutreach, channel, stagingActor, ...rest } = input;', '    const { requestManualOutreach, channel, stagingActor, staffSubmitActor, ...rest } = input;'],
    ['      stagingActor ? { kind: "staff", actor: { staffId: stagingActor.staffId ?? "", name: "Staging operator", role: stagingActor.role } } : channel === "staff" ? { kind: "staff", actor: _referralActor() } : { kind: "external" };', '      stagingActor ? { kind: "staff", actor: { staffId: stagingActor.staffId ?? "", name: "Staging operator", role: stagingActor.role } } : channel === "staff" ? { kind: "staff", actor: staffSubmitActor ? { staffId: staffSubmitActor.staffId ?? "", name: getStaffMember(staffSubmitActor.staffId)?.name ?? "Staff", role: staffSubmitActor.role } : _referralActor() } : { kind: "external" };'],
    ['        ...(!stagingActor ? { referralSource: r.referralSource, referringAgency: r.referringAgency, referrerName: r.referrerName } : { staging: true }),', '        ...(!stagingActor ? { referralSource: r.referralSource, ...(channel === "public" ? { referringAgency: r.referringAgency, referrerName: r.referrerName } : {}) } : { staging: true }),'],
  ];
  for (const [from, to] of deltas) {
    if (source.split(from).length !== 2) throw new Error(`27 Oct referral anchor not found exactly once in ${path}`);
    source = source.replace(from, to);
  }
  return source;
}