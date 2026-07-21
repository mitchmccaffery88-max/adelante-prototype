# Vendor status page, refill flow, telehealth lifecycle, audit viewer

Four related additions built on the existing `AdelanteEHR` + vendor adapter seam. All mock-backed; no real vendor calls. Existing `AuditLogCard` on Admin today only shows consent events — this pass generalizes it into a real audit stream.

## 1. Unified audit event stream (foundation for everything else)

`src/lib/ehr.ts`
- Add `AuditEvent` type: `{ id, at, actorRole?, actorId?, patientId?, category: "consent" | "rx" | "telehealth" | "vendor" | "access", action, detail? }`.
- Add internal `auditEvents: AuditEvent[]` array + `appendAudit(evt)` helper that also `emit()`s.
- Fold existing consent-event writes and `recordRxEvent` through `appendAudit` so nothing is duplicated; keep back-compat `listRxEvents` reading from the unified store filtered by category.
- New helpers: `listAuditEvents({ patientId?, category?, since?, limit? })`, `listTelehealthSessions(patientId?)`.

## 2. Medication refill request flow

Data (`src/lib/ehr.ts` + `src/lib/vendors/erx.ts`)
- Add `RefillRequest` type: `{ id, patientId, medicationId, medicationName, requestedAt, requestedBy: "patient" | "clinician", pharmacyNote?, status: "pending" | "approved" | "denied" | "sent_to_pharmacy", reviewedBy?, reviewedAt?, denyReason? }`.
- `AdelanteEHR.requestRefill({ patientId, medicationId, pharmacyNote? })` — creates a pending request, appends audit `rx:refill_requested`, and auto-generates a `CaseTask` (assignee = PMHNP) so it surfaces in the clinician queue.
- `AdelanteEHR.reviewRefill({ id, decision: "approved"|"denied", denyReason?, clinicianId })` — updates status, appends audit `rx:refill_approved|denied`, marks task done. Approval moves status to `sent_to_pharmacy` after a short mock delay (immediate in-memory OK for MVP; annotate with source: "escribe-mock").
- `listRefillRequests({ patientId?, status? })`.

Patient surface (`src/components/PatientHome.tsx`)
- On each row of the "My medications" card add a **Request refill** button.
- Clicking opens a small inline form (pharmacy note optional). After submit, show status pill next to the med (Pending / Approved / Denied — with deny reason tooltip).
- Bilingual copy via `useI18n` (EN + ES strings).

Clinician surface (`src/routes/clinician.tsx`)
- New **Refill requests** card near the credentialing banner: pending requests for the acting clinician's caseload, with Approve / Deny actions (deny requires reason). Only visible when acting role has `meds_erx` write (PMHNP); read-only for therapist/CM.
- Existing "Open in eScribe" launch continues to write `sso_launch` through the unified audit store.

## 3. Telehealth session lifecycle tracking

Data (`src/lib/ehr.ts` + `src/lib/vendors/telehealth.ts`)
- Add `TelehealthSession` type: `{ id, appointmentId, patientId, clinicianId, vendor, roomId, joinUrlPatient, joinUrlClinician, state: "scheduled"|"clinician_joined"|"patient_joined"|"in_progress"|"ended"|"expired"|"failed", createdAt, startedAt?, endedAt?, durationSec? }`.
- `AdelanteEHR.startTelehealthSession(appointmentId)` — idempotent; creates the session if missing, appends audit `telehealth:created`.
- `AdelanteEHR.markTelehealthJoin(appointmentId, role)` — transitions to `clinician_joined` / `patient_joined` and to `in_progress` when both present. Audit each join.
- `AdelanteEHR.endTelehealthSession(appointmentId, reason?)` — sets `ended`, computes duration, appends audit.
- Auto-expire helper `sweepExpiredTelehealth()` called on session listing (mock: sessions past `expiresAt` with no `endedAt` become `expired`).

Wire-in
- `src/routes/clinician.tsx` "Launch telehealth" → open join URL + call `markTelehealthJoin(id, "clinician")`.
- `src/routes/schedule.tsx` patient join button → `markTelehealthJoin(id, "patient")`.
- New "End session" affordance in clinician view once state is `in_progress`.
- Client Record Drawer "Telehealth" section (small): last 5 sessions with state + duration (read-gated by `telehealth_room`).

## 4. Vendor status page (`/admin/vendors`)

New route `src/routes/admin.vendors.tsx` (child of admin) — a full page instead of just the existing Admin dashboard card.
- **Adapters panel**: telehealth + eRx with vendor name, mode (mock/live), last ping result and timestamp, "Test connection" button (calls `adapter.ping()`).
- **Telehealth activity**: 24h / 7d counts by state (created, in_progress, ended, expired, failed). Table of recent sessions with jump-to-audit link.
- **eRx activity**: counts of SSO launches, refill requests (pending/approved/denied), last activity per patient (aggregated). Table of recent RxEvents.
- **Config readiness**: static checklist rows ("Telehealth SDK key", "eScribe SSO client ID", "Webhook secret") each showing `Missing (mock in use)` badge — placeholder for the eventual live wiring.
- Keep the existing lightweight `VendorStatusCard` on the admin dashboard but link its header to the new page.

## 5. Audit log viewer

New route `src/routes/admin.audit.tsx` — full-page viewer over the unified `listAuditEvents`.
- Filters: category (multi), actor role, patient (search-by-CIN or name from existing patient list), date range.
- Table columns: timestamp, category (colored pill), action, actor, patient (masked CIN), detail. Row-expand shows full JSON detail.
- CSV export button (reuses the pattern already in `billing.tsx`).
- Replace the Admin dashboard's existing `AuditLogCard` body with a compact "Recent activity" preview (last 10 events across all categories) plus "View all" link to `/admin/audit`. Keep it consent-ledger-friendly by defaulting the filter to `category=consent` when navigated from the consent surface.

## 6. RBAC + i18n

- `src/lib/roles.ts`: extend the matrix so `sys_admin` gets `read` on all audit categories; `pmhnp`/`therapist` read their own patients' telehealth/rx events; CM read (non-Part-2). No new record classes needed — reuse `meds_erx` and `telehealth_room`; audit viewer gate is `sys_admin` write / everyone else summary.
- Add EN + ES strings in `src/lib/i18n.tsx` for refill request UI, session state labels, and audit categories.

## Out of scope

- Real vendor SDK wiring, real pharmacy transmission, real webhook receivers.
- Persisting audit events to Cloud (still in-memory; matches current mock EHR posture).
- New consent classes — refill and telehealth reuse existing `meds_erx` and `telehealth_room` gating.

## Technical notes

- All new mutations flow through `appendAudit` — no direct writes to `rxEvents` or consent arrays.
- Vendor adapters (`src/lib/vendors/*`) grow `ping()` result caching (last N=5) and gain `endRoom` state emission; UI still only talks to `AdelanteEHR`.
- Two new route files under `src/routes/admin.*.tsx` follow the existing flat dot-separated file-based routing convention; head() metadata unique to each. No changes to `src/routeTree.gen.ts` (auto-generated).
- Refill task auto-creation reuses `CaseTask` + `TaskQueueCard`, so no new queue UI is needed on the CM side.
