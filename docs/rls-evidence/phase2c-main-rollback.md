# Phase 2c — main-project rollback evidence

Requested 27 Oct 2026; executed 27–28 Oct UTC. Target: connected main `bnvukmpmwuhftvjpnwqi` only. TEST secrets/project untouched. Persistence OFF; nothing published.

## Method

Migration-tool transactions use `SET LOCAL ROLE authenticated`/`anon` and fictional `request.jwt.claims` sub/role. `request.jwt.claim.sub` is cleared so `auth.uid()` reads the real claims JSON. No app helper was replaced. Auth users have reserved `example.test` emails and no password credentials. Fictional account/role/site/consent additions and temporary candidate policies/grants roll back. Attestation and acting-role setup use existing privileged functions under fixture setup because their public/authenticated execution is revoked; asserting readers remain authenticated. This tests PostgreSQL claim evaluation, not hosted JWT signature validation or HTTP sign-in.

## Successful migrations and cases

| Migration | Evidence |
|---|---|
| `20261027235458_c91ccef1-c5a0-49a4-9ea8-b023e35ed587.sql` | 90 assertions: 18 roles × real claims mapping, acting role, same-site/team chart entry, off-site denial, and observed off-team contract. All passed **as current-contract checks**, not acceptance of requested off-team denial. |
| `20261027235702_e2eade66-9505-488d-a711-3fb9066d71eb.sql` | Own-site/sibling restriction; 4 seeded packet documents, 2 ID-only locked stubs; active standard TPO unlock, revoke relock, unchanged Intake chart/SUD denial; multi-role no union; restricted record requires reasoned open, open does not survive role switch; patient own row only; advocate consented identity slice and revoke relock, no direct patient rows; store-derived packet chain structural join. 18 checked assertion branches. |
| `20261028000241_776800df-2f7d-451f-8bc6-b094a973d172.sql` | 36 own-site/sibling checks across all 18 roles; 45 anon public-table denials; 6 shared SQL crisis vectors with owner/source/fallback comparisons and 3 fallback-notice checks. |
| `20261028000257_4f9dfaea-581a-4fa2-8a80-25052f690790.sql` | **Opened `own_work_sites`** on `staff_site_assignments`, proved by all-role positive row and sibling-negative cases above. |
| `20261028000334_00d78d27-1854-483d-ab90-7df6f7965d8c.sql` | 54 identity assertions: 18 roles × exact read eligibility, direct-write grant denial, restricted-candidate denial. Only Intake/sys_admin/clinical_coordinator see the candidate. |
| `20261028000352_576e52d5-23dc-4c2b-bf40-5b3c0ec312e1.sql` | **Opened `identity_lane`** on `identity_review_items`, proved by the all-role positive/negative and restricted-candidate suite. No decision write enabled. |
| `20261028000435_dd1567a2-c66b-467c-baf4-87a39ebdfd4d.sql` | 1,872 checks: 18 roles × 26 Phase 2 tables × read plus three write-grant denials. Current read composition verified. Snapshot comparisons for auth.users + all 45 public tables after fixture-subtransaction rollback (46 comparisons). |

Total explicit successful assertions: **2,170**, including current-contract/structural checks and retention comparisons; this is **not full Phase 2c acceptance**. No empty read is counted as positive row proof.

## Before/after retention

| Relation | Before | After |
|---|---:|---:|
| auth.users | 0 | 0 |
| accounts | 0 | 0 |
| patients | 18 | 18 |
| staff_members | 41 | 41 |
| referrals | 9 | 9 |
| tester_attestations | 0 | 0 |
| acting_role_sessions | 0 | 0 |

The final transaction compares **every public application's table count plus auth.users** before/after rolled-back fixtures and raises on differences. Existing Phase 2b store-driven seeds stay intact; zero new test users/accounts/data remain. Migration ledger entries are retained intentionally. Post-run reads confirm baseline counts. Persistence-enabled flag query returns zero rows. Packet/advocate/crisis helper and command execution grants remain revoked. Supabase linter: no issues.

