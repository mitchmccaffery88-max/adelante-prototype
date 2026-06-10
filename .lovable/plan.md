
# Profile, Scheduling & Care Plan Polish

Five focused fixes, all mock-storage (no Cloud). Each is independently shippable.

---

## 1. Medi-Cal intake — make status messaging unmissable

**Problem:** In `intake.tsx` (coverage step), the four status options each have unique downstream meaning, but only "suspended" and "none_unsure" show a tiny grey helper line. "active" and "other" show nothing. The signal is easy to miss.

**Fix in `src/routes/intake.tsx` (coverage step only):**
- Replace the grey `text-xs text-muted-foreground` helper with a **status callout card** that always renders below the Select — color-coded and iconified per status:
  - `active` → green/teal "You're all set" card: "Your visits are free. We'll verify your Medi-Cal ID with the county — no action needed from you."
  - `suspended` → gold/amber "Auto-reactivating" card: "Your Medi-Cal turns back on automatically when you come home (CalAIM §1945). A case manager will confirm with {county} County within 5 business days."
  - `none_unsure` → navy "We'll help you apply" card: "A case manager will start a BenefitsCal application with you. Most reentry adults qualify. Coverage is usually active within 10 days."
  - `other` → neutral card with a small input: "Plan name (optional)" + "We'll bill your plan. If they don't cover it, your visits stay free under our reentry program."
- Promote the County field above the status callout (county is what drives the message for `suspended`), and interpolate it into the callout text.
- Add matching i18n keys (`intakeCoverageActive*`, `intakeCoverageSuspended*`, `intakeCoverageNone*`, `intakeCoverageOther*`) to `src/lib/i18n.tsx` for EN + ES.
- No schema change — `coverage.status` already exists.

---

## 2. Scheduling — bind Book/Reschedule to provider availability

**Problem:** `src/routes/schedule.tsx` lets a patient pick any weekday 9–17 slot regardless of whether the clinician is actually free, so they can request times that will be rejected later. Reschedule today has no dedicated path.

**Design (mock Healthie availability):**
- Extend `HealthieService` in `src/lib/healthie.ts`:
  - `getClinicianAvailability(clinicianId, dateRange) → Slot[]` — mock returns seeded slots per clinician for the next 30 days (M–F, three slots/day, minus already-booked ones).
  - `bookAppointment` validates the chosen slot is still in the availability list; rejects with a typed error if taken.
  - `rescheduleAppointment(apptId, newSlot)` — cancels old, books new, fires a notification (see §3).
- Replace the free-form `datetime-local` in `schedule.tsx` with a **two-step picker**:
  1. **Day strip** (next 14 weekdays) showing slot counts ("3 open" / "Full").
  2. **Time chips** (only real open slots for the selected clinician on that day).
- Add an optional `?reschedule={apptId}` query param to `/schedule` so the existing "Book another time" / a new "Reschedule" button on `PatientHome` can deep-link in; on submit it calls `rescheduleAppointment` instead of `bookAppointment`.
- Empty state when no slots in 14 days: "No openings with {clinician} this week — try another counselor" with a clinician switch.
- **Note for the user (technical caveat):** the real Healthie GraphQL `availabilities` query goes behind this same `getClinicianAvailability` shape, so the swap-in is mechanical when we wire the live API.

---

## 3. Appointment notifications — profile + SMS + email

**Problem:** Today, booking just toasts "requested" and writes to mock state. The user wants: profile updates immediately, SMS if opted in, email if on file.

**Fix:**
- Add `HealthieService.notifyAppointmentChange({patientId, apptId, kind: "booked"|"rescheduled"|"cancelled"|"confirmed"})` that:
  1. Appends to a per-patient `notifications: Notification[]` list (drives the profile update — surfaced as a new "Recent updates" line in the Next Session card and as a toast on next load).
  2. If `smsConsent` is on and `phone` exists → enqueues a mock SMS log entry (visible in admin's existing SMS-vs-manual branch).
  3. If `email` exists → enqueues a mock email log entry.
  4. All three channels record to a single `commsLog` so admin/case-manager can audit delivery.
- Call it from `bookAppointment`, `rescheduleAppointment`, `cancelAppointment`, and clinician confirm action.
- In `PatientHome.tsx` Next Session card, add a small "Confirmed via text + email · 2m ago" line under the time when a notification exists for that appt — this is the "profile update" the user asked for.
- Add an `email` field to `Patient` (optional) and surface it in `PatientProfileDialog` and the My Profile card (currently we only collect phone).

---

## 4. Patient profile layout — Privacy & Consent moves to the bottom

**Problem:** In `PatientHome.tsx`, the render order is: Welcome → Next Session + Care Plan → Goals → Tasks → **My Profile → Consent** → Upcoming → History. User wants Privacy & Consent at the very bottom.

**Fix in `src/components/PatientHome.tsx`:**
- Reorder to: Welcome → Next Session + Care Plan → Goals → Tasks → **My Profile** → Upcoming → History → **Privacy & Consent** (last card before the crisis footer).
- No content changes to the consent toggles themselves.

---

## 5. Care Plan card — blank badge + sparse visuals

**Problem (root cause found):** `PatientHome.tsx` `needMap` keys are `housing | substanceUse | employment | benefits | family | transportation`, but the seeded `Patient.needs` schema in `healthie.ts` is `housing | food | employment | transport`. So `food` and `transport` render as badges with **no label** (the blank chip in the screenshot) and `substanceUse / benefits / family` are dead keys.

**Fix:**
- Reconcile `Patient.needs` schema in `src/lib/healthie.ts` to the full set the UI references: `housing | food | substanceUse | employment | benefits | family | transport`. Backfill the four seeded patients and the new-patient default.
- Update `needMap` and the i18n keys: add `needFood`, rename `needTransportation → needTransport` (or keep both and map `transport → needTransport`). EN + ES.
- Filter out falsy entries AND unknown keys defensively so a future schema drift cannot render a blank chip again.
- "Care plan will appear here after intake" placeholder is intentional for pre-intake patients — leave as is, but for **post-intake** patients with no goals yet, show three skeleton goal rows + a "Your counselor will add goals after your first session" hint so the card never looks empty.
- Add icons per need category (Home / Utensils / HeartPulse / Briefcase / FileText / Users / Car) in place of the single MapPin so the card reads as a real summary, not a tag dump.

---

## Files touched

- `src/lib/healthie.ts` — availability, reschedule, notify, needs schema reconciliation, email field
- `src/lib/i18n.tsx` — Medi-Cal callout copy, need labels, notification toasts (EN + ES)
- `src/routes/intake.tsx` — Medi-Cal callout cards
- `src/routes/schedule.tsx` — availability-driven picker, reschedule mode
- `src/components/PatientHome.tsx` — reorder, notification line, fixed needs rendering
- `src/components/PatientProfileDialog.tsx` — email field

No new dependencies, no migrations, no new routes.

## Suggested order

§5 (smallest, fixes a visible bug) → §4 (pure reorder) → §1 (intake copy) → §2 (scheduling picker) → §3 (notifications, builds on §2).
