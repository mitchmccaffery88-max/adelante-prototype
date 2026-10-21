- [x] Content Download / Load my changes (/admin-content). Open: runAction permissions snapshot needs Mitch's decision on the 2 new action lines per role.
- [x] Read-only content inventory export (scripts/export-content-inventory.ts) for Cathy's audit template.
# Roadmap

## B3b — Billing privacy narrowing (Oct 21) — BEHAVIOURAL TEST STOP
- Rollback: b1d3c414de160babe95c541483a610853cb3e076; B3a accepted 2409b85c
- [x] Inventory and old-test stop checks; asam allowed block / permission snapshot byte-identical to 2f56b883
- [x] Mitch delegated approval: exact /billing selector adapter only; preserve all other inventory bindings.
- [x] Second-stop delegation approved: NEW OpsWorkspace-only exact-once adapter for three declarations; all other inventory bindings pinned.
- [x] Third-stop delegation approved and applied: exact-once OpsWorkspace and billingWorkspace adapters; every other byte/inventory binding pinned; projection/group/signature/name boundaries complete.
- [x] Original workspace computations reused with safe coverage rows; every list ID/order/count/reason matches for billing and billing_coordinator on default and B3a seeds under pinned clock.
- [x] NEW projection privacy units 5/5, lifecycle privacy browser 3/3; clinician / sys_admin selectors/workspaces and shared clinical sources unchanged.
- [x] Restart → full units 2,900/2,900 EXIT 0 → exclusive full browser :8080 --workers=1, polled to literal EXIT 1: 216 passed / 1 failed (41.3m).
- [ ] BLOCKED: e2e/staffSlowLoadLanding8c2.spec.ts:31 failed once in the full suite (0 nav_access_denied audits). Mitch-directed diagnosis: 3/3 PASS standalone on current code (:8080) and 3/3 PASS on rollback b1d3c414 archive (:8090); no B3b-changed module is imported on the /case-manager → /worklist path (PageNewLauncher → DashboardActionLauncher, not Ops*). Full evidence in docs/b3b-billing-privacy-report.md. STOPPED; awaiting Mitch's decision (audit assertion, not on flake list).
- [x] Rollback screenshots restored byte-identically; report implemented field table, exact adapter lines and behaviour stop documented.
- [ ] Final successful closeout SHA awaits resolution of the behaviour-test blocker; current checkpoint reported separately.
- Narrowing only; no publishing, reconciliation/export/denied-look/rule/permission changes; stop on workflow or existing-test conflict.

## B3a — Seeded end-to-end claims (Oct 21) — COMPLETE
- Rollback / starting HEAD after DMC and its docs: 2f56b883487b7d927a7c63d080bfc14459173a40 (DMC source checkpoint 615a3ac8)
- [x] Inventory public lifecycle APIs and billing payloads with file:line in docs/b3-claims-report.md
- [x] Mitch decisions: retain financial reconciliation and county exports; stable keys resolve generated IDs; partial receipt keeps state; paid has no insurer remittance ledger; one action.succeeded plus one claim_status_changed
- [x] Separate QA scenario and NEW lifecycle tests; default seed unchanged; focused UI walkthrough 3/3
- [x] After all edits: restart → full units 2,895/2,895 (360 files) → exclusive full browser --workers=1 on :8080, background-polled to literal EXIT 0: 214/214 (38.0m), no exceptions
- [x] Restored 17 tracked screenshots; all 246 rollback images byte-identical; evidence and report finalized; B3b remains separate
- B3b next: clinical-subgraph-free billing projection; group-topic/other-attendee removal; billing-safe signature status; /admin-claims name policy. Standalone service-date observation deferred.
- No publishing; billing rules, rates, states, permissions, denied look and P1/P3 unchanged.

## DMC Date-freeze batch — COMPLETE (Oct 20)
- Rollback / starting HEAD after P3 and its docs: 66bc81a63aef1b021fa22a1ce246f25b5aa668fc
- [x] Mitch-approved test-local hoisted Date-only freeze in dmcOdsReadiness.test.ts; restore real timers afterAll; no assertion or production changes
- [x] External 2026-10-20T14:02:00Z collision-clock harness: 8/8 on three consecutive runs; test-local clock confirmed 2026-09-29T15:00:00.000Z; current clock 8/8
- [x] Full unit suite 2,893/2,893 (359 files), EXIT 0; DMC file 8/8; no browser run (test-only change plus requested roadmap/report)
- [x] DECIDED: keep CalAIM Your turn chip for ≥1 eligible discharge even below 11; count remains <11; no code change
- Next: seeded claims. Nothing published.

## Privacy P3 — COMPLETE (Oct 20)
- Rollback 8ce8a6343e53917d7473af94e2006583c9e342b7
- [x] 1 Patient-name policy (incoming events, TaskQueueCard, OpsWorkspace, quality-compliance + other surfaces); ~20 untraced surfaces listed for later
- [x] 2 Referrer types/updates/authorization/SUD hold/audit + disclosure log; DECIDED: authorized non-covered gets "enrolled on <date>" only
- [x] 3 sys_admin de-identified reporting aggregates (consent-only SUD, <11)
- [x] 4 Production bundle hook-free + NEW test; demo-only exposure list
- [x] 5 Emergency "End access now"
- [x] Approved e2e/access.spec.ts:24/:50 program-ID selection; standalone 1/1
- [x] Units 2,893/2,893; FULL browser 211/211 EXIT 0; screenshots restored; report complete
- Next: DMC Date-freeze batch, then the seeded claims. Nothing published.

## Phase 9c-2 — COMPLETE (Oct 20)
- Rollback aff263ff1aa707d68994b7f175f83aa9d09306fd (9c-1 accepted b15085a8)
- [x] Existing role-home actions/summaries regrouped; gates, values, suppression, testids, handlers, denied look, patient screens and crisis banner preserved
- [x] Accepted NEW scroll-region fix and PRE-EXISTING presentation-only axe fixes; rollback archive :8081 classification; all ten current home/viewport scans clean
- [x] Accepted new billing-on-/admin denial correction retains denial plus zero admin tiles
- [x] Pinned clock/seed/sweep rendered parity: all five roles' visible-testid inventories and every tile value byte-identical; no remaining differences
- [x] Units 2,857/2,857 (353 files); new dashboard spec 3/3 standalone (11/11 each)
- [x] FULL background one-worker browser suite on :8080, polled to literal EXIT 0: 211/211, 31.0m; last validation step; no flake exceptions
- [x] Restored 17 tracked screenshots vs rollback; 223 rollback image files byte-identical; new evidence preserved; docs/phase9c2-report.md complete
- DMC pre-import Date freeze approved Oct 20; separate batch tracked above; no publishing
- Next: finish Privacy P3 (approval for access.spec.ts:50), then the DMC Date-freeze batch