## Failures and corrections

Failed attempts were checked for rollback before retry; auth.users/accounts stayed zero, patients stayed 18.
- `permission denied for function attest_beta`: fixture attestation/role setup moved to existing privileged functions, without helper override or retained grant.
- `packet_seed_lock`: completed Intake is intentionally excluded by `phase2_intake`; kept failure recorded. Pre-completion packet tests reopen only the fixture checklist window inside rollback, not the actual policy.
- `part2_elements_required`: fictional advocate consent lacked evidence confirmations; corrected fixture, not guard.
- `own_sites_anon_count 81`: inventory is 45 public tables, not 46; corrected inventory count.
- `permission denied for function resolve_crisis_owner`: temporary test-only grant, rolled back.
- Identity comparison syntax and ambiguous count-column errors corrected without changing expectations.

## Policies intentionally still closed / acceptance gaps

- **Chart/patient/contact/consent, team/enrollment and restricted-record groups:** requested off-team denial conflicts with current `chart_entry` allowing same-site nonrestricted outside-caseload entry (13 roles); restricted care-team members also do not need a reasoned open. No helper or store rules changed. Needs Mitch's decision on the intended authority before opening.
- **Packet/referral/staging/intake/handoff groups:** completed Intake cannot use the current packet helper; only pre-completion helper behavior and seeded structural chain passed. No end-to-end authenticated handoff row-read acceptance or write transport claim. Closed.
- **Advocate tables/RPC:** helper consented slice/revocation passed under temporary grant; full candidate table/RPC composition, wrong-recipient/scope/org vectors remain unverified. Closed.
- **Identity decisions:** SQL/server registry decision/merge transport is unimplemented and belongs to 2d. Intake/sys_admin **cannot decide in SQL yet**; clinical coordinator is view-only. Read policy acceptance is not decision acceptance. Support/inbox remain separate closed tables; no union view exists. Positive populated support/inbox isolation and cross-org identity vectors remain outstanding.
- **Signup sessions/attempts/safety, triage/on-call, support/inbox, all other Phase 2 policies:** no complete positive-and-negative row suite in this batch; remain closed.
- **Anon public directory exception:** no public directory view exists yet (planned Phase 5). All existing public tables deny anon; website directory still reads preview memory. No new view created.
- Requested independent transaction per case was not fully met: role cases share a rolled-back suite transaction; crisis shifts use rolled-back subtransactions. Evidence does not claim separate per-case database transactions.

## Crisis-owner parity

`src/lib/persistence/crisisOwnerVectors.json` is shared with `phase2cCrisisOwner.test.ts`; its six literal vectors are used in the migration SQL. Assigned SDOH manager, assigned clinician, on-call in range, on-call end boundary/out of range, visible coordinator fallback, SDOH skips on-call: TS **6/6**, SQL **6/6**. TS undefined owner is normalized to SQL coordinator pool; runtime signatures unchanged. Assignment date/site/ambiguous-order parity beyond these scenarios remains unverified.

## Application validation

- Full units **3,544/3,544**, 404 files, exit 0, 175.79 seconds; completed before public browser suite started.
- Public browser: clean full rerun **51/51**, exit 0, 13.0 minutes; eight current public specs, one worker against :8080, no unit overlap. Initial full run 49/51: both Diana 390 service click assertions observed aria-expanded=false; unchanged isolated Diana rerun 5/5, then unchanged full rerun 51/51. No browser test/config/timeout or website runtime edits; first failures remain recorded, not discarded. Spanish group-detail screenshot inspected after isolated run.
- Preview build OK. Corrected two pre-existing TypeScript test errors in signupInvite.test.ts; no signup runtime changes.

## Reserved for 2d

Full domain repositories; server/registry write transport (including identity decisions); signup matching parity; signed-copy storage; persistence switches; tables for Didn't-start-care lifecycle state, Getting-started need confirmations, sign-up invite tokens and contact verification. None started here.