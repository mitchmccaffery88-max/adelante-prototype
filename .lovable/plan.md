
# Get-Started & Profile Audit — Lean MVP

Storage decision (confirmed): keep the in-memory `HealthieService` mock. No Cloud / DB this pass. All profile data lives in `src/lib/healthie.ts` and persists via existing `localStorage` session keys only for "which patient am I."

---

## Findings — current state

### 1. Signup is fake
`src/routes/auth.tsx` toggles a "Sign in / Sign up" label but both paths just pick from three pre-seeded personas (`p1/p2/p3`) and call `setCurrentPatientId`. No form fields are collected. `mode === "signup"` is dead UI.

### 2. No identity is ever captured by the user
A `Patient` row already contains `firstName, lastName, dob, phone, releaseDate, enrolledAt, episodeDay, programId` before the user touches the app. Intake assumes the row exists. There is no step where the user (or a case manager doing assisted intake) types their own name, DOB, phone, preferred name, language, contact channel, or emergency contact.

### 3. Intake gaps
`src/routes/intake.tsx` steps: welcome → consent (HIPAA + Part 2) → coverage (Medi-Cal) → screeners → needs → review. Missing for a real first-time flow:
- Preferred name / pronouns
- Preferred language (UI has i18n but intake never asks)
- Preferred contact channel + best time to reach
- Emergency contact (name + phone + relationship)
- Mailing/temporary address (housing stability also depends on this)
- Confirm/update release date and phone (currently seeded)
- Save-and-resume affordance (intake state is in-memory only; refresh wipes it even though `alreadyComplete` UI implies persistence)

### 4. No profile surface for patients
`PatientHome` has Welcome, Next session, Care plan, Goals, Tasks, Consents. There is no "My profile" card or route where the patient can see/update phone, language, contact prefs, emergency contact, or address. Consents (`ConsentCard`) are the only editable identity-adjacent thing.

### 5. No profile surface for staff
- `admin.tsx` has KPIs, filterable caseload table, CSV export, referral tracker, consent audit — but no per-patient drill-down. You cannot click a row to see/edit a patient.
- `case-manager.tsx` shows caseload + last-contact + check-ins + resource referrals — also no patient detail / edit screen.
- `clinician.tsx` has Schedule / Care Plan / Notes / Tracking — also no demographics view.
Result: nowhere in the app can staff correct a phone number, language, or emergency contact.

### 6. Referral → patient bridge is missing
`HealthieService.createReferral` writes to the `referrals` array and (per recent work) either flags `smsSentAt` or queues `outreachTask: "manual_call"`. `advanceReferral` flips status to `enrolled` but **never creates a Patient row** from the referral. So the intended flow (partner refers → SMS welcome → person signs up → intake) terminates before the new patient ever lands in `listPatients()`.

### 7. AppShell persona switcher leaks the demo
`AppShell.tsx` exposes `setCurrentPatientId` as a top-level persona dropdown. Fine for demos, but it sits next to the "real" auth flow with no separation, which makes the auth page feel meaningless.

### 8. Where profile data lives (answer to the literal question)
- Source of truth: the `patients: Patient[]` array in `src/lib/healthie.ts` (in-memory, lost on reload).
- Per-user "session": `localStorage["adelante.session"] = { patientId, email }` written by `auth.tsx`. Only the chosen patient id survives reload; field edits do not.
- No write-through, no migration, no schema. This is correct for the mock decision but must be called out in any demo: **edits are ephemeral**.

---

## Ranked fix plan (mock-only, no Cloud)

Each bucket is independent and independently testable in the preview. No new deps, no routes added except where called out.

### P0 — Make signup real (so intake has somebody to talk about)
**Files:** `src/routes/auth.tsx`, `src/lib/healthie.ts`, `src/lib/i18n.tsx`
- Add `HealthieService.createPatient(input)` that seeds a minimal Patient (id, programId auto, `firstName, lastName, dob, phone, preferredLanguage`, empty consents/needs/screeners, `enrolledAt = now`, `episodeDay = 1`) and sets it current.
- Split `auth.tsx` into two real modes:
  - **Sign in**: keep persona picker, label it "Demo accounts" with a small "for the pilot demo" caption.
  - **Sign up**: form with First name, Last name, DOB, Phone, Preferred language (en/es). On submit → `createPatient` → navigate to `/home` → `FirstTimeWelcome` → "Start intake."
