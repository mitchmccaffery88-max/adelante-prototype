# Supabase schema plan for Beta persistence

Status: approved by Mitch with changes (26 Oct). The changes are folded into the sections below and listed in "Changes from review (26 Oct)" at the end. No tables exist yet; phase 1 starts in the next batch.

What I confirmed in the code before writing this:
- The connected Supabase project (bnvukmpmwuhftvjpnwqi) has no tables, functions, triggers or buckets yet.
- `src/lib/ehr.ts` is one in-memory store of about 26,900 lines.
- `src/lib/` has about 335 modules.
- `roles.ts` defines 18 staff roles, including Intake Coordinator, and a `RecordClass` list of 44 classes (recounted; see change 3).
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
| Self-help and safety (`self_help`, `safety_plan`) | safety_plans, private_self_tracking (owner read only), checkin_responses (owner read only; writes through the server-function path so the crisis scan runs) |
| Adel chat | adel_threads, adel_messages (owner read only; writes through the server-function path so the crisis scan runs; no staff read path to content) |
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
- The seed covers all 44 record classes in `roles.ts` (`RecordClass`), × 18 staff roles: account_support, demographics, screeners_mh, screeners_sud, psych_eval, care_plan, therapy_notes, meds_erx, telehealth_room, sdoh, self_help, safety_plan, sud_treatment, psychotherapy_notes, case_notes, peer_notes, chw_notes, documents, billing, consent_ledger, problems, allergies, alerts, eligibility, care_coordination, custody_tracking, pre_release, controlled_substance_custody, population_health, crisis_queue, patient_messaging, provider_requests, community_inquiries, worklist, note_templates, catalog_governance, platform_administration, scheduling_rules, group_sessions, group_notes, staff_supervision, assisted_signup, content_authoring, clinical_text_governance. `psychotherapy_notes` is default-deny for every role and still gets a row per role.

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
- Adel threads and check-ins have only an owner READ policy, with no staff policy at all. Writes go through a server function that runs the existing crisis scan (`detectCrisisLanguage` / `scanTextForCrisis`) before the insert, per the 19 Oct monitoring decision; a hit raises the normal crisis escalation with no message text. Audit stores IDs only.

**Writes.**
- Direct writes on gated tables are denied. The app's sign-in role gets no write grant on them.
- Writes go through `app.run_action(action_id, patient_id, payload)`, called from TanStack server functions. The flow:
  1. The server function first runs the existing TypeScript `runAction`, so the registry and the store rules stay the source.
  2. The database function then checks the role and record-class grant again.
  3. It does the write and adds exactly one audit row, all in one transaction.
- No table allows direct owner writes. Check-ins, self-tracking and Adel messages are written through server functions too, so the crisis scan always runs.

## 3. Consent, audit and logs

- **Consent types:** the standard Part 2 consent at intake is `part2_tpo_single` with purpose code `tpo` (treatment, payment and health care operations), recipients described by class (Adelante care team, treating providers, health plans and payers including Medi-Cal and the county DMC-ODS program, the health information exchange, program operations), no expiry, revocable. Counseling notes (`counseling_notes_release`), criminal-justice/probation-parole (`po_voluntary_coordination`), legal proceedings (`legal_part2_disclosure`), advocate/family ROI (`advocate_release`) and named outside recipients (`part2_specific_written`) are separate types; a check constraint plus the `consent_covers` type match mean one record can never be two of these.
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

- Patients, advocates and staff all sign in with Supabase Auth email and password. PIN sign-in stays on in Beta as a hashed PIN behind a function.
- Phone-only sign-in waits for an SMS provider. Until one is chosen, Beta testers sign in by email.
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
- Complementary suppression: totals, subtotals and margins are computed only from published cells, and when exactly one cell in a row or column is suppressed, the next-smallest cell is suppressed too. Report functions refuse filter combinations whose difference from an earlier published figure would reveal a suppressed cell (the same groups at a narrower filter).
- Raw tables give no direct read access to reporting roles.
- Tests check that no report returns a group smaller than 11, and that no total, subtotal or second query (narrower filter, complement) lets someone work out a suppressed cell by subtraction.

## 9. Migration approach

