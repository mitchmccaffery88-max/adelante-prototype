# MVP Polish — Pass 2

Focus: **Billing/ISL**, **Case Manager workspace**, with **notification realism** and **empty/loading/error states** as cross-cutting improvements. Depth ~4/5: meaningful feature work, still within the mocked `AdelanteEHR` model — no external API wiring.

## 1. Billing / ISL workspace (`src/routes/billing.tsx`, `src/lib/ehr.ts`)

Today the page is mostly a static read of appointments and a rate table. Turn it into a working coordinator surface.

### 1a. Claims worklist becomes actionable
- Extend `Appointment.billingStatus` transitions in `ehr.ts`: `draft → ready → submitted → paid | denied | write_off`, plus `denialReason?: string`, `submittedAt?`, `paidAt?`, `chargeCents?`.
- Add mutations `markBillingReady(id)`, `submitClaim(id)`, `markPaid(id, chargeCents)`, `denyClaim(id, reason)`, `writeOff(id, reason)`. Each pushes an entry into an appointment `billingHistory[]` (who/when/from→to).
- Auto-derive `chargeCents` from `RATE_TABLE` × `serviceType` + `durationMin` when moving to `ready` (mock-derived; show as editable).
- Worklist row gains action buttons matching current status, plus expand-row to see history and denial reason.
- Column filters: lane (existing), status (new), date-range, clinician. Aging bucket badge (0–7d / 8–30d / 31–60d / 60+d) computed from `submittedAt`.
- Bulk select + "Mark ready" / "Submit selected" actions.

### 1b. ISL tab gets an actual export
- Add `AdelanteEHR.exportIslReport(range: {from, to})` returning a CSV blob (program ID, DOB, encounter date, service, clinician, lane rationale). Wire the "Export annual ISL report" button to download `adelante-isl-{year}.csv`.
- Show ISL table (not just count) with encounter date, patient program ID, service type, clinician, and the reason it fell into ISL (uninsured / benefit-exhausted / restricted-setting) driven by `patient.coverage.status` and a new optional `Appointment.islReason`.
- Period selector (This year / Last year / Custom range).

### 1c. KPI tiles above the tabs
Small strip: Ready to submit, Submitted awaiting payment, Paid this month ($), Denied (needs rework), ISL reportable this year. Each tile is clickable and pre-filters the worklist.

### 1d. Credentialing hard-stop wire-up
- Add `AdelanteEHR.canBook(clinicianId): { ok, reason? }` that returns `{ ok: false, reason: "Medi-Cal enrollment expired" }` when `mediCalStatus === "expired"`.
- Call from `bookAppointment` (throw) and from `src/routes/clinician.tsx` booking form (disable + inline warning). Removes the current TODO comment.

## 2. Case Manager & Peer workspace (`src/routes/case-manager.tsx`, `src/components/ClientRecordDrawer.tsx`, `src/lib/ehr.ts`)

### 2a. Task queue / follow-ups
- New model in `ehr.ts`: `CaseTask { id, patientId, assignedTo, title, dueDate, status: "open"|"done"|"snoozed", origin: "manual"|"missed_appt"|"screener_flag"|"referral_stale", createdAt, completedAt? }`.
- Auto-generate tasks:
  - Appointment status → `no_show` creates a "Follow up on missed visit" task due +1d.
  - PHQ-9/GAD-7 severity `moderately_severe`+ creates a "Review elevated screener" task.
  - `ResourceReferral` in `requested` status >7d creates a "Chase referral" task.
- Add a **Tasks** tab in the caseload view showing the CM's open tasks with due badges (Overdue / Today / This week). Row actions: complete, snooze +3d, open patient drawer.
- `ClientRecordDrawer` grows a Tasks section per-patient.

### 2b. Caseload table upgrades
- Column sort (name, DOB, last contact, open tasks, elevated screener).
- "Stale contact" pill when `lastContactAt` >14d, "No contact yet" when null.
- Bulk-select + "Log check-in for selected" (opens the existing check-in card pre-populated for multiple patients, one submit creates N check-ins with the same note/mode/timestamp).
- Column visibility toggle (persist in `localStorage`).

