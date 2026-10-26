let check: ((input: unknown, actor: unknown) => void) | undefined;
export function registerIntakeStagingBoundary(fn: (input: unknown, actor: unknown) => void) { check = fn; }
export function assertIntakeStagingBoundary(input: unknown, actor: unknown) {
  if (!check) throw new Error("Referral staging boundary unavailable.");
  check(input, actor);
}