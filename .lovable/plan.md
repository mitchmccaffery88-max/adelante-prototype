## Add DOB to referral form

**Edit `src/routes/referral.tsx`:**
- Add `dob: ""` to the form state.
- Add a "Date of birth" field in the "About the person" section (between Last name / CIN and Phone), using a native `<Input type="date">` (matches the existing "Expected release date" pattern for consistency).
- Pass `dob: form.dob || undefined` into the `HealthieService.createReferral(...)` call.

No changes needed to `src/lib/healthie.ts` — `Referral.dob` already exists and `advanceReferral` already forwards it into `createPatient`.

No copy is required to be i18n'd here since surrounding referral labels are still English.