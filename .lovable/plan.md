## Goal
Add a live "referral status timeline" bar shown on the case-manager patient record (the ClientRecordDrawer) that renders each milestone the client has moved through and auto-updates as assignments and intake steps change.

## Milestones tracked
Ordered, each with a timestamp when available:
1. Referral submitted — `referral.createdAt`
2. Outreach — `referral.smsSentAt` OR `outreachTask==='manual_call'` (contacted)
3. Enrolled as patient — `referral.status==='enrolled'` (fallback: patient.createdAt if no referral)
4. Case manager assigned — `patient.caseManagerId` set (uses latest `audit` entry of category `assignment` for timestamp; falls back to "assigned")
5. Clinician assigned — `patient.primaryClinicianId` set (same audit lookup, falls back)
6. Intake completed — `patient.intakeCompletedAt`
7. First session booked — earliest `appointment` for patient (any status)

Each step renders as: dot + label + relative timestamp (or "Pending"). Reached steps use `bg-teal`; current step pulses; future steps `bg-border`. Connector segments fill teal between reached steps.

## Files

**New** `src/components/ReferralStatusTimeline.tsx`
- Props: `patient: Patient`.
- Uses `useEhr()` so it re-renders on any store mutation.
- Internally: pulls referral via `AdelanteEHR.listReferrals().find(r => r.enrolledPatientId === patient.id || r.id === patient.referralId)`, appointments via `appointmentsForPatient`, and audit events via existing `listAudit`/equivalent (filter by patientId + category `assignment`) to source assignment timestamps.
- Computes an ordered `steps` array `{ key, label, reachedAt?: string, current: boolean }`.
- Renders a horizontal bar on ≥sm, stacked vertical list on mobile (mirrors existing `ReferralTrackerCard` styling; uses tokens `teal`, `navy`, `gold`, `success`, `border`).

**Edit** `src/components/ClientRecordDrawer.tsx`
- Import and render `<ReferralStatusTimeline patient={patient} />` at the top of the drawer body, above the existing overview/tab section. Same placement for all staff roles (visible without extra RBAC — no PHI beyond what the drawer already shows).

## Non-goals
- No new mutations, no store schema changes.
- No changes to admin/referral pages (existing `ReferralTrackerCard` untouched).
- No timeline on patient-facing surfaces.

## Verification
- `tsgo` typecheck.
- Manual: open a case-manager patient with a referral vs. one without; assign a clinician via `AssignClinicianButton` and confirm the timeline advances without reopening the drawer.
