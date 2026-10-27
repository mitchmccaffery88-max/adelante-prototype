# Supabase schema plan for Beta persistence (PLAN ONLY)

Status: draft for Mitch's review. Nothing gets created until this is approved. Once approved, this document goes to `docs/supabase-schema-plan.md` and phase 1 starts.

What I confirmed in the code before writing this:
- The connected Supabase project (bnvukmpmwuhftvjpnwqi) has no tables, functions, triggers or buckets yet.
- `src/lib/ehr.ts` is one in-memory store of about 26,900 lines.
- `src/lib/` has about 335 modules.
- `roles.ts` defines 18 staff roles, including Intake Coordinator, and a `RecordClass` list of about 30 classes.
- 19 features are marked `simulated: true`.

Ground rules this plan follows:
- No Lovable Cloud and no GitHub link to Supabase.
- Plain Postgres where possible, so it can move to AWS RDS later.
- Fictional data only.
- The store rules stay the single source. The database only enforces them a second time.

## 1. Inventory: what becomes tables

Most tables use the same pattern:
- an `id uuid` key;
- `org_id`;
- `created_at` and `updated_at`, kept by a trigger;
- `created_by_account`.

Classification columns are written by code, never by the database.

| Domain (record classes) | Proposed tables |
|---|---|
| Org and structure | orgs, sites, locations, programs, county_programs |
| Accounts and roles | accounts (maps auth.users), staff_members, staff_role_assignments (primary + additional), acting_role_sessions |
| Patients and demographics (`demographics`, `alerts`, `allergies`, `problems`) | patients, patient_contacts, patient_language_prefs, alerts, allergies, problems |
| Advocates | advocates, advocate_links (patient, scope, consent_record_id) |
| Care team (`care_coordination`) | care_team_assignments, case_tasks, task_events |
| Episodes and plans (`care_plan`, `sud_treatment`) | care_episodes, care_plans, care_plan_goals (origin: clinician / patient / journey) |
| Notes (`therapy_notes`, `psychotherapy_notes`, `case_notes`, `peer_notes`, `chw_notes`) | notes (class column), note_versions, note_cosigns. Psychotherapy notes go in their own table. |
| Screeners (`screeners_mh`, `screeners_sud`, `psych_eval`) | screener_results, psych_evals. The SUD instruments AUDIT-10 and DAST-10 are stored in `part2.screener_results`. |
| Medications and orders (`meds_erx`) | medication_orders, lab_orders, refill_requests, moud_continuity |
| SDOH (`sdoh`) | sdoh_needs (provenance: referral_form / partner_referral / pre_release_packet / clinician) |
| Self-help and safety (`self_help`, `safety_plan`) | safety_plans, private_self_tracking (owner only), checkin_responses (owner only) |
| Adel chat | adel_threads, adel_messages (patient only, no staff path) |
| Pre-release (`custody_tracking`, pre-release workspace) | custody_records, prerelease_cases |
| Documents (`documents`) | documents, document_files (storage pointer) |
| Consent (`consent_ledger`) | see section 3 |
| Scheduling | calendars (owner: clinician / care manager / location), availability_rules, appointments, telehealth_rooms |
| Groups | group_sessions, group_enrollments, group_join_requests, group_request_decisions |
| Messaging | message_threads, messages, message_flags |
| Referrals and intake | see section 4 |
| Billing and coverage (`billing`, `eligibility`) | coverage_records, coverage_checks, coverage_requests, claims, claim_lines, payments |
| Content center | content_items, content_versions (EN/ES with review status), content_audiences |
| Public directory | resources, resource_revisions, resource_reports, naloxone_sites |
| Credentialing | credentials, credential_documents |
| Audit and logs | see section 3 |

These stay as code or config, with version-pinned seeds of reference data where useful:
- the permission matrix;
- CHART_ACTIONS;
- group types and their requirements;
- the C-SSRS mapping;
- crisis triggers;
- consent purpose codes;
- feature flag definitions;
- Simulated labels.

These become data, as admin-editable reference tables with an audit row:
- payers;
- county programs;
- sliding-scale tiers;
- coverage re-check cadence;
- the per-group join rule, audience and billable flag;
- feature flag values;
- content;
- resources;
- on-call schedule entries.

## 2. Access model in the database

**Acting role.**
- `acting_role_sessions` holds: account_id, role, started_at, ended_at, and an optional reason.
- A function `app.set_acting_role(role)` checks that the role is the primary role or a held additional role. It closes the previous session and writes one audit event.
- RLS reads `app.current_role()`. That function looks up the open session row for `auth.uid()`.
- I'm not using a custom JWT claim. It is Supabase-specific and goes stale after a role switch.
- There is never a union: every check uses exactly one role.

