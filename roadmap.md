# Roadmap

## 28 Oct 20:23 access rules part B continuation (Draft)
- [ ] Tighten MOUD care-manager self-only assignment/replacement; SQL mirror and same-transaction end/retain proof; green units.
- [ ] Step 2 coordinator request/coverage/weekly review hosts; green units.
- [ ] Step 3 Intake logged read-only 60-day host; green units.
- [ ] Step 4 access-log reasons and full gate verification; green units.
- [ ] Step 5 all-role rollback vectors and separately passing read policies.
- [ ] Step 6 public browser then preview readback, final reports/Draft matrix.
- [ ] Carry-overs: on-team HLOC therapist fixture; DEA controlled-substance prescriber checks.
- Persistence OFF; nothing published; Part 2 matrix unchanged; commands browser-revoked until 2d.

## 28 Oct credentialing as-of fix (Draft)
- [x] Exclusion screening judged as of booking time; DOS mode for billing readiness; tile shows checks due before booked visits; relative seeds; tests + re-pins; units 3,599/3,599.
- [ ] Public browser 52/53: websiteSignup5 HLOC test hits the access-rules reason gate — resolve in the access-rules batch.

## 27 Oct access rules — 28 Oct implementation (Draft)
- [ ] 28 Oct 16:32 approved resume: narrow superseded assertions/pins/snapshot, MOUD normal team membership, remaining hosts and rollback vectors, separately proven read groups; full units then public browser/readback. Stop on unrelated failures.
- [x] Narrow access/search assertions, three exact-one-change pins, sys_admin labels, ECM reason fixture and real outpatient MOUD team fixture; registry snapshot refreshed, all 73 changed rows reported.
- [ ] Blocked outside named re-pin scope: billingProjectionB3b therapist/sys_admin pin src/routes/clinician.tsx; existing embedded-gate delta violates that protected source pin. Do not change the pin or remove the gate without a scoped decision. Full units 3,583 passed / 2 failed; browser and new SQL acceptance not started.
- [x] Inventory shared app gates, SQL entry and rollback harness; identified the superseded mandatory-site rule and pre-data rendering gap.
- [x] Resolve Part 2 prerequisite: Mitch chose Keep existing exceptions; no-consent negatives target already consent-gated roles/classes.
- [ ] Finish shared gate/readback, coordinator review/request/coverage hosts and exact source-pin/assignment-fixture reconciliation; entry helpers reapplied, no previous-rule restore.
- [ ] Intake read-only 60-day packet/checklist logged hosts and authenticated day-60/day-61 proof; helpers reapplied, policies closed.
- [x] All-18-role chart helper rollback and physician reason-only specific-consent/revoke proof; all-public/auth counts equal, no fixtures retained.
- [ ] Complete on-call/coverage/supervision/group/patient/advocate and policy-level acceptance; open only passing groups — none opened.
- [ ] Resolve protected clinician-screen pin blocker (3,583 passed / 2 failed), rerun green full units, then public browser and UI readback; no browser retry while units fail.
- [x] Document failed rollback attempts, zero retained fixture counts, report, Draft proposed matrix and architecture stop rule.
- [x] Restore clean app/SQL boundary; restored units 3,583/3,583, 406 files, exit 0.
- [x] Isolated restored-app public browser 51/51, exit 0, 10.1 minutes, one worker, after units; build OK and Supabase linter clean.
- Persistence OFF; no TEST secrets/project, publishing, Cloud or GitHub. Phase 2d remains outside scope.