### 2c. Coordination log filters
Inside `ClientRecordDrawer` External Coordination tab: filter by contact type (probation, housing, health plan, family), date range, and free-text; sort newest/oldest.

### 2d. Peer specialist notes: mode tags
Add optional `mode: "in_person"|"phone"|"text"|"warmline"|"group"` on peer notes; show as a chip in the list and filter by mode.

## 3. Notification realism (`src/lib/ehr.ts`, `src/components/PatientHome.tsx`, `src/routes/case-manager.tsx`, `src/routes/admin.tsx`)

Right now `notifications[]` on patient records is booking-only and only records that a channel was chosen — nothing about delivery.

- Rework `ApptNotification` (and add a broader `Notification` union) with:
  - `channel: "sms"|"email"|"profile"`
  - `state: "queued"|"sent"|"delivered"|"failed"`
  - `error?: string`, `sentAt?`, `deliveredAt?`
- Extend `notifyAppointmentChange` to emit one entry per channel with `state: "queued"`, then a mocked async tick promotes each entry: SMS/email → `sent` after ~500ms, then `delivered` after ~2s. Randomly fail (~10%) with a canned reason ("Carrier rejected", "Bounced") so staff surfaces have something to react to.
- **Patient home** — replace "Notified via profile/SMS/email" line with per-channel status pills and a timestamp.
- **Case Manager patient drawer** — new "Messages" section: reverse-chron list of every notification with channel, state, and a "Resend" button on `failed`. Include a "Manual outreach needed" banner when the patient is flagged `noReliablePhone` or when a notification failed and hasn't been resent within 24h.
- **Admin audit log** — show failed notifications as a filterable event class.
- Add `AdelanteEHR.resendNotification(id)` and `listFailedNotifications()` for the admin view.

## 4. Empty / loading / error states (cross-cutting)

- New shared component `src/components/EmptyState.tsx` (icon slot, title, body, optional CTA). Adopt on: Case Manager caseload (no matches), Tasks tab (no tasks), Billing worklist (no rows for filters), ISL table (no reportable encounters this range), Clinician "Today" list, Patient notifications, Coordination log.
- New `src/components/LoadingSkeletons.tsx` with `TableSkeleton` and `CardSkeleton`. Wire on billing worklist and case manager caseload for the first paint (mocked 150ms delay through a `useDeferredValue` gate).
- Route-level error boundaries: extend the existing root error surface to also set `errorComponent` on `/billing`, `/case-manager`, `/clinician`, `/admin` — friendly copy + "Try again" that calls `router.invalidate()` and `reset()`.
- Not-found: give `/schedule?reschedule=<missing-id>` an inline empty state ("We couldn't find that appointment") instead of falling through to the booking form.

## Out of scope (call out for next pass)
- Real payer/clearinghouse or Chargebee integration — still mocked rate table + statuses.
- Real SMS/email transport — mock async promotion only, no Twilio/Resend wiring yet.
- Multi-CM assignment / caseload transfer.
- Task recurrence (weekly check-in cadence rule) — for now tasks are one-off.
- Admin user/role management, referral triage board — parked for pass 3.

## Technical notes
- All new fields on `Appointment`, `Patient`, notifications remain **optional** so seed data compiles unchanged. New arrays (`billingHistory`, `tasks`) default to `[]` on read.
- CSV export uses a client-side blob; no server function needed at MVP.
- Async notification promotion runs via `setTimeout` inside `notifyAppointmentChange` and calls the store's `emit()`; no new dependencies.
- Task auto-generation lives inside the existing mutations (`updateAppointmentStatus`, screener submit, referral create) — no polling loop.
- `EmptyState` and skeletons use existing shadcn tokens (`text-muted-foreground`, `bg-card`) — no new colors.
