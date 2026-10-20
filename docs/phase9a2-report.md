# Phase 9a-2 — Admin, dashboards and reporting tiles on StatTile

- Rollback: `2c463a96f657306af2a3dc4fcf72eb9b39d84cad`
- Starting HEAD: `2628d52c860253c0d2f074fcdcf0f4b4033cf55e` (managed checkpoint after 9a-1 closeout; docs only)
- Final SHA: reported in chat at closeout (managed checkpoint after this report)
- Not published. No 9a-3 work.

## What changed (presentation only)

| Surface | File | Change |
|---|---|---|
| /admin KPI row | `src/routes/admin.tsx` | Six `Kpi` cards → neutral `StatTile` (no status). Enrolled patients, active referrals: "<11". Session completion, Medi-Cal verified, ECM caseload %: suppressed when the patient cohort < 11; ECM "x of y" basis hides x < 11. Intake velocity keeps "Too few referrals to report" wording in the comparison line. Retired `Kpi` helper removed (navy/gold accents gone). |
| /admin group activity | `src/routes/admin.tsx` | Three numbers → `StatTile`; active groups exempt (not people), enrolled and seats "<11". Testids kept. |
| CalAIM | `src/components/dashboards/CalAimSection.tsx` | Three `StatTile`s; codes exempt (configuration). Amber discharge card + amber badge → neutral tile + gold `StatusChip state="yourturn"` "Time-sensitive handoff" (word + icon). Drill-downs are Details buttons opening the existing dialogs. |
| Group utilization | `src/components/dashboards/GroupUtilizationSection.tsx` | Active / enrolled / attendance tiles and open-group engagement numbers → `StatTile`. Attendance % suppressed when attendance entries < 11. Export unchanged. |
| Engagement | `src/components/dashboards/EngagementSection.tsx` | Four non-self-tracking stats → `StatTile`; track table cells "<11". No self-tracking content (P1 holds). |
| /reporting | `src/routes/reporting.tsx` | Local `Stat` now renders `StatTile` with suppression; notes that could repeat a small number are hidden when suppressed. Request-to-booked and appointment-outcome counts suppressed with the cohort (was: medians only / "—"). Billing area uses `BillingStat` = the exact pre-9a markup (9a-3). |
| PopulationHealth | `src/components/reporting/PopulationHealthSection.tsx` | Lists/tables (not single-number tiles), so they take the StatTile suppression rule rather than the component: every count < 11 shows "<11"; positive % hidden when screened < 11. Demo-only caveat replaced by neutral "counts under 11 are hidden". `warning` alias and navy removed. |
| TimelyAccess | `src/components/reporting/TimelyAccessReport.tsx` | Three `StatTile`s; person count now "<11" too; per-person list hidden below 11. Names only via `staffPatientLabel` (chart-access rule); unenrolled referrals show "Referral (no chart yet)". |
| Catalog metrics | `src/components/admin/CatalogResolutionMetricsCard.tsx` | Two `StatTile`s, exempt (catalog/order event counts, not people). |
| StatTile | `src/components/ui/stat-tile.tsx` | Added `nonPatient` (exempt like `personal`) and `tileTestId`. No other behaviour change. |

Rule used for "aggregate cross-patient count": a count of people (or a rate whose
denominator is people/attendance entries). Counts of codes, groups, catalog
events and referral-source values are `nonPatient`. 0–10 all show "<11",
matching 9a-1. Unsigned notes / tasks on /reporting follow 9a-1's /dashboards
treatment ("<11").

No selector, permission, role, Part 2, consent or route-gate code changed —
`statTileParity9a2` asserts all 12 selector modules are byte-identical to rollback.

## Reported, not built
- CalAIM "Your turn" chip shows when discharges > 0 even if the count reads "<11" (a workflow cue for already-authorized roles). Mitch to confirm.
- PopulationHealth stays list/table form; a single-number tile layout would need new headline numbers (not added).
- Many small 10–11px captions outside the converted tiles remain (9c / staff-density work).

## Tests (new files only)
- `src/lib/__tests__/statTileParity9a2.test.tsx` — 12 selector modules byte-identical to rollback; CalAIM, groups, catalog tiles render the selector number.
- `src/components/__tests__/suppression9a2.test.tsx` — aggregate < 11 suppressed (CalAIM, groups, attendance %), personal and non-patient exempt, gold Your turn chip, no amber/emerald/red/navy classes.
- `e2e/statTiles9a2.spec.ts` — /admin parity with `stats().enrolled`, no status on neutral tiles, axe light/dark at 390/768/1280 on each converted region, billing sees no clinical tiles on /dashboards, /reporting, /admin, ecm_provider (non-Part-2) sees no ASAM/CalOMS/level-of-care tiles.
- No existing assertion edited; none failed.

## Validation
- Units: 2,817 / 2,817 passed (349 files).
- Browser (full, --workers=1, :8080): see closeout section.
- Evidence: `docs/phase9a2-evidence/` — 30 captures (admin-kpis, dashboards-calaim, dashboards-groups, reporting-timely, reporting-request-to-booked × 390/768/1280 × light/dark).