## 27 Oct credentialing — 28 Oct reconciliation (Draft)
- [x] Existing ehr-ext credential/enrollment records are the sole authority; self-registration removes module-load roster reads; roster NPI remains single-source.
- [x] Historical payer/service evaluator, stricter approved missing-data coverage, unchanged old assertions and exact-once reconciliation source ledger.
- [x] Registry dashboard verification/expiry/follow-up/enrollment, manual and Simulated monitor paths, ids-only block/unblock audits, count-only claim ingestion and urgent coordinator notices.
- [x] Existing preview-memory document capture labelled Simulated; no secure storage or Supabase changes.
- [x] Full units 3,583/3,583 (406 files), exit 0; then public browser 51/51, exit 0, one worker, no overlap.
- [x] Credentialing UI readback after public completion: enrollment saved/read back with one audit, OIG match → coordinator urgent item → acknowledgment; 1280/390, no overflow/page errors. Report docs/credentialing-report.md.
- Draft acceptance: county cadence/contracts, go-live permissions/compliance review; real monitoring and phase 5 secure storage remain outside scope.

## 27 Oct Supabase Phase 2c revised — main rollback access tests
- [x] Real-claims fictional fixtures for all 18 roles, patient and advocate; all public-table/auth counts unchanged after rollback; no TEST secrets.
- [x] 2,170 assertions; opened only own_work_sites and identity_lane after all-role positive/negative tests; failed/unproved groups stay closed.
- [x] Shared TS/SQL crisis-owner vectors 6/6 each; separate policy migrations; no routing/persistence cutover.
- [ ] Chart off-team/restricted-team rule decision — blocked by conflict with existing chart_entry; full packet/handoff, advocate composition, cross-org and identity decision acceptance remain incomplete (unported contracts).
- [x] Full units 3,544/3,544 then clean full public browser 51/51, one worker, nonoverlapping (initial 49/51, unchanged Diana 5/5); evidence phase2c-main-rollback.md and Phase 2 report.
- Phase 2d: repositories/write transport/signup parity/storage/switches; lifecycle state, need confirmations, invite tokens/contact verification tables.

## 27 Oct sign-up verification redesign — Draft
- [x] Invite link (hashed, 14-day, single use, rate-limited), reminders reuse it, pre-release timing, expired resend to contact on file, lost-contact review.
- [x] Not-invited: name+DOB, contact+channel, one code required; auto-match only on verified contact on file; paper code + last name + DOB; staff in-person PIN setup; passwordless sign-in option.
- [x] Referral "I'm not a robot" labelled Simulated (not a real check). Fixed paper codes containing U.
- [x] Units 3,538/3,538; public browser suite after units. Report docs/signup-invite-report.md.
- [ ] Mitch: confirm Draft settings; SMS/SMTP and CAPTCHA providers; Phase 2d tables.

## 27 Oct Diana public website first pass
- [x] Home order, shared mission/values, services, care wording and accessible menus.
- [x] Verified EN/ES at 1280/390, reduced motion; full units 3,523/3,523 then full public browser 52/52 (47 existing + 5 Diana), one worker, no overlap. Report: docs/website-diana-pass1-report.md; build OK.
- Supabase Phase 2c remains parked; no Supabase, TEST secrets or publishing.


## 27 Oct Supabase Phase 2c — blocked before migrations
- Historical test-project attempt; superseded by revised main rollback batch above. Test project remains parked/optional.
- [x] Retry safety preflight: all four TEST_SUPABASE secrets exist; test ref cguwotbbuyqzgmebckqy differs from main bnvukmpmwuhftvjpnwqi; test database ref matches test API ref. No values recorded.
- [ ] Apply Phase 1 + 2 + 2b migrations to test only and compare migration versions — blocked: available migration tool targets the connected main project and offers no test-project target. Shell-based database modifications are not permitted. Do not reconnect the integration or run the migration tool against main as a substitute.
- [ ] After migration-target blocker is resolved: fictional per-role signed-JWT accounts, store-driven seeds, positive/negative RLS and crisis-owner parity; open only proven reads in both projects.
- [ ] Full units, then public browser suite without overlap — not run at this pre-migration stop.
- [x] Evidence and Phase 2 report updated; no database/account/policy/application changes, publication or persistence cutover.
- Phase 2d only: full repositories, server/registry write transport, signup parity, signed-copy storage, persistence switches; tables for Didn't-start-care state and Getting-started need confirmations.

