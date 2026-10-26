// 26 Oct signup change (Mitch) — the ONLY approved source change to
// src/lib/ehr.ts for the Get started / Sign in batches: `enrollReferral`
// gains a `websiteSignup` option so the public signup path records
// matchSource "website_signup" and keeps referrer identity out of the
// enrollment audit. No dashboard, billing, stat-tile or permission behavior
// changes. Parity tests apply these exact substitutions to the rollback text;
// anything else must still match byte-for-byte. Each anchor must match
// exactly once or this throws.
const SIGNUP_OCT26: [string, string][] = [
  // 1. enrollReferral signature gains the websiteSignup option
  [
    "  enrollReferral(id: string, opts?: { createAnyway?: { reason: string; actorId?: string; actorRole?: string } }) {",
    "  enrollReferral(id: string, opts?: { createAnyway?: { reason: string; actorId?: string; actorRole?: string }; websiteSignup?: boolean }) {",
  ],
  // 2. matchSource records the website signup path
  [
    '      matchSource: "referral",',
    '      matchSource: opts?.websiteSignup ? "website_signup" : "referral",',
  ],
  // 3. website-signup enrollment audit carries ids only (no referrer identity)
  [
    "      detail: {\n        referralId: r.id,\n        referralSource: r.referralSource,\n        referringAgency: r.referringAgency,\n        referrerName: r.referrerName,\n      },",
    "      detail: {\n        referralId: r.id,\n        ...(!opts?.websiteSignup ? { referralSource: r.referralSource, referringAgency: r.referringAgency, referrerName: r.referrerName } : { simulated: true }),\n      },",
  ],
];

/** Rollback text with only the approved 26 Oct signup substitutions applied (each must match exactly once). */
export function withApprovedSignupOct26(path: string, rollbackText: string): string {
  let s = rollbackText;
  const subs = path === "src/lib/ehr.ts" ? SIGNUP_OCT26 : [];
  for (const [from, to] of subs) {
    if (s.split(from).length !== 2) throw new Error(`Approved anchor not found once in ${path}`);
    s = s.replace(from, to);
  }
  return s;
}
