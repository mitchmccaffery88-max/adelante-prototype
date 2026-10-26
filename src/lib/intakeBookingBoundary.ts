// Referral-only capability hook. Generic booking rights remain unchanged.
export interface IntakeBookingProof { referralId: string; kind: string }
let check: ((input: unknown) => void) | undefined;
export function registerIntakeBookingBoundary(fn: (input: unknown) => void) { check = fn; }
export function assertIntakeBookingBoundary(input: unknown) {
  if (!check) throw new Error("Referral booking boundary unavailable.");
  check(input);
}