## 27 Oct referral-to-billable-patient lifecycle — Draft (continuation done)
- [x] Inventory all surfaces before UI edits (docs/referral-lifecycle-inventory.md; conflict section marked resolved).
- [x] Stage 2 administrative only; first care plan drafted after enrollment via a Today task with accept/edit/dismiss suggestions.
- [x] Registry actions for outreach/contact/identity/enroll/close and reopenable "Didn't start care"; peer contact allowed, enroll/close denied; Intake identity evidence required; Intake stays in its workspace.
- [x] Shared stage chip, record panel with readiness, My work Getting started, patient/Adel/advocate Getting started, funnel stages.
- [x] Units 3,523/3,523; public browser suite run after units; report docs/referral-lifecycle-report.md.
- [ ] Mitch/Christi: confirm Didn't-start reasons/owners, 90-day clock start and the credential proxy used for readiness.

## 27 Oct peer specialist referral follow-up
- [x] Approve peer sending through the shared narrow gate; trainee remains denied; no other grants change.
- [x] Update only peer website_referral_submit snapshot; consistency and adjacent denials; full units 3,514/3,514 then public browser 47/47 without overlap; staff regressions 4/4 including peer Intake readback.
- [x] Append verified results to docs/referral-submit-fix-report.md; build OK; no publishing or Supabase changes.

## 27 Oct staff referral submission fix
- [x] Narrow clinical-coordinator send permission; shared button/store gate and plain refusal; peer/trainee Draft note.
- [x] Website/referral consistency sweep; fixed Intake's public-principal link with staff dialog; staff saved/routed/audit proofs, public unchanged.
- [x] Full units 3,512/3,512 then public browser 47/47; new staff browser 4/4. Report docs/referral-submit-fix-report.md; build OK; no publishing or Supabase changes.

## 27 Oct Supabase Phase 2b — narrower finish (stopped at clean boundary)
- [x] 1. part2_tpo_single expiry: TS + SQL agree for the standard intake consent (purpose tpo): no end date; "until revoked"/"end of treatment" wording only. 8 shared vectors pass in TS and SQL (rollback). Treatment-purpose scope unchanged — decision for Mitch.
- [x] 2. Store-driven seed: scripts/generate-phase2-seed.ts runs the registry seeds and three intakes, migration retains 18 patients, 22 care-team rows, 18 enrollments, 3 signed part2_tpo_single, 9 referrals, packet docs/needs/checklist/handoff. All synthetic; build-time only.
- [ ] 3. Positive access scenarios on seeded data — moved to 2c: needs signed-in test accounts per role (auth users), which this batch did not create; all reads stay closed.
- [x] Validation: units 3,488/3,488, then public browser 47/47 (one worker, :8080).
- [ ] 4. Crisis-owner TS/SQL parity vectors — moved to 2c (not started).
- [ ] 2c (not started, as instructed): domain repositories, server/registry command transport, signup matching parity, persistence switches.

## 27 Oct Supabase Phase 2 — approved closed foundation
- [x] Install 26 synthetic-only closed tables and helper prototypes; after review keep all new reads/commands revoked pending complete parity. Persistence off.
- [x] 2,023 rollback assertions on main project; full units 3,479/3,479. Evidence and partial report written; no publishing, Cloud or GitHub connection.
- [ ] Full fictional suite/three retained intake seeds — store-owned database seed transport not implemented.
- [ ] Real repositories/server-registry commands and complete positive RLS/advocate/identity/handoff parity — implementation incomplete; do not enable.
- [x] Clean full public browser rerun 47/47, 12.4m, one worker; unchanged isolated landing rerun 5/5; build OK.

