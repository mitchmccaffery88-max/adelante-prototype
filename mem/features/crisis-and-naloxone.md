---
name: Crisis landing page + naloxone/overdose content
description: /crisis is the single destination for every "Crisis support" entry point; /naloxone holds verbatim SAMHSA/CDC/DHCS content under a real pending-review flag
type: feature
---
`/crisis` ("You are not alone") is the ONE destination for every crisis entry
point in the patient shell — header pill, sidebar block, More sheet, and the
Get-help-now modal. They used to be bare `tel:988` links / a `/home#safety-plan`
anchor; do not revert them to raw dials. The page carries tel:988 + sms:988,
links to the real box-breathing exercise (`/library?exercise=box-breathing`)
and the real Phase 7 safety plan (`/home#safety-plan`), and the footer note
"988 is the only crisis number this app will show unless a local line has been
verified" — do not add another crisis number without a verification pass.

TWO REVIEW TRACKS in `src/lib/safetyContent.ts`, never merged:
`NALOXONE_ACCESS_REVIEW` (contact verification — Cathy, staff id `s-cc2`,
2026-08-12; all 5 access points and Never Use Alone are `verified: true`) and
`SAFETY_CONTENT_REVIEW` (clinical sign-off — still pending Christi /
Dr. Bagga, covering ONLY `NALOXONE_STEPS` and `TOLERANCE_WARNING`). Verifying
contact details must never clear the clinical flag.

`src/lib/safetyContent.ts` holds naloxone access points, the 6 administration
steps, Never Use Alone (1-800-484-3731) and the tolerance warning. All strings
are VERBATIM transcriptions of SAMHSA / CDC / California DHCS material — never
paraphrase, regenerate or "improve" them. `/naloxone` and
`ClinicalContentReviewCard` on `/admin-audit` render both tracks separately.
Do not clear the clinical flag in code without sign-off.

Community Resources: Cathy's real human verification pass is replayed at store
init in `src/lib/communityResources.ts` (`applyRecordedVerifications`) by
calling the real `verifyResource` with staff `s-cc2`, so all 20 sourced entries
are patient-live; never-sourced skeletons stay in the queue.
