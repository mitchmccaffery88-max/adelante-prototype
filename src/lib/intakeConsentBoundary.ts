// Narrow capability hook; ledger and chart grants are unchanged.
let validate: ((input: unknown, operation: "capture" | "upload" | "send") => void) | undefined;
export function registerIntakeConsentBoundary(fn: NonNullable<typeof validate>) { validate = fn; }
export function assertIntakeConsentBoundary(input: unknown, operation: "capture" | "upload" | "send") {
  if (!validate) throw new Error("Referral consent boundary unavailable.");
  validate(input, operation);
}