## 26 Oct Intake Phase B — dedicated referral adapters
- [x] B1 Intake-only form send/typed capture/paper attestation and status-only packet checklist; no ledger/history/disclosure grants. Existing typed forms require care-team review, not Intake renewal.
- [x] B2 Billing-owned eligibility request and coverage-only readback; no Intake result entry. Real Billing task and registry manual-check host.
- [x] B3 Validated referral/partner/packet SDOH projection and administrative handoff checklist only; exact source references rechecked.
- [x] B4 Referral-staging import and referral-owned restricted packet documents; original clinical importer denied. Clinical coordinator staging on existing referral queue.
- [x] B5 28 new boundary/privacy tests; real Intake capture/lock/unlock → Billing manual-check → Intake coverage readback, 390px no overflow/no page errors. FULL units 3,387/3,387 (393 files), exit 0; isolated FULL public browser 47/47, exit 0, 10.6m. Build OK; report: docs/intake-phase-b-report.md. No new broad-access stop; simulated storage/delivery, source attestation, non-transactional preview import and external-recipient ROI remain documented gaps. Nothing published.

## 26 Oct Intake Phase A — dedicated referral adapters
- [x] A1 First-of-kind indicated booking and attributed clinician-approved group requests; no general booking/reschedule/details. Conflict refusals contain no other clinician/visit details.
- [x] A2 Administrative checklist completion, active-roster scoped assignments, existing Today tasks and read-only header care team.
- [x] A3 Linked crisis wrapper and source-keyed pre-chart triage with tier owners, receipts only for Intake, confirmed later chart linking. No on-call defined: explicit clinical-coordinator fallback gap. Source ingestion uses clinical-only structured capture; no private-answer scanning.
- [x] A4 Four real-store demo referrals; allowed/adjacent-denial tests; FULL units 3,359/3,359 across 392 files; FULL public browser isolated 47/47, exit 0, 12.9m. Build OK; real UI booking/completion/clinical triage verified. Report: docs/intake-phase-a-report.md. Nothing published.
- Historical Phase B deferral superseded by Phase B authorization and implementation above. Do not publish.

## 26 Oct Intake responsibilities — scoped restoration
- [x] Verify seven responsibilities against existing stores and Part 2 gates; findings in docs/intake-scoped-responsibilities-stop.md.
- [x] Historical stop superseded by Phase A: patient-independent triage and separate booking/group/completion/assignment/escalation boundaries built without broad grants. Importer staging and paperwork/eligibility/SDOH remain intentionally deferred to Phase B, not an open Phase A task.
- [x] FULL units 3,340/3,340, 391 files, exit 0.
- [x] FULL public browser clean rerun 47/47, exit 0, 13.3 minutes; first run interrupted by the command limit (31 checks passed, not a completed suite). No timeout/retry changes or publication.

## Daylight v2 batch 4b — remaining public pages
- [x] Cost, grouped FAQ, role-only Team, Partners, Platform, Privacy, Careers and Contact with bilingual copy and shared motion/template.
- [x] Referral three-step presentation; all fields, final validation, advocate URL and robot/store/delivery path preserved. Existing preview storage is not encrypted: public claim corrected, no transport implementation added.
- [x] Platform capabilities/status flag; preview-only careers/contact registry inbox and résumé metadata validation.
- [x] Final units 3,297/3,297; 4b/polish browser 9/9; existing public suite 11/11 and 4a 6/6; intake repeat 3/3 after focus-click correction; no-JS visibility all nine pages. Report: docs/daylight-v2-batch4b-report.md. Nothing published.
- Follow-up blockers: persistent authenticated intake backend and encrypted referral storage; counsel notice/contact and clinic details; native-speaker Spanish review.

## Daylight v2 batch 4a — shared pages and directory COMPLETE (prototype)
- [x] WebsitePage/JourneyPage, four journeys, How it works and About with bilingual copy and shared ReadyBand.
- [x] Public accessor shares managed records; showOnPublic/county editor, verified/demo/URL filters and anonymous registry reports in existing review workspace.
- [x] Patient /resources and gates unchanged; public directory menu/footer/Adel links use /directory.
- [x] Full units 3,277/3,277; new browser 6/6; existing public/admin browser 28/28; final landing 5/5. EN/ES phone/desktop, Axe and real admin-to-public/queue flows verified. Report: docs/daylight-v2-batch4a-report.md. Nothing published.
- Hosted persistence remains a backend-phase follow-up: existing CMS/resource store and public reports are local preview memory, with Simulated report labels.