- Extend the existing adapter seam (`src/lib/ehr/adapter.ts`) into one repository interface per domain, each with a memory version and a Supabase version.
- A feature flag per domain, `persist_<domain>`, chooses which one runs. It is off by default.
- The unit suite (3,422 tests) and browser suite (47 checks) keep running against memory, unchanged.
- Each domain also gets a contract-test suite that runs the same cases against both versions, with the Supabase run against the test project.
- **RLS tests:** a generated suite of role × table × operation, expected to allow or deny. It sets the acting role for each staff role and checks reads, writes and locked stubs.
- **Where it runs:** there is no GitHub-to-Supabase link and none is planned. The RLS and contract suites run from this Lovable sandbox against the second (test) Supabase project, using a test-only connection string stored as a project secret. Each run writes a dated summary (counts, failures, schema migration id) to `docs/rls-evidence/` in the repo, and the batch report quotes it.
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
| 1 | Accounts, staff roles, acting role, orgs/sites/programs, feature flags, audit, core patients (patients, patient_contacts, account link), consent ledger, Beta guards | Role-switch audit, matrix sync test, RLS suite for these tables, consent_covers test vectors | 21 |
| 2 | Advocates, care team, referrals, sign-up (with safety scan results), three review lanes, intake, packets, staging, triage, on-call shifts | Contract tests, Part 2 locked-stub tests, packet-to-patient scenario | 23 |
| 3 | Calendars (every care manager), appointments, groups, join rules, self-sign forms | Group-request tests on both versions | 12 |
| 4 | Clinical data and the part2 schema | Part 2 and consent read tests for every role | 22 |
| 5 | Content, public directory, website inbox, storage buckets | Public-only reads, insert-only forms | 10 |
| 6 | Billing and coverage | Coverage-only projection; Intake can't see financial fields | 12 |
| 7 | Reporting functions | Small-cell and complementary suppression suite | Views only |

Total: about 100 tables.

## 12. Operations

- **Backups:** daily backups kept 7 days are enough for fictional Beta data. Point-in-time recovery isn't needed.
- **Spend cap:** keep it on.
- **Environments:** a second Supabase project is recommended for automated tests and RLS suites (about $10/month extra on Pro), so tests never touch the data testers use.
- **Co-owners:** Diana and Cathy are added as organization owners in Supabase for billing and access. Schema changes still go only through Lovable.

## 13. Open questions and risks

Decided 26 Oct: second test project yes; server-function-only writes yes; PIN sign-in on in Beta (hashed) yes; Spanish review status stored in the database yes; audit and access logs kept in full for all of Beta.

Still open:

- Owner and schedule for on-call duty (Draft).
- Which SMTP/SMS provider? Prefer one that signs a BAA.
- Production retention for audit and access logs (Diana/counsel).
- **Risk:** keeping the matrix and consent logic in step between TypeScript and SQL. Mitigation: generated seeds plus shared test vectors.
- **Risk:** `ehr.ts` is about 26,900 lines, so splitting it into repositories is the largest piece of work.
- **Risk:** existing source-pin tests will need approved changes during the split.

## Changes from review (26 Oct)

1. Adel messages and check-ins are not direct owner writes. They go through the server-function path so the server-side crisis scan always runs (19 Oct decision). Owner reads stay owner-only; there is still no staff read path to content.
2. Core patient tables (patients, patient_contacts, the account link) move into phase 1 because consent_records reference patients. Phase 2 keeps the rest.
3. Record classes recounted against `roles.ts`: the `RecordClass` union has 44 classes, not "about 30". Mitch confirmed 27 Oct that code is authoritative and the previous 41 count predates three newer classes. The generated grants seed covers every one; they are listed in section 2.
4. Reporting adds complementary suppression; no total, subtotal or second query may let someone derive a suppressed (<11) cell. Tested.
5. Phone-only sign-in waits for an SMS provider; Beta testers sign in by email until then (section 7).
6. The role-by-table RLS and contract suites run from the Lovable sandbox against the second Supabase project; results are recorded in `docs/rls-evidence/` and quoted in each batch report (section 9).
7. Decisions: second Supabase project for automated tests — yes. Server-function-only writes — yes. PIN sign-in on in Beta (hashed) — yes. Spanish review status stored in the database — yes. Audit and access logs — keep everything for all of Beta; production retention open (Diana/counsel). SMTP/SMS provider — open, prefer one that signs a BAA.
8. The consent ledger includes the standard Part 2 consent at intake (`part2_tpo_single`, purpose code `tpo`, recipient classes, no expiry, revocable). Counseling notes, criminal-justice and legal-proceedings consents stay separate types that can never be combined with it (section 3).
