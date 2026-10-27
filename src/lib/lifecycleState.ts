// 27 Oct (Mitch) — "Didn't start care": a reopenable post-enrollment status.
// Draft — pending EHR/Admin audit. Separate from a declined referral (closed
// before enrollment) and from discharge (after care started). Records only the
// reason key, owner and dates — never clinical text. Written only through
// referralLifecycleActions (registry entries).

export const DIDNT_START_REASONS = [
  { key: "unable_to_reach", label: "Couldn't reach after enrolling", owner: "Care manager (Intake may also record)" },
  { key: "chose_not_to_start", label: "Person chose not to start right now", owner: "Care manager" },
  { key: "went_elsewhere", label: "Getting care somewhere else", owner: "Care manager" },
  { key: "moved_away", label: "Moved out of the service area", owner: "Care manager" },
  { key: "returned_to_custody", label: "Returned to custody", owner: "Care manager or clinical coordinator" },
  { key: "other", label: "Other (explain)", owner: "Clinical coordinator" },
] as const;
export type DidntStartReason = (typeof DIDNT_START_REASONS)[number]["key"];
export const DIDNT_START_DRAFT = "Draft — pending EHR/Admin audit: reasons and owners pending sign-off.";

export interface DidntStartRecord {
  patientId: string;
  reason: DidntStartReason;
  at: string;
  byRole: string;
  byStaffId?: string;
  reopenedAt?: string;
  reopenedByRole?: string;
}

const records = new Map<string, DidntStartRecord>();

export function didntStartCareFor(patientId: string): DidntStartRecord | undefined {
  return records.get(patientId);
}
export function _setDidntStart(r: DidntStartRecord) { records.set(r.patientId, r); }
export function didntStartReasonLabel(key: string) { return DIDNT_START_REASONS.find((r) => r.key === key)?.label ?? key; }
export function __resetLifecycleStateForTests() { records.clear(); }
