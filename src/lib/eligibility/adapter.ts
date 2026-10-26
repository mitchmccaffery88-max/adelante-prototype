// §Phase 8c — the seam for a future clearinghouse (270/271) vendor.
//
// Where a real vendor plugs in (production scope, NOT built):
//   1. `src/lib/eligibility/<vendor>.server.ts` implements EligibilityAdapter
//      (builds the 270, calls the vendor, parses the 271, stores the raw
//      response server-side and returns only a pointer to it).
//   2. `src/lib/eligibility/eligibility.functions.ts` — a createServerFn that
//      picks the adapter from an environment setting and reads credentials
//      from secrets inside the handler.
//   3. The normalized result goes through AdelanteEHR.applyEligibilityResponse,
//      the ONE write path (attributed, audited, append-only).
import type { ElectronicEligibilityDetail } from "@/lib/ehr";

export interface EligibilityRequest {
  patientId: string;
  cin?: string;
  firstName: string;
  lastName: string;
  dob?: string;
  serviceDate: string;
}

/** What every adapter must return — already mapped to our fields. */
export type NormalizedEligibilityResponse = ElectronicEligibilityDetail;

export interface EligibilityAdapter {
  vendor: string;
  send270(request: EligibilityRequest): Promise<NormalizedEligibilityResponse>;
}

// ---------------------------------------------------------------------------
// 26 Oct (Mitch) — channel-agnostic coverage adapter. One interface for every
// channel (manual, the simulated vendor, a 270/271 clearinghouse, or an
// external billing module such as a future SculptSoft integration). Adapters
// return ONLY this normalized shape; raw payloads stay with the channel.
import type { CoverageChannel, CoveragePath } from "./coverageConfig";

export interface CoverageCheckRequest {
  requestKey: string;
  patientId: string;
  path: CoveragePath;
  programId?: string;
  payerId?: string;
  /** Opaque Billing-held reference (never shown outside Billing). */
  memberRef?: string;
  serviceDate: string;
}
export interface CoverageCheckResponse {
  outcome: "active" | "inactive" | "not_found" | "error" | "manual_required";
  errorKind?: "timeout" | "unreachable" | "rejected" | "not_connected";
  channel: CoverageChannel;
  simulated: boolean;
  transactionRef?: string;
  planName?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  /** Billing-only. */
  financial?: { copayCents?: number; deductibleCents?: number; outOfPocketMaxCents?: number };
  /** Behavioral health / SUD carve-out flags (Billing-only). */
  carveOuts?: { behavioralHealth?: boolean; sud?: boolean };
}
export interface CoverageAdapter {
  channel: CoverageChannel;
  simulated: boolean;
  check(request: CoverageCheckRequest): Promise<CoverageCheckResponse>;
}
