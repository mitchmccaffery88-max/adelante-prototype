# Staff-initiated patient record creation (no login attached)

## What I found first

- `AdelanteEHR.createPatient` already supports credential-free creation: `CaseloadUploadDialog`
  (bulk Track A) and `openPreReleaseEpisodeForNewPatient` (in-custody) both call it with no
  `signupCredential`. There is no individual staff "create one chart" action anywhere.
- `openPreReleaseEpisodeForNewPatient` is the precedent for a named wrapper: it calls the real
  `createPatient`, then writes one audit event (`in_custody_patient_created`). I'll mirror that
  shape exactly rather than inventing a second creation mechanism.
- **Important honesty finding:** `redeemEnrollmentCode` does support "record first, login later" —
  it never creates a patient, it attaches credential metadata to an existing one. But the only
  place an `EnrollmentCode` is ever issued today is `completeReentryCarePlan`, and the
  `EnrollmentCode` type *requires* `episodeId` and `carePlanId`. So a walk-in chart created this
  way has **no real way to get a code today**. I will not fake one. See "What the UI will honestly
  say" below — this is the main thing needing your call.

## Build

### 1. EHR wrapper (`src/lib/ehr.ts`)

`createStaffPatientRecord({ firstName, lastName, dob?, phone?, email?, preferredLanguage?, cin?,
caseManagerId?, createdByStaffId, createdByStaffName, actorRole })`

- calls the existing `createPatient` unchanged, with **no** `signupCredential` and no session;
- optionally calls the existing `assignCaseManager` when a case manager is picked;
- appends one audit event `staff_created_patient_record` with the creating staff identity and
  `portalAccess: "none"`.

No new patient fields, no new flags. "Has no login" stays derived from absent `signupCredential`,
exactly as it already is for every Track A record.

### 2. RBAC (`src/lib/roles.ts`)

New record class `patient_record_creation` + `canCreatePatientRecord(role)` derived from the
matrix (same pattern as `assisted_signup` / `canRunAssistedSignup`). Grants, with reasoning:

| Role | Grant | Why |
|---|---|---|
| ecm_provider | write | already `demographics: write`; owns D0–90 enrollment |
| sud_counselor | write | already `demographics: write`; treating provider |
| therapist, pmhnp | write | the stated case — a clinician opening a chart for a walk-in or an in-facility program patient who will never use the portal |
| clinical_coordinator | write | owns intake disposition and record correction |
| sys_admin | write | correction/support, matching `assisted_signup` |

Deliberately excluded: `cf_care_manager` (in-custody creation already has its own purpose-built
pre-release path; a walk-in is not their lane), `peer_specialist`, `medical_assistant`,
`clinical_trainee`, `community_health_worker`, `billing*`, `credentialing_coordinator` — all
read-only on demographics today.

### 3. Entry point

A "New patient chart" button in the `/case-manager` header, immediately beside the existing
"Upload caseload" button — the individual counterpart of the bulk path, in the one place staff
already manage caseloads. Rendered only when `canCreatePatientRecord(role)`; the dialog itself
re-checks the same gate.

New `src/components/NewPatientRecordDialog.tsx`: first/last name (required), DOB, phone, email,
preferred language, CIN, optional case-manager assignment — plus a plain, permanent notice in the
dialog that this creates a chart with **no portal login**. On success: toast + navigate to
`/record/$patientId`.

### 4. Honest chart signalling

New `src/components/clinical/PortalAccessBadge.tsx`, rendered in the `/record/$patientId` header
(and reused nowhere else for now). For any patient with no `signupCredential`:

> **No portal login** — this chart has no patient account attached. The person can't sign in, see
> messages, or use the app.

Expanded (tooltip/inline): the one real mechanism that attaches a login to an *existing* chart is
redeeming an `RE-` enrollment code at sign-up — and those codes are only issued when a reentry
care plan is completed for someone in a pre-release episode. So the text will say plainly that
this applies to pre-release records, and that for a directly-created chart there is no
self-service path yet. No button that does nothing.

### What the UI will honestly say

I'm choosing accurate-but-blunt over a reassuring dead-end. If you'd rather I extend enrollment
codes so staff can issue one against any chart (making `episodeId`/`carePlanId` optional), say so
— that's a real change to the code-issuance model and your non-goals said not to touch it, so I'm
leaving it alone and reporting the gap instead.

## Verification

Typecheck, full Vitest (plus a new unit test for the wrapper: no `signupCredential`, audit written,
and a roles test for the gate). Browser at 1280px and 390px: create a chart as ECM provider,
confirm no session/credential, confirm the badge, confirm a peer specialist sees no button and the
dialog refuses. Zero console errors; caseload upload, signup, and code redemption untouched.
