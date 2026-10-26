# Daylight batches 5–6 and HLOC correction — Oct 26

Nothing published. No database, SMTP or SMS configuration changed.

## Delivered in the preview
- HLOC blocked Send opens explicit confirmations for patient name, destination, information, purpose, revoke right, expiration, signature/date and redisclosure notice. Nothing starts checked. Signature name, witnessed attestation, actual date and expiration/event are required. Typed purpose remains `referral_for_treatment`; send cites the specific legal disclosure.
- Five-step public signup, supplied EN/ES copy, generic code mismatch, typed-first-name-only matched outcome, no-code verification, continue-without-code, account help and new account outcomes.
- Pure identity/contact normalization, record-code identity checks, five attempts per fifteen minutes per entered identity within the current in-memory device context, duplicate contact privacy and coordinator review tasks.
- Simulated sign-in, generic failures, show/hide credential, reset with six-digit codes, five tries, ten-minute expiry and thirty-second resend. Existing demo member and staff sign-in retain routing.
- Public flow header uses home-linked brand without competing website navigation/CTA; back and language controls remain in the flow, fixed 988 support remains. Staff-assisted SignupFlow branch is retained.
- Coordinator-only signup review detail in the Worklist; entries are not placed in signup audits.

## Files
- Consent: `src/components/clinical/CareEpisodesPanel.tsx`, `src/lib/outpatientCare.ts`, `src/lib/__tests__/consentPurposeCodes.test.ts`.
- Matching/registry: `src/lib/signupMatch.ts`, `src/lib/website/signupStore.ts`, `src/lib/website/authPreview.ts`, `src/lib/chartActions.ts`, `src/lib/patientMatching.ts`, `src/lib/ehr.ts`.
- Screens/copy: `src/components/frontdoor/PublicSignupSteps.tsx`, `src/components/frontdoor/PublicSignIn.tsx`, `src/components/frontdoor/SignupFlow.tsx`, `src/components/frontdoor/flow.css`, `src/lib/website/signupCopy.ts`, `src/components/identity/SignupVerificationHelp.tsx`, `src/components/WebsiteLayout.tsx`, `src/routes/start.tsx`, `src/routes/auth.tsx`, `src/routes/worklist.tsx`.
- Tests/dev evidence: `src/lib/__tests__/signupMatch.test.ts`, `src/lib/__tests__/authPreview.test.ts`, `e2e/websiteSignup5.spec.ts`, `src/lib/devInspect.ts`.
- Documentation: `AGENTS.md`, `roadmap.md`, signup decision memory.

## Verified
- Focused unit run: 46/46 (signup, reset, consent purposes/review, existing code redemption and patient merge).
- New browser suite: seven cases passed in the combined run; HLOC case subsequently passed after correcting the test for the real blocked-Send entry and newest-first audit ordering. Actual checklist capture → Send → specific disclosure, notice and chronological audit order verified.
- Existing public-shell browser suite: 6/6 in combined run.
- EN/ES at 1280 and 390: new-account signup and simulated reset exercised; no horizontal overflow or page errors in the walkthrough. Axe serious/critical checks passed on initial signup/sign-in in all four combinations. Fixed 988 support remained visible.
- Actual demo patient sign-in → `/home` and staff sign-in → `/clinician` passed.
- Latest observed build log: build OK.

## Full-regression stop / not accepted as green
Full units: **3316 passed, 7 failed, 3323 total**. Existing pinned tests were not edited or snapshots regenerated.
1. `roleDashboardParity9c2`: `ehr.ts` pinned source delta.
2. `billingParity9a3`: `ehr.ts` pinned source delta.
3. `statTileParity9a2`: `ehr.ts` pinned source delta.
4–5. `billingProjectionB3b`: therapist/sys_admin pinned source deltas.
6. `runAction`: registry matrix snapshot now contains new actions.
7. `simulatedLabelsSL`: assumes every notifications-simulated action has a permitted staff actor; public signup deliberately permits no staff actor.
These require a separately scoped acceptance of the exact signup source/action deltas, not granting staff signup access or weakening the tests. No full browser suite was launched after this stop.

## Simulated / limitations
- All public signup commands, verification delivery, credential setup/checks, reset and saved progress are prototype-only. Password/PIN values are never persisted; only credential-kind metadata is recorded. No real SMS/email/reset occurs.
- Save retains only steps 1–3 in memory during this page session. It has no durable resume token/link and does not survive reload. Current device attempt counters are memory-only and cannot provide production abuse protection.
- Verification prose is identical for zero/one/multiple matches; the tester panel always displays a non-delivered sample code, but only a uniquely matched open referral can verify/link. No-match review tasks can be patient-less until account creation.
- Coordinator task access is a preview acting-role gate, not production authorization. Hosted role enforcement, persistence and delivery are still required. Review details are exposed only in coordinator Worklist; existing merge tooling is reused separately, no new merge workflow implemented.
- No-code enrollment reuses the existing reconciliation/store; a new comprehensive browser matrix for all referral field reconciliation, every expired/used code and every duplicate path was not completed. Store tests cover principal identity/contact, expiry, rate and duplicate rules.
- Supplied Spanish remains draft; main Adelante phone line is unconfirmed, so no invented callable front-desk number is provided.
- Full acceptance is **not complete**, because of the seven full-suite failures above. Do not publish this as validated production authentication.