- Persist `adelante.session` with the new id so reload still lands on the new patient (data still ephemeral; surface a one-line "Demo: data resets on reload" note on the welcome card).

### P1 — Add demographics + contact prefs step to intake
**Files:** `src/routes/intake.tsx`, `src/lib/healthie.ts`, `src/lib/i18n.tsx`
- New step inserted between Welcome and Consent: **About you**.
  - Confirm/edit: preferred name, pronouns (optional), preferred language, phone, best time to reach (morning/afternoon/evening), preferred channel (text / call / video).
  - Emergency contact: name, relationship, phone.
  - Mailing or temporary address (free-text, single line; we are not doing address validation).
- Extend `Patient` with `preferredName?`, `pronouns?`, `preferredLanguage`, `contactPrefs: { channel, bestTime }`, `emergencyContact?: { name, relationship, phone }`, `address?: string`.
- `HealthieService.updateProfile(patientId, patch)` for partial writes; call from this step and from the new profile surfaces below.

### P2 — Patient-facing "My profile" card
**File:** `src/components/PatientHome.tsx`
- New collapsible Card under `ConsentCard`: shows the fields from P1 with an Edit button that flips to inline form, calls `updateProfile`, toasts success.
- Keep consent management where it is — profile card is identity/contact only.

### P3 — Staff profile drill-down (admin + case manager)
**Files:** `src/routes/admin.tsx`, `src/routes/case-manager.tsx`
- Make the patient row in each caseload table open a `Dialog` (shadcn) with: demographics, contact prefs, emergency contact, address, coverage, consents (read-only summary), screener latest. Save calls `updateProfile`.
- Admin dialog also shows the program id + audit trail filtered to that patient (already have `consentEvents`).
- No new route; the Dialog is the lightweight drill-down.

### P4 — Wire referral → patient
**File:** `src/lib/healthie.ts`, `src/routes/admin.tsx`
- When `advanceReferral` transitions to `enrolled`, call `createPatient` with the referral's name/dob/phone and link `patient.referralId = referral.id`.
- In the admin referral tracker, show the resulting program id in the enrolled row.
- This closes the loop tested in the earlier referral-to-welcome-SMS fallback work: referral → SMS or manual task → enroll → patient exists → first-time `FirstTimeWelcome` → intake.

### P5 — Save-and-resume polish for intake
**File:** `src/routes/intake.tsx`
- Persist intake-in-progress to `localStorage["adelante.intake." + patientId]` on every step change; rehydrate on mount.
- Clear on submit. Add a small "Saved" indicator next to the progress bar.
- This makes the existing `alreadyComplete` UI honest and supports the assisted-by-phone flow that already exists in `mode`.

### P6 — Separate demo persona switch from auth
**File:** `src/components/AppShell.tsx`
- Hide the persona dropdown behind a small "Demo" affordance (e.g. footer chip that opens a small popover), not the main shell row.
- Removes the visual collision with the new signup form.

---

## Suggested execution order

P0 → P1 → P5 (these are the user-visible first-time flow, end to end) →
P2 (lets the patient verify their own profile) →
P3 (gives staff parity) →
P4 (only after P0 exists, since it depends on `createPatient`) →
P6 (cleanup).

P0+P1+P5 alone is a credible "real first-time flow on mock storage" and is shippable in one pass if you want a tighter scope.

---

## Technical notes

- All edits stay in: `src/routes/{auth,intake,admin,case-manager}.tsx`, `src/components/{PatientHome,AppShell}.tsx`, `src/lib/{healthie,i18n}.tsx`. No new files required (Dialog is already in `src/components/ui/`).
- No migrations, no new deps, no new routes.
- Every new field on `Patient` is optional so existing seeded personas keep rendering.
- Mock-storage caveat ("data resets on reload") gets surfaced once on the first-time welcome card so demos do not mislead.