## Phase 9c-1 — COMPLETE (Oct 20)
- Rollback 1e410aad83903e2950d62031329ff42b3ff18033; starting HEAD 89e1b1bdc87041e9fa982502325a24ad753e63aa
- [x] Approved fixture field `occurrencesRecorded` in suppression9a2 + statTileParity9a2 (both attendance objects; no assertion changes)
- [x] Overflow: case-manager grid min-w-0/grid-cols-1 + table scroll wrapper, billing header stack/wrap, admin grid min-w-0 + StaffTable scroll wrapper + VendorStatusCard header wrap; before numbers in docs/phase9c1-evidence/before.json (case-manager 1,104@768, billing 441@390, admin 426@390 + 1,330@1280)
- [x] Roster mouse lock: StaffTable More menu defers onSelect to next tick + onCloseAutoFocus guard; live browser flow passes
- [x] Chart colors: RecordTabs/LabsAndMeasures onto chartTheme tokens (single, axis, series 1/2, grid)
- [x] NEW tests e2e/overflow9c.spec.ts (9/9) + chartColors9c.test.tsx (8/8)
- [x] Approved staffTables8b2.test.tsx:34 async + `await vi.waitFor(() => expect(writes).toBe(1))`, default timeout; no further test edits
- [x] Accepted Next-page app fix: remove inner table wrapper, scroll existing StaffTable container, sticky saved views/pagination; pre-fix current failed 3/3, rollback passed 3/3, fixed inventory + overflow passed 3/3
- [x] After widths: all 24 checks equal viewport; 12 light/dark chart captures retained
- [x] Units: previously 2,836/2,838 with the approved PRE-EXISTING DMC pair; fresh read-only full run 2,838/2,838 (352 files). Date-pinned diagnosis reproduces the pair at 14:02 UTC; see report
- [x] FULL background browser suite --workers=1 on :8080, polled to literal EXIT 0: 200/200, 29.0m; no flake exceptions
- [x] Restored 17 screenshots vs rollback; 194 rollback images byte-identical; docs/phase9c1-report.md complete; validated source SHA ffcccdf3bbec2e06e96d87b21d7b2d398640640a (managed closeout SHA reported separately)
- [x] Mitch approved DMC readiness pair setup-only pre-import Date freeze Oct 20; separate batch tracked above; no billing/medical-necessity logic changed
- Next: Phase 9c-2 — complete; Privacy P3 next. Nothing published.

## Phase 9a-3 — COMPLETE (Oct 20)
- Rollback / starting HEAD 7c834669d4f2811e28dac8b50090906873b9b8ad
- [x] /billing Outstanding, Paid, Drafts/write-offs on StatTile; Denied card + denied chip unchanged
- [x] BillingStatusSummary icon + word per status (Denied unchanged)
- [x] Weekly paid / submitted sparklines (src/lib/billingSparkline.ts, read-only)
- [x] County cards on StatTile, Simulated kept; quality-compliance tokens
- [x] NEW tests billingParity9a3, billingSparkline9a3, e2e/statTiles9a3; 36 evidence captures
- [x] Units 2,830/2,830 (351 files)
- [x] Full browser suite 191/191, EXIT 0; 17 screenshots restored (0 diffs); final SHA 1e410aad83903e2950d62031329ff42b3ff18033
- [x] Mitch DECIDED: CalAIM chip stays visible for ≥1 eligible discharge below 11; count stays <11
- Pending Mitch: type-only errors in 9a-2 test files (no edit without approval)

## Phase 9a-2 — COMPLETE (Oct 20)
- Rollback 2c463a96f657306af2a3dc4fcf72eb9b39d84cad; starting HEAD 2628d52c860253c0d2f074fcdcf0f4b4033cf55e
- [x] /admin KPIs + group activity, CalAIM, group utilization, engagement, /reporting tiles, PopulationHealth, TimelyAccess, catalog metrics on StatTile / "<11"
- [x] NEW tests statTileParity9a2, suppression9a2, e2e/statTiles9a2; 30 evidence captures
- [x] Full units 2,817/2,817 (349 files)
- [x] Full browser suite 187/187, EXIT 0; 17 screenshots restored (0 diffs); docs/phase9a2-report.md final
- Next: 9a-3 — complete (see above).

## Phase 9a-1 — COMPLETE (Oct 20)
- Rollback 7c0e871520e0a2eb6b8a29ed604e4e2cefa385f3; starting HEAD 193c406f54a7604b8ac2dab8d42106f1efcc585e
- [x] StatTile and KPI conversion, unchanged selectors and caller access; real weekly MAR/attendance projections only
- [x] NEW suppression/member-boundary/projection/rollback parity/browser tests; existing assertions untouched
- [x] Six light/dark 390/768/1280 section captures; full units 2,798/2,798 (347 files), then full background one-worker browser suite to EXIT 0: 182 passed, 0 failed (31.2m)
- [x] Restored 17 regenerated rollback screenshots; 120 inspected, zero byte differences; retained six new evidence images
- [x] Final docs/phase9a1-report.md; final managed SHA reported in chat
- Next in sequence: Phase 9a-2 — not started, awaits its batch authorization
- No publishing, 9a-2/3 or permission/privacy changes.

## Privacy P2 — COMPLETE (Oct 20)
- Rollback c5c3da6af29fc6ed3a3064d84f7b9b9654c7fe28; original starting HEAD 14fe8a744a3cb730390e39447f84b78fd3d5f054
- Closeout starting HEAD / validated source checkpoint 3874f3859cfff66622b38cc4c4c73b1678679919; final managed closeout SHA reported in chat
- [x] Consent/release and B-only gates; emergency registry/dialog/audit/disclosure/review/four-hour expiry; view audits
- [x] Search/export/AI boundaries; dev-only test API documented; med/MAR print sections unchanged (B is a ceiling)
- [x] Approved snapshot-only addition (17 hidden keys; other entries byte-identical); approved counseling fixture distinction plus standard-note consent assertion
- [x] NEW unit/surface/live emergency tests; full units 2,775/2,775 (344 files)
- [x] Prior browser process/log unavailable: reran FULL suite before edits, background --workers=1 on :8080, polled to EXIT 0: 180/180 passed, 0 failed (31.4m); no flake exception used
- [x] Restored 16 regenerated screenshots; all 20 rollback images byte-identical; kept new e2e/screenshots/p2-emergency-unlock.png evidence
- [x] Final docs/privacy-p2-report.md with exact per-role before/after table; only clinical_coordinator gains access
- [x] Next in sequence: Phase 9a-1 separately authorized Oct 20; work tracked above
- Scope closed: no publishing, unrelated widening or 9a implementation.

## Privacy P1 — billing minimum-necessary, self-tracking, SUD cards, AI inputs (approved Oct 19)
- Rollback SHA f8a650cfdc77ff6a3c2bbaadfc243bef87ed92ba
- [x] Inventory: billing reach, self-tracking readers, SUD cards, AI summary inputs, coordinator consent/note/emergency model
- [x] Source narrowings + new tests (src/lib/__tests__/privacyP1.test.ts, 15/15)
- [x] Coordinator state-reporting ownership, My Work missing-viewer denial, emergency disclosure reason retention
- [x] Four stop-item decisions received; both booking cases fail identically on isolated rollback (2 failed / 2 selected)
- [x] Approved initial booking setup and export repairs; coordinator worklist success assertion
- [x] Approved destination setup repair (cleanupReschedule 6/6)
- [x] NEW owner/disclosure-audit tests (privacyP1Owner.test.ts 4/4); full units 2,757/2,757
- [x] Full browser suite ran to EXIT: 178/179; screenshots restored (0 differ)
- [x] Delegated confirmation: unchanged therapist staffNewAudit8a2.spec.ts:29 passed 3/3 (24.750s, 22.812s, 22.203s); historical individual durations unavailable; 0 screenshots differ from rollback
- [x] P1 COMPLETE: units 2,757/2,757; full browsers 178/179 with sole timeout accepted by Mitch after 3/3 standalone passes; final report docs/privacy-p1-report.md
- [ ] Follow-up: investigate slow therapist New-menu audit test (~25s near unchanged 30s limit); no timeout/retry change authorized
- Scope: no publishing, 9a, 9c or P2 in this continuation.

