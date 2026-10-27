# Supabase Phase 2 — partial closed foundation

27 Oct 2026. **Not complete; persistence remains OFF; nothing published.** Existing connected Supabase Pro project only. No Lovable Cloud, GitHub link, connector, auth-user changes, or buckets.

## Installed tables
26 public tables, organization-bound foreign keys, timestamps/update triggers, synthetic-only guards, RLS and explicit grants; authenticated/service-role direct writes revoked; anonymous access revoked:

- Chart: `care_team_assignments`, `patient_site_enrollments`, `staff_site_assignments`, `restricted_record_flags`, `restricted_record_opens`.
- Advocate: `advocates`, `advocate_links`.
- Referral: `referrals`, `referral_codes`, `referral_status_updates`, `referral_outreach_log`.
- Signup: `signup_sessions`, `signup_attempts`, `signup_safety_scans`.
- Separate review lanes: `identity_review_items`, `account_support_items`, `website_inbox_items`.
- Intake: `intake_checklists`, `intake_form_status`, `intake_packet_needs`, `pre_chart_triage`, `first_visit_handoffs`.
- Staging: `staging_imports`, `staging_rows`, `packet_documents`.
- Draft on-call: `on_call_shifts`.

## Functions and permissions
Chart helpers separate acting role, actual work-site enrollment, care team, restriction/search, and existing `app.can_access`; no grant-matrix widening. NULL roles fail closed. Packet projections return only `{id,locked:true,reason}` when locked and metadata only when unlocked. Standard treatment consent does not unlock Intake chart, SUD screeners or treatment classes. Advocate identity helper checks link, scope, recipient and associated consent; it remains unexposed pending positive tests.

`app.phase2_run_action` prototypes narrow fictional template import, packet attachment, verified linking, team assignment and on-call creation with one neutral simulated audit. **Its execution is revoked from authenticated callers; no runtime server wrapper is attached.** The `phase2_referral_link` prototype is not an approved registry contract and must not be enabled. Identity decisions, capture/signature writes and other unported mutations refuse or remain unavailable.

`app.resolve_crisis_owner` prototype preserves the special SDOH branch and normal assigned/on-call/fallback routing; no runtime exposure and no claim of full parity. On-call shifts require active licensed roles, positive dates, at most seven days and the Draft label.

Signup guards cover the existing 5/15-minute code, 5-try OTP, 10-minute OTP and 30-second resend rules; hashes only. Safety scans and attempts are immutable. Inbox stores résumé name/size only. Staging identity fields reject clinical payload fields; packet paths are rejected pending Phase 5.

**Final access is closed:** all 26 table read policies are false, new staff identity/contact/consent policies are false, public packet/advocate RPCs and command RPC are revoked. Helpers remain for isolated rollback testing only. No new app patient read is enabled.

## Seeds
No retained Phase 2 database seeds. A temporary export exercised the fictional general signup and verified packet signup through the real registry; the database rollback test covered staged packet → patient enrollment and consent lock/unlock. This does **not** satisfy the requested full current patient suite, three retained intakes, care teams, or store-owned seed persistence. The temporary export also exposed TypeScript capture/SQL standard-TPO expiry mismatch; it is not shipped or used as database signature evidence. No invented real signature or raw fixture identity export is committed.

## Repositories and runtime
`phase2.ts` adds disconnected read types, off-default domain declarations and an ID-only defensive packet projection. Memory/Supabase wrappers are port scaffolds, **not implemented domain repositories or full contract parity**. No new server functions, no persistence switch, no UI/shell changes.

## Validation
- Database: **2,023 passing rollback assertions**, main project; see `docs/rls-evidence/phase2-rollback.md`. Matrix reads on empty tables are not comprehensive positive access proof.
- Full units: **3,479/3,479**, 399 files. New projection/default-off tests: 14/14.
- First browser run was terminated at 600 seconds: 24 passed, 2 timed out, 21 uncompleted; overlapping full unit work contributed load. No tests/config/timeouts changed.
- Isolated landing rerun: **5/5**. Clean full public rerun: **47/47**, 12.4 minutes, one worker against :8080; no assertion/config/timeout changes.
- Preview build log: build OK. No content route was modified; index metadata preserved.

