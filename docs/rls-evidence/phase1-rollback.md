# Phase 1 RLS evidence — 27 Oct 2026

Target: connected main project `bnvukmpmwuhftvjpnwqi`, not a second project (not created/configured).

- Migration-tool transaction, explicit BEGIN/ROLLBACK; fixtures synthetic only; no auth.users mutations.
- Transaction-local account helper override supplies synthetic authenticated identities; the original helper is restored by rollback. This exercises database RLS, not hosted authentication.
- **2,261/2,261 checks passed**: 18 roles × 20 tables × 4 direct operations = 1,440; 792 effective role/class cases; 18 role switches; 3 held-role/session negatives; 8 synthetic/ownership/audit/attestation/access-collapse checks.
- Correction: Phase 1 request lists **20 tables**, not 21 (19 public plus app.record_class_grants).
- Inherited Supabase broad anon/authenticated grants were discovered by the first run, explicitly revoked, then the complete suite passed.
- After rollback: accounts=0; patients=0; grants=792; original auth.uid helper restored; anon/authenticated account UPDATE grants false.
- Passing suite is recorded by `supabase/migrations/20261027021705_03af1411-8ebb-483f-adb1-2f3eaf185a04.sql`; it is rollback-only and retains no test rows.
- Read cases exercise policies; tables without fixtures are not comprehensive positive row-projection proofs. Expanded ownership/consent/anonymous cases and API contracts are separately recorded when run.
- SQL shared consent vectors: **17/17 passed**, same inputs as `src/lib/persistence/consentVectors.ts`; transaction rolled back.