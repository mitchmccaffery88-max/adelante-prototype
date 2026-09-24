# Part B — Adel-guided intake (demo slice: profile + benefits only)

Part A (seeded pre-release persona "Tomás R.") is already built; this plan covers Part B only.

## What the patient sees
1. Intake Welcome step gets a second button, **"Go through this with Adel"**, beside the existing "Start" (form stays the default) and the existing Ask Adel help link.
2. Tapping it opens an Adel conversation panel inside the intake page, labelled **Prototype** using the same banner component as Scribe Copilot.
3. Adel asks one question at a time, in plain words, covering the same fields and allowed answers as the form:
   - About you: what to call you, pronouns, language, phone, how to reach you, best time, emergency contact, address (and release date only if the form would ask it).
   - Benefits: the same 8 coverage choices; for Medi-Cal/dual, CIN, plan (from the same plan list, including "I don't know") and Medi-Cal status; for others, plan name.
   - Tap a choice chip or type. Skippable questions keep the "Skip" option the form has.
4. If a value is already on file: "Here's what we have: 559-555-0100. Is that still right?" (Yes / Change it).
5. Every answer gets a confirmation ("You said Medi-Cal — is that right?"). Only "Yes" moves it into the draft; nothing is taken from an unconfirmed or guessed answer.
6. After benefits, Adel says consent has to be done on the form by the patient, and hands off to the regular **Consent** step (or the next step if consent is already on file). Adel never marks intake complete; the patient finishes with the form.

## Saving (existing paths only)
- Confirmed answers go into the same intake draft the form already uses (`adelante.intake.<patientId>`: `profile`, `benefits`, `step`), so switching to the form continues where Adel stopped and the home tile Start/Continue logic is untouched.
- At the hand-off, Adel commits what was confirmed:
  - About you: the same `AdelanteEHR.updateProfile` patch the form's submit builds (factored into a small shared helper so both use identical fields), plus one audit entry `intake_profile_saved` with `via: "adel_guided_intake"`.
  - Benefits: `recordIntakeBenefits(..., { source: "patient_reported", via: "adel_guided_intake", ... })` — adds that one `via` value; plan span source stays `patient_reported`. The form's final submit re-sends the same answers, which the existing dedupe already handles (no duplicate span/task).
- No change to intake completion, screeners, consent, needs, history, tile states, 9a or 9b.

## Crisis first
- Every typed message runs the existing `detectCrisisLanguage` / `scanTextForCrisis` path from Patient Adel before anything else, with the same 988 reply and crisis-queue escalation. A tripped message is not treated as an answer.
- The "I need help now" / craving button stays visible.

## Assumption to confirm
- **No AI model call for this slice.** Adel's questions are scripted and typed answers are matched to the allowed choices deterministically (unclear typing gets "I didn't catch that" plus the chips). This keeps saved values exactly within the form's allowed answers and makes "nothing inferred" guaranteed. The Prototype label says so. If you want the model to phrase questions, that can come after the demo.

## Languages
English and Spanish for all new Adel lines, Spanish marked pending bilingual review.

## Technical details
- New `src/lib/adelIntakeScript.ts`: ordered question list (field, prompt EN/ES, choices, parse fn, "show if" rule), pure and unit-tested (parsing, confirmation gating, conditional Medi-Cal questions).
- New `src/components/intake/AdelGuidedIntake.tsx`: chat UI, receives `profile`/`benefits` and setters from `intake.tsx`, calls `onHandoff()` which sets the step to consent/coverage.
- `intake.tsx`: welcome-step button, mode state, extract `profilePatch(profile)` helper used by both submit and Adel commit. No other intake logic changes.
- `IntakeBenefitsInput.via` gains `"adel_guided_intake"`.
- Tests: script unit tests + a test that the Adel commit writes `patient_reported` and the audit `via`.

## Verification
Typecheck, full suite count, one-tab browser pass desktop + phone: Tomás card (safety hidden) and no justice re-ask; new patient Adel flow → confirmations → saved plan span `patient_reported` → consent hand-off → finish with form; crisis phrase mid-chat fires interception first; Rosa, Daniel, sign-in code flow still work; zero new console errors.
