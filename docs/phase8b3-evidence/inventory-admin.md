# ADMIN/REFERENCE rollback inventory (649459806dd4)
Recorded before edits; selector audit: searched e2e and src test/spec files for all candidate routes and hooks; reviewed refillDeclineFrequency8c2, staffNewAudit8a2, supervisionAdmin, dataExchange, adminGateTightening contracts.

| File/table | Existing rows, filters, order and hidden rows | Hooks | Actions |
|---|---|---|---|
| admin-vendors sessions | listTelehealthSessions({}), slice(0,10), source order; later sessions hidden | none | none |
| data-exchange health | hieSyncLog(10), source order; older runs hidden; DATA_EXCHANGE_ROLES gate | dx-health panel | none |
| data-exchange outbound | listOutboundShares(), unfiltered source order; same route gate | dx-outbound panel | none; CSV outside table unchanged |
| dmc-ods-readiness preview | dmcOdsExportRows(acting.role), exportColumnsFor(role); null hides entire view; Part 2 projection unchanged, source order | dmc-ods-export panel | none; download unchanged |
| admin patient | listPatients filtered by coverage status, episode buckets <=30 / >30<=60 / >60, nextContactKind; source order; unmatched patients hidden | none | row click setOpenPatientId(p.id); replace with Open; CIN last four only |
| admin-kpi-targets targets | listKpiTargets(true), includes inactive, source order; existing access gate | data-target-metric | openEdit; setReason + setDeactivating; setKpiTargetActive reactivate |
| admin-scheduling-rules | listSchedulingRules(true), includes inactive, source order; existing access gate | none | startEdit; setDeactivating; actFor scheduling_rule_save reactivate |
| admin-supervision | supervisedStaff(), source order; existing supervision access gate; candidates supervisorCandidates() | supervision-row-<id> | inline Select change(s.id,v), retained |
| admin-catalog-governance frequencies | listFrequencies(true), source order including inactive; existing gate | code cell exact accessible name required | openEdit; setFrequencyActive; setReason/setDeactivating; removeFrequency via existing handler; LAST button Delete preserved |
| admin-catalog-governance suppressions | listCatalogSuppressions(true), source order including lifted; existing gate | none | setLiftReason/setLifting active only |

## Exclusions
- admin-facilities: dormant in-facility registry (outpatientLens test and navigation in-facility gate); excluded, no changes.
- PatientMatchingQueue: candidate field/Record A/Record B side-by-side comparison, not a row work list; retained; review list is cards.
- provider-reference and billing-calaim-codes: no tables.
- Dashboards/stat tiles/charts, reporting/county-reporting, patient/advocate and printed records excluded.

## Observations
Existing outbound sharing name projection and role-specific DMC-ODS projection remain untouched; no privacy/revenue behavior changes attempted.

## Completion
Converted 10 tables in admin-vendors, data-exchange (2), dmc-ods-readiness, admin, admin-kpi-targets, admin-scheduling-rules, admin-supervision, admin-catalog-governance (2).
Stable StaffTable IDs: admin-vendor-sessions, data-exchange-health, data-exchange-outbound, dmc-ods-preview-table, admin-patients, admin-kpi-targets-table, admin-scheduling-rules-table, admin-supervision-table, admin-frequencies-table, admin-suppressions-table.
Existing panel IDs, data-target-metric and supervision row IDs retained. Frequency code cell contains only code; existing positional buttons retained (Delete last), with inactive badge moved to label cell. Other multi-action tables use Edit primary and existing lifecycle buttons in More content. Supervisor Select remains host-owned inline control.
Created src/components/__tests__/adminTables8b3.test.tsx (12 tests), e2e/adminTables8b3.spec.ts (written, not run per browser ownership rule). Focused Vitest: 4 files / 36 tests passed including supervisionAdmin, dataExchange and adminGateTightening. Export function bodies verified byte-identical against rollback. ESLint attempted: formatting violations (including pre-existing formatting); no builds/typechecks/browser runs performed. In-page imports for helpers lacking inspect exports may require coordinator verification of Vite module identity; existing inspect-exported projections use __adelante directly.
Shared StaffTable unchanged. No privacy/revenue gaps fixed; no library changes.
