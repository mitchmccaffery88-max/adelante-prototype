// §Advocate dashboard build 1 — TEMPORARY demo affordance.
//
// WHY THIS EXISTS: no real email/SMS transport is wired for advocate
// invitations yet (see `advocateInvite.functions.ts` — Twilio returns
// `not_configured` in this environment), so a demo reviewer never actually
// RECEIVES a code. Without a bypass the advocate flow is untestable outside
// the store.
//
// SAFETY PROPERTIES (deliberate, do not weaken):
//  - The real validation path is untouched. A code that MATCHES a link is
//    always resolved normally; the bypass is only consulted after a real
//    lookup misses.
//  - The bypass never locates a patient from advocate-supplied identifying
//    information — the hard invariant of the whole mechanism. It resolves to
//    the most recent UNCLAIMED, unexpired, unrevoked invitation that already
//    exists in the store. Nothing is created, and no patient is searchable.
//  - Every bypassed claim is audited with `demoBypass: true`, so a reviewer
//    can always tell a demo claim from a real one.
//  - It is OFF by default in tests (`resetAdvocateDemoClaim`) and can be
//    switched off at runtime.
//
// REMOVE THIS MODULE when real invitation delivery is wired.
//
// OFF under test: the suite asserts the REAL validation path (a bad code must
// throw), and a demo affordance must never be able to mask that regression.
const DEFAULT_ENABLED = import.meta.env?.MODE !== "test";

let enabled = DEFAULT_ENABLED;

export function isAdvocateDemoClaimEnabled(): boolean {
  return enabled;
}

export function setAdvocateDemoClaim(on: boolean): void {
  enabled = on;
}

/** Test seam — restores the prototype default. */
export function resetAdvocateDemoClaim(): void {
  enabled = DEFAULT_ENABLED;
}