## Daylight v2 batch 2 — landing page COMPLETE
- [x] Thirteen specified bands implemented (footprint hidden), configurable hero and manual journeys.
- [x] Scripted public Ask Adel with safety/privacy precedence, no raw text retention and anonymous intent counters.
- [x] /directory public placeholder added without touching patient /resources; legacy anchors retained.
- [x] EN/ES desktop/phone, keyboard, crisis clearance, Axe and reduced motion verified; full units 3,260/3,260, public browser 27/27. Report: docs/daylight-v2-batch2-report.md. Nothing published.

## Daylight v2 batch 1 — shared public shell COMPLETE
- [x] Rebuild public header, click mega-menus, phone sheet, fixed 988 bar and footer using existing tokens.
- [x] Preserve existing content and access boundaries; add twelve missing public destinations and auth/start crisis coverage. Existing `/resources` retains its member shell; public directory reclassification is outside this public-only batch.
- [x] New menu/focus/crisis tests and 1280/390 EN/ES, keyboard, Axe and reduced motion verified; public presentation tests updated for new menus/aside/2026 footer. Full units 3,063/3,063; public browser 22/22.
- [x] Architecture and validation recorded in docs/daylight-v2-batch1-report.md; evidence saved. Nothing published.

## Batch SL (Mitch approved, Oct 24) — COMPLETE
Original rollback: `0eff6798065e7362df8141759a99463e06005c9c`; Shorten, else move step rollback: `1b8717718da5c27256905e50388e0edd51e307ee`. Nothing published.
- [x] Bilingual integration labels, all 15 simulated flags, audit contracts, approved exact-once adapter ledger.
- [x] Mitch-approved batchBIntake literal-ID-only edit and accepted 13/13 proofs; historical stops and two missing-E2E_BASE_URL launches documented.
- [x] Scoped staffNewAudit8a2 timeout approved Oct 24; inventory investigation no-change outcome retained. Named inventory exception is timeout only.
- [x] Shorten, else move: shortened text alone still 873 > 844; approved phone-only placement after billing-kpis passes all 10 dashboard cases plus denial case; label checks pass 4/4. Existing tests/config unchanged except approved this-session label text.
- [x] Restart → full units 3,037/3,037 → full browser via setsid :8080 one worker, literal EXIT 0, 228/228 (42.0m); log/results immediately preserved; no flake exception used.
- [x] Exactly one billing label verified at phone/desktop; summary bottom 815 at 390×844; desktop label placement unchanged.
- [x] Restored 17 screenshots; all 248 rollback image assets byte-identical to 0eff6798. Report, changed-line ledger and evidence complete; final managed SHA read for closing response.

## Done
- B2 consent model (B2-1 … B2-6, B2-5 migration with system actor) — COMPLETE, final SHA c421de0a, browser 224/224. Follow-ups recorded: backend-phase typed-writer conversion; "advocate_release has no gate reader; decide in backend phase".

## Friday cleanup batch (Mitch approved, Oct 23) — COMPLETE Oct 24
Rollback: 9ddf890f292d97976fa34c042169eea200de99d1 (recorded first). Do not publish.
- [x] 1. Patient-name sweep and NEW label-pinning test; all requested surfaces traced. Identity comparison exceptions retain existing gates; dictation renders no name. See closeout table.
- [x] 2. Standalone-claim stored service date and local-calendar rendering corrected; NEW regression tests; no rate, rule or claim-state change.
- [x] 3. staffNewAudit8a2 investigation recorded with evidence provenance; timeout unchanged and byte-identical to rollback. Mitch owns any later timeout decision.
- [x] 4. Demo-only inventory documented, including every scenario and 16 flags (15 simulated; in_facility is off-by-default, not simulated). No code changes for inventory; unverified label coverage is explicit.
- [x] Validation: restart/full units previously accepted (3,003/3,003); full browser rerun alone --workers=1 on :8080: 224/224, 44.5m, literal EXIT 0; 17 screenshots restored and all 265 rollback images byte-identical; report and adapter ledger saved.