**The matrix lives once.**
- `app.record_class_grants` holds: role, record_class, level (none / summary / read / write / consent_gated).
- A script generates it from `roles.ts` into a seed migration.
- A unit test fails if the database seed and the `canAccess` output differ, so code stays the source.
- The helper `app.can_access(record_class, patient_id)` returns level plus a reason.

**Part 2 segmentation.**
- Part 2 data lives in a separate `part2` schema:
  - SUD screeners;
  - the SUD-classified parts of problems and medications;
  - SUD episodes;
  - Part 2-tagged documents;
  - counseling notes.
- Rows land there because code calls `classifyPart2`, `sudMedClassifier` or the screener `isSud` flag before the write. The database never classifies anything itself.
- Every read goes through views or functions, never straight to the tables. Each returns either the row or a stub: `{id, locked: true, reason}`. Nothing restricted disappears silently.
- The consent check `app.consent_covers(patient, type, recipient, purpose_code, item)` copies the typed-ledger logic of `consentGate`. The TypeScript test vectors run against both, so they stay in step.

**Patients and advocates.**
- A patient reads rows where the patient's account matches.
- An advocate reads only through the `advocate_view_*` functions. These check `advocate_links` plus the consent record the link points to.
- Adel threads have only an owner policy, with no staff policy at all. Audit stores IDs only.

**Writes.**
- Direct writes on gated tables are denied. The app's sign-in role gets no write grant on them.
- Writes go through `app.run_action(action_id, patient_id, payload)`, called from TanStack server functions. The flow:
  1. The server function first runs the existing TypeScript `runAction`, so the registry and the store rules stay the source.
  2. The database function then checks the role and record-class grant again.
  3. It does the write and adds exactly one audit row, all in one transaction.
- Owner-only tables (check-ins, self-tracking, Adel) allow direct writes by the owner only.

## 3. Consent, audit and logs

- **Consent ledger:** consent_records holds type, recipients, purpose_code, items, status, effective/expiry dates, legacy_unverified and supersedes_id. Also consent_versions (form template versions) and consent_signed_copies (storage pointer plus SHA-256, never deleted). Revoke, supersede and renew add new rows; nothing is overwritten. Self-sign is supported by a `signed_by_kind` column (patient / staff_capture / paper) for the group confidentiality and telehealth forms.
- **Audit:** audit_events stores IDs, codes and outcome only, plus `simulated bool` and registry_version. Insert happens only through functions. Update and delete are revoked, and a trigger raises an error if anyone tries. A check trigger rejects text fields that look like names, dates of birth, phone numbers or emails, as a second layer behind `part2SafeText`.
- **Disclosure log:** disclosure_events (consent_record_id, recipient, purpose_code, items).
- **Record-access log:** record_access_log. A function collapses views by the same account, patient and class within 5 minutes into one row with a count.

## 4. Identity and intake

- **Referrals:** referrals holds referrer_type, identity_confidence, dob_unknown, approx_age, status, source, linked_patient_id and safety_flag_tier. Also referral_codes (hashed, expiry, claimed_at, attempt counters) and referral_status_updates.
- **Sign-up:** signup_sessions, signup_attempts (for the 5-tries-per-15-minutes and OTP limits) and signup_safety_scans (result tier only, with escalation_id).
- **Review queues:** three separate tables, each with its own policies:
  - identity_review_items (lane, candidate IDs, decision);
  - account_support_items;
  - website_inbox_items. Careers uploads keep the résumé's file name and size only.
- **Intake:** intake_checklists, intake_form_status, intake_packet_needs (source-bound), pre_chart_triage (patient-independent), and on_call_shifts (clinician, start, end; Draft).
- **Pre-release packets:**
  - staging_imports and staging_rows. These are referral-only, and their functions refuse to write episodes, coverage or HRSN.
  - packet_documents (type, source, part2_tagged, storage path).

## 5. Files (Storage)

All buckets are private, with 15 MB per file and PDF/JPEG/PNG/HEIC only.

| Bucket | Contents |
|---|---|
| `referral-uploads` | Public referral form uploads, through a server function only |
| `packet-documents` | Packet documents, with a separate `part2/` path |
| `consent-signed` | Signed consent copies. No delete policy. |
| `documents` | Chart and other documents, with a separate `part2/` path |
| `credentialing` | Credentialing files |

- Storage rules call `app.can_access` and `app.consent_covers` for the matching record.
- Files are shared only through signed links that last 5 minutes and are created by a server function.
- Uploads are labelled Simulated until a production store covered by a BAA (Business Associate Agreement) exists.

## 6. Public website

