# Referral-to-billable-patient lifecycle — report (27 Oct, continuation)

Draft — pending EHR/Admin audit. No publishing, no Supabase/schema changes, no TEST secrets used.

## Resolution of the earlier stop
- Stage 2 is administrative fact gathering only (packet facts, identity, duplicates). No clinical plan exists before enrollment.
- On enrollment, one Today task "Draft first care plan" goes to the assigned clinician (or the clinical coordinator queue), due before the first scheduled visit (otherwise 7 days, Draft). Intake facts (non-Part-2 packet needs) show as care-plan suggestions that the clinician accepts, edits or dismisses; provenance is recorded (`edited: true` on edited accepts). Part 2-flagged packet needs never become suggestions.
- Neutral "First care plan not drafted" gap shows in stages 6–8.
- "Didn't start care" is a reopenable post-enrollment status, separate from a closed referral and from discharge. Blocked once a visit was attended.

## What was built
- `src/lib/careLifecycle.ts`: pure eight-stage derivation, gaps, owner/next action, existing Draft clocks (3/7 referral aging; post-enrollment 7/14, 5/10, 14/30), work homes, billing readiness labels, lifecycle funnel (cohort guard 11, association only). 90-day clock start kept as one Draft setting (enrollment — unchanged behavior, pending Christi).
- `src/lib/referralLifecycleActions.ts` + 8 registry entries (`referral_outreach_log`, `referral_mark_contacted`, `referral_identity_confirm`, `referral_enroll`, `referral_close`, `didnt_start_care_mark`, `didnt_start_care_reopen`, `patient_need_confirm`). Each store function re-checks the button's gate and reuses the existing referral store writers.
  - Peer specialists: log outreach/contact only. Trainees: unchanged (denied).
  - Intake: enroll only with identity evidence (staff/identity-review confirmation record or a used claim code; verified-OTP signups already enroll themselves). DOB or `verified_source` alone does not count. Close only duplicate / unable to reach.
  - Enroll and close are separate checks. No record-class grants changed.
- `src/lib/lifecycleState.ts`: "Didn't start care" reasons (Draft list — see open questions).
- `src/lib/gettingStarted.ts`: patient card (care team names, first visit, paperwork, plain-language coverage, own needs with "Still need help with this?", pathway content, requested groups stay "Requested"), Adel line, advocate slice from the consent-scoped schedule only, staff My work list.
- UI: one `LifecycleChip` on the referral queue table/list and drawer; drawer actions now go through the registry with a required reason; Intake workspace rows get stage chip, identity confirmation, enroll and the two allowed closes; record drawer gets the Getting started panel with readiness checklist and Didn't-start controls; patient Home, Adel greeting, advocate home and My work show Getting started; Reporting shows the eight-stage funnel under the cohort guard.

## Tests
- New `src/lib/__tests__/careLifecycle.test.ts` (9): peer contact yes / enroll-close no; trainee denied; Intake identity evidence; Intake close reasons; first-plan task; stages; funnel guard 11; Didn't-start mark/reopen and Intake limit; Dana pre-release scenario (packet needs → patient + clinician suggestion, Part 2 need excluded, Spanish copy).
- Updated `websiteReferralActionsConsistency.test.ts` for Mitch's peer-contact decision.
- Permission snapshot: additions only (the 8 new actions); no existing value changed.
- `referralFunnel.ts` is pinned by the 9a-2 parity test, so the stage funnel lives in `careLifecycle.ts` instead.
- Full units: 3,523/3,523. Public browser suite: see final status in chat.

## Open questions / limits
- Didn't-start reasons and owners are my Draft list (couldn't reach, chose not to start, care elsewhere, moved away, returned to custody, other); please confirm.
- "Rendering clinician credentialed" uses a Draft proxy (roster clinician with a credential on file); there is no credential-validity helper yet.
- New notifications were not added; the patient card and the neutral task title carry the message.
- Didn't-start records and patient need answers are preview memory only, like other prototype stores.
