# MVP Polish — Pass 3

Pass 2 landed billing, tasks, and notification realism. Pass 3 closes the remaining rough edges before we consider new features. Grouped by user impact.

## 1. Shared UX primitives (foundation)
- `src/components/EmptyState.tsx`: icon + title + description + optional CTA. Replaces the ad-hoc "No X yet" divs in Billing, CM tasks, Clinician appts, Patient notifications.
- `src/components/LoadingSkeleton.tsx`: table / card / list variants using shadcn `Skeleton`. Wire into routes that already have `useQuery` states.
- Route-level error boundaries per role route (`/billing`, `/case-manager`, `/clinician`, `/admin`, `/patient`) so one bad record doesn't blank the workspace.

## 2. Client Record Drawer parity
- Tasks tab: reuse Pass-2 `caseTasks` store filtered by `patientId`; add / complete / snooze inline.
- Coordination log filters: by agency type, date range, and outcome.
- Peer notes: add `modality` field (Text / Call / In-person / Group) matching clinician SOAP note modality; surface in the check-in list.

## 3. Admin experience
- Surface audit log with filters (actor role, action, patient, date range) — the events already exist, they just aren't rendered.
- Credentialing panel: show clinicians with license expiring in ≤30 days (mirrors Billing's hard-stop signal on the admin side).
- Notification failure digest: count of failed SMS/email in the last 24h with a "regenerate tasks" action.

## 4. Patient flow polish
- Consent capture: currently displayed at bottom of profile but never asks for a fresh signature when re-consent is due. Add a "Consent needs renewal" banner and simple checkbox capture that writes an audit event.
- Screener → crisis flow: crisis-flag screener already spawns a CM task; also show the patient a warm-handoff card ("A team member will call you within X hours") instead of only a toast.
- i18n gap: `useI18n` is wired only in `PatientHome`. Extend to `schedule.tsx`, `intake.tsx`, and consent copy. Keep the Spanish stub, but ensure every string routes through `t()`.

## 5. Accessibility & mobile pass
- Icon-only buttons across `case-manager.tsx`, `billing.tsx`, `clinician.tsx`, `ClientRecordDrawer.tsx` need `aria-label`s.
- Replace `h-screen` with `h-dvh` on any full-height layout.
- Verify tap targets on Patient Home action tiles are ≥44px.
- Confirm one `<main>` per route.

## Out of scope (call out, don't build)
- New feature surfaces (groups, messaging, document e-sign, real Healthie integration).
- Real SMS/email vendor wiring — mock stays.
- Roles beyond the current four.

## Technical notes
- All work is additive to existing files; no schema breaks.
- Shared primitives land first so sections 2–4 can adopt them as they go.
- Estimated 5–7 focused edits per section; type-safe end-to-end.

## Suggested order
1. Section 1 (primitives + boundaries) — unblocks everything else
2. Section 2 (drawer parity) — highest CM value
3. Section 3 (admin surfaces) — makes existing data visible
4. Section 4 (patient polish) — user-facing trust
5. Section 5 (a11y sweep) — final pass

Tell me which sections to include, or say "all" and I'll work top-to-bottom.
