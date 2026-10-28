# Access rules — main rollback evidence

Requested 27 Oct; investigated and attempted 28 Oct 2026. **Stopped at a real Part 2 policy conflict; no read policies opened.** Connected main `bnvukmpmwuhftvjpnwqi` only. No TEST variables/project, Cloud, GitHub or publishing. Persistence OFF.

## Method

Used the Supabase migration tool, `BEGIN`/`ROLLBACK`, fictional `auth.users` and app account/role fixtures, `SET LOCAL ROLE authenticated`, and actual `request.jwt.claims` with `request.jwt.claim.sub` cleared. Existing `app.attest_beta` and `app.set_acting_role` established fixture context under the privileged setup role. No auth/context helpers were overridden. This proves PostgreSQL claim evaluation, not hosted sign-in or JWT signature verification.

Each proposed all-role suite snapshots every public base table plus `auth.users`, uses a nested fixture transaction, and compares counts after a sentinel rollback. **Neither attempted suite completed its final count assertions**, because a guard failed first. The entire outer transaction rolled back; independent post-failure count reads verify the important baselines below. No completed all-role acceptance count is claimed.

## Installed then quarantined

- `20261028133322_1a851b1f-5ee4-4d8c-bcec-fc4fa865c448.sql`: Draft reason-grant/coverage scaffolds, supervision/group/handoff/access-log fields and candidate entry/window helpers. Chart, packet and handoff policies stayed closed.
- `20261028133425_173bbb24-aa52-4a9f-803a-114483d6c267.sql`: revoke authenticated command execution after linter warnings; server transport remains Phase 2d.
- Subsequent migration corrected `record_access_log.kind` from unsupported `reason_open` to existing `open`, keeping `reason_code` separate.
- Final safety migration restored the exact prior `app.chart_entry`, `app.phase2_is_team` and `app.phase2_packet_access` definitions, and revoked candidate command/group/window execution. New tables remain empty and closed. See migration history for the tool-generated filenames.

## Failed assertions retained

1. `record_access_log_kind_check`: candidate command used `reason_open`, but the existing log permits `open`, `section`, `print`, `export`, `brief`, `compute`. Corrected the function, not the constraint.
2. `part2_no_consent_failed physician`: the physician fixture had no consent but `app.can_access('screeners_sud', patient)` returned a non-none grant. This is the **existing matrix behavior**, not a reason-grant leak. TypeScript confirms therapist/PMHNP/SUD-counselor `screeners_sud` reads without a separate consent gate; physician inherits PMHNP. PMHNP/physician/SUD-counselor also have direct treatment grants. The requested “Part 2 still locked without consent” conflicts with “everything else follows the existing record-class matrix.” No consent requirement was weakened or silently reinterpreted.

## Retention checks

Independent reads after failed transactions and after final safety restoration:

| Relation | Before fixtures | After |
|---|---:|---:|
| auth.users | 0 | 0 |
| public.accounts | 0 | 0 |
| public.patients | 18 | 18 |
| public.chart_reason_grants | 0 | 0 |
| public.clinician_coverage_assignments | 0 | 0 |

No fictional login, reason grant, coverage fixture or consent survived. Schema scaffolds and successful migration ledger entries remain intentionally; “nothing left behind” applies to fixtures, not approved schema migrations. No candidate policy was committed.

## Policy status

**Opened: none.** Existing prior Phase 2c `own_work_sites` and `identity_lane` remain unchanged. Chart identity/contact/consent/team/enrollment/restriction, packet and handoff groups remain closed. Patient/advocate policies and functions were not changed. No empty read or structural join is counted as positive acceptance.

Not proved: complete all-18-role suite; on-call/coverage/supervisor/group-context SQL acceptance; Part 2 unlocked/revoke composition; patient/advocate full composition; Intake day-60/day-61 authenticated rows; candidate read-policy positive/negative coverage; comprehensive final table-count loop. Those remain blocked, not passed.

## Application validation at the stop boundary

Candidate app focused tests passed after local fixture corrections, but the candidate full suite was **3,585 passed / 11 failed** (407 files). Failures included prior source-parity pins, sys_admin identifier-only assertions, a fake staff identity in the route-guard test, and unchanged continuity/coverage fixture assumptions. An unintended consent-action widening caused by reusing `roleHasChartEntry` for sys_admin was observed; it is not retained.

Restored every changed app source to the pre-batch boundary `721d1721`, leaving integration-generated schema types untouched. Restored full units: **3,583/3,583**, 406 files, exit 0, 130.53 seconds. Public browser suite runs only after that unit completion; final result is recorded in the report. No candidate UI readback is claimed.