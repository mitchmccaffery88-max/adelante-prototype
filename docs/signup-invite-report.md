# Sign-up verification redesign — one possession check at most (27 Oct)

Draft — pending EHR/Admin audit. Decided by Mitch, 27 Oct. Not published. No Supabase changes. Texts and emails are **Simulated** until an SMS/SMTP provider is chosen: testers see the existing demo panel; nothing claims a message was delivered.

## What changed (existing systems extended, no parallel ones)
- `src/lib/signupInvite.ts` (new module, preview memory): invite tokens, SHA-256 hash at rest, 14-day validity (Draft setting `INVITE_TTL_DAYS`), single use, rate limits (Draft: 3 sends per referral per day, 60 s apart), 5 identity tries (`INVITE_IDENTITY_TRY_LIMIT`), Draft default timing "on release date". The raw link exists only in the simulated outbox (the message body a provider queue would hold) so reminders can reuse it.
- Registry actions (each through `runAction`, one audit, reason required): `signup_invite_send`, `signup_invite_remind`, `signup_in_person_setup`. Allowed: Intake Coordinator, ECM provider, CF care manager, clinical coordinator. Peer and trainee: hidden. Permission snapshot changed by additions only (these three keys).
- `signupStore.ts` (same `website_signup` registry entry): new operations `invite_open`, `invite_identity`, `invite_continue`, `invite_resend`, `invite_lost`, `send_code`, `verify_code`, `set_signin`, `referral_source`. `create()` now refuses without a verified contact (`verify_required`).
- `signupMatch.ts`: `paperCodeMatches` (code + last name + DOB), `verifiedContactReferralMatches` (verified contact + last name + DOB vs the referral's contact on file; public/family referrals still never auto-match). Duplicate check unchanged.
- Identity review: three new types — invite opened but identity didn't match; person no longer has the contact on file; name + DOB match a referral but the contact differs. Source "invite link" added.
- Screens: `/start/invite/$token` (new), `/start/signup` rebuilt as three screens, sign-in setup after the account exists. Staff controls in the Intake workspace row and the referral drawer.

## Flows
1. **Invite link** — tap → "Let's make sure it's you" (last name + DOB on one screen). Match → Matched, no code. No match → "That didn't match" (never says which part) with "Continue without it" (asks first name, creates the account with the contact on file plus an Identity review item; nothing links). 5 tries → locked, code_lockout review. Expired/used/unknown link → "This link has expired. Send me a new link." — resend goes only to the contact on file, rate-limited, same generic message either way. "I don't have that phone or email anymore" → Identity review item, then the not-invited path. Staff can resend from the Intake workspace or drawer; a resend while the link is valid reuses it.
2. **Reminders** — "Start your intake before your visit on Tue" reuses the same valid link. No second verification.
3. **Pre-release** — staff pick "On release date" (Draft default) or "Now". A future release date schedules the invite for that date (Simulated).
4. **Paper code** — "Have a code from your care team?" → code + last name + DOB → Matched → add a phone or email, verified once with one code.
5. **Not invited** — name + DOB → phone or email + "Text / Email" → 6-digit code (required for any account) → automatic matching: verified contact + last name + DOB matches the contact on file → linked; same name + DOB but different contact → new account + review, nothing shown from the referral; no match → new account. "Were you invited?" step removed; "Who referred you?" is optional after sign-up.
6. **No phone (staff-assisted)** — staff record "identity confirmed" (who, when, how — e.g. "In person — photo ID") with the existing `referral_identity_confirm`; then either the person sets a PIN on the clinic tablet (`signup_in_person_setup`) or staff send the invite while together.
7. **After setup** — sign-in choice: link or code (default, passwordless), PIN on this device, or password; "Remember me". Sign-in page gains "Send me a one-time code instead" (Simulated). Staff sign-in unchanged.

## Family and agency referrers — CAPTCHA finding
No change to consent-to-contact, CAPTCHA or audit. **The "I'm not a robot" box is not a real check** — it is a checkbox only. It is now labelled on screen "Simulated — not a real check" (ES "Simulado — no es una verificación real").

## Bug found and fixed
Referral paper codes (`RE-____-____` from the packet) were minted with the letter **U**, which the code validator rejects. Roughly one code in four could never be redeemed. The minting alphabet now matches the validator; a test mints 60 codes and checks each is accepted.

## Privacy and audit
- Nothing from the referral renders before Matched: the invite screen shows only fixed words; mismatch never says which field failed; the resend message is the same whether or not a link was ours.
- Audit details carry ids, reason codes and `simulated: true` only — no names, dates of birth, contacts or tokens (unit + browser checks).
- The 988 bar is visible on the invite and sign-up screens (browser checks at 1280 and 390, EN and ES layout checked at 390).

## Tests
- New `src/lib/__tests__/signupInvite.test.ts` (14): Draft settings; sender roles (peer/trainee denied); hash at rest and contact-on-file only; invite tap + last name/DOB → Matched with no code and no referral data before; wrong DOB → generic, Continue without it → account + review, 5-try lock; expired → resend only to the contact on file, rate-limited, unknown token generic; lost contact → review; reminders and resends reuse one link; pre-release scheduling; in-person setup needs confirmation then PIN; paper code + last name + DOB then one contact code; ids-only audits; code alphabet fix.
- Updated `signupMatch.test.ts` and `identityIntakeOct26.test.ts` for the replaced flow (old "continue without a code" and referral-only OTP are gone): verified-contact auto-match, contact-differs review, account impossible without verified contact, duplicate block unchanged.
- Browser `e2e/websiteSignup5.spec.ts`: paper-code path, not-invited path (no account before the code), invite path (Matched with no code, generic mismatch, 988 bar). Note: the browser "expired" step reloads the page, so it shows the generic expired screen for a link the fresh preview no longer knows; true 14-day expiry is covered by the unit test.
- Full units: **3,538/3,538** (403 files), then the public browser suite (see Results).

## Results
- Units: 3,538/3,538 passed, 112.8 s.
- Public browser suite (one worker, :8080, after units, not overlapping): PENDING

## Open / for Mitch
- Draft settings to confirm: 14 days, 3 sends/day 60 s apart, 5 tries, "on release date" default.
- Everything is preview memory; invite, outbox and verified-contact state need tables in Phase 2d.
- Spanish copy is draft (tú) for native review.
- Real sending needs an SMS/SMTP provider; real bot protection needs a CAPTCHA provider.
