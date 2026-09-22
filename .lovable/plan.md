# Pre-Release Pipeline — episode-to-patient data flow + internal CSV upload

## What I found (real current state)

- `openPreReleaseEpisodeForNewPatient` (ehr.ts:10023) calls `createPatient` without the release date; `createPatient` hard-sets `releaseDate: ""` (ehr.ts:6827).
- `markPreReleaseEpisodeReleased` (ehr.ts:10271) accepts `releasedOn` but writes it only into audit detail (ehr.ts:10292) — the episode has no field for it.
- `redeemEnrollmentCode` (ehr.ts:10951) writes only `signupCredential` / `signupAssistedBy`.
- No custody field on `Patient`. Custody is inferred from a `Booking` row (ehr.ts:11576, 17260) that the pre-release form never creates.
- A real provenance type already exists and is unused on this path: `ReleaseDateMeta { source, confidence, history }` (ehr.ts:404) with `confidence: "confirmed" | "estimated" | "self_reported"`. This is the honest home for "anticipated vs confirmed".
- AHC-HRSN results are `ScreenerResult.domains` — five fixed domain keys: `housing`, `food`, `transportation`, `utilities`, `safety` (screeners.ts:357).
- Existing patterns to follow: `CaseloadUploadDialog` (CSV parse + preview + apply) and `src/lib/credentialRoster.ts` (pure, preview-first, per-row rejection reasons, template/export).

## Part 1 — episode-to-patient data flow

### 1a. Anticipated release date lands on the patient immediately
`openPreReleaseEpisode` sets, on the patient:
- `releaseDate = anticipatedReleaseDate` **only if currently empty** (never overwrite a confirmed date),
- `releaseDateMeta = { source: "custody", confidence: "estimated", history: [...] }`.

Doing it at episode-open (not only at redemption) means the date is right on the record the whole time, and redemption is not the first moment it exists.

### 1b. Redemption copies it too
`redeemEnrollmentCode` resolves the episode via the already-stored `rec.episodeId` and applies the same fill-if-empty copy, so codes issued against records created before this change are also corrected. Audit gains `releaseDateSource`; no code value is ever audited.

### 1c. Confirmed release is persisted
- New optional field on `PreReleaseEpisode`: `actualReleaseDate?: string`.
- `markPreReleaseEpisodeReleased` writes `ep.actualReleaseDate = releasedOn ?? anticipatedReleaseDate`, and writes that date onto `patient.releaseDate` **unconditionally** with `releaseDateMeta.confidence = "confirmed"`, `source: "confirmed"`, appending the prior value to `history`. Confirmed always beats estimated. Audit unchanged plus the persisted date.

### 1d. Honest custody representation on the patient
New optional field, populated only from the real episode lifecycle:

```ts
custody?: {
  state: "in_custody" | "released" | "unknown";
  source: "pre_release_episode";   // the only real source today
  episodeId: string;
  facilityName?: string;
  bookingNumber?: string;
  anticipatedReleaseDate?: string;
  confirmedReleaseDate?: string;
  updatedAt: string;
}
```

Written at episode open (`in_custody`), at release confirmation (`released`), and at close. Deliberately NOT derived from `Booking` — the comment will say so, and say plainly that absence of this field means unknown, not "not in custody". The existing booking-derived checks stay untouched (no regressions to facility views).

### 1e. Intake / profile pre-fill — recommendation
**Yes, and I'll build it as part of this pass**, matching the AHC-HRSN reconciliation stance: show what's on file, say where it came from, ask the person/staff to confirm rather than silently trusting or silently discarding.

- Intake (`intake.tsx:806`) and `PatientProfileDialog`: the release-date input pre-fills from `patient.releaseDate` (it already binds to it — with 1a/1c it stops being blank), plus a small provenance line: "From the pre-release episode — anticipated, not yet confirmed" or "Confirmed release date".
- When the value is `estimated`, a real "Confirm this date" control marks it confirmed (writes `releaseDateMeta.confidence = "confirmed"`, `source: "confirmed"`) — an explicit human step, not an assumption.
- Custody state shown read-only where release date appears, labelled with its source. No new editing surface for it.

## Part 2 — internal staff CSV upload for externally-sourced pre-release data

### Home and shape
New route `/pre-release-import` inside the EHR shell, linked from the pre-release page header (not a nav-section addition — it is an occasional bulk action, same relationship the caseload upload has to the case manager page). Pure logic in a new `src/lib/preReleaseRoster.ts`, mirroring `credentialRoster.ts`: parse → classify → preview → apply, nothing written until confirm.

### Columns
`first_name, last_name, dob, anticipated_release_date, county_of_release, facility_name, booking_number, hrsn_housing, hrsn_food, hrsn_transportation, hrsn_utilities, hrsn_safety`

HRSN columns accept `yes`/`no`/blank — **domain positivity only, not item responses**. Item-level answers belong to a real administered interview and will not be faked from a spreadsheet; the stored result is marked with a distinct provenance so it is never mistaken for a scored interview. Blank means not screened.

### Row classification (each row gets an explicit outcome + reason)
- `created` — new patient + pre-release episode opened.
- `matched` — existing patient by name + DOB; episode opened or existing episode updated.
- `rejected` — with a specific reason: missing name, missing/invalid DOB, missing or unparseable release date, release date in the far past, duplicate row within the file, invalid HRSN value.
- `skipped` — patient already has an open episode with the same release date (no-op).

Preview table with counts per outcome, downloadable template, and a per-row reason column. Apply reuses the real primitives only: `openPreReleaseEpisodeForNewPatient` / `openPreReleaseEpisode`, `updateProfile` for county, and a narrow store call for the imported HRSN domains — no parallel write path.

### RBAC — reasoning
The `pre_release` matrix row already grants write to `cf_care_manager` and `ecm_provider`, and read to `clinical_coordinator`. The realistic channel is an external CF coordinator emailing an Adelante-internal person, so the importer must be reachable by someone internal even when the CF Care Manager has no account.

I will **not** widen the `pre_release` row (that would silently grant clinical coordinators write access to every episode form). Instead a dedicated, documented helper `canImportPreReleaseRoster(role)`: `cf_care_manager`, `ecm_provider`, `clinical_coordinator`, `sys_admin`. Bulk administrative intake of identity + logistics data is a distinct, narrower permission than working an episode's clinical checklist, and it is stated as such in the code.

### Non-goals honoured
No API endpoint — a one-line comment in `preReleaseRoster.ts` notes that a machine feed would land here if the channel ever stops being human-mediated. No external-partner portal. No medical-record columns.

## Verification
Typecheck, full test suite, plus new tests: fill-if-empty vs confirmed-overwrites, custody transitions, redemption copy for pre-existing records, and roster row classification/rejection reasons. Live browser on wide and phone: open an episode and see the date on the patient, redeem a code, confirm a release, view the pre-filled intake/profile with provenance and the confirm control, and run a CSV through preview → apply. Zero console errors.