## Follow-ups outside this batch
- Backend phase: convert live untyped consent writers to typed records.
- Backend phase: "advocate_release has no gate reader; decide in backend phase".
- staffNewAudit8a2 timeout was unchanged in Friday cleanup; Mitch approved the scoped change Oct 24 in Batch SL (applied and fully validated).

## Daylight v2 batch 3 (motion)
- [x] Motion layers 3,7,8,9,10,11,13,14,17,18 + ray clipping, reduced-motion stills, tests
- [x] /faq and /cost use shared FAQ motion with batch 4b content.

- [x] Correct HLOC required-element capture; store negatives and actual blocked Send → capture → Send browser proof passed.
- [x] Website batch 5 preview: five steps, record codes, simulated verification, private duplicate handling and coordinator review.
- [x] Website batch 6 preview: simulated sign-in/reset/help; demo patient and staff routing browser checks passed.
- [x] Seven regression fixes: exact-once EHR adapter covers signup only; role adapter covers explicit intake/additional-role deltas; public actions use named PUBLIC_WEBSITE_ACTIONS allowlist. Final full validation recorded below.

## 26 Oct decisions (Mitch) — COMPLETE (preview)
- [x] Identity review store: five types; intake/sys_admin reviewers, clinical coordinator view-only; candidate and Part 2 guards; reasoned IDs-only decisions and confirmed claim codes.
- [x] signupMatch: public_unverified referrals never auto-match; publicReferralResembles added.
- [x] signupStore: review cases now create Identity review items (not coordinator case tasks); code lockout item; referral claim-code path in claimCode; worklist signup-review block removed.
- [x] Registry identity-review decisions (reviewer-only, Draft check label); explicit public-action allowlist and scoped permission snapshot updated.
- [x] Family/friend/self optional DOB, unknown checkbox, approximate age and identityConfidence; professional validation preserved.
- [x] Identity review/account support routes and Your-turn count badges; separate account-support permission retained.
- [x] Primary/additional held roles, audited sys_admin management and demo persona; acting-role-only permissions.
- [x] Initial narrow intake workspace (superseded by Phase A above): generic clinical navigation/tasks, chart grants, consent, eligibility, clinical SDOH and pre-release access remain denied; dedicated Phase A referral adapters are exceptions only to their own actions.
- [x] Item/lane/privacy/action and denied-clinical-access tests; actual reviewer decision and coordinator read-only flow checked.
- [x] Final FULL units: 3,340/3,340 across 391 files. FULL public browser: 47/47, one worker against :8080, 13.8 minutes; no timeout changes. Earlier overlapping-edit browser run was 45/47; clean final run passes both affected checks. Build OK. No publication.
- Preview limitations: identity/account-support/sign-in remain simulated/local-memory; account-support page is an empty separate queue, not a live reset service. Hosted persistence, real authentication/delivery and native-speaker Spanish review remain outside this batch.

## Group requests and join rules (26 Oct, Mitch) — preview
- [x] Per-group audiences, join rule, type-owned requirements, billable flag; roster editor on /group-sessions.
- [x] Patient Groups list: Join / Ask to join / Requested; clinical and Part 2 items never named; EN/ES.
- [x] Routing to care manager + clinician, Intake / clinical coordinator fallbacks; Today tasks.
- [x] Decisions: Approve and add, Not right now, Needs something first; portal message each time.
- [x] Care-team on-behalf requests share the request item; Intake path unchanged.
- [x] Patient self-sign for group confidentiality / telehealth consent — decided 26 Oct evening, built.
- [x] Open groups without care-plan eligibility — decided 26 Oct evening (open + non-billable only), built.
- [x] Validation: FULL units 3,399/3,399 (394 files); FULL public browser 47/47 (9.5m, one worker, :8080). Nothing published.