## Remaining work / blockers
This implementation batch is partial, not Phase 2 acceptance. Remaining implementation gaps are not a request for new secrets or approval: generated full store-driven seeds; real domain repositories and server/registry command contracts; patient/advocate/identity positive RLS scenarios; complete handoff/care-team end-to-end; reasoned restricted-open/compliance path; broad consent/class locked projections; trusted signup matching and crisis-owner parity.

Separate test project credentials remain external; until supplied, only rollback tests are used. Hosted authenticated end-to-end remains unavailable with zero provisioned accounts/auth users. These limits are distinct from unfinished implementation. All persistence remains off until the missing work passes.

## Phase 2b update (27 Oct)
**Complete**
- Item 1 — standard Part 2 consent end rule. `src/lib/standardTpoExpiry.ts` (TS) and `app.synthetic_guard` / `app.standard_tpo_end_events()` (SQL) agree: `part2_tpo_single` with purpose `tpo` has no end date; the only end wording is until revoked / end of treatment; revocable any time. Intake Phase B capture and its staff panel show "No end date" for that scope. 8 shared vectors: TS suite pass, SQL rollback 8/8. **Open decision:** treatment-purpose `part2_tpo_single` keeps its end date because pinned B2 parity suites encode one; widening needs Mitch's approval of those pin changes.
- Item 2 — store-driven seed transport. `scripts/generate-phase2-seed.ts` (build-time, never imported by the app) boots the demo store, runs the Phase A registry seed, a general website sign-up (`website_signup`), and the packet intake (`intake_staging_import` → `intake_packet_attach` → verified sign-up link → `intake_team_assign` ×2 → `intake_complete`), then emits compact JSON pasted into a migration-owned seed. Retained: 23 staff (+ held roles), 18 patients, 18 site enrollments, 22 care-team rows, 3 signed `part2_tpo_single` (Marcus L., Luis Camacho, Jasmine Holt; packet patient Dana unsigned so the locked path is testable), 9 referrals incl. Casey (`public_unverified`), staging import/row, 4 packet docs (2 Part 2-tagged), 3 SDOH needs, completed checklist, first-visit handoff. 0 non-synthetic rows.

**Stopped at the boundary (moved to 2c)**
- Item 3 positive access scenarios: each case needs an authenticated per-role account (auth user + account + attestation). None exist and creating auth users was outside this batch, so every Phase 2 read stays closed.
- Item 4 crisis-owner parity vectors: not started.
- 2c as instructed: repositories, server/registry transport, signup parity, persistence switches.

**Tests:** full units 3,488/3,488 (400 files); then public browser 47/47 (eight public specs, one worker, :8080, 13.2m). Tests ran rollback-only on the main project (no test-project secrets). Persistence off; nothing published.

## Phase 2c retry (27 Oct, 20:39 UTC request) — blocked before migrations
- All four required test secrets are present: `TEST_SUPABASE_DB_URL`, `TEST_SUPABASE_URL`, `TEST_SUPABASE_ANON_KEY`, `TEST_SUPABASE_SERVICE_ROLE_KEY`. Presence only was checked; no values were printed or written.
- Test API project ref is `cguwotbbuyqzgmebckqy`, distinct from main `bnvukmpmwuhftvjpnwqi`. The test database connection's project identity matches the test API ref. Credential validity and database connectivity were not tested.
- **Migration-target blocker:** the available Supabase migration tool has no target-project argument and operates on the connected main project. Database modifications must use that tool; applying SQL through a sandbox script would bypass this restriction. The integration was not reconnected, and the main-targeting tool was not called as a substitute.
- Applied migration IDs: none. Main/test schema-version equality: unverified. Auth users/accounts created: zero. Seed loads and signed-JWT RLS/crisis tests: zero. Policies opened: none in either project. Full unit/public browser suites were not run at this pre-migration stop; no application code changed.
- Evidence: `docs/rls-evidence/phase2c-test-project.md`. Resume requires an approved migration mechanism capable of targeting the separate test project while leaving the app's main integration unchanged.
- **Reserved for 2d:** full domain repositories, server/registry write transport, signup matching parity, signed-copy file storage and persistence switches. Include tables for the new Didn't-start-care lifecycle state and Getting-started need confirmations; neither is implemented here.
- Persistence stays OFF; no publishing, Lovable Cloud, GitHub linking, lifecycle edits or database modifications occurred.
