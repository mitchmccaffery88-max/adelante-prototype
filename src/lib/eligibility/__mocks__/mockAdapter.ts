// MOCK — TESTS ONLY. Not a clearinghouse, not reachable from the app (a test
// asserts no route or component imports it). Sample responses already in the
// normalized shape a real adapter would return.
import type { EligibilityAdapter, EligibilityRequest, NormalizedEligibilityResponse } from "../adapter";

export const MOCK_RESPONSES: Record<"active" | "active_unlisted" | "not_found" | "error", NormalizedEligibilityResponse> = {
  active: {
    transactionId: "MOCK-TRN-0001",
    vendor: "MOCK",
    rawResponseRef: "mock://271/0001",
    responseStatus: "active",
    benefits: {
      aidCode: "1H",
      shareOfCostCents: 25000,
      managedCarePlan: { payerName: "anthem  blue cross", planId: "ABC-HMO" },
      coverageStart: "2026-09-01",
      payerId: "MCAL-CA",
    },
  },
  active_unlisted: {
    transactionId: "MOCK-TRN-0002",
    vendor: "MOCK",
    rawResponseRef: "mock://271/0002",
    responseStatus: "active",
    benefits: { aidCode: "M1", shareOfCostCents: 0, managedCarePlan: { payerName: "Sunrise Community Plan" }, coverageStart: "2026-09-01" },
  },
  not_found: { transactionId: "MOCK-TRN-0003", vendor: "MOCK", rawResponseRef: "mock://271/0003", responseStatus: "not_found" },
  error: { transactionId: "MOCK-TRN-0004", vendor: "MOCK", responseStatus: "error", errorReason: "AAA 42 — unable to respond now" },
};

export function mockAdapter(kind: keyof typeof MOCK_RESPONSES): EligibilityAdapter {
  return {
    vendor: "MOCK",
    async send270(_req: EligibilityRequest) {
      return MOCK_RESPONSES[kind];
    },
  };
}
