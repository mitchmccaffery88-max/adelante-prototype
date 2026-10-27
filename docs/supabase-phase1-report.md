# Supabase Phase 1 — 27 Oct 2026

Connected external Supabase Pro `bnvukmpmwuhftvjpnwqi` only. No Lovable Cloud, GitHub connection or publishing.

## Foundation installed
The requested list contains **20 tables** (19 public + one app), all RLS-enabled and closed to direct changes. Organization keys and timestamps are present; person-bearing rows carry synthetic flags. Immutable rows reject changes; mutable tables maintain updated timestamps.

- Reference: orgs, sites, locations, programs, county_programs.
- Identity: accounts (auth.users mapping, kind only—not staff roles), staff_members, staff_role_assignments, acting_role_sessions.
- Matrix: app.record_class_grants, **44 × 18 = 792** generated rows including explicit none. Physician rows mirror PMHNP; nursing overlays included.
- Controls/logs: feature_flags, audit_events, record_access_log, disclosure_events, tester_attestations.
- Core person identity: patients, patient_contacts; non-synthetic inserts rejected by trigger, even privileged.
- Typed ledger: consent_versions (EN/ES, DB Spanish review state), consent_records, consent_signed_copies (pointer/SHA-256, immutable).
- Empty `part2` and `report` schemas: no anon/authenticated usage; no tables/data exposed.

## Functions and policies
- app.account_id/org_id/current_role/owns_patient isolate verified identities and organizations. One open acting-role session, validated against active held assignments, never a union.
- app.set_acting_role closes previous session and adds one ID/code-only audit in the same transaction.
- app.can_access resolves generated levels and typed Part 2 gates, returning level + neutral reason. No clinical table reads are exposed by this helper.
- app.consent_covers matches typed ledger scopes, status/effective/expiry, verbal restrictions, merge/legacy holds; shared SQL/TS vectors pass.
- app.append_audit applies strict UUID/code-only metadata validation; immutable trigger refuses updates/deletes. App runtime service_role also has no direct table-write privileges.
- app.record_view serializes duplicate reads and collapses within five minutes, preserving count; role at first read is retained.
- app.set_feature_flag requires sys_admin + reason code, rejects live mode on simulated flags; definitions remain code-owned.
- app.attest_beta records immutable version/language/hash with one audit; repeat acceptance creates no duplicate. Hash pins exact EN/ES statement.
- Public exposed wrappers: read-only invoker context; service-only command/log/consent-lifecycle wrappers authenticate the supplied server-verified user through account mapping and require attestation where applicable.
- Patients read only their own identity/contact/consent/copy rows. Advocates receive no patient read path in Phase 1. Staff core clinical reads remain deliberately closed until chart-context/site/assignment contracts are ported; class grants alone do not replace these checks.
- Signed copies/versions/logs remain immutable. Consent revocation/expiry terminal transitions are atomic with IDs-only audit; signed content cannot be edited in place.

## Seeds
Migration-owned `app.seed_foundation` creates fictional organization/site/location/program/county reference data and a fictional 18-role preset roster with additional Intake on the admin. It is not runtime callable. No auth users/accounts/patients seeded. Patient data remains Phase 2 except rollback-only consent fixtures.

## App wiring and what stays off
- Narrow foundation repository contracts, memory-port adapter and caller-RLS Supabase reads; selector defaults to memory for accounts, staff_roles, feature_flags, audit, consent, patients_core.
- `persist_*` values and `beta_foundation` seeded false. Beta banner/first-sign-in agreement wraps every screen only when build opt-in `VITE_BETA_FOUNDATION=true`; no behavior change in the default preview.
- Authenticated server functions and bearer middleware added. No caller-controlled role used as authorization; SQL validates held role again.
- Supabase-only coupling: auth.users FK/auth.uid (isolated helpers), SDK/PostgREST and generated clients, public RPC wrappers. No Storage buckets yet; copies are pointers, not claims that files are uploaded/verified. Portable core tables/functions otherwise.

## Verification
- Foundation matrix/default-off focused: 4/4.
- Shared consent TypeScript vectors: 17/17; SQL vectors: 17/17, rollback-only main project.
- Main-project rollback RLS/helper suite: **2,261/2,261**; fixtures and temporary identity helper overrides rolled back. Actual JWT/Auth end-to-end is not established by these tests.
- Additional boundary suite **31/31**: anonymous all-table denials, cross-org consent/copy ownership, advocate denial, copy immutability and flag reason/live/non-union/one-audit. Combined foundation **2,292/2,292** plus 17 SQL vectors.
- Actual DB matrix vs generated code: checksum `87fb6d48742a73f6c6a68a2f23f140cc`, 792 rows, zero drift; migration literal sync zero mismatches.
- Full units: **3,465/3,465, 398 files**, exit 0 (final full run before isolated public suite).
- Full public browser: **47/47 passed**, exit 0, 10.3m, eight files, one worker, localhost:8080. First run 46/47 had an Axe execution context destroyed during reload; unchanged full rerun passed. No timeout/retry/config changes.
- Linter: no issues. Build OK after source edits. Default browser page: no errors, Beta absent as intended.

## Incomplete cutover / blockers
This is a closed foundation, **not an enabled Beta persistence cutover**.
- Second test project not created/credentials unavailable; all SQL cases run rollback-only on main, recorded in docs/rls-evidence/. Transaction helper overrides test RLS with synthetic accounts without modifying auth.users.
- Connected auth.users count is zero, accounts empty. Real first-sign-in/role switch cannot be tested through UI until a Beta email user is provisioned and mapped. Existing sign-in remains simulated; do not enable Beta gate before that path is ready.
- Consent creation/signed-file evidence transport is not enabled: current memory signing lacks a trusted storage artifact; exposing generic writes would bypass store/signature provenance. Lifecycle wrapper exists, but full create/supersede/frozen-copy transport must be connected before persist_consent activation.
- Repository domain selection contracts exist but existing store mutation call sites are not swapped. Full registry-run transport for all core domain mutations remains off; no general CRUD endpoint was added to compensate.
- Feature-flag setter/audit/view helpers exist but admin flags, prototype access log and registry audits are not cut over. Keep persist_feature_flags/persist_audit off until one-event transaction transport is complete.
- Phase 2 care-team/site/restricted chart context is absent; staff patient reads stay denied, not widened to the raw matrix.
- No real-file imports enabled by this phase; existing memory-only simulated importers are unchanged. A future Beta activation must enforce generated-template-only imports on their server transport.
- SMTP/SMS, hashed PIN transport, second project, counsel wording/sign-off and production retention remain the previously recorded later-phase decisions.

## Migration notes
Initial draft migration was rejected and rolled back; concise active guards replaced invalid draft sections in the tool retry. The generated migration retains commented draft text (inert); migration files are tool-owned and were not edited manually. The inherited Supabase default grants were detected by negative tests and explicitly revoked. No broad privileges remain for anon/authenticated; service-role direct writes were also revoked.