## Phase 8b-3 — Billing, claims, admin, reference and audit tables (approved Oct 17)
- Rollback SHA 649459806dd45b19214130247becf5871e83d34d
- [x] Pre-edit inventory (source, filters, hidden rows) per table
- [x] Convert billing/claims tables; denied claims keep today's look; money byte-identical
- [x] Convert audit tables (read-only, no new exposure)
- [x] Convert admin/reference tables
- [x] New unit + browser specs (row/amount parity, non-billing denial, axe)
- [x] Full unit + full browser suite last; screenshot matrix; report
- [x] Phase 8 table track done Oct 17 (8b-1, 8b-2, 8b-3): docs/phase8b3-report.md
- Scope stop: no publishing, no Phase 9.

## Phase 8b-2 — Remaining staff tables (approved Oct 17)
Rollback: 064533e3ba01fd425d1a66959495ef49a7f27406
- [x] Record all active target row sources, filters, hidden-data rules and rollback projections before presentation edits
- [x] Convert 26 table surfaces across remaining queues, content inventory, staff and credentialing; preserve gates, actions, dialogs, testids and byte-identical inventory export
- [x] New unit file (3 tests) and 4 area browser files (10 tests) with parity/role-exclusion/axe; existing tests untouched
- [x] Full units 2,696 passed / 2,696 listed (334 files); full background browsers 155 passed / 155 listed (40 files, 30.7 minutes), --workers=1 on :8080; 16 regenerated images restored, all 20 tracked hashes matched
- [x] Each converted table 390/768/1280 light/dark matrix: 156 captures reviewed; no table/document overflow or runtime errors; unchanged privacy gaps recorded
- [x] Phase 8b-2 complete Oct 17: docs/phase8b2-report.md; full suite green without using the contentWiring flake exception
- Scope stop: no publishing or 8b-3; unrelated open tasks remain outside this approval.

## Phase 8b-1 — Shared staff table pilots (approved Oct 17)
Rollback: e822105ffca551809487f2403bc60f728bfe8d9b
- [x] Record each pilot's source, existing hidden-data rules and rollback row parity before replacing presentation
- [x] One shared compact table: caseloads, eligibility worklist, notes queue and task queues; unchanged caller gates/handlers; empty saved views, unsaved task drafts across paging and selected-view stat parity verified
- [x] New sorting/paging/views/lock/keyboard units and pilot browser/axe coverage; existing tests untouched
- [x] Final full units: 2,693 passed / 2,693 listed (333 files); full background browser suite --workers=1 on :8080: 145 passed / 145 listed (36 files, 32.7 minutes); 14 regenerated screenshots restored, all 20 tracked screenshot hashes matched this turn's pre-run baseline
- [x] 390/768/1280 light/dark screenshot matrix: 24 captures reviewed; table widths fit all viewports; existing non-table case-manager overflow at 768 remains documented
- [x] Coordinator comparison: unchanged contentWiring spec passed 3/3 current and 3/3 rollback; app-only rollback restored afterward. No table-triggered role navigation found; original failure not reproduced.
- [x] Follow-up presentation: empty-state fallback, actor-scoped session-only task drafts across paging, selected-worklist statistics; both focused units passed in the full suite; UI row IDs and counts match unchanged rollback projections
- [x] Environment recovered: current source confirmed, no stash ref, supervised server restarted once; fresh notes table verified; standalone pilots 9/9. Previous diagnostic stop retained as history in docs/phase8b1-diagnostic-stop.md.
- [x] Phase 8b-1 done Oct 17: docs/phase8b1-report.md records parity, pre-existing flake, unchanged privacy gaps, validation totals and screenshot limitations
- Phase 8b-1 scope closed; Phase 8b-2 separately approved below, no publishing or 8b-3.

## Phase 6 — Emotion check-in (approved 14 Oct)
- [ ] Shared eleven-emotion flow, private dismissal, real-record choices and timer
- [x] Approved allowlist/snapshot and audiences-test setup corrections only
- [ ] Blocked on Mitch: contentBackup.test.ts:97 author restore expectation; group1Profile.test.ts:162 assignment-active expectation after goal closure. See Phase 6 report.
- [ ] Full units then every browser/axe, Spanish review exports and 390px screenshot
- [ ] Phase 6 report, architecture rules and final results

## Content audiences + Part 2 for authors (14 Oct)
- [x] Part A: content authors see Part 2 content (approved line staffContentCenter.test.ts:14)
- [x] Part B: "Who it's for" audiences, any-match; migration of 4 lessons + 2 journeys; no pre_release content stage
- [x] SUD triggers: care-plan SUD goal sets flag; AUDIT >= 8 / DAST >= 3 neutral staff task (Draft)
- [x] Editor checkboxes, inventory column/filter, export re-run
- [ ] Apply Mitch-approved contentBackup.test.ts:87-88 and group1Profile.test.ts:162 corrections; preserve other assertions

## Phase 5b — Draft member and public screen Spanish (14 Oct)
- [x] Re-check cfProxyMode and consentWorkflow twice before edits; classify staff-only gaps
- [x] Draft ordinary screen Spanish in tú; preserve authored and controlled content
- [x] Regenerate priority-marked review CSV and remaining gap inventory
- [x] Full units then all browsers/axe, one warm timeout rerun; 15 Spanish mobile checks
- [x] Report keys, exclusions, files and all validation results
- [x] Green browser contract: 5c approved Spanish selector lines; 79/79 browsers (Oct 14)

Report: `docs/phase5b-report.md` — 608 gap keys drafted, 72 staff-only keys dropped, 908 authored-content gaps, 1,611 controlled gaps; 79 files. Units 2,570 passed; browsers 74/79; cfProxy warm rerun 0/2; Spanish 15/15 at 390px. Dynamic expression English outside the original gap export is disclosed in the report.

## Phase 3 Part A — Safety-only red (14 Oct)

Report: `docs/phase3-red-cleanup-report.md` — build green; 2,568 units; final browsers 78/79 (English public language control duplicate-selector failure), previous complete run 79/79; settled contrast minimum 5.51:1.
- [x] Apply only inventory CHANGE / non-safety MIXED presentation treatments; preserve KEEP exceptions and member boundaries
- [x] Final inventory scan and complete file/location report
- [x] Full units, then every browser spec/axe; conditional single warm timeout rerun
- [x] Settled light contrast and requested 1280px/390px screenshots; report all failures

