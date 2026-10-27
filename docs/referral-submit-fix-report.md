# Staff referral submission fix — 27 Oct 2026

## Result
- Clinical coordinators can send staff referrals through the existing registry/store path. Intake Coordinator and existing care-coordination writers retain sending rights. No record-class grant, contact/disposition permission, Part 2 boundary or database setting changed.
- `canSubmitReferral` is shared by the queue button/form, Intake launcher, registry and submission store. Peer specialists and clinical trainees see “Referrals are sent by Intake or the clinical coordinator.” without a send button or staff form; their permission-matrix sending rows carry the Draft go-live audit note.
- Registry and store role refusals, and staff form failure display, use “You can't send referrals from this role.”
- Staff submission carries the acting staff ID and role into the existing domain audit; staff audit metadata omits referrer name and agency. One standard action event remains alongside the existing domain event; no extra audit was added. Public submission and its external attribution remain unchanged.

## Consistency sweep
- Found one additional mismatch: Intake workspace's “Send a referral” link opened `/referral`, which always uses the public principal. Replaced it with a gated staff-form dialog in the same workspace. Intake's separate navigation scope is unchanged; `/referral-queue` is still not opened to Intake.
- Reviewed signup, auth preview, careers/contact intake, public directory reports and shared referral callers. Other converted public callers use their existing dedicated principals and matching checks; no further visibility/action disagreement found.
- New consistency coverage checks all 18 staff roles against the shared sending rule, registry and actual store result; compares all five converted public-action gates against registry states. Tests prove clinical-coordinator care coordination stays read-only and contact remains denied.
- Permission snapshot changed only `clinical_coordinator.website_referral_submit` from hidden to allowed. Historical EHR byte-parity comparisons retain exact-once substitutions for only the approved staff attribution/audit changes; no unrelated pins, assertions, timeouts or retries were relaxed.

## Verification
- **Full units: 3,512/3,512 across 401 files**, exit 0.
- **Full public browser: 47/47**, eight existing specs, one worker against localhost:8080, 11.7 minutes; ran after units, without overlap.
- **New staff browser regressions: 4/4**: coordinator and Intake send → saved submitted referral → readback in Intake workspace; peer and trainee explanation/no send control. Staff IDs/acting roles and content-free audit metadata asserted; screenshots inspected.
- Latest preview build signal: **build OK**. Both changed content routes already retain unique title/description, Open Graph and Twitter metadata.
- Initial full unit run detected five historical byte-parity mismatches from the explicit EHR changes; exact-delta adapter resolved them. Initial staff browser test incorrectly tried Intake's denied queue URL; test now exercises Intake's real workspace and the discovered public-link mismatch is fixed.

## Boundaries
No Supabase/schema changes, credentials, persistence activation or publishing. Verification used fictional in-memory preview records, not hosted persistence or live delivery; existing simulated services remain unchanged.

## Follow-up — peer specialist sending approved, 27 Oct
- Added `peer_specialist` explicitly to `canSubmitReferral`, alongside the clinical-coordinator exception. Care-coordination remains **read**; peer contact, enroll and decline remain denied. Clinical trainee sending remains denied; the public staffless principal is unchanged.
- Both staff hosts retain the shared button/form gate. Denied explanation now reads: “Referrals are sent by Intake, the clinical coordinator or a peer specialist.” Removed the peer sending row's Draft go-live note; retained the trainee note.
- Updated the committed permission snapshot with only `peer_specialist.website_referral_submit`: **hidden → allowed**. No other grant or snapshot value changed.
- Consistency coverage spans all 18 roles and all five converted public actions. Added peer saved/submitted Intake projection, staff-ID/acting-role attribution, exactly one standard action event, content-free audit checks, and concrete contact/enroll/decline denials.
- **Full units: 3,514/3,514 across 401 files**, exit 0. Then **full public browser: 47/47**, eight specs, one worker against localhost:8080, 10.9 minutes, exit 0; no overlap. The first foreground browser launch hit the command's 600-second limit after 33 passing checks; the complete detached rerun passed without changing tests, timeouts or retries.
- **Staff browser: 4/4**, exit 0: clinical coordinator, Intake and peer send → submitted record → visible readback in Intake workspace; trainee explanation without send control/form. Staff attribution and IDs-only audits asserted. Screenshots inspected; readback verified by the rendered name assertion.
- Evidence logs: `/tmp/browser/peer-referral-followup/units.log`, `public-full.log`, `public-full.exit`, and `staff.log`. Latest preview signal: **build OK**; changed staff routes and index retain unique leaf metadata.
- No Supabase/schema changes, credentials, persistence activation or publishing. Records/delivery remain the existing fictional in-memory simulated preview.