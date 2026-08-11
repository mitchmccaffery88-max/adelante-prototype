import { AdelanteEHR } from "@/lib/ehr";

/**
 * §Phase 4.2 test helper — clear the frontline validation checklist (6.5) and
 * record a real clinician incapacity determination, which is what activation
 * now requires. Tests that exercise the activation gate itself call the store
 * directly instead of using this.
 */
export function activateAhcdForTest(
  linkId: string,
  opts: { clinician?: string; part2ScopeUnclear?: boolean; reviewByDate?: string } = {},
): void {
  const reviewedBy = "Val Ortiz, CF Care Manager";
  AdelanteEHR.recordAhcdChecklistItem(linkId, { item: "identity_match", outcome: "verified", reviewedBy });
  AdelanteEHR.recordAhcdChecklistItem(linkId, { item: "agent_identification", outcome: "verified", reviewedBy });
  AdelanteEHR.recordAhcdChecklistItem(linkId, { item: "execution_validity", outcome: "verified", reviewedBy });
  AdelanteEHR.recordAhcdChecklistItem(linkId, {
    item: "part2_scope",
    outcome: opts.part2ScopeUnclear ? "unclear" : "verified",
    reviewedBy,
  });
  AdelanteEHR.activateAdvocateAhcd(linkId, {
    determinedBy: opts.clinician ?? "Dr. Bagga",
    determinedByRole: "pmhnp",
    basis: "Client cannot communicate health care decisions; documented in chart.",
    ...(opts.reviewByDate ? { reviewByDate: opts.reviewByDate } : {}),
  });
}
