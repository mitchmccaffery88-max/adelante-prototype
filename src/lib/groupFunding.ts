// 29 Oct (Mitch, Draft) — groups with mixed payers. Each enrolled member's
// attendance resolves its own funding source and the facilitator check runs
// per member. Only an affected member's claim is flagged; the group still
// runs and a non-billable group never blocks. The facilitator sees a neutral
// count only — never member payer details. No store import (params in).
import { credentialedForService, credentialingRecordForClinician, type CredentialingReasonCode } from "./credentialing";
import { resolveFundingSource, type FundingResolution, type FundingSource } from "./fundingSource";

export interface GroupLike {
  id: string;
  facilitatorId: string;
  serviceType: string;
  start: string;
  billable?: boolean;
}

export interface GroupMemberFunding {
  patientId: string;
  source?: FundingSource;
  /** True when this member's claim needs Billing review (credential or coverage). */
  billingReview: boolean;
  reasons: CredentialingReasonCode[];
}

export interface GroupFundingReview {
  members: GroupMemberFunding[];
  flaggedCount: number;
  /** Neutral facilitator note, or undefined when nothing needs review. */
  facilitatorNote?: string;
}

export const groupFacilitatorNote = (n: number) => (n > 0 ? `Billing review needed for ${n} member${n === 1 ? "" : "s"}` : undefined);

export function groupSessionFundingReview(
  session: GroupLike,
  memberIds: string[],
  opts: { asOf?: string; resolve?: (patientId: string) => FundingResolution } = {},
): GroupFundingReview {
  // A non-billable group never blocks and never flags.
  if (session.billable === false) return { members: memberIds.map((patientId) => ({ patientId, source: "non_billable", billingReview: false, reasons: [] })), flaggedCount: 0 };
  const facilitator = credentialingRecordForClinician(session.facilitatorId);
  const members = memberIds.map((patientId): GroupMemberFunding => {
    const funding = opts.resolve ? opts.resolve(patientId) : resolveFundingSource(patientId, session.serviceType, session.start);
    if (funding.source === "non_billable") return { patientId, source: "non_billable", billingReview: false, reasons: [] };
    if (!funding.source) return { patientId, billingReview: true, reasons: [] };
    if (!facilitator) return { patientId, source: funding.source, billingReview: true, reasons: ["no_record"] };
    const res = credentialedForService(facilitator.staffId, funding.payerKey, session.serviceType, session.start, { asOf: opts.asOf ?? session.start, fundingSource: funding.source });
    const flagged = !res.ok || (res.flags?.length ?? 0) > 0 || funding.flags.length > 0;
    return { patientId, source: funding.source, billingReview: flagged, reasons: res.ok ? [] : res.reasons };
  });
  const flaggedCount = members.filter((m) => m.billingReview).length;
  return { members, flaggedCount, facilitatorNote: groupFacilitatorNote(flaggedCount) };
}
