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
