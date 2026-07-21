# Provider Switch Notification

When a patient moves from one provider to another — via reschedule, new booking, refill request, or a change of assigned clinician — the outgoing provider gets flagged and looped in for continuity review. Also surfaces in Admin reporting.

## What counts as a "switch"

1. **Appointment reschedule** — `clinicianId` changes on an existing appointment.
2. **New appointment** — patient books with a clinician different from their most recent scheduled/attended provider for the same service type.
3. **Refill request** — patient sends a refill to a prescriber other than the med's last prescriber.
4. **Assigned clinician change** — the patient's primary/assigned clinician on their record changes (staff-initiated).

Self-scheduling with the same provider = no switch. First-ever booking = no switch (no prior provider).

## Behavior on switch

- **Flag on the patient record**: new `ProviderSwitch` entry (from, to, reason, service type, initiated by, timestamp, status: `pending_review` → `acknowledged` | `dismissed`).
- **Task to previous provider**: auto-generated `CaseTask` addressed to the outgoing clinician, origin `provider_switch`, with a link back to the patient record. Task carries the reason and switch context so they can review continuity, in-network status, and flag conflicts.
- **Task to case manager**: parallel task for CM review of coordination impact (release date, funding lane, in-network eligibility).
- **Notification banner**: on the outgoing clinician's workspace, unresolved switches show at the top with Acknowledge / Consult / Dismiss actions. Acknowledge closes the flag; Consult opens a coordination-log entry pre-filled with both provider names.
- **Audit event**: `appendAudit` with kind `provider_switch` so it appears in the unified audit viewer.
- **Patient-facing**: silent by default; patient just sees their new provider. No alarming messaging.

## Data model (additive, in `src/lib/ehr.ts`)

- `ProviderSwitch` type + `providerSwitches[]` store.
- `flagProviderSwitch({ patientId, fromClinicianId, toClinicianId, context, initiatedBy })` — creates the record, tasks, and audit event. No-op if `from === to` or `from` is empty.
- Hooks into: `bookAppointment`, `rescheduleAppointment`, `requestRefill`, and a new `reassignPrimaryClinician` mutation.
- Helper `getPreviousProviderFor(patientId, serviceType)` picks the most recent scheduled/attended clinician to compare against.
- Resolve helpers: `acknowledgeProviderSwitch`, `dismissProviderSwitch`.

## UI surfaces

- **Clinician workspace** (`src/routes/clinician.tsx`): new "Provider switch alerts" card listing pending switches where they are the outgoing provider, with actions.
- **Case Manager caseload** (`src/routes/case-manager.tsx`): switch badge on affected client rows; drawer tab shows the switch history.
- **Client Record Drawer** (`src/components/ClientRecordDrawer.tsx`): "Provider history" mini-timeline under Contact/Coordination.
- **Admin reporting** (`src/routes/admin.tsx` + `admin-audit.tsx`): KPI tile for pending switches, and switches surface as their own audit-log category with filters.

## RBAC

- Outgoing clinician + assigned CM: can see and act on the flag.
- Admin: read-only across all switches.
- Patient: no direct view; visible only as a normal provider change on their profile.

## Out of scope for this pass

- External payer / in-network verification API — flag only, review is manual.
- SMS/email to previous provider — internal task + banner is sufficient for MVP.
- Bulk reassignment tooling.