## Staff StatusChip — batch 2b-2 (13 Oct)
- [x] Operations-only status chips and two authorized care-work corrections; preserve exceptions, member views and test contracts
- [x] Harness build; full units then every browser/axe to completion; record all failures and conditional warm navigation rerun
- [x] Settled light contrast and 1280px claims/eligibility/credentialing/content screenshots; report files, chip counts and unmapped statuses

Validation: build OK; 2,561 units and 79/79 browsers (axe/Back to top) passed; 26 operations chip positions in 17 files plus two care-work corrections; settled light minimum 5.43:1. Exceptions and interrupted intermediate run recorded in docs/staff-statuschip-2b-report.md.

## Staff StatusChip — batch 2b-1 (13 Oct)
- [x] Care-work status-chip presentation applied in 40 application files (96 resulting chip render positions, including existing member positions); member boundaries, counts, selectors and 2b-2 files preserved
- [ ] Remaining defaults: authoritative pre-release MOUD confirmation/out-of-supply fields unavailable in shared display slice; exact escalation total-wait date unavailable (current dueAt caption is overdue age); see report
- [x] Harness build OK; final units 2,561/2,561, then all browsers 79/79 including axe/Back to top; authorized warm staff-nav rerun 22/22; initial eight browser failures recorded without test changes
- [x] Settled real-screen light chip contrast minimum 5.43:1; 1280px staff screenshots reviewed (cosign real empty state); exact files/results/default limitations in `docs/staff-statuschip-2b-report.md`

## Patient color pass — phases 2a + 4 (13 Oct)
- [x] Approved fixes and final member-system wrapping applied; Home grid/tiles shrink; ConnectMeButton copy unchanged; staff/public/icon-only styling preserved
- [x] Previous settled contrast EN/ES × light/dark × 1280/390 passed; final wrapped text spot-check 13.84:1 light / 14.80:1 dark; help 7.06:1 and lesson Continue 5.52:1 light
- [x] Final EN/ES 390px: Home/gold, My care, Schedule, longest lesson, advocate Home and medications all scrollWidth 390; reviewed screenshots; 11 lesson targets 48×48px
- [x] Staff navigation warm diagnostics 22/22 twice before edits: previous PMHNP/billing failures are timing flakes under load per Mitch rule; no guard/permissions/test changes
- [x] Final full units 2,561/2,561 (306 files), then separate browser suites staffNav 22/22, websitePolish 3/3 (axe/Back to top), patientPlayer 2/2; automatic harness build OK
- [x] docs/patient-color-pass-report.md updated with final files, evidence, contrast and counts; final focused checks complete

## Design system phase 1 (13 Oct)
- [x] Verify all six supplied SVG hashes before implementation
- [x] Apply approved fonts, global tokens, aliases and brand-link changes only
- [x] Render supplied artwork and verify image dimensions
- [x] Authorized mobile-only overlay fix; measured all hero labels above 4.5:1 at 390px, desktop unchanged; 140×40px logo fits
- [x] Full unit suite: 2,561/2,561 passed (306 files)
- [x] Approved Back to top visibility rule: past the lesser of one viewport or half the available scroll distance, never at scrollY 0; focus return, reduced motion and crisis clearance unchanged
- [x] Final full units: 2,561/2,561 (306 files), then all browsers separately: 79/79; axe EN desktop and ES mobile passed home/About/Team without serious or critical issues; no test assertions/retries/thresholds changed
- [x] Phase 1 complete: artwork, fonts/tokens/brands, mobile contrast, logo fit and full regression validation

## Public top-bar order (13 Oct)
- [x] About us and Our team moved to the end of the top bar and mobile menu: How it works · Find where you fit · What you get · FAQ · About us · Our team
- [x] Nav order tests updated (landingWebsite.test.ts)
- [x] Named the recurring unit flake: the mock e-prescribing adapter seeded a Sertraline order for any patient id ending in "1" or "a"; real ids are random, so demo personas and new sign-ups randomly inherited a prescription nobody ordered. Now an explicit allowlist (p1) with a regression test
- [x] Full units 2,561/2,561, then all browsers 79/79 separately; preview build OK

## Public heading correction (12 Oct)
- [x] Exact English Title Case section headings; Spanish and navigation/footer labels unchanged
- [x] Copy and heading-style regression tests updated
- [x] Full units 2,560/2,560, then all browsers 79/79 separately; preview build OK

## Public website polish (12 Oct)
- [x] W1–W2/W6 exact copy and bilingual updates with pinned tests
- [x] W3–W5/W7–W10 navigation, headings, About layout, mobile header, crisis clearance and back-to-top
- [x] W11 shared branded 1200×630 share image on all three public pages
- [x] W12 public accessibility audit/fixes; full units 2,559/2,559 then all browsers 79/79 separately
- [x] Polish typecheck confirmed by Mitch: zero errors
- [x] Previous pages typecheck confirmed by Mitch: zero errors

## Public pages and optional agency (12 Oct)
- [x] Optional referral agency, required referrer name, missing-agency display and regression checks
- [x] Separate About/Team pages, shared public layout, navigation and legacy redirects
- [x] Full units 2,558/2,558 then browsers 76/76, no simultaneous unit/browser runs
- [ ] Explicit automatic typecheck/build result unavailable; see public website handoff

## Public website (12 Oct)
- [x] W1 public-only branding and metadata; single placeholder logo
- [x] W2–W6 exact mission/team/fit/closing copy, bilingual navigation and legacy anchor
- [x] Landing EN/ES desktop/mobile checks (3/3 new browser tests); full units (2,555 passed)
- [ ] All-browser green and explicit harness typecheck confirmation: 67/68 in completed full run; existing Brief performance failure; later runs environment-terminated. See docs/public-website-handoff.md.

## Follow-up 9 Oct
- [x] F1 one advocate consent path  - [x] F2 c2 unfrozen  - [x] F3 screener-resume race  - [x] F4 onboarding→active advocate spec

## Consent workflow (9 Oct, Draft — pending counsel)
- [x] W1 form library  - [x] W2 send  - [x] W3 Forms to sign  - [x] W4 track  - [x] W5 store/retention/migration
- [x] W6 renew + revoke  - [x] W7 packet + group gate  - [x] W8 advocate forms  - [x] handoff doc

## Group 2 (9 Oct) — pathways, Part 2 fixes, contacts + advocate
- [x] G1 content gaps → content owner (journey owner, else owner pool)
- [x] G2 SUD journeys hidden from non-Part 2 staff + advocate tiers (fixed restricted plan view leak)
- [x] G3 group 1 browser walkthrough (e2e/group1Availability.spec.ts)
- [x] S1–S5
- [x] P1–P5
- [x] O1/O2/O4 onboarding contacts + advocate; [x] O3 staff contacts editor uses onboarding model

