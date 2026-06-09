# Adelante Build 1 MVP — Remaining Work

Gap analysis comparing the current build against the original MVP scope and the items previously deferred.

## Status snapshot

Shipped: 4 role workspaces (Patient, Case Manager, Clinician, Referrer/Admin), intake with PHQ-9/GAD-7/AUDIT-10, crisis banner, care plan + SOAP notes + tracking trend, self-scheduling, manifest + icons, English/Spanish toggle on landing, intake, crisis banner, patient home.

Not yet meeting MVP bar: items below.

---

## P0 — Clinical completeness

### 1. Wire DAST-10 and PCL-5 into the live flow
Both screeners exist in `src/lib/screeners.ts` but are not used anywhere.
- Add DAST-10 and PCL-5 steps to `src/routes/intake.tsx` after AUDIT-10, with the same 42 CFR Part 2 framing (DAST is substance-use, gated by consent).
- Persist results into `screenerHistory` (already supported by `healthie.ts`).
- Add both series to the Tracking tab chart in `src/routes/clinician.tsx` with the existing Day 30/60/90 reference lines.

### 2. Re-screening cadence enforcement
- Surface "Re-screen due" badges on the clinician schedule + case-manager check-in lists when ≥30 / 60 / 90 days have passed since last administration of each instrument.
- One-click "Send re-screen" action that creates a patient task visible on `/home`.

---

## P1 — Compliance & data handling

### 3. Consent revocation + audit log viewer
- Patient-facing "Withdraw consent" control on `/home` (per-purpose: Part 2 SUD, ECM share, SMS).
- Append-only audit entries in `healthie.ts` (`consentEvents[]`).
- Read-only audit viewer in `/admin` with filter by patient programId + event type.

### 4. Minimum-necessary admin export
- CSV export from `/admin` (de-identified caseload + referral status), no PHI columns.
- Cohort filters: episode day bucket, coverage status, referral status.

---

## P2 — Workflow completeness

### 5. Referrer-facing status tracker
- New view in `src/routes/referral.tsx` (or a `/referral/status` child) showing the referring partner the status of patients they sent in: received → eligibility verified → intake scheduled → enrolled. No clinical content.

### 6. Editable ECM / Community Supports flags
- Case-manager workspace: toggle ECM eligible, Community Supports (housing, food, transport), JI Reentry need. Persist on patient record.
- Admin KPI tile: % of caseload with active ECM / CS flags.

### 7. Eligibility & coverage actions
- From case-manager workspace: "Mark verified", "Request reactivation", "Send enrollment-assistance task". Today coverage is read-only.

---

## P3 — Patient experience & i18n

### 8. Spanish coverage gaps
Currently translated: landing, intake, crisis banner, patient home.
Still English-only: AppShell nav labels for non-patient roles, case-manager workspace, clinician workspace, admin dashboard, schedule page, referral page.
- Decide scope: MVP target is patient-facing surfaces fully bilingual; staff surfaces can stay EN for Build 1. Confirm before expanding.

### 9. Patient account stub
- Lightweight sign-in/sign-up screen reusing the demo patient switcher as backing store (no real auth yet — explicit MVP scope).
- "Remember me" via localStorage so the patient lands directly on `/home`.

### 10. PWA install + offline shell
Manifest and icons are present. Missing:
- Service worker registered from `src/router.tsx` caching landing + `/home` shell.
- "Add to Home Screen" prompt affordance on `/home`.

---

## Explicitly out of scope for Build 1 (confirm)

- Real auth provider / Lovable Cloud wiring (Build 2).
- Live Healthie API integration — current `healthie.ts` stays a mock.
- Billing claim generation; admin only shows billing status.
- Push notifications; SMS fallback stays a display-only indicator.

---

## Suggested sequencing

1. P0 items 1–2 (one pass, ~half-day of edits, unblocks clinical credibility).
2. P1 items 3–4 (compliance bar for pilot).
3. P2 items 5–7 (workflow completeness).
4. P3 items 8–10 (polish + packaging).

Tell me which tier to start with — or to drop/reorder any item — and I will implement.
