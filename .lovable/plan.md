# Referral form: person's email + referrer must give phone or email

## What changes for people
- The referral form (public page and the staff "submit on someone's behalf" form) gets an optional **Email** box for the person being referred, next to Phone.
- The form will not submit unless the referrer gives a **work phone or a work email** (at least one). The message: "Add your work phone or work email so we can reach you if we can't reach this person."
- When a referral is enrolled, the person's email carries over to their patient record.
- On a referral's timeline, the "Contact the person who referred them" box only appears when the referrer can actually be reached. For older referrals with no referrer phone or email, it shows a plain note instead: "No contact details for the referrer are on file — there is no one to fall back on. Continue outreach to the person directly."

## Public vs. staff (item 3)
Same rule on both. No real reason to differ: the referrer-fallback step and status texts depend on the referrer's contact details in the same way however the referral was entered, and staff entering a referral are relaying someone else's details, so they should capture them too. The staff form already shares every check with the public one, so one rule keeps them from drifting apart.

## Interpretation
- The person's email box is fully optional and does not replace a phone: "No reliable phone" still means manual outreach, the call list stays phone-only, and the "No welcome text is sent" wording is untouched. Nothing is ever emailed.
- "Standard validation" = trimmed, lowercase, basic `name@domain.tld` shape. It's checked on submit with a clear message, and a blank box is fine. The same check runs on the referrer's email when given, so a malformed referrer email can't satisfy the phone-or-email rule.
- A phone counts only when it isn't blank (spaces trimmed). There is no phone-format check, to match what happens today.
- Legacy referrals are shown honestly, never changed.

## Technical details
- `src/components/referral/ReferralSubmissionForm.tsx`: add `email` to form state; add an Email input in "About the person"; add checks after the required-field check — `referrerPhone.trim() || referrerEmail.trim()` present, and email shape valid where given; pass `email: form.email.trim().toLowerCase() || undefined` to `createReferral` (writes the existing `Referral.email`). Small exported `isValidEmail` helper in the same file.
- `src/lib/ehr.ts` `enrollReferral`: pass `email: r.email` into `createPatient` (it already accepts and stores `email`).
- `src/lib/referralOutreach.ts`: add `referrerPhone?`/`referrerEmail?` to `OutreachShapedReferral`, and extend `ReferrerFallback` with `referrerUnreachable?: boolean`. In `needsReferrerFallback`, when a fallback would be due but the referrer has neither contact, return `{ due: false, referrerUnreachable: true, reason, explanation }` so the person-side reason is kept. The trigger conditions themselves (dead number / no phone / 2 unanswered) are unchanged.
- `src/components/ReferralTimelineDrawer.tsx`: render the honest no-referrer-contact note when `referrerUnreachable`; the existing box otherwise, unchanged.
- Tests: extend `referralPhase4e.test.ts` (fallback suppressed + `referrerUnreachable` when neither referrer contact exists; still due with only an email or only a phone); new test that enrollment copies email to the patient; form validation test for the phone-or-email rule and email shape.
- Verification: typecheck, full tests, Playwright at desktop and phone — public form blocked without referrer contact, staff form (referral queue) blocked the same way, email saved on the referral, enrolling copies it to the patient, legacy no-contact referral shows the honest note. Zero console errors.

## Not in scope
No email sending, welcome email or outcome tracking; no change to manual-outreach/call-list logic or the welcome-text wording.
