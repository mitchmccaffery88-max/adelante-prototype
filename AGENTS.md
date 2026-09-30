# Architecture rules

Standing rules — apply to ALL work, every change, any folder:
- Registry + runAction: every mutation is a `CHART_ACTIONS` entry run through `runAction` (role check + one audit event).
- Simulated: every mock/placeholder integration has `simulated: true` in `features.ts`, audits `simulated: true`, UI says "Simulated".
- Part 2: SUD content is hidden (not stubbed) for roles failing the existing checks; notification/audit/task text stays neutral; outbound SUD goes through `disclose()`.
- Draft: every clinical/policy rule is labelled "Draft — pending clinical sign-off"; Spanish clinical copy marked draft.
- Cohort guard 11 on all aggregates.
- Outpatient only: in-facility behind `inFacilityEnabled()`, off by default.
- Demo seeds only through real store functions.

Full per-module rules: `src/lib/AGENTS.md` — read before changing app logic.

<!-- LOVABLE:BEGIN -->
- Clinician tiles and merged action rows derive through `clinicianWorkspace.ts`; dashboard “+ New” uses `CHART_ACTIONS` plus `dashboardActionBus.ts`. Why: one acting-person scope, one permission registry, no duplicate queues.
<!-- LOVABLE:END -->
