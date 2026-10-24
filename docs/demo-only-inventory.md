# Demo-only inventory (Friday cleanup, Oct 23 — docs only, no code changes)

Every demo/test-only surface in the published build today, with who can reach it and what it does. Classes: **(a)** testing/impersonation tool, **(b)** simulated integration, **(c)** fictional seed data, **(d)** placeholder copy.

## (a) Testing / impersonation tools

| Surface | File:line | Who can reach it in the published build | What it does |
|---|---|---|---|
| DemoControlsBar | `src/components/DemoControlsBar.tsx:10`; mounted in `AppShell.tsx:166-167` and `WebsiteLayout.tsx:54` | Everyone, every page (not dev-gated) | Sticky bar hosting the two switchers below |
| StaffRoleSwitcher / setActingStaff / setActingRole | `src/components/StaffRoleSwitcher.tsx`; `src/lib/roles.ts` (`setActingStaff`, `setActingRole`) | Everyone | Changes the acting staff identity/role in browser storage; every role gate in the app then answers as that role |
| AppShell staff picker | `src/components/AppShell.tsx:278` | Everyone on staff shells | Same impersonation, picker form |
| DemoStateSwitcher | `src/components/DemoStateSwitcher.tsx` (QA scenario matrix from `:40`; demo patient names `:439`) | Everyone | Applies named QA scenarios (5-state pass) by seeding real store records |
| QA scenario switcher + scenarios | `src/components/DemoStateSwitcher.tsx:40,169,248` | Everyone | Each scenario writes demo records through real store functions |
| VITE_E2E build mode | `vite.config.ts:20`, `package.json` `build:e2e` / `preview:e2e` | Build-time only | Compile-time flag; installs the `__adelante` inspection hook in dev/e2e builds only (production bundle checked by `privacyP3Bundle.test.ts` — 0 hits) |
| devJourneys, adelBriefCheck dev entry | `src/lib/devJourneys.ts`, `src/lib/devInspect.ts` | Dev/e2e builds only (dropped from production) | Automated journey checks via `window.__adelante` |
| setInFacilityEnabled | `src/lib/features.ts` (overrides map `:170`) | Dev/e2e; runtime toggle | Opens the in-facility features that are off by default (outpatient-only rule) |
| System migration actor | `src/lib/consentMigration.ts` (`SYSTEM_MIGRATION_ACTOR_ROLE`, label "System (consent migration)") | Not selectable, not assignable; only the seed path calls it | Runs `consent_legacy_migrate` through the registry; hidden for all 17 staff roles |

## (b) Simulated integrations — all 16 FEATURE_FLAGS (`src/lib/features.ts:39-168`, each `simulated: true`)

`in_facility`, `hie_simulated`, `voice_intake`, `adel_drafts`, `placeholder_lab`, `cures_placeholder`, `eligibility_simulated`, `erx_simulated`, `telehealth_simulated`, `caloms_export_simulated`, `notifications_simulated`, `payments_simulated`, `scribe_simulated`, `llm_simulated`, `calendar_sync_simulated`, `consent_upload_simulated`.

"Simulated" label: `SIMULATED_LABEL = "Simulated"` (`features.ts:225`); surfaces render it via `simulatedSurfaceLabel(id)` (`features.ts:252`), e.g. the scribe badge (`agentic.scribe.$patientId.tsx`, `data-testid="scribe-simulated"`), and every tied action is audited with `simulated: true`. Reachable by any role whose screen shows the feature; nothing is sent to a real vendor.

## (c) Fictional seed data

- Demo seed patients, staff roster and fixed demo names: seeded through real store functions (`src/lib/ehr.ts` seeds, `src/lib/identityDemoSeed.ts`, `src/lib/advocateDemo.ts`, scenario seeds in `DemoStateSwitcher.tsx`). Visible to anyone who opens the app; all names are fictional.
- B2-5 demo consents: legacyUnverified markings and scoped re-captures (`docs/b2-5-report.md`).

## (d) Placeholder copy

- Agentic prototype screens (`/agentic/*`): `PrototypeBanner` / `SampleBadge` mark the sample narrative as illustrative (`agentic.chart-review.$patientId.tsx:123-134`).
- "Demo controls" / "Demo" chip text in DemoControlsBar; demo names inside DemoStateSwitcher (`:439`).
- Clinical/policy defaults carry "Draft — pending clinical sign-off"; draft Spanish carries the single translation-review notice.

## Notes

- Removal of the class-(a) tools is scheduled for real login (recorded in `docs/privacy-p3-report.md` §4); none is removed in this batch.
- No code was changed for this inventory.
