## Add CIN / Insurance Number field

A single optional identifier field ("CIN / Insurance #") added to the referral form and carried through to the patient and case-management records to disambiguate duplicate or similar-named submissions.

### Data (`src/lib/healthie.ts`)
- Add `cin?: string` to the `Referral` type and to the `Patient` type.
- `createReferral(...)` accepts and stores `cin`.
- `advanceReferral` — when a referral is promoted to `enrolled` and a Patient is materialized, copy `cin` onto the new Patient record.
- Duplicate detection helper: `findReferralsByCin(cin)` returns any existing referrals matching a normalized (trimmed, uppercased) CIN — used to warn about likely duplicates on referral submit and in the case-manager workspace.
- Update `updateProfile` whitelist so patients/staff can correct the CIN later.

### Referral form (`src/routes/referral.tsx`)
- New optional field **"CIN / Medi-Cal ID (if known)"** in the "About the person" section, with helper text: *"9-character California Medi-Cal ID. Optional — helps us avoid duplicate records."*
- Light inline validation: allow blank, otherwise trim + uppercase; warn (non-blocking) if length ≠ 9 or non-alphanumeric.
- On blur, if the CIN matches an existing referral, show a soft inline notice: *"A referral with this CIN already exists (status: X). You can still submit if this is a new episode."*
- Include CIN in the submitted payload.

### Referrer status tracker (same file)
- Show CIN (masked to last 4, e.g. `••••• 1234`) beside each referred person's name so referrers can tell duplicates apart.

### Case Manager workspace (`src/routes/case-manager.tsx`)
- Add a **CIN** column to the caseload table (last-4 masked, full value on hover via `title`).
- Add CIN to the search/filter input so staff can look someone up by ID.
- In the patient detail area, surface CIN with an inline "Edit" affordance that calls `updateProfile`.

### Patient profile (`src/components/PatientProfileDialog.tsx`)
- Add an optional **CIN / Medi-Cal ID** input under the coverage/contact fields so patients (or staff on their behalf) can add or correct it.
- Same normalize + length-hint validation as the referral form; save via `updateProfile`.

### Admin (`src/routes/admin.tsx`)
- Add `CIN (last 4)` column to the referral tracker rows (masked) and a `CIN` column to the CSV export (full value, since export is staff-only and already de-identified downstream by policy).

### i18n (`src/lib/i18n.tsx`)
- New keys (EN + ES): `fieldCin`, `fieldCinHelp`, `cinDuplicateWarning`, `cinInvalidHint`, `colCin`.

### Out of scope
- No real Medi-Cal eligibility API call — this remains a plain identifier field, consistent with the current mocked `HealthieService`.
- No forced uniqueness / hard block on duplicate CINs (soft warning only), so legitimate re-referrals for a new 90-day episode still succeed.
