# Access rules — main rollback evidence

## 29 Oct Step 5 main rollback acceptance

**Draft — pending clinical sign-off and go-live permissions audit. Part 2 internal-use basis: pending counsel confirmation.** No publishing; persistence OFF; no matrix changes.

- Rule acceptance migration `20261029013942_52241121-15c0-44c5-9f1d-6ccf4ddf3da1.sql`: **112 checks passed** on connected main. All 18 staff roles use fictional auth users/accounts, real request.jwt.claims, actual attestation and acting-role helpers, and local authenticated role for callable entry/record reads. Not a hosted login/JWT-signature test.
- Covers all-role off-team/team/reason/expired reason; physician/PMHNP/therapist on-call exact start, exact end and future; dated coverage start/end/future and unrelated patient; supervisor assigned active trainee versus unrelated patient/inactive role; matching/wrong/ended group context with no chart entry; Intake general day60 and Part 2 with/without TPO, day61 both denied; physician direct matrix versus reason-only specific-class consent, wrong class/counseling and revoke; restricted reason/search denial and team entry; patient own-row versus other-row; advocate scoped release/raw-row isolation and revocation; MOUD self-only, replacement denial, single audit, team entry, no-consent Part 2 denial, same-transaction end, independent membership preservation.
- Day numbering matches existing app: handoff date is day1; day60 uses Pacific local date difference59, day61 difference60. No boundary rule changed.
- Revoked group helper and MOUD commands were exercised only by privileged fictional fixture setup under real actor claims; no function grants/helper overrides. Reason and coverage browser commands remain revoked.
- First attempt rejected required TPO recipient kind; no retained fixtures. Second attempt reached 112 checks but its MOUD no-consent negative still had the Intake TPO consent active. Corrected the fixture by revoking that consent before MOUD; **matrix unchanged, assertion unchanged**. Successful third attempt completed nested sentinel rollback and outer rollback.

Candidate-policy read proof `20261029014059_4216237a-235d-4842-920b-b649b1911ecb.sql` temporarily changed seven policies **inside an outer rollback only**. Actual authenticated reads passed all-role off-team/team chart identity/contact/team-row conditions and reason-open identity, general packet/handoff role conditions, Intake day60 checklist/needs/doc/handoff visible and day61 none visible. Tagged Part 2 documents remained hidden for all roles. No permanent policy opening. This proves candidate read predicates for the exercised rows, not every unrepresented data category.

Before/after all **47 public base tables plus auth.users** count maps matched in each successful fixture harness; independent post-run map also matched. Nonzero values (all omitted tables are zero): orgs1, sites1, patients18, programs2, locations1, referrals9, audit_events1, staging_rows1, feature_flags22, staff_members41, consent_records3, county_programs2, staging_imports1, packet_documents4, intake_checklists1, intake_packet_needs3, first_visit_handoffs1, care_team_assignments22, staff_role_assignments43, staff_site_assignments23, patient_site_enrollments18. auth.users/accounts/reasons/coverage remain **0/0/0/0**. No fictional rows retained. Post-read confirmed all seven candidate policies still false and authenticated reason/coverage execution false.

**Opening boundary:** individually approved chart group `20261029023403_e5ccfe2c-a977-4686-9fac-d179ac50ee01`, separately approved general packet group `20261029125738_b4616f5f-a372-4098-b59b-17f72be21815`, and separately approved handoff group `20261029134441_74e60da0-8e1a-4351-bdef-f16205a416ec` applied. All seven installed predicates read back correctly. Full47-public/auth.users count map remains identical to the baseline above; matrix792 rows, read-only aggregate checksum87fb6d48742a73f6c6a68a2f23f140cc. Authenticated reason/coverage execution remains false. Tagged Part2 packet reads remain excluded. No consent/matrix expansion or failing group opened. Full units after openings passed3,662/3,662 (414files,285.64s); public browser follows without overlap, result pending.

## 29 Oct green app checkpoint — no new SQL proof

Step 4 Today/Inbox/bell/quick-peek shared-gate readback and saved browser regression 1/1 passed; full units 3,662/3,662 after catalog DEA work. No Supabase fixture/migration/count query in this continuation; historical counts below are not a new baseline. Step 5 all-role temporal/group/Intake/patient/advocate vectors, before/after counts and candidate-policy reads remain unproved. Chart/packet/handoff policies remain closed; reason/coverage command transport remains revoked until 2d. Persistence OFF, nothing published. **Part 2 internal-use basis: pending counsel confirmation.**

## 28 Oct step 4 green-unit checkpoint

App-only partial checkpoint: units 3,658/3,658, HLOC browser 1/1 and search/deep-link/print/embedded-picker/reason-log readback passed. Today/inbox/bell/quick-peek and privacy-safe DEA Billing integration remain unproved. **Not a SQL acceptance result:** no Supabase call, fixture, new before/after count or migration in this continuation. All chart/packet/handoff read-policy groups remain closed; command transport remains unavailable until 2d. Persistence OFF; nothing published. **Part 2 internal-use basis: pending counsel confirmation.**

## 28 Oct 21:05 Intake host checkpoint

**Part 2 internal-use basis: pending counsel confirmation.** App step 3 only: logged read-only follow-up host and shared form/need/document expiry guards. Full units 3,648/3,648; preview checklist/document single-event readback and live expired-window UI passed. This is **not** a new SQL acceptance result. No Supabase calls/fixtures/migrations in this continuation; no new before/after database counts claimed. All chart/packet/handoff read-policy groups remain closed; Step 5 vectors/counts and openings still pending. Persistence OFF; nothing published; revoked command/browser transport boundary unchanged.

## 28 Oct 20:23 MOUD tightening acceptance

**Part 2 internal-use basis: pending counsel confirmation.** No read policies opened; persistence OFF; no publishing.

- Rule migration `20261028202524_ddc385f1-3680-4bfa-8b5d-78f509eda61b`: care-manager callers self-assign only; replacing another requires coordinator. Same-transaction episode-only closure uses transaction now with strictly earlier start where needed; independent-source membership remains.
- Completed rollback `20261028202621_734e42cb-8d71-4798-b270-a4318667475e` on connected main only. Fictional coordinator, ECM and CF care-manager accounts; actual request.jwt.claims and account/acting-role/attestation helpers; local authenticated role for chart entry. Revoked commands invoked only by privileged test setup under real app actor claims, not by browsers; no helper overrides. This proves claim evaluation, not hosted login/JWT signature verification.
- Passed: off-team no entry; self assign allowed; another target denied without state/audit mutation; replacing another with self denied; coordinator replacement allowed; prior member loses entry immediately in same transaction; one assign audit; independent row reused; no Part 2 screeners grant for ECM; episode-only end removes chart entry immediately in same transaction; other-source member retains entry immediately after end.
- Every public base-table count plus auth.users snapshotted before fixture subtransaction and compared after sentinel rollback; outer rollback successful. Independent final counts: auth.users 0, accounts 0, patients 18, care_team_assignments 22, MOUD audits 0 — match 0/0/18/22/0 baseline. No fictional fixtures retained.
- Independent command privileges: authenticated chart_reason_open=false; clinician_coverage_set=false. No browser transport added.
- App units after tightenings 3,607/3,607; after coordinator hosts 3,627/3,627. Remaining all-role policy-group acceptance is not claimed by this focused proof.

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