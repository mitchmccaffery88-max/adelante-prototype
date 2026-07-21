# Pivot to Native Adelante EHR + Vendor Adapters

Adelante now owns the EHR record of truth. External vendors are only used for two bounded jobs: **telehealth video sessions** and **medication management / eRx (eScribe)**. Everything else — scheduling, charting, care plans, tasks, billing, consent, RBAC — lives in our own data model.

Prior renames already stripped `HealthieService` → `AdelanteEHR` and `useHealthie` → `useEhr`, so no code references to Healthie remain. This plan reframes intent, tightens vendor seams, and adds the eRx surface.

## 1. Product framing changes (copy + docs)

- Schedule page: replace "Book a private video or phone session with your care team" wording that implies a third-party booking with Adelante-owned language ("Adelante schedules and hosts your visit").
- Clinician "Launch telehealth" toast: change `Adelante video room · session {id}` to name the integrated vendor generically ("Secure video powered by our telehealth partner") so the vendor can swap without copy churn.
- Consent page telehealth row: add a short note that video is delivered via a HIPAA-aligned integrated vendor; medication management is delivered via eScribe.
- Admin "About" / footer: state Adelante Pathways is the EHR of record; list telehealth + eRx as integrated services.

## 2. Vendor adapter seams (no business logic changes)

Introduce a thin, typed adapter layer so vendors are swappable and mockable. All calls flow through `AdelanteEHR`; adapters never touch UI directly.

New files:
- `src/lib/vendors/telehealth.ts` — `TelehealthAdapter` interface: `createRoom(appointmentId) → { joinUrl, roomId, expiresAt }`, `endRoom(roomId)`, `getJoinUrl(appointmentId, role)`. Ship a `MockTelehealthAdapter` for MVP that returns a deterministic fake join URL and logs an audit event.
- `src/lib/vendors/erx.ts` — `ErxAdapter` interface for eScribe: `ssoLaunchUrl(clinicianId, patientId) → string`, `listActiveMedications(patientId)`, `listRecentRx(patientId)`, `pushDemographics(patient)`. Ship a `MockEscribeAdapter` returning seeded medication rows.
- `src/lib/vendors/index.ts` — resolves the active adapter (mock in MVP; real vendor keys wired later via Cloud secrets).

Wire-in points (behavior identical, just routed through adapters):
- `clinician.tsx` "Join" / "Launch telehealth" → `telehealth.getJoinUrl(apptId, "clinician")`.
- `schedule.tsx` patient join button (post-booking confirmation) → `telehealth.getJoinUrl(apptId, "patient")`.
- New Clinician + Patient "Medications" surface → `erx.listActiveMedications(patientId)`.

## 3. EHR data-model additions (`src/lib/ehr.ts`)

Additive only — no breaking changes to existing seeds.

- `Appointment`: add optional `telehealth?: { vendor: string; roomId: string; joinUrlPatient?: string; joinUrlClinician?: string; expiresAt?: string }`. Populated on booking when modality = `video`.
- New `Medication` type: `{ id, patientId, name, dose, route, frequency, prescriberId, startedOn, endedOn?, source: "escribe" | "manual", status: "active" | "discontinued" }`.
- New `RxEvent` type for audit-visible eRx actions (launch, refill request, discontinue) — no PHI beyond patient/clinician IDs and timestamps.
- `AdelanteEHR` methods: `listMedications(patientId)`, `recordRxEvent(evt)`, `attachTelehealthRoom(apptId, room)`.
- Extend the RBAC matrix in `src/lib/roles.ts`: `meds_erx` already exists; add `telehealth_room` record class (pmhnp/therapist: write, case_manager: read, peer: none). Consent-gated as usual.

## 4. New surfaces

- **Clinician → Medications tab** on the patient chart drawer: read-only list from `MockEscribeAdapter`, plus an "Open in eScribe" button that calls `erx.ssoLaunchUrl` (mock URL for now). Only visible to `pmhnp` and `therapist` (read).
- **Patient Home → My medications card**: name + dose + frequency + prescriber, using patient-safe simplified copy. Hidden when list is empty.
- **Admin → Vendor status card**: shows which adapter is active (mock vs live), last successful call timestamp, and a "Test connection" button. Sets up the eventual live-key rollout.

## 5. Cleanup + guardrails

- Add a lint-style check note in `src/lib/ehr.ts` header comment: "Adelante is the EHR of record. Do not import vendor SDKs outside `src/lib/vendors/*`."
- Update landing / auth marketing copy that still hints at a third-party EHR partner (spot-check `Landing.tsx`, `PatientHome.tsx` help text).
- i18n: add English + Spanish strings for the new Medications card and telehealth vendor phrasing.

## Out of scope for this pass

- Real eScribe SSO handshake, real telehealth vendor selection, and Cloud secret wiring — deferred until vendor contracts are signed. The mock adapters keep the UI and RBAC honest in the meantime.
- Any change to billing, scheduling rules, or existing consent flows beyond the copy tweaks above.

## Technical notes

- Adapters live under `src/lib/vendors/` and are pure TS with no network calls in MVP; swapping to real implementations is a one-file change per vendor.
- `AdelanteEHR` remains the only module UI code imports for patient data. Vendor adapters are called *by* `AdelanteEHR` methods, never directly by components, except for `ssoLaunchUrl` which is a pass-through by design.
- All new records flow through the existing audit log so 42 CFR Part 2 / consent gating stays intact.
