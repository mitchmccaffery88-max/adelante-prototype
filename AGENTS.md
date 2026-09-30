# Architecture rules

- Store/domain rules (Part 2, registry + runAction, Simulated, clocks, crisis owners, etc.) live in `src/lib/AGENTS.md`; read it before changing app logic. Why: one home per scope.

<!-- LOVABLE:BEGIN -->
- Clinician tiles and merged action rows derive through `clinicianWorkspace.ts`; dashboard “+ New” uses `CHART_ACTIONS` plus `dashboardActionBus.ts`. Why: one acting-person scope, one permission registry, no duplicate queues.
<!-- LOVABLE:END -->
