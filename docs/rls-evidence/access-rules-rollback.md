# Access rules — main rollback evidence

## 28 Oct 16:32 resume checkpoint

**Part 2 internal-use basis: pending counsel confirmation.** No migration or new rollback proof in this resume; no chart/packet/handoff read policies opened. Previous successful helper proofs below remain the latest SQL test evidence, not complete policy acceptance.

Independent SELECT-only readback after app test reconciliation: auth.users 0, accounts 0, patients 18, chart_reason_grants 0, clinician_coverage_assignments 0 — unchanged from the prior documented before counts 0/0/18/0/0. No fixtures were introduced this turn; this is not a new all-table transaction-count proof. `chart_reason_open` and `clinician_coverage_set`: anon/authenticated/service_role execution all **false**.

Full app units: 3,583 passed / 2 failed, exit 1; protected clinician-screen source pin lies outside the three named re-pins. Stopped without changing that assertion; no public browser or preview acceptance. Pending SQL cases: dated on-call/coverage/supervision, group limits, authenticated Intake 60/61, patient/advocate composition, MOUD team-assignment lifecycle and actual policy-group reads. Persistence OFF; nothing published.

## Revised 28 Oct 16:12 decision — current retry evidence

**Part 2 internal-use basis: pending counsel confirmation.** Access-rules helpers reapplied; no chart/packet/handoff policy opened; commands remain revoked and persistence OFF.

- Reapplication: `20261028161450_42bdba2a-5c2e-4cd6-af6f-f024f311e513`.
- Reason-only Part 2 composition: `20261028161631_5a975188-74c3-4b57-bda5-90a0737b750b`, corrected consent/matrix ordering in `20261028162245_48356fa1-6b45-4744-bb73-303d0bda8099`.
- All-role rollback proof: `20261028162346_5c7d2fa1-e0e1-4c44-b4db-8d4e73347bfb` succeeded. All 18 roles use real `request.jwt.claims`, local authenticated role, actual account/acting-role helpers; no overrides. Positive team and reason access paired with off-team/no-reason and expired-reason negatives; treating physician/PMHNP/therapist/SUD counselor matrix SUD-screener grants preserved; reason-only without consent denied. Every public base-table count plus auth.users compared after nested sentinel rollback; outer transaction also rolled back.
- Consent-scope/revoke rollback: `20261028162530_4a25c373-bd61-4dbf-9f97-0826089ad0e9` succeeded. Physician reason-only no-consent lock; specific `screeners_sud` written consent read; other classes denied; revoke locks again. Key counts compared after nested rollback. Initial invalid signature code failed and rolled back; accepted `wet_sign_upload` fixed the fixture only.

Independent counts before retry fixtures and after the failed consent attempt: auth.users **0→0**, accounts **0→0**, patients **18→18**, reason grants **0→0**, coverage **0→0**. All-public-table count equality is additionally asserted inside the successful all-role proof; no retained fictional accounts or grants.

These are helper proofs, **not read-policy acceptance**. On-call/coverage/supervisor/group and authenticated Intake-window row cases, patient/advocate composition and policy-level positive/negative reads remain unproved. Opened policies this retry: **none**. App full units: 3,571 passed / 13 failed; no public browser retry while units fail. Historical evidence below is not the current validation result.

Requested 27 Oct; investigated and attempted 28 Oct 2026. **Stopped at a real Part 2 policy conflict; no read policies opened.** Connected main `bnvukmpmwuhftvjpnwqi` only. No TEST variables/project, Cloud, GitHub or publishing. Persistence OFF.

28 Oct clarification: Mitch chose **Keep existing exceptions**. The failed universal no-consent assumption is superseded: future negative tests must target already consent-gated roles/classes, while proving treating-clinician exceptions unchanged. No new database test or policy migration was run to record this decision; historical results below remain historical, not newly accepted.

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

Restored every changed app source to the pre-batch boundary `721d1721`, leaving integration-generated schema types untouched. Restored full units: **3,583/3,583**, 406 files, exit 0, 130.53 seconds. Public browser suite then completed **51/51**, exit 0, 10.1 minutes, eight specs, one worker on :8080, no overlap. Logs: `/tmp/access-restored-units.log`, `/tmp/browser/access-rules/public.log` and `public.exit`. Build OK; Supabase linter clean. No candidate UI readback is claimed.