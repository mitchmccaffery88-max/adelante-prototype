# MVP Polish Pass 4

Scope: Standard (1–2 tracks combined). Focus on **Patient Flow + Spanish i18n**, **Clinician Workspace Polish**, and a **WCAG AA Accessibility Sweep**. Admin/reporting depth deferred to a follow-up pass.

## 1. Patient Flow + Spanish i18n

**Goal:** A patient can complete their journey (home → schedule → check-in → profile) entirely in Spanish, at a 6th-grade reading level.

- Expand `src/lib/i18n.ts` dictionary with keys for: Schedule page, Reschedule dialog, Check-in flow, Care Plan card, Profile dialog, Medi-Cal status, Notifications toasts.
- Wire `useI18n()` into:
  - `src/routes/schedule.tsx` (labels, service-type names, modality, conflict messages)
  - `src/components/PatientProfileDialog.tsx`
  - Care Plan + Goals cards on `src/routes/patient.tsx`
  - Toast/notification strings surfaced to patients
- Add a persistent language toggle (EN / ES) in the patient header; persist to localStorage.
- Simplify remaining jargon: "modality" → "how you meet", "credentialing" hidden from patient view, "episode" → "care period".
- Add a "Need help?" support link on every patient screen (single component).

## 2. Clinician Workspace Polish

**Goal:** Reduce clicks between caseload → appointment → note → care plan.

- Add a **caseload filter bar** to `src/routes/clinician.tsx`: search by name/CIN, filter by next-appointment window (today / this week / overdue), risk flag.
- Add a **Recent SOAP notes** column showing last note date + modality per client; click opens the note in a drawer.
- On the appointment detail, prefill SOAP note with: service type, modality, duration, goals from active Care Plan.
- Add a lightweight **Goal progress sparkline** (last 4 check-ins) on the Care Plan card.
- Surface **credentialing warning banner** (reuse `expiringClinicianLicenses`) at the top of the clinician workspace when the signed-in clinician's own license expires <30 days.

## 3. Accessibility Sweep (WCAG AA)

**Goal:** Pass the critical + warning tiers of the a11y checklist across all workspaces.

- **Icon-only buttons:** add `aria-label` to every `size="icon"` Button across drawers, dialogs, tables (Client Record Drawer, Case Manager, Clinician, Admin, Billing, Schedule).
- **Landmarks:** ensure exactly one `<main>` per route, rendered in `__root.tsx` around `<Outlet />` if not already; remove any duplicates in child routes.
- **Headings:** verify no skipped levels on patient/clinician/admin/billing routes.
- **Color tokens:** replace any hardcoded `text-gray-*` / `bg-white` / arbitrary hex with `text-foreground` / `text-muted-foreground` / `bg-background` / `bg-card` tokens.
- **Focus states:** add `focus-visible:ring-2 focus-visible:ring-ring` to any custom-styled clickable divs; convert `onClick` divs to `<button>` where feasible.
- **Forms:** confirm every `Input` / `Select` / `Textarea` has an associated `Label` (esp. `TimePicker`, ClientRecordDrawer tabs, referral form CIN/DOB, schedule filters).
- **Mobile tap targets:** bump icon buttons in patient views to `min-h-11 min-w-11`.
- **`h-screen` → `h-dvh`** on any full-height patient layout.
- **`lang` attribute** on `<html>` reflects current i18n locale (updates on toggle).
- **ReadAloud coverage:** ensure ReadAloudButton is present on Landing, Patient Home, and Schedule confirmation screens.

## Out of scope (deferred)

- Admin/reporting depth (funding lane utilization report, episode outcomes dashboard, audit-log filters, CSV exports) — plan separately in Pass 5.
- New features; this is polish only.

## Technical notes

- No new dependencies.
- No schema/EHR model changes — this is UI + i18n + a11y work.
- All new strings routed through `useI18n()`; English keys stay as source of truth, Spanish additive.
- Verify with `tsgo` after edits; spot-check patient + clinician routes visually.