- Public visitors can read resources and naloxone listings only where `show_on_public_website = true`, through a view with a county filter.
- Contact, careers and public referral submissions are insert-only through security-definer functions. The public can never read them back.
- A rate limit is kept per IP hash.

## 7. Auth

- Patients, advocates and staff all sign in with Supabase Auth email and password. PIN sign-in is a hashed PIN behind a function.
- `accounts.kind` (staff / patient / advocate) drives the existing role routing, which stays unchanged.
- One-time codes, "Save and finish later", password resets and email/SMS delivery stay Simulated until Mitch picks an SMTP/SMS provider.
- Supabase-only dependencies:
  - `auth.users` and `auth.uid()`;
  - Storage policies;
  - Supabase's public data access through the PostgREST grants.
- Each one is wrapped in an `app.*` function, so moving to Cognito means rewriting those functions only.

## 8. Reporting

- Reports are security-definer functions such as `report.population_*` and `report.county_*`, or views over them.
- Every grouped result applies `HAVING count >= 11`. Small cells come back as a suppressed row with no count.
- Raw tables give no direct read access to reporting roles.
- A test checks that no report can return a group smaller than 11.

## 9. Migration approach

- Extend the existing adapter seam (`src/lib/ehr/adapter.ts`) into one repository interface per domain, each with a memory version and a Supabase version.
- A feature flag per domain, `persist_<domain>`, chooses which one runs. It is off by default.
- The unit suite (3,422 tests) and browser suite (47 checks) keep running against memory, unchanged.
- Each domain also gets a contract-test suite that runs the same cases against both versions, with the Supabase run against the test project.
- **RLS tests:** a generated suite of role × table × operation, expected to allow or deny. It runs by setting the acting role for each staff role and checking reads, writes and locked stubs. It runs in CI against the test project.
- **Cut-over order:** follows the phases in section 11. Each domain switches on only after its contract tests and RLS tests are green.

## 10. Seeds

Every seed runs through the store functions, not raw SQL, and every fictional row is tagged `synthetic = true`. The suite contains:
- all 18 staff roles, including Intake Coordinator and the multi-role demo staff;
- the full current fictional patient set;
- three new types of intake:
  1. a general-population new sign-up;
  2. a referral with a pre-release packet that includes medical details, SDOH needs and Part 2-tagged documents;
  3. a referral with little or no information (public_unverified).

Scenario 2 is assigned to a patient record and is the main Beta flow to check.

PHI guards:
- the database rejects patient inserts without `synthetic = true`;
- a Beta banner shows on every screen;
- every tester must agree at first sign-in to use fictional data only, and that agreement is audited;
- no import path accepts real roster files: Beta imports only accept the generated fictional template.

## 11. Phases

| # | Delivers | Verify | About how many tables |
|---|---|---|---|
| 1 | Accounts, staff roles, acting role, orgs/sites/programs, feature flags, audit, consent ledger, Beta guards | Role-switch audit, matrix sync test, RLS suite for these tables, consent_covers test vectors | 18 |
| 2 | Patients, advocates, care team, referrals, sign-up, three review lanes, intake, packets, staging, triage, on-call | Contract tests, Part 2 locked-stub tests, packet-to-patient scenario | 26 |
| 3 | Calendars (every care manager), appointments, groups, join rules, self-sign forms | Group-request tests on both versions | 12 |
| 4 | Clinical data and the part2 schema | Part 2 and consent read tests for every role | 22 |
| 5 | Content, public directory, website inbox, storage buckets | Public-only reads, insert-only forms | 10 |
| 6 | Billing and coverage | Coverage-only projection; Intake can't see financial fields | 12 |
| 7 | Reporting functions | Small-cell suppression suite | Views only |

Total: about 100 tables.

## 12. Operations

- **Backups:** daily backups kept 7 days are enough for fictional Beta data. Point-in-time recovery isn't needed.
- **Spend cap:** keep it on.
- **Environments:** a second Supabase project is recommended for automated tests and RLS suites (about $10/month extra on Pro), so tests never touch the data testers use.
- **Co-owners:** Diana and Cathy are added as organization owners in Supabase for billing and access. Schema changes still go only through Lovable.

## 13. Open questions and risks

- Do we approve the second test project?
- Is a server-function-only write path acceptable, given the extra round trips?
- Owner and schedule for on-call duty (Draft).
- Which SMTP/SMS provider?
- Can PIN sign-in stay on in Beta?
- Retention for audit and access logs.
- Do Spanish content review states carry into the database?
- **Risk:** keeping the matrix and consent logic in step between TypeScript and SQL. Mitigation: generated seeds plus shared test vectors.
- **Risk:** `ehr.ts` is about 26,900 lines, so splitting it into repositories is the largest piece of work.
- **Risk:** existing source-pin tests will need approved changes during the split.