## Eligibility for every coverage path (26 Oct, Mitch) — preview
- [x] One request type with eight paths; county programs, payers, fee schedules, sliding tiers, re-check cadence are configuration data.
- [x] Billing processing per path: adapter check (manual / simulated vendor / clearinghouse stub / external-billing seam), insurance details, self-pay, sliding-scale tier, application assistance, path determination, primary/secondary + COB, re-verification tasks.
- [x] Intake and care-team coverage-only projection (path, status, checked, next check); patient summary ready, not mounted.
- [x] Clearinghouse Simulated and disabled by default; switch on by configuration only with BAA + vendor + credentials setting.
- [ ] Approved sliding-scale tier table and fee schedule — waiting on finance sign-off (Draft placeholders in place).
- [x] Validation: FULL units 3,422/3,422 (395 files); FULL public browser 47/47 (10.8m, one worker, :8080). Nothing published. Report: docs/eligibility-paths-report.md.

## Schema plan + 26 Oct evening decisions (Mitch) — preview
- [x] A. Write docs/supabase-schema-plan.md with review changes (no tables)
- [x] B1. Patient self-sign: group confidentiality + telehealth (+ B6 in intake packet)
- [x] B2. Open non-billable groups skip care-plan eligibility
- [x] B3. Safety scan of sign-up / public referral free text
- [x] B4. Every care manager has a calendar; addStaffMember default hours
- [x] B5. On-call duty schedule + resolveCrisisOwner + admin screen (Draft)
- [x] B6. Standard Part 2 TPO consent at intake (Draft)
- [x] Validation: FULL units 3,444/3,444 (396 files); FULL public browser 47/47 (13.0m, one worker, :8080). Nothing published. Report: docs/decisions-26oct-evening-report.md.
- [x] Record-class count: Mitch confirmed 27 Oct that roles.ts is authoritative: 44 classes (41 predates three additions).
- [ ] On-call owner and SMS/SMTP provider — waiting on Mitch/Diana.

## 27 Oct Supabase Phase 1 — approved foundation
- [x] Foundation 20 tables/RLS/helpers, generated 44 × 18 grants and synthetic reference seeds; existing connected project only. DB/code checksum equal.
- [x] Off-by-default repository scaffolding, Beta banner and SQL-audited agreement; memory remains default. No persistence cutover claimed.
- [x] Rollback-only main-project RLS/helper checks 2,261/2,261; SQL and TypeScript consent vectors 17/17 each; evidence in docs/rls-evidence/.
- [x] Full units 3,465/3,465; report docs/supabase-phase1-report.md; build OK. No publishing.
- [x] Full public browser suite — isolated unchanged rerun 47/47, exit 0, 10.3m. Initial 46/47 Axe context/reload interruption retained in evidence; no test/config/timeout changes.
- [ ] Beta first-sign-in end-to-end — blocked by zero hosted auth users/provisioned accounts and later real-auth transport.
- [ ] Second test project — credentials not yet supplied; main tests roll back.
- [ ] Consent create/frozen signed-copy persistence — blocked by trusted file/signature transport; persist_consent stays off.
- [ ] Registry-driven domain cutover/staff patient RLS — blocked by Phase 2 care-team/chart context and trusted mutation contracts; all persist_* stay off.
- [x] Re-pin clinician.tsx (access-rules adapter); full units green 3,585/3,585
- [x] MOUD episode → care-team registry write + SQL mirror + rollback proof (part B step 1; units 3,604/3,604)
- [ ] Part B steps 2–6: coordinator hosts; Intake 60-day host; access-log reason + gate on every route; all-role SQL vectors + per-group policy opens; units, browser (incl. HLOC fixture), preview readback, final docs; DEA carry-over
- [ ] Coordinator hosts, Intake 60-day host, access-log readback, gate verification
- [ ] All-role SQL vectors, open passing policy groups, browser suite, preview readback, final reports
