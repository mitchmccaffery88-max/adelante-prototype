let check: ((input: unknown) => void) | undefined;
export function registerIntakeStagingBoundary(fn: (input: unknown) => void) { check = fn; }
export function assertIntakeStagingBoundary(input: unknown) {
  if (!check) throw new Error("Referral staging boundary unavailable.");
  check(input);
}