## In progress — Player and engagement (K1–K3, P1–P10)
- [ ] K1 registry content mutations + additive permissions snapshot
- [ ] K2 ASAM dimension tag interventions
- [ ] K3 production-served parallel browsers, warm-up, unchanged assertions
- [ ] P1/P2 animated breathing, exercise input persistence and toolkit summaries
- [ ] P3 session Simulated read aloud EN/ES, tap-only safety
- [ ] P4/P8 Home resume and today's action; unanswered confidence; toolkit preview/completion
- [ ] P5/P6 shared practice and grounding stepper
- [ ] P7 three-question Simulated Adel, crisis scan, tag links
- [ ] P9 patient theme/readability and architecture guidance
- [ ] P10 Part 2/private-text redaction
- [ ] Full units, harness typecheck, all parallel browsers, EN/ES/advocate walkthrough
- [ ] Content tables/search/editor preview: deferred by Mitch to next batch

## In progress — Content center + care/Adel/SDOH wiring (C0–C6)
- [x] C0 seeds load on any entry path; titles not ids
- [x] C1 baseline verification (59/60 — SMART Recovery has no phone), no patient badge, one resource store, verify stamps managed revision
- [~] C2 home digest, groups (Education/Recovery/Directory/Messages placeholder); full tables + side-drawer editor still to do
- [x] C3 tags/flags/ES status/reading level/owner/review date; Draft backfill; recovery lessons Part 2; check-in shows category only
- [x] C4 clinical/Part 2 need a different clinical reviewer; Spanish block + override reason
- [x] C5 live picker, deep links, auto-complete, tag suggestions in care plan, Adel chat (Simulated), needs; lessonRecommends + Adel lesson list on live content; coverage view
- [ ] Content edits through runAction registry (currently direct store calls + store audit)
- [ ] ASAM interventions read tags (still fixed ids)
- [x] C6 MAT seed at 2 days; screener drafts survive reload


## Done
- [x] Moved resource verification to Patient Content & Resources Center; retained verifier gates and published revision attribution, added filters/counts and verification provenance, restored coordination-first ordering with Reassign needed. All 2,406 unit tests pass and harness typecheck/build is clean; selected sequential browsers: 37 pass including the coordinator content walkthrough, calendar and continuity checks fail (stability/seed work remains deferred).
- [x] Section 6 item 3: cancel requests (patient/advocate), staff cancel with reason, no-show, late-cancel label (draft), ASAM task reopening, claim guard, reporting, demo data.
- [x] Advocate demo thread via upload → staff verification of a two-way HIPAA release.
- [x] Patient and advocate navigation correction: persistent desktop sidebars, phone left drawer, no user top-nav strips, and no staff-link leakage.
- [x] Sticky demo controls with neutral unselected QA label and protected-control spacing.
- [x] Pre-demo My Care consolidation: folded duplicate needs, appointment, weekly check, recommendations, and advocate status surfaces.
- [x] Consent-gated advocate invitation delivery with pre-consent privacy test and row-level failure feedback.
- [x] One positive-signal Recovery Journey rule across navigation, cards, recommendations, and direct route access.
- [x] Full typecheck, 1,696-test suite, persona browser inventory, advocate flow, Kayla billing flow, and referral attempt verification.

- [x] Dashboard Standardization Phase 5c — demo CINs, expandable My tasks rows with attributed edits/notes/follow-up, per-client follow-ups consolidated onto the record with a read-only open-items rollup.
- [x] Dashboard Standardization Phase 5a — Care Coordination naming, honest scope copy, dashboard cleanup, refusal queue, eligibility consolidation, and blank initial chart.
- [x] Dashboard Standardization Phase 5b — shared staff top bar with typed patient search (name/DOB/program ID/CIN) and persistent My Work count; chart tab reuses the same search.
- [x] Referrals Rework Phase 4b — consolidated duplicate referral tracker cards.
- [x] Referrals Rework Phase 4a — movable referrals, attributed disposition, honest welcome SMS.
- [x] Investigation: intake↔scheduling coordination + intake SDOH fidelity/handoff (reported).
- [x] Investigation: pre-release SDOH vs general intake duplication risk (reported).

## Paused (plan written, not approved)
- [x] Staff-initiated patient record creation (no login attached).

## Later phases (sequenced, not started)
- [x] SDOH prerequisites: intake↔AHC-HRSN need mapping table, `SdohPlanItem` provenance field.
- [x] Intake SDOH reconciliation against existing pre-release data.
- [x] Scheduling: patient-side conflict checks + appointment provenance.

## Referrals Phase 4c
- [x] Referrer status-change SMS (contact/enroll/decline)
- [x] Staleness badge on shared tracker (draft threshold)
- [x] Segmented referral form (justice-involved yes/no/unsure)
- [x] Advocate discovery prompt at enrollment

## Referrals Phase 4d
- [x] Standalone staff referral queue page (/referral-queue)
- [x] Repoint "Referrals" nav entry to the staff queue
- [x] Staff "submit on someone's behalf" via shared form in a dialog
- [x] Dashboard tracker cards kept, with link-through to the queue

## Referrals Phase 4f
- [x] First session requires a real attended appointment
- [x] Clinician assignment writes the real assignment audit entry
- [x] Enrollment creates a pooled care-team/intake setup task
- [x] Post-enrollment staleness (draft thresholds, per step)
- [x] Cross-patient "Needs setup" view on coordination + referral queue

## Referrals Phase 4e
- [x] Real manual-outreach task created when no welcome text can send
- [x] Outreach attempt trail with outcomes and attribution
- [x] Referrer-fallback prompt (no phone / dead number / 2 unanswered)
- [x] Honest form copy for "no reliable phone"

## Pre-Release Pipeline (episode→patient + CSV import)
- [x] Anticipated release date + custody state onto patient at episode open
- [x] redeemEnrollmentCode copies release date from the episode
- [x] markPreReleaseEpisodeReleased persists the confirmed date (episode + patient)
- [x] Honest `Patient.custody` field sourced from the episode
- [x] Intake/profile pre-fill with provenance + confirm step
- [x] /pre-release-import staff CSV upload (preview-first, row reasons, RBAC)

## SDOH Referral Thread Phase 5d-1 (consent + attribution)
- [x] Part 2 consent gate in the data layer for both referral creation paths
- [x] `sudDisclosureConsent` stamped from the patient's live consent (viewer-access bug fixed)
- [x] Generic restricted row (no category/provider/note) for Part 2 gated viewers
- [x] Attribution + audit on need and referral create/status changes

## SDOH Referral Thread Phase 5d-2 (needs <-> referrals, directory, outcomes)
- [x] `ResourceReferral.sdohItemId`; drop never-written `SdohPlanItem.referralId`
- [x] Refer action on a need; creating a referral moves the need to sent
- [x] Real directory picker (`resourceId`) + link state via referralLinks.ts
- [x] Off-directory referral (name + note), never writes to the directory
- [x] Seven real outcomes with reason + attribution
- [x] Connected prompts staff to resolve the need (no auto-close)
- [x] Materialize positive AHC-HRSN domains as real needs
- [x] Interpersonal-safety needs + their referrals default staff-only, warn before making visible
- [x] Remove the stale "Build 2" resource-library string

## Phase 5d-3 — SDOH activity log, follow-up tasks, aging
- [x] SdohLogEntry type + append-only writers on needs and referrals (audited)
- [x] Pre-existing single `note` shown as unattributed "Earlier note"
- [x] followUpDate UI + real CaseTask creation (origin sdoh_follow_up), honest no-case-manager message
- [x] src/lib/sdohAging.ts draft thresholds, last-action includes log entries
- [x] patientOpenItems: add open referrals + aging detail
- [x] myWork: sdohAging bucket for the assigned case manager
- [x] Shared SdohActivityLog component wired into SdohTab + ReferralsTab (Part 2 / safety respected)
- [x] Tests, typecheck, build, live browser both viewports

