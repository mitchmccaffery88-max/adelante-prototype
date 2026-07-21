Goal: Make the patient-facing Adelante experience feel like a native, thumb-friendly app on phones, while keeping staff surfaces usable on mobile. Keep demo personas and in-memory store; do not add a backend or service-worker offline behavior.

Scope
- Patient surfaces: landing, auth, home, intake, schedule, consent.
- PWA installability: manifest already exists; add an explicit install prompt and a fallback manual instruction.
- Staff surfaces: make case-manager and clinician pages at least readable and tappable on phones without horizontal clipping.
- Accessibility + touch: fix icon-only controls, tap targets, dynamic `lang`, landmarks, and focus indicators.

Technical guardrails
- Stay in Tailwind v4 + shadcn/ui; no new colors except via tokens in `src/styles.css`.
- No `vite-plugin-pwa` or service worker; offline behavior is out of scope.
- Keep demo auth / role picker exactly as-is.
- All changes must pass `bun run build` and `bun run lint`.

Plan

1. Viewport & shell fundamentals
   - Replace `min-h-screen` with `min-h-dvh` in `AppShell` and any other full-height wrappers.
   - Audit every route for duplicate `<main>` tags; keep the single `<main>` in `AppShell` and remove any inner `<main>` wrappers.
   - Synchronize `<html lang>` with the active i18n language in `src/lib/i18n.tsx` (update `document.documentElement.lang` on client, default SSR stays `en`).

2. Mobile navigation
   - Add a bottom tab bar for patient-primary actions: My care, Intake, Schedule. Show it only on `/home`, `/intake`, `/schedule` at `md:hidden`.
   - Keep the existing top header as a brand + language + account strip; move the patient links out of the top mobile scroll bar and into the bottom tab bar.
   - Collapse the staff mobile scroll nav into a single "Staff" dropdown in the header so it does not compete with the patient bottom nav.
   - Ensure the sticky 988 crisis banner and the bottom tab bar do not overlap content; use bottom padding equal to the combined height of the footer elements on patient pages.

3. Patient surfaces
   - `src/components/PatientHome.tsx`:
     - Make the welcome/progress card stack vertically on small screens.
     - Convert the two-column appointment / care-plan grid to a single column on mobile.
     - Ensure medication refill request buttons and goal toggles have `min-h-11 min-w-11` or visible text labels.
   - `src/routes/intake.tsx`:
     - Make the progress bar sticky at the top of the step content so users know where they are while scrolling.
     - Increase radio/checkbox touch targets (wrap items in a larger label area).
     - Convert multi-column grids (e.g., first/last name) to a single column on mobile.
     - Add a floating/always-visible "Save & continue" button area that sits above the crisis banner.
   - `src/routes/schedule.tsx`:
     - Make the day picker horizontally scrollable with clear padding and snap points.
     - Convert time-slot chips to a grid of large tappable buttons; show "Open" / "Taken" with both color and text/icon.
     - Ensure modality cards (Video / Phone / In person) are full-width stacked on mobile.
   - `src/routes/auth.tsx`:
     - Keep the card within the viewport; ensure the demo persona list is scrollable if it exceeds the screen.
     - Add a11y labels to the language toggle buttons (they already have `aria-label`, but verify screen-reader order).
   - `src/routes/consent.tsx`:
     - Stack consent cards in a single column on mobile; ensure toggle buttons are large enough.

4. PWA installability
   - Verify `public/manifest.webmanifest` is already linked in `src/routes/__root.tsx` (yes, it is).
   - Add an `InstallAppButton` component that:
     - Listens for the `beforeinstallprompt` event and shows a native prompt on supported browsers.
     - Falls back to iOS/Android manual instructions in a dialog if the event is unavailable.
   - Place the install button in the patient footer or in the account menu; do not show it on staff-only pages.
   - Add a one-time dismissible home-screen nudge on the patient home after intake is complete.

5. Accessibility & touch hardening
   - Audit all `Button size="icon"` and icon-only controls for `aria-label`; add missing labels.
   - Ensure no icon is the only indicator of state (e.g., status badges include visible text).
   - Increase small tap targets in the mobile nav and footer to at least 44×44px.
   - Add `focus-visible` rings to any custom focusable elements.
   - Verify form `Label` associations are correct; fix any inputs that use placeholder-only labels.
   - Add `aria-live="polite"` to toast region so screen readers announce success/error messages.

6. Staff surfaces mobile pass (minimum-viable)
   - `src/routes/case-manager.tsx`:
     - Convert the caseload table to a card list below `sm` breakpoint, or keep a horizontally scrollable table with visible column headers.
     - Ensure the CIN/DOB filters collapse into a single expandable filter row.
   - `src/routes/clinician.tsx`:
     - Make the schedule/care-plan/notes/tracking tabs horizontally scrollable without clipping.
     - Stack the booking panel under the appointment list on mobile.
   - These are not full redesigns; the goal is "no clipped content, no unreachable buttons."

7. Verification
   - Run `bun run build` and `bun run lint` after each sub-pass.
   - Use Playwright at `390×844` to capture the same pages as the audit and compare.
   - Run an axe-core quick scan via Playwright on `/home`, `/intake`, `/schedule`, and `/case-manager` to catch regressions.

Deliverables
- `src/components/MobileNav.tsx` (patient bottom tab bar)
- `src/components/InstallAppButton.tsx` (install prompt + fallback instructions)
- Updated `src/components/AppShell.tsx`, `src/routes/__root.tsx`, `src/lib/i18n.tsx`
- Mobile-layout refinements in `src/components/PatientHome.tsx`, `src/routes/intake.tsx`, `src/routes/schedule.tsx`, `src/routes/auth.tsx`, `src/routes/consent.tsx`
- Minimal mobile fixes in `src/routes/case-manager.tsx` and `src/routes/clinician.tsx`
- Updated Playwright mobile audit under `/tmp/browser/mobile-audit/`

Out of scope
- Backend persistence / real auth (demo personas only).
- Offline service worker or push notifications.
- Native app store builds.
- Redesigning the visual brand or color system.