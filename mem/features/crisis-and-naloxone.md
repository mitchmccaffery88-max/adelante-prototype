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

`src/lib/safetyContent.ts` holds naloxone access points, the 6 administration
steps, Never Use Alone (1-800-484-3731) and the tolerance warning. All strings
are VERBATIM transcriptions of SAMHSA / CDC / California DHCS material — never
paraphrase, regenerate or "improve" them. Every access point is
`verified: false` and `SAFETY_CONTENT_REVIEW.pending` is true (Christi /
Dr. Bagga), rendered as visible banners/chips on `/naloxone` and as a row in
`ClinicalContentReviewCard` on `/admin-audit`. Do not clear either flag in code
without sign-off.