## Phase 5d-4 (final) — unified need thread, advocate referrals, reporting funnel
- [x] Patient unified need thread on /next-steps (+ home summary card, remove ReferralsForYouCard)
- [x] Closure message: "Resolved — {need}. Let your care team know if this comes back."
- [x] All new patient/advocate strings via i18n with Spanish marked pending bilingual review
- [x] Advocate referral status per tier in advocateCoordination + panel
- [x] Reporting funnel (identified → referred → connected → resolved) + barriers, cohort guard
- [x] Disengagement link: recommendation only, nothing built

## Phase 5d-4 (done)
- Unified patient need thread on /next-steps (one list; directory match inside each need card).
- Home summary card replaces the separate "Referrals for you" list.
- Advocate coordination now carries referrals per need, tier-aware Part 2 restricted rows.
- Social needs funnel + slices + barrier frequency on /reporting, cohort-guarded.
- Disengagement link: recommendation only (separate "needs stalled" signal), not built.

## Referrals Rework Phase 4g — referral-to-active-patient funnel
- [x] `src/lib/referralFunnel.ts`: stages submitted → contacted (reached only) → enrolled → first appt scheduled → first appt attended, medians, cohort guard
- [x] Slices: source (justice sources folded), justice-involved answer, population track
- [x] Drop-off: declined by reason, outreach attempted-not-reached, overdue before first contact, enrolled never attended
- [x] Reporting Area beside Social needs, with confidentiality note on the source fold
- [x] Tests incl. unanswered attempt ≠ contacted; typecheck, suite, build, browser

## Phase 5e — Ask Adel prototype (staff top bar)
- [x] src/lib/askAdel.ts — role groups, question library, real answers, cohort guard
- [x] src/components/AskAdelPanel.tsx — sheet, sample questions, encounter shortcuts, no free text
- [x] StaffBreadcrumbs button, shown only when a question or shortcut applies
- [x] Tests: role mapping, access filtering, Part 2 masking, cohort guard, read-only
- [x] Typecheck, suite, build, live browser at both viewports incl. Part 2-gated role

- [x] Phase 7a: Revenue & billing group, Consent & privacy group, billing_coordinator full parity (incl consent_ledger read) + parity test, /billing-calaim-codes, billing status card

## Phase 7b — Claim as single billing source
- [x] Claim states + written_off; transitionClaim (billing write enforced, attributed, audited); write-off reversible → generated with reason
- [x] markClaimSignedFromNote for note signing; claimChargeCents single amount fn
- [x] Attended visit creates claim; remove appointment billingStatus + transitionBilling/advanceClaim
- [x] /billing, summary, pilot card, clinician line read claims; tests; browser check

## Phase 7c — rate table + billing units
- [x] rates.ts: billing code table (unit rules), effective-dated rates, add/end-date, audit, billing-write
- [x] Claims: code/program/units at creation, rate × units, no-rate flag blocks Ready, corrections
- [x] /billing Rates + Codes sections; units shown on /billing and /admin-claims; remove fake table
- [x] Tests + browser (Billing, Billing Coordinator, Sys Admin)
- [x] Phase 7b.1: signature-to-claim gaps (cosign ceremony, enforced claim signing, traceability, seed audit)
- [x] Demo: attended visits waiting for a note (Kayla Nguyen trainee c4 / Rosa T.; Dr. Reyes / Alicia)

## Phase 7d — General-population billing
- [x] Programs self_pay / sliding_fee / grant_isl / commercial (inactive); selection rule; migration
- [x] Patient payment arrangement (billing write, audited); unrecorded → flag + blocks Ready; setting re-prices open claims
- [x] Optional payerId on rates, payer-specific preferred
- [x] Patient responsibility split; manual payments (no overpay, no card numbers, void); audit
- [x] Placeholder rates; /billing + /admin-claims UI; tests; browser
- [x] Phase 7d follow-ups: payment arrangement on chart (Eligibility section); Lane label derived from claim program / real coverage type
- [x] Phase 8a: coverage merge (no erase), self-report never verified, Medi-Cal status only for Medi-Cal/dual
- [x] Phase 8b: intake benefits step (CIN, plan spans, arrangement prompt)
- [x] 8b follow-up: craving button stays on /intake, repositioned above Save bar
- [x] 8b follow-up: worklist "Not Medi-Cal (reported)" filter, not never-checked
- [x] Phase 8c: electronic eligibility infrastructure (approved; electronic counts as verified)

## Pre-demo batch
- [x] Home Start my intake → /intake; Start/Continue/Completed tile
- [x] Sign-up / redemption → /intake
- [x] Daniel scenario label
- [x] Ask Adel help line (intake + landing), en/es
- [x] Staff header role indicator
- [x] Outreach attempts on queue + journey
- [x] Public referral confirmation; remove your-referrals + storage; referrer SMS
- [x] Rename journey → Re-entry Pathway (blocked: text "Getting back on your feet journey" not found in app — need its location)

## Demo final build (Sep 24)
- [x] Part A: seeded pre-release persona (Tomás R.) + switcher entry
- [x] Part A: CF care manager must not be "Rosa" — use staff directory name
- [x] Part B: Adel-guided intake (profile + benefits), scripted, Prototype label "guided questions, not AI-generated"
- [x] Shared profilePatch helper + full Rosa form intake regression in browser

## Part B pre-demo (approved narrow scope)
- [ ] B1 About You: justice question moved, "looking for" → Patient.seeking (SUD merged into needs.substanceUse), content gating, advocate pending invite
- [ ] B1 suggested goals (clinician accept/dismiss, audited) — no auto goals; screeners unchanged
- [ ] B2 My Care tiles: first appointment, needs w/ match counts, recommended
- [ ] B3(a) matched resources per need
- [ ] Tests + browser verification
- [ ] Resume interrupted approved My Care consolidation and deliver one complete verification report covering all eight items and requested browser workflows.
- [x] Final pre-demo freeze: add CALOMS to the shared substance-use signal, remove Alicia's seeded signal, gate all SUD-specific tools, preserve universal crisis/overdose access, and complete persona regression verification.

## Phase 10a + 10b (approved Sep 25)
- [x] Part A: 10a screener fixes (AUDIT 0/2/4, PC-PTSD-5 + PCL-5-20, retired short form, AHC intake options, cadence table, verbatim tests) + 10b C-SSRS (placeholder text, triggers, crisis queue risk, staff/self paths); result metadata on EHR record; draft labels; 10c/10d-ready model
- [x] Part B: QA switcher scenario matrix audit + add missing scenarios via store API; report per-record changes (separate message)
- [x] Part C: persistent top-bar QA + staff role switchers side by side on every page, desktop + phone (separate message)
- [ ] Verification: typecheck, build, full tests, browser walk per scenario
## Phase 10c (approved, building now)
- [ ] ASAM data model (AsamAssessment, task, triggers)
- [ ] recordSeeking Part 2 change (no-consent masked task)
- [ ] Roles: SUD counselor authors, LPHA signs/cosigns
- [ ] Chart UI, My Work, Ask Adel, Guided Chart Review
- [ ] Outputs on cosign: episode, CALOMS prompt, H0001, care plan suggestion
- [ ] Demo data: Luis signed, Jasmine counselor-authored pending, Daniel due, no-consent scenario
- [ ] Tests + typecheck + build + browser verification

