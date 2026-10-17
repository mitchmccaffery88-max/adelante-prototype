# Phase 8b-3 — Billing, claims, admin, reference and audit tables

Approved by Mitch (delegated to coordinator), Oct 17 2026. Not published. Last Phase 8 table batch; Phase 9 not started.

- Rollback SHA: `649459806dd45b19214130247becf5871e83d34d`
- Pre-edit inventories (source, filters, order, hidden rows, hooks, actions): `docs/phase8b3-evidence/inventory-billing.md`, `inventory-audit.md`, `inventory-admin.md`. Comparisons used `git show` projections only (no stash/revert).

## Tables converted (26)
Billing / claims (8): `billing-table`, `billing-isl-table`, `billing-credentials-table` (/billing); `claims-table`, `blocked-attempts-table` (/admin-claims); `rates-table`, `codes-table` (RatesPanel); `calaim-codes-table` (/billing-calaim-codes).
Audit (8, read-only): `admin-audit-table`, `documents-audit-table`, `consent-audit-table`, `group-audit-table`, `action-audit-feed`, `disclosure-log-table`, `access-log-table`, `outside-caseload-table` (inside unchanged `outside-caseload-report`).
Admin / reference (10): `admin-vendor-sessions`, `data-exchange-health`, `data-exchange-outbound`, `dmc-ods-preview-table`, `admin-patients`, `admin-kpi-targets-table`, `admin-scheduling-rules-table`, `admin-supervision-table`, `admin-frequencies-table`, `admin-suppressions-table`.

Shared component: `StaffTable` gained two optional, additive props only — `StaffColumn.sortTestId` (keeps `sort-*` hooks + `data-sort`) and `rowAttributes` (keeps `data-encounter`, `data-calaim-code`, `data-target-metric`). No behavior change for 8b-1/8b-2 callers.

Excluded (recorded): `permissions-matrix` (role × action comparison, not a row list); PatientMatchingQueue field-comparison panels (side-by-side record A/B, not a list — the review list is cards); `/admin-facilities` (dormant in-facility); reporting/county-reporting, dashboards/tiles/charts (Phase 9); ContentAudit metrics (aggregate analytics, Phase 9); patient/advocate; printed records.

## Money parity
- Amount/units/rate/balance cells render through the unchanged `ClaimAmount` / `PatientBalance` / `CorrectClaim` and the unchanged `DOLLARS` helpers; no money code was edited.
- Browser spec `e2e/billingTables8b3.spec.ts` (billing `s-bill1` and billing_coordinator `s-bc1`): for every rendered `billing-row`, claim encounter → amount text, units/rate text and status word equal an in-page projection from `AdelanteEHRExt.listClaims()` using the rollback formula; `sort-charge` order is numeric by `chargeCents` (−1 when unpriced), not string.
- Unit `src/components/__tests__/billingTables8b3.test.tsx`: row-id parity and numeric charge sort.
- Exports unchanged: claims CSV (`downloadCsv`), ISL (`downloadIsl` → `exportIslReport`), goal-audit CSV, DMC-ODS CSV and admin caseload CSV function bodies are byte-identical to rollback (hash-compared); no lib file changed. Content export fingerprints unchanged.
- Every action call (`runAction`, `actResult`, `confirmedAction`, `confirmation.ask`, store mutations, toasts) has identical counts per file vs rollback; only read calls (`canBook`, `frequencyUsage`) increased.

## Denied-claim isolation
Denied rows keep today's exact look: /billing renders the original `<span class="text-[10px] rounded-full px-2 py-0.5 ${STATUS_STYLE.denied}">` plus the original denial-reason div; /admin-claims renders the original `<Badge className={stateStyle.denied}>denied</Badge>`. Only non-denied states use `StatusChip` (claims reuse the existing admin-claims chip mapping; /billing buckets use their existing `BILLING_STATUS_ROWS` words). The browser spec asserts the denied badge class string equals rollback.

## Privacy
Rows passed to every table are the same source, filters and order as rollback; views only narrow. No permission, Part 2, chart-access, status-mapping or registry-gate change. Audit redaction (`redactAuditEvents`, `summarize`) unchanged; masked subjects and "[restricted — reason]" (visible-but-restricted today) now carry the lock; no hidden row became a placeholder. During review one conversion had dropped the disclosure log's emergency "Mark reviewed" action; it was restored verbatim as the row primary action before validation.
Non-billing / restricted roles verified: therapist cannot see billing rows; billing is denied /admin-audit, /disclosure-log and /quality-compliance tables; clinical coordinator sees the audit log with masked subjects and no extra rows; peer specialist denied admin routes.

## Existing gaps recorded, NOT changed (for Mitch)
- `action-audit-feed` shows raw `event.detail` for action/who/reason; only the subject goes through `redactAuditEvent`.
- /admin-claims "Move to …" calls `AdelanteEHRExt.transitionClaim` directly (store enforces billing write) rather than through `runAction`.
- `ClaimActions` on /billing shows up to two buttons (e.g. Mark ready + Write off) because those buttons own the Write-off/Deny confirmations; kept as-is rather than moving confirmation paths.
- Outbound-sharing table shows patient names to roles that reach /data-exchange (existing projection).
- Page-level horizontal overflow outside the tables at 390px on /billing (header links) and /admin (filter toolbar), and at 1280 on /admin (dashboard content) — pre-existing layout, out of table scope.

## Validation
- Units: 2,711 passed / 2,711 listed (337 files) — see phase8b3 run; the one new audit test corrected for the restored action re-passed (2/2).
- New browser specs: billing 3/3, audit 6/6, admin 10/10 (focused, one worker).
- Full browser suite (--workers=1, E2E_BASE_URL=http://localhost:8080), run after the last source change: RESULT_PLACEHOLDER
- Screenshot matrix: 26 tables × 390/768/1280 × light/dark = 156 captures; no JS errors, no text under 14px. Tables with no rows in demo data (ISL, blocked attempts, documents audit, vendor sessions, suppressions) captured as their existing empty states; their row rendering is covered by unit tests. Claims and DMC-ODS preview scroll horizontally inside their own container at 1280; long audit details now wrap instead of being clipped.
- Tracked screenshots restored to rollback hashes.
