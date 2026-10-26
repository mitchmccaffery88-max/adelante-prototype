# Oct 26 — consent-gate review (A) and website brand fixes (B)

## A. Consent gate review
Tests: `src/lib/__tests__/consentGateReviewOct26.test.ts` (7) — all pass on current code before any fix.
- A1 non-seeded HLOC: blocked → blocked-send panel capture (same store call as ConsentCapture) → sent; disclosure logged with redisclosure notice; legal_disclosure_recorded precedes hloc_referral_sent. legacyUnverified and flag-only stay blocked.
- A2 referrer: card "yes" authorizes, revoke/"no" deny; applicable revoked typed record decides over live answer; SUD case with live legal disclosure naming the referrer sends, legacy history does not.
- consentGate already calls `today()` when no typed record applies (fixed Oct 23, `b25MitchDefects.test.ts`). No A code change.
- Not tested: "expired" live referrer answer — the store has no expiry concept; typed expiry has no store setter.

Caller audit findings (not changed):
- disclose(): panel purpose text ("Referral — Residential") never matches "Referral for treatment", so the consent reference falls through to the generic live Part 2 section instead of citing the specific LegalDisclosure row. Send works; provenance is less specific.
- ConsentCapturePanel (typed capture) takes free-text purpose; gates match exact literals ("Referral for treatment", "care_coordination", "status_updates", "treatment"...). A typed record only unblocks if staff type the literal. Same for coordinator (asamReporting, coordinatorSudAccess: typed-only) and referrer status_updates (only enrolled_update gets a code automatically).
- part2ConsentFor legal fallback, isConsentCategoryAuthorized: consistent.

## B. Website
- Real flat symbol (`/brand/adelante-symbol.svg`) in hero (280/180px, glow behind), ReadyBand disc and hub. Gradient sun component and page-header suns removed.
- Sunburst centred on the symbol's sun (60,62 of 120×128) from rendered position; updated on resize, animation end and after load. Measured equal at 1280 and 390 (EN/ES).
- Hub: 504px wide, 612px (EN) / 648px (ES) tall with current card copy — taller than the 520px target; short 32px connectors; new hub keys `website.v2.hub.title/body`.
- Evidence: `docs/daylight-v2-brandfix-evidence/`.