## Phase 10c — ASAM (in progress)
- [x] asam.ts model, triggers, store methods, chart panel, cosign inbox, Ask Adel, chart review facts, H0001 claim hook
- [x] Demo seeds (Luis signed, Jasmine counselor-authored pending cosign, Daniel due, Jordan Vega no-consent) + switcher entry
- [ ] Typecheck/build clean
- [ ] asam.test.ts (triggers, masking, cosign, no auto-level, patient view)
- [ ] Full test run + browser verification (desktop/phone)
- [ ] Report with the two navigation confirmations

## Phase 10d-1 (done)
- [ ] Decision: should clinical coordinator see ASAM reporting? (currently hidden — no Part 2 access)
## Next: 10d-2, 10d-3 (separate messages)
- [x] Rename staff Elena Vargas → Renee Castillo
- [x] Rename QA patients colliding with staff (2b, 3, 5)
- [x] ASAM reporting lib (worklists, differences, timeliness, cohort guard, Part 2)
- [x] My Work ASAM group; /reporting "ASAM (clinical)" section; chart level history
- [x] Demo: overdue task + recommended≠actual signed record
- [x] Tests, typecheck, browser check
## Item 6 — Clinical Coordination (done)
- [x] Carry-overs: advocate cancel seed + check, telehealth button check, task title fix
- [x] Kayla profile, role gate, reassign with reason, audit, unassigned list, export names, demo
## Section 4 part 2 (done)
- [x] Advocate page phone width; mood count for case managers; B8 merged care-team thread; E7 Adel greeting check-in
## Clinical core — turn A (done)
- [x] A1 SUD-medication masking (single classifier + toggle, every med surface)
- [x] A2 Note addendum / correction / void / late entry / version history
- [x] A3 Demographics & identifiers edit with reason + history
## Clinical core — turn B (next message)
- [x] A-finish: void approval inbox, primary clinicians, browser checks
- [x] B1 allergy cross-check  - [x] B2 CURES placeholder step  - [x] B3 outpatient episodes  - [x] B4 higher-level referrals
## Carry-overs + E5 Phase A (voice intake)
- [x] (a) Referral list in staff menu (clinical roles)
- [x] (b) Legal / Part 2 disclosure card on consent screen
- [x] (c) Safety panel on note orders
- [x] E5A useAdelVoice layer, plain-language intake, tap-only sensitive items, crisis scan, admin guardrail notice, remove homepage placeholder

- [x] Turn 2: clinician workspace tiles, unified Today/action queues, dashboard + New, carry-over custody gate, and full verification.
- [x] One-tab Anita, Marisol, Luz, Priya desktop/mobile and dashboard + New checks; outpatient medication-pass filtering fixed; 2,039 tests passed.

## Turn 4 of 6 (batch E) — in progress
- [ ] Carry-overs: hydration <p> fix, eligibility simulated outcome, turn 2 browser re-proof
- [ ] patientMatching.ts engine on every creation path (+HIE)
- [ ] Patient matching review queue (merge / not same / link related)
- [ ] Merge + unmerge (consents flagged, duplicate claim block)
- [ ] Multi-role staff identities, dedupe, retire s-cf2, advocate/patient personas
- [ ] Demo seeds + tests + browser
## U1/U2 — Escalations + team messaging (done)
- [x] advocateSelfSeparation stable in full suite (cold-start warm-up)
- [x] Unified Escalations queue, crisis-queue redirect, Needs my action link
- [x] Staff-to-staff threads, mentions, read receipts, Discuss from escalation
## Adel chat persistence (done)
- [x] History/continue, delete/clear, 90-day retention, share summary via disclose(), advocate isolation, EN/ES, handoff rows 12–16

## Staff content center S1–S6
- [x] Private real-player Browse + care plan preview
- [x] Structured Manage forms + exercises/journeys CMS
- [x] Journey patient progress/assignment integrity
- [x] Revision-pinned engagement + suppressed Audit/history/stale queue
- [x] Full unit (2,458) + typecheck; browser 54/55 together — continuity.spec screener-resume step intermittent under parallel load only (passes standalone)

## Access & notifications batch (Draft — pending exec RBAC review)
- [x] A1 chart entry by role + enrolled site; /record + print gated; restricted record (reason, audit, compliance item); outside-caseload + unusual-volume reports
- [x] A2 search only for chart-entry roles on staff work pages; results limited to enterable patients
- [x] A3 per-person read state; task pointers linked to My work; bell filters; new events; narrowed LVN cosign + HLOC routing; four text leaks fixed; Part 2 text lint; seeded broadcasts ≤5 per role
- [x] A4 Spanish screener resume fixed at source; all browser specs green together (56/56, live preview)

## Group 1 (8 Oct) — profile, availability, flag journeys (Draft)
- [x] K1 chartAccess comment · [x] K2 event + routing tests (notificationEvents.test.ts)
- [x] P1–P4, A1–A4, C2 with unit tests (group1Profile.test.ts)
- [ ] Browser walkthrough spec for Group 1 flows (not yet written)

## Phase 3 Part B — MOUD continuity (13 Oct)
- [x] Release-cycle continuity record, two registry actions, shared panel + side drawer in pre-release episode detail and chart Reentry hand-off; 7 new unit tests
- [ ] Part A red cleanup (next build)
- [ ] Persistent Demo seed of a person with MOUD + release episode (not added; would change shared Luis demo flows)

## Phase 5a — Copy, tú, review export and staff English (14 Oct)
- [x] Outcome verbs, deadline wording, missed visits, dismissal semantics and icon classification; preserve historical/clinical text
- [x] Monthly member check-in presentation and confirmed tú conversions only
- [x] Development Spanish review CSV and per-screen gap list; no missing Spanish drafts (5b)
- [x] English staff surfaces with local Spanish content previews
- [x] Authorized assertion-text edits, full units then all browsers/axe, warm reruns and 390px Spanish checks
- [x] Report changed files, pattern counts, gaps and editorial/clinical exceptions

Validation report: docs/phase5a-report.md. Build green; 308 unit files / 2,570 tests passed; initial browsers 75/79, final complete browsers 76/79 (all axe/Back-to-top passed); one authorized warm staffNav rerun 22/22. Final failures: missing Rosa role option within 2s, consent packet navigation timeout, Spanish tablet navigation destroyed context. Spanish mobile checks 390px across seven changed member screens. CSV 4,531 rows, 1,657 ordinary draft gaps, 1,746 controlled rows.
- [ ] Preview in Spanish switch blocked by frozen e2e/staffContent.spec.ts:16–17; retained local EN / ES · Draft buttons, requires Mitch's assertion-line approval.
- [ ] Build 5b missing Spanish drafting is not started; await Mitch's separate approval, source gap list includes audience/dynamic-review caveats.

