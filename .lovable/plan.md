# Build 1 MVP — Prioritized Close-Out Plan

Five focused workstreams, ordered by clinical/compliance value. Each is small enough to ship in one pass.

## 1. Complete the screener battery (DAST-10 + PCL-5)
- Extend `src/lib/screeners.ts` with `DAST-10` (0–10, drug-use severity bands) and `PCL-5` (0–80, PTSD cutoff ≥ 33).
- Add both to the intake flow in `src/routes/intake.tsx` after AUDIT-10, with the same plain-language framing and 42 CFR Part 2 guardrails.
- Persist results to `screenerHistory` (already in `src/lib/healthie.ts`) so the trend tab can render them.

## 2. Clinician workspace: care plan, notes, trend tab
- New tabbed layout in `src/routes/clinician.tsx`: **Schedule | Care Plan | Notes | Tracking**.
- **Care Plan**: editable goals + interventions per patient, stored on the patient record in the mock service.
- **Notes**: SOAP-style progress note form (date, session type, subjective/objective/assessment/plan), list view per patient.
- **Tracking**: render `screenerHistory` as a simple trend (PHQ-9 / GAD-7 / AUDIT-10 / DAST-10 / PCL-5) with day 30 / 60 / 90 markers and a "Schedule re-screen" action.

## 3. Patient portal upgrades
- Add account stub (sign-in/sign-up screen reusing the existing demo patient switcher as the backing store — no real auth yet, scoped to MVP).
- Patient-visible **Goals & Next Steps** card on `/home`, sourced from the clinician care plan.
- **Self-scheduling**: let the patient request/book an open slot from the clinician scheduler.

## 4. Spanish (es) language coverage
- Expand the i18n stub beyond `appName` to cover landing page, intake prompts, crisis banner, and patient home.
- Keep copy at 6th-grade reading level; mirror the warm tone of the English landing page.

## 5. PWA packaging
- Add `public/manifest.webmanifest` (name "Adelante", theme, icons, standalone) and link it from `__root.tsx`.
- Register a minimal service worker for offline shell (cache landing page + patient home).
- Add an install prompt affordance on `/home`.

## Explicitly deferred (not in this pass)
- Consent revocation UI and audit-log viewer
- Admin CSV export and cohort filters
- Real auth provider / Lovable Cloud wiring
- Referrer-facing status tracker view
- Editable ECM / Community Supports flag toggles

## Technical notes
- All data stays in the existing mock `src/lib/healthie.ts` service — no backend changes this pass.
- Screener scoring stays pure functions in `src/lib/screeners.ts` for easy unit reasoning.
- Trend tab uses `recharts` (already in deps) — no new packages.
- PWA: use a hand-rolled service worker registered from `src/router.tsx` to avoid adding a Vite PWA plugin.

Confirm and I'll implement in this order — or tell me to drop/reorder any item.