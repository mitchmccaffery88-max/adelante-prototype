# Phase 2 rollback evidence — 27 Oct 2026

Target: connected main Supabase project `bnvukmpmwuhftvjpnwqi`. The four TEST_SUPABASE credentials were absent; none were requested. All test fixtures ran in migration-tool BEGIN/ROLLBACK transactions. A transaction-local `app.account_id()` override supplies synthetic identities, not hosted authentication; rollback restores it.

## Passing evidence
- **1,976** role/table/direct-operation and anonymous checks: 18 roles × 26 tables × 4 operations = 1,872; 26 × 4 anonymous denials = 104. Migration `20261027123935_34aa173b-5093-48a6-94de-5103e501b5f7.sql`.
- **13 packet/chart assertions**: one import audit; source-bound staging plus two needs; unlinked ID-only packet lock; referral-to-patient enrollment; linked no-consent lock; typed standard TPO unlock; unchanged Intake chart/screener/treatment denial; revocation relock; same-site chart entry; required site assignment; restricted search/open denial; restricted Intake denial; NULL acting-role denial. Migration `20261027124038_13b8f95c-bb88-494b-9254-2f9847910822.sql`.
- **4 signup limit assertions**: sixth code attempt rejected in 15 minutes; sixth OTP rejected; resend under 30 seconds rejected; OTP at 10 minutes rejected. Migration `20261027124612_8f97a07a-4074-427a-b551-ee3cb0e71415.sql`.
- **30 final closure/shape assertions**: 26 closed/RLS/direct-write checks, closed command/read RPCs, no raw safety text fields, unmixed identity shape, no stored packet paths. Migration `20261027124655_8502e1aa-cc2f-4c0b-8aba-f29213f8ac3a.sql`.
- Total database assertions: **2,023**. These are not a comprehensive positive-row access suite. Empty-table role reads do not prove authorized slices.
- After rollback: accounts=0, patients=0, referrals=0, grants=792; 26 Phase 2 tables remain. No fixture account, patient, signature, or packet was retained.

## Corrections, not weakened tests
Missing composite acting-session key; permission-loop alias; NULL acting-role fail-open; broad Intake/sys_admin role path; packet owner bypass; need/referral organization shadow; handoff completion/record grants; compliance viewer literal; shared trigger field/alias references. Standard-TPO fixture corrected to no expiry and explicit signed/effective timestamps. Unverified reads and commands ultimately revoked/closed rather than represented as complete.

## Not verified
Positive row projections for every new table/role, real hosted auth, advocate consented slice/revocation, all identity decisions, crisis owner parity (including special SDOH semantics), complete care-team handoff, concurrent attempt races, signed-copy persistence, full memory/database repository parity, retained store-driven synthetic database seeds.
## Phase 2b (27 Oct)
- Standard Part 2 end-rule vectors (`STANDARD_TPO_EXPIRY_VECTORS`): SQL rollback transaction on the main project, `{"checks":8,"passed":8}`; 0 rows retained.
- Store-driven seed retained (not rollback): patients 18, care team 22, enrollments 18, signed part2_tpo_single 3, referrals 9 (1 public_unverified), Part 2-tagged packet docs 2, handoffs 1, non-synthetic patients 0.