- [x] Phase 6 emotion check-in complete (SUD goal origin fix, tests, exports, ES 390px screenshot)
- [x] Phase 6 follow-up: origin "clinician" on accepted ASAM goals and asam_signed legacy goals (Draft — pending clinical sign-off); NTP goal SUD link open for Dr. Bagga

## Phase 8a-1 — Staff shell foundation (approved Oct 15)
Rollback: 1a622225b55f2e2425e4cc843d54696715f3e86f
- [ ] Staff-only shell, compact density, 240/56px sidebar, mobile sheet, safe Quick jump and crisis count
- [ ] Existing New launcher parity with one shell trigger; staff-only neutral demo controls and overlays
- [ ] Only three approved assertion replacements; add foundation tests
- [ ] Full units/list count, all browser specs/axe, requested screenshots and report
- [ ] Preserve consent/member/public/dashboards; do not start 8a-2/8b/8c
- [ ] STOPPED: userNavigationShell.test.ts:24 needs Mitch's decision; 2,606 passed / 2,607 listed, build OK. No browser suite or new foundation tests after stop. See docs/phase8a1-staff-shell-report.md.

## Phase 8c-1 — Approved staff fields and dialogs (15 Oct)
- [x] Staff FormField and ConfirmDialog; CMS/calendar adapters; required consent-publish reason
- [x] Only two approved existing test edits; 13 new unit tests and 3 browser/axe tests pass
- [x] Full units 2,638/2,638 listed; 18 light/dark screenshots and checkpoint report
- [ ] STOPPED awaiting Mitch: existing cfProxyMode.spec.ts:37 timed out; full browsers 9 pass, 1 fail, 2 interrupted, 80 unstarted. Candidate line in report; no edit applied.
- [ ] Remaining plan verification: all browsers, touch/focus-return and additional adapter edge cases after checkpoint approval
Rollback: 97668bd969a632fe3706613359bb1d448f4ead27. No 8c-2 work.

## Phase 8a-2 — Kept by Mitch on Oct 15; verified Oct 15 (report: docs/phase8a2-report.md)
Preserved rollback: e231f0dd8e26acd460acee64ee0f1535480d687c.
- [x] Consent overlap regression at 390/768/1280 — not reproduced, no layout change
- [x] Staff Needs you / Waiting on others / Today order and persistent scoped crisis banner — rollback parity proven
- [x] Keep /consent in its current shell; member-access finding recorded for the real-auth phase
- [ ] Shell + New audit test — blocked: e2e/staffShell8a2.spec.ts:12 needs an approved line change (Mitch)
- [x] 768 layout and coarse 48px targets; 390 admin-content width
- [x] Public early taps reproduced and fixed (replayed after load); 988 stays a plain link
- [x] Sequential full units and browsers/axe; screenshots and report

## Phase 8c-2 — COMPLETE Oct 16 (progress: docs/phase8c2-progress-report.md; real sign-in will later remove the staff/demo loading gates)
- [x] Registry gates equal to rollback UI gates for the 8 new actions + consent revoke (unit-proven)
- [x] Audit reasons scrubbed (Part 2 terms, diagnosis codes, patient name); blank never written
- [x] Permission snapshot update — approved 136 lines applied
- [x] Lesson archive = existing withdrawal (8c-1); refill decline, frequency delete refusal, hydration and loading gates done; 2,658/2,658 units, 123/123 browsers (--workers=1, :8080)

## Quick-actions batch 2 — COMPLETE Oct 16
- [x] Shared + New menu on the three existing launchers only; approved role defaults and registry labels; duplicates removed
- [x] Whole-menu search, correct search/no-search headings, filtered keyboard navigation and live result count; all three popovers named New action
- [x] Pending nurse actions remain hidden; permissions and existing test assertions preserved
- [x] Full units 2,671 passed / 2,671 listed, then full browsers 128 passed / 128 listed with --workers=1 against :8080, including axe
- [x] Close-out report: docs/quickactions-batch2-report.md
- Batches 3 and 4 complete below; no publishing.

## Quick-actions batch 3 — done Oct 16
- [x] Shared "+ New" on My work, Worklist, Case manager, Inbox and the content center (approved 8a-2 lines applied; 2,677/2,677 units, 135/135 browsers). See docs/quickactions-batch3-report.md.
- [x] Reuse shared New menu on My work, Worklist, Case manager, Inbox and content center; preserve registry gates and existing action paths
- [x] Remove only replaced legacy add controls; document patient selection or omission per page
- [x] New unit/browser files; full units then all browsers with --workers=1 on :8080; restore regenerated screenshots
- [x] Write docs/quickactions-batch3-report.md and mark complete only after all checks pass

## Quick-actions batch 4 — COMPLETE Oct 17
- [x] Device-only per-staff prototype settings: choose/reorder up to eight, reset, own-role eligibility, no audit, hydration-safe storage
- [x] Context-sensitive therapist/SUD counselor Task defaults with unchanged registry permissions; all coordinator setup, literal-label and launcher-scope decisions documented
- [x] Prior full units 2,686 passed / 2,686 listed (331 files); final full browsers 136 passed / 136 listed (35 files), 0 failures, --workers=1 on :8080 to completion
- [x] Restored 15 regenerated tracked images; all 108 pre-run tracked image hashes identical
- [x] Close-out report and every final changed test line: docs/quickactions-batch4-report.md
- [x] Quick-actions track complete. No permissions changed, no publishing, no work after batch 4.
- Open question for Mitch only (not implemented): therapists have patientless dashboard Task but no chart Task because case_notes is read-only; grant chart Task or offer patient-prefilled dashboard Task in chart?

## Group A access-hardening fixes — COMPLETE Oct 19
- [x] Seven narrowing fixes (unsigned notes, caseload SUD program, in-facility tasks, audit feed scrubbing, outbound names, claim Move via registry, staff drawer reset). See docs/group-a-access-fixes-report.md.
- [x] Units 2,720/2,723 (3 pre-existing/conflict-avoided, see report); full browsers 177/177 --workers=1; screenshots restored.
- Open for Mitch: roster sheet leaves mouse locked after closing; reschedule unit tests are clock-dependent.

## Phase 9b — chart foundation and palette — COMPLETE Oct 19
- [x] Approved chart tokens light+dark, chartTheme helpers, View as table on every chart. See docs/phase9b-report.md.
- [ ] 9a/9c dashboards and stat tiles — not started (awaiting Mitch).

## Export file names — DONE Oct 19 (disclosure, note PDF, refusal PDF)
- [x] Disclosure export named by program ID; approved adminTables8b3 line; new no-name test
- [x] Note PDF and refusal PDF file names use program ID (approved test lines changed)

## B3b validation stop (Oct 21)
- [ ] Full browser suite: 214/215, EXIT 1 — staffSlowLoadLanding8c2.spec.ts:31 saw 0 nav_access_denied audits under 6x CPU throttle; guard/audit path byte-identical to rollback b1d3c414 (verified via git diff). Units 2,907/2,907 green; new billingPrivacyB3b spec 3/3. Stopped per stop rule; awaiting Mitch: rerun or investigate.
