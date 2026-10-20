# Phase 9a-3 — billing, compliance and county tiles

Rollback / starting HEAD: 7c834669d4f2811e28dac8b50090906873b9b8ad. Not published. No permission, role, Part 2 or data-visibility change; billing roles still see claim-level data only.

## Changes
- /billing KPI row: Outstanding, Paid and Drafts / write-offs now use StatTile (tokens, no navy/teal). Amounts use the unchanged `DOLLARS` formatter and the unchanged `kpis` block; values marked `nonPatient` (claims, not people) so no "<11".
- Denied card: the pre-9a `Kpi` markup, untouched (outerHTML and same-spot pixel compare in e2e).
- BillingStatusSummary (strip on /billing, list on /admin): each status shows a StatusChip (icon + word): Draft/Ready = Up next, Submitted/Partial = With others, Paid = Done, Write-off = Closed. Denied keeps its label text and red Badge exactly. Counts unchanged.
- Sparklines: new read-only `src/lib/billingSparkline.ts` — 12 (start,end] weeks from each claim's first dated `submitted` / `paid` history entry, whole dollars. Weeks before the earliest dated entry are null; no dated entries in window = no sparkline. Today's demo claims have recent history only, so one point shows (real, not padded).
- /county-reporting cards: StatTile (number = blockers, nonPatient work count); due, status chip, next action and Simulated buttons kept; nullable DATAR/BHOATR cells still render "<11".
- /quality-compliance: no numeric tiles exist; only heading token (text-navy → text-foreground). Nothing invented.
- Exports: billing.tsx download code, `exportClaimsCsv`, ehr-ext, billingWorkspace, countyReporting and ehr modules byte-identical to rollback.

## Tests (new files only)
- src/lib/__tests__/billingParity9a3.test.tsx — selector/export modules and KPI/formatter/download blocks byte-identical to rollback; every status count rendered; denied Badge kept.
- src/lib/__tests__/billingSparkline9a3.test.ts — fixed dated fixtures.
- e2e/statTiles9a3.spec.ts — on-page parity for billing and billing_coordinator, denied look, axe 390/768/1280 light+dark, county Simulated, therapist sees no billing tiles.
- No existing assertion edited or failing.

## Validation
- Units: 2,830 / 2,830 (351 files).
- Browser: see final section.
- Evidence: docs/phase9a3-evidence/ (36 captures).

## Stop items / for Mitch
- Typecheck reports `occurrencesRecorded` missing in two 9a-2 test files (suppression9a2, statTileParity9a2) — present at rollback, type-only, tests pass. Not edited (no-test-edit rule); approve a one-line fixture fix if wanted.
- CalAIM chip decision still pending; left as built.
