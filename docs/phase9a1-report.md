# Phase 9a-1 — COMPLETE: StatTile and KPI vs target

## Baselines and scope
- Approved rollback: `7c0e871520e0a2eb6b8a29ed604e4e2cefa385f3`.
- Starting HEAD: `193c406f54a7604b8ac2dab8d42106f1efcc585e`.
- Validated source checkpoint: `4fa575fdb9bdc237db09f9b62dc52c757529e486` (final managed closeout SHA reported in chat after documentation).
- No publishing, permissions, roles, Part 2 changes, patient target configuration, or later-phase conversions. P1/P2 selectors and gates unchanged.

## Implementation
- `src/components/ui/stat-tile.tsx`: scalar-only API, no patient/name/record props or unknown-prop forwarding; one measured number, comparison, chartStatus icon/word; null/nonfinite says **No live metric yet**. Aggregate counts 0–10 show **<11**, with keyboard/hover privacy tooltip; `personal` exempts personal work. Explicit cohortSize can also suppress a rate. Suppressed provenance/status/history do not render.
- StaffDensity plus member ancestry restricts status coloring to staff/admin; nested member previews and nonstaff render neutral icons/words. Words remain high-contrast ink; approved chart status color is on the icon only (the existing warning/serious palette is insufficient for 14px text). No palette change.
- Optional sparkline uses chart-single, last measured endpoint, dashed chart-target, and named period caption; null buckets remain gaps, never bridged or zero-filled. Supports targetConfirmed without creating confirmation workflow.
- `src/components/dashboards/KpiVsTargetSection.tsx`: repeated StatTiles replace colored badges; original evaluateTarget, values, testids, period semantics, explicit no-detail reasons and Details callbacks retained. met/near/missed map to good/warning/serious; no invented critical threshold. Count suppression is display-only, not selector mutation.
- `src/routes/dashboards.tsx`: existing population_health gate remains unchanged; new histories computed only for authorized hosts and passed into the presentation component. No extra devInspect API or role grants.
- `src/lib/kpiSparkline.ts`: pure 12-week projections from scheduledAt-or-chartedAt MAR records and attendance-recorded occurrenceStart group records. Nonoverlapping (start,end] seven-day intervals ending at explicit now; void/future/invalid records excluded; present+late group numerator. Weekly distinct-patient cohorts below 11 return null. Unsigned notes/tasks/unsupported metrics return null before store reads.
- Existing KPI targets are program-level records; schema has no confirmation marker. All existing targets stay **Draft target**. No invented last-month comparison. MAR remains behind the existing off-by-default in-facility gate; group attendance gets a sparkline only when an existing program target is configured and a week has >=11 patients. The real outpatient demo currently has only task/note target tiles, so evidence does not invent MAR/group rows or history.
- `AGENTS.md`: recorded the presentation/read-only host boundary.

## Validation
- NEW `src/components/__tests__/statTile9a.test.tsx`: 13 tests, suppression, exact threshold, personal zero, missing data, icon/word states, staff/member boundary, no patient-name API/forwarding.
- NEW `src/lib/__tests__/kpiSparkline9a.test.ts`: 6 tests, fixed dated 11-person fixtures, boundary allocation, void/future exclusion, recorded-roster attendance, small-cohort suppression, no backlog history.
- NEW `src/lib/__tests__/statTileParity9a.test.ts`: 4 tests execute actual `git show <rollback>:src/lib/dashboardMetrics.ts` selector source against the same store; every scalar, basis, formatted value and target evaluation identical for 7/30/90/365 days.
- Existing assertions untouched; existing KPI row interactivity 4/4 preserved.
- Full units **2,798/2,798 passed, 347/347 files, EXIT 0** (98.51s).
- NEW `e2e/statTiles9a1.spec.ts`: **2/2 passed** standalone (15.1s + 7.8s), visible backlog parity (explicit <11), real Details dialog/no navigation, billing exclusion, all axe violations absent in light/dark at 390/768/1280, section no overflow.
- Initial new-test diagnostics: fixed fixture missing batchId; new browser assertion corrected Billing heading to existing billing-workspace; low-contrast status text replaced with neutral word + colored icon. No existing tests, thresholds/timeouts/retries changed. Latest harness build OK.
- Full browser suite: **182/182 passed, 0 failed, EXIT 0 (31.2m)**; background --workers=1 on `E2E_BASE_URL=http://localhost:8080`, polled to its literal EXIT line as final validation step. New tile specs passed inside the full run (11.4s and 6.2s); existing slow therapist New-menu test passed (25.4s). No flake exception needed.

## Evidence and closeout
- Six section screenshots: `docs/phase9a1-evidence/kpi-{390,768,1280}-{light,dark}.png`; mobile-light and desktop-dark reviewed visually, labels wrap and measured section widths fit. All six axe states pass.
- Rollback tracked images restored after the full run: **120 inspected, 17 regenerated restored, zero remaining byte differences** against rollback, including existing `e2e/screenshots/p2-emergency-unlock.png`; six new 9a-1 images retained. Manifest: `docs/phase9a1-evidence/screenshot-restoration.json`.
- No stop items, existing assertion changes, permission changes or flake exceptions. Phase 9a-1 complete; 9a-2 is next, not started. Unpublished.
- Final managed closeout SHA is reported in chat; pre-documentation/restoration checkpoint `9afd273ca5de806be6cc5a40a7d9d140f07ce549`. Documentation cannot embed its own content-derived final revision.