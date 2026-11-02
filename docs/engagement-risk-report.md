# R57 engagement-risk flag and event-triggered needs re-screens

Approved by Mitch, 1 Nov 2026. **Draft — pending clinical sign-off**; Christi tunes thresholds and weights. Explainable, non-punitive rules, not a prediction model. No publication, persistence or Supabase changes.

## What exists (inventory before product changes)

| Source | Current evidence / availability |
| --- | --- |
| Missed visits | `src/lib/ehr.ts:2200–2240` stores appointment start/status, `noShow.at` and `cancellation.at/lateCancel`; real cancellation/no-show paths are `staffCancelAppointment` and `markAppointmentNoShow` (`ehr.ts:9953` onward). Existing dated appointment status supplies the 30-day window; no new attendance fields. |
| Outreach and replies | `src/lib/caseloadReview.ts:26–34,73–124` records attempted/no-answer versus actual call/text/in-person/video contacts, with dates. Patient `careMessages` (`ehr.ts:1870`, messaging methods near 16800) has staff/member authorship and timestamps. Use structured attempt logs plus staff messages, never infer unanswered calls from free text. |
| Phone/address | `src/lib/demographics.ts:61–68` and `ehr.ts:1850` hold timestamped changed fields; `updatePatientDemographics` appends history (`ehr.ts:12276`). Phone change and address change exist. A structured disconnected-phone or confirmed SMS-undeliverable field has not been established: **needs data**, skip those branches; notification delivery errors are not automatically a disconnected phone. |
| Coverage | `ehr.ts:1725–1760` stores coverage status and verification (`pending`, `not_found`, etc.), with dated coverage spans. Captured inactive/suspended or pending eligibility can be used; absent coverage is **needs data**, not an inferred gap. Eligibility transports remain Simulated. |
| Release/reentry | Patient `releaseDate` plus provenance `releaseDateMeta` (`ehr.ts:1874–1875`); R53 already reads real release date in `rescreenCadence.ts:22–30`. No episode-day substitution. |
| HRSN / needs | Scored results/history in `ehr.ts:1692`; CMS AHC-HRSN definition/domains in `screeners.ts:550` onward. Housing/food/transport domain positives and `sdohPlan.items` (`ehr.ts:792–813,1891`) have resolution status and provenance; packet needs are separate referral-staging evidence, not automatically a clinical HRSN result. Safety has its own `safetySensitive` boundary (`ehr.ts:696–699,807–813`) and is excluded here. |
| Phone/data need | `whatWouldHelp.ts:40–58` captures optional topic `phone` with the canonical need “Phone or internet”; this exists in `sdohPlan` when actually selected. Absence is **needs data**, not a fabricated add-on answer. |
| Member needs changes | Need source `intake_self_report` and dated updates exist (`ehr.ts:679–683,802–805`). Packet confirmation (`intakePacket.ts:146–151`) checks patient identity but changes only state, without an event timestamp: that path is **needs data** for event detection. Only actual attributable member writes may trigger; staff/advocate/partner imports never become member-reported changes. |
| R53 overdue | `rescreenCadence.ts:65–80` groups outstanding tasks; `RESCREEN_PROMPT_RULES.staffFollowupDays` is 10. No instrument names or safety content belong in the engagement reason. |
| App-open sweep | `useReminderSweep.ts:28–55` invokes the existing R53 sweep on mount and every 20 minutes while a browser is open. Exact timing/delivery needs the production scheduler, R54/R48. |
| Caseload tile/list | `WorkspaceDashboard.tsx:95,149` renders the existing “My caseload” tile; `CaseloadTable.tsx:210–224` renders the staff member list, including a previous New/Steady presentation column. Caller scopes and chart gates must remain authoritative. |
| Task lifecycle | Existing `CaseTask` (`ehr.ts:4427–4498`) and creation dedupe (`ehr.ts:16997–17029`) exist. Staff worklist completion calls the store directly: **no existing task-completion registry action was found**. Existing completion has no R57 outcome requirement. See mandatory stop below. |

### Signal mapping (all Draft — pending clinical sign-off)

- Missed visits: **exists** (dated no-show/late-cancel status).
- Outreach not answered: **exists** (structured no-answer contacts and timestamped staff/member messages; message content never inspected).
- Contact lost: **partial** (phone history exists; disconnected/confirmed undeliverable **needs data**, skipped).
- Housing unstable: **exists** (living-situation item/HRSN domain + resolution; do not treat every housing-quality issue as loss of stable housing).
- No phone or data: **exists if captured** as “Phone or internet”; otherwise **needs data**.
- Transportation / food: **exists** (scored domain and unresolved plan evidence).
- Re-screen overdue: **exists** (R53 day-10 groups; neutral reason only).
- Early reentry: **exists if release date captured**; no stand-alone flag.
- Coverage gap: **exists if captured** (status/verification); otherwise **needs data**.
- Interpersonal safety: **excluded**, keeps existing clinician routing; never a flag reason.

## Results

### Part 1 — option A approved 1 Nov, 16:55 CT

The completion-action blocker is resolved by Mitch's scoped approval. This part builds logic, registry, the app-open sweep and unit tests only. No staff surface is mounted; part 2 owns badges/reasons, browsers and screenshots. Earlier stop findings below describe the pre-approval state, not the current scope. Disconnected phone, SMS undeliverable and packet-confirmation needs-change events remain **needs data** and skipped. No publication, persistence or Supabase changes.

- Inventory completed before application changes. No invented signal fields or demo events.
- **Mandatory stop before application changes:** the requested existing staff task-completion registry action does not exist. `chartActions.ts:897–903` (`task`) and `:960–968` (`dashboard_task`) register creation only (`createCaseTask`). Neither `completeCaseTask` nor `setWorklistStatus` nor `addCaseTaskNote` has a registry store reference. Existing `TaskWorkRow.tsx:170–177,290–296` calls completion/status/note stores directly; `RecordTabs.tsx:2188` also directly completes a case task. A second read-only investigation confirmed the missing registry path.
- `ehr.ts:17230–17255` completes/reopens a worklist task without requiring or recording one of the four R57 outcomes. Reusing the direct call would violate registry-only writes and would allow completion without an outcome. Registering a new staff completion action requires additional permission-snapshot rows, outside the approval for **only** 18 hidden `engagement_risk_automation` rows. Attaching completion to an existing creation action would change its behavior and is not a safe substitute.
- **Scoped approval needed:** authorize an engagement-task-only staff completion registry path, preserving existing worklist/chart and ownership gates, requiring exactly the four approved outcomes, with explicit approval for its additional snapshot rows and exact-once source re-pins. Alternatively identify a different already-registered completion action to reuse. Nothing in the current approval or standing OK permits changing this behavior/permission prerequisite.
- No R57 product, test, permission, snapshot, Supabase or persistence changes made; no engagement flags/tasks/prompts seeded. R57 full units, clinician/care-manager/caseload/role/advocate/public browsers and all four screenshots **not run** after this stop. No new test/browser failure is claimed. Latest preview diagnostics: **build OK**, 1 Nov 22:02:24 UTC; this is not R57 behavior validation.
- Earlier completed R53 follow-up remains documented in `docs/rescreen-cadence-report.md`: units **3,858/3,858**, requested staff browsers **31/32** (only known triage **#16**), screenshot saved. These are prior R53 results, not R57 results.

## Standing OKs

- Superseded-anchor regression exception remains limited to immutable prior/replacement fixtures and direct adapter verification, retaining drift/reapplication checks. **R57 uses: none.**
- 1 Nov type-only exception applies only to tests created 31 Oct / 1 Nov for R53/R57, with no assertion/input/expected-value/test-name changes, through an exact-once approved re-pin plus regression, each use recording file/line/error. **R57 uses: none.** The missing completion action is a behavior/permission prerequisite, not either exception.

## Exactly what remains open

- Part 1 logic/registry/unit work is complete. Part 2 staff badges/reasons, browser suites and screenshots are next and not run or mounted here.
- Clinical review and production scheduler remain open as listed below; no approval blocker remains for part 1.

## Open clinical / production items

- Christi: confirm thresholds, time windows, weights and early-reentry step-up; all remain Draft.
- Disconnected phone / confirmed SMS undeliverable: needs structured data; do not infer from simulated delivery failure text.
- Uncaptured phone/data need and absent coverage: needs data, skipped.
- R54/R48 production scheduler: app-open sweeps cannot guarantee timing or delivery.
## Part 1 implementation checkpoint

- Pure settings/evaluator and metadata-only outreach projection built; **18/18** pure rule tests passed. Housing requires the living-situation item (quality-only positive is excluded). Only completed needs resolve a signal; not_completed means unresolved. Safety domains/items never enter stored flags or event reasons.
- Real registry automation/close checks: **33/33** passed. Elevated task dedupe, Watch-without-task, clearing audit with open task retained, all four outcomes and actor provenance, chart/ownership refusals and patient/advocate denial verified. Audit keeps outcome/actor and note-presence only, never optional note body or message content.
- Exact-once R57 adapter after rescreenTileActorNov01Approved: **8/8** passed. Approved source targets: ehr.ts, chartActions.ts, useReminderSweep.ts. Existing task completion and all staff UI untouched.
- Event triggers derive real history/appointment IDs and actual intake_self_report selection timestamps. Packet confirmations, disconnected phone and SMS delivery remain skipped. Deferred events remain pending through shared 7-day cap and 14-day completion skip; existing open HRSN consumes pending events without duplicate prompt.

### Approved new permission rows — before snapshot update

All values below are role-only registry availability, not chart/worklist/ownership grants. Store closure still requires chart entry, worklist **write**, matching assignment/claim and task discipline. Read-only worklist roles may have the approved registry row but cannot close through the store; no existing worklist grant changes.

| Staff role | engagement_risk_automation | engagement_task_close |
| --- | --- | --- |
| ecm_provider | hidden | allowed |
| cf_care_manager | hidden | allowed |
| sud_counselor | hidden | allowed |
| clinical_trainee | hidden | allowed |
| medical_assistant | hidden | hidden |
| peer_specialist | hidden | allowed |
| community_health_worker | hidden | allowed |
| therapist | hidden | allowed |
| physician | hidden | allowed |
| pmhnp | hidden | allowed |
| nurse_rn | hidden | allowed |
| lvn | hidden | allowed |
| billing | hidden | hidden |
| clinical_coordinator | hidden | allowed |
| intake_coordinator | hidden | hidden |
| credentialing_coordinator | hidden | hidden |
| billing_coordinator | hidden | hidden |
| sys_admin | hidden | hidden |

Snapshot update is pending; only these 36 additive rows are approved.

### Snapshot and first full-unit result

- Snapshot-only update via `vitest -u` on `src/lib/__tests__/runAction.test.ts`: **7/7 passed**; diff inspection found exactly **36 additive rows** (18 automation hidden, 18 close rows as tabled), zero changed existing rows/other actions.
- First full suite: **3,913 passed / 4 failed (3,917 total)**. All four failures were earlier approved source/chain baseline regressions superseded by R57, not product assertions. Standing superseded-anchor OK used four times: `rescreenCadenceOct31Approved.test.ts:16` (ehr baseline), `rescreenCadenceFinishOct31Approved.test.ts:12` (chartActions baseline), `rescreenTileActorNov01Approved.test.ts:26` and `rescreenTileFollowupNov01Approved.test.ts:21` (prior chain). Immutable R57 prior sources/prior-chain fixture now reconcile only those baselines; adapter exact-apply/drift/reapplication checks remain.
- Type-only standing OK used once: newly created R57 `engagementRiskAutomationR57.test.ts:74`, TS2322 inferred throwing getter as void versus CareMessage.body string. Added only `: string` return annotation; no assertion/input/expected/test-name change. All five changes pass through their own hash-checked exact-once reconciliation adapter/regression.

- Final event tests: **5/5 passed**, including all four HRSN triggers with cap/skip deferred delivery and C-SSRS exclusion. Full units then **3,928/3,928**. Preview found a second type-only error in new `engagementRiskEventsR57.test.ts:17`: mock read projection contains `end` and lacks full Appointment fields. Type-only standing OK use #2: added only type import and erased `unknown as Appointment[]` cast to this deliberate read-seam fixture; no runtime input/assertion/expected/test-name changed. Separate exact-once adapter/regression added.

## Part 1 final validation

- Full unit suite: **3,929/3,929 passed across 450 files**, final run 1 Nov 23:12 UTC. No unresolved unit failures; all four first-run failures were recorded superseded-baseline regressions reconciled under the standing OK.
- Snapshot: exactly the approved **36 new rows**, no existing row/action changed. Existing tests were changed only for the four recorded superseded source baselines; the two type-only fixes were confined to new R57 tests through separate exact-once adapters.
- App-open automation is hooked into the existing sweep before R53 cadence, so event HRSN uses the same member tasks and weekly cap; no staff UI, TaskWorkRow, RecordTabs or worklist completion path changed. No browser suites/screenshots in this logic-only part.
- Standing OK totals: **4 superseded-anchor uses**, **2 type-only uses** (files/errors above). No permissions/matrix grants, Supabase changes, publication or persistence activation.
- Christi open: all thresholds/weights/windows, early step-up, missing-data signals and HRSN interpretation remain Draft — pending clinical sign-off. Missing disconnected/SMS/packet events remain skipped. R54/R48 exact production scheduler remains required.
- Closure notes are stored only on the task (maximum 280 characters); audit records actor, outcome and note presence, not its body. The four approved outcomes are the only accepted values.

- Final preview diagnostics: **build OK**, 1 Nov 23:14:49 UTC; type checks clean after both recorded type-only reconciliations.

## Part 2 — staff surfaces (1 Nov approval)

- Started from the completed part 1 checkpoint. Scope: caller-gated staff caseload badges/reasons and engagement-only Close picker using the existing registry action; other task controls remain unchanged. No registry, permission, snapshot, Supabase, publication or persistence changes.
- Demo real-path dependency investigation is in progress before changing any fictional records. Existing source/test pins remain protected through a new exact-once adapter chained after the latest R57 adapter. Units precede requested one-worker browser suites; part 2 results and evidence will be recorded here as obtained.
- Staff components added: `EngagementFlag` reads only `engagementFlagFor`; the caseload tile and existing table column retain caller scopes, labels, counts and unchanged CSV output. `EngagementTaskClose` uses the existing `engagement_task_close` registry/store action and gate, four required outcomes and optional 280-character note. Only engagement rows replace their generic editor controls; all other task controls are unchanged.
- Focused initial checks: **26/26** exact-once/unchanged-dashboard binding tests; new component checks **6/6** (badge/reasons, patient/advocate empty projection, required outcome, one registry call and refused task gate).
- First full suite: **3,939 passed / 1 failed (3,940 collected)**, **450 passed / 2 failed files**. One failure is the superseded R53 tile source anchor at `src/test/rescreenTileNov01Approved.test.ts:9`; reconciled under the superseded-anchor standing OK against the immutable approved prior/replacement surface fixture, retaining exact apply, drift and reapplication checks. **Part 2 use #1**.
- Preview also found TS2769 at new R57 `src/components/__tests__/engagementSurfacesR57.test.tsx:34`: Testing Library does not accept Playwright's `exact` option. Removed only unsupported `exact: true`; the exact string name match, inputs, assertions, expected values and test names stay unchanged. **Part 2 type-only standing OK use #1**, through its own hash-checked reconciliation fixture/regression.
- **STOP: older protected test incompatibility outside both standing exceptions.** `src/components/__tests__/staffTable8b1Closeout.test.tsx:10` mocks only `useActingStaff`; the new engagement imports transitively load `communityBilling.ts:69` through `ehr-ext.ts`, which requires the absent mocked `supervisorCandidates` export. The suite fails before collecting its two tests. Its existing `ehr` mock also has only paging-fixture APIs. No assertion has failed in that file; no older mock/test changes have been made. Proposed scoped test-only remedy: isolate the new `EngagementTaskClose` child to `null` in this older non-engagement paging fixture, preserving all original assertions/inputs and the new R57 component tests. This is not approved by either standing OK, so validation stops here.
- Demo candidates inspected without writes: existing Rosa (`p2`) already evaluates to **Watch** from captured coverage gap; existing Tomás Reyna evaluates Clear with one structured attempt. Two real `contact_log` attempts could provide Elevated, but complete candidate/count dependency clearance was not established before the protected-test STOP. No demo contact, appointment, demographic, task or flag records were directly written or changed. Watch cannot be established by cancellation/contact/phone-change paths alone (these are High signals); existing recorded Watch evidence may be reused without changing it.
- Requested browser suites and all five screenshots **not run** because units have not reached green. Known Sunday #16 remains untested here, not a new observed failure. No registry, permission, snapshot or Supabase changes; persistence OFF; no publication.
- Post-reconciliation focused validation: **40/40 passed across five files** (new surfaces, both exact-once adapters, superseded R53 regression and unchanged dashboard bindings). Latest preview **build OK**, 1 Nov 23:51:15 UTC; type checks clean. Full units are not rerun after the mandatory older-test STOP. Part 2 remains open, not done.
- Part 2 standing-OK totals: **one superseded-anchor use; one type-only use**, both detailed above. Part 1 totals remain separate (four anchor/two type-only).
- Christi still owns confirmation of thresholds, weights, all time windows, early-reentry step-up and HRSN interpretation. Disconnected phone, SMS undeliverable, packet confirmation events, uncaptured phone/data and absent coverage remain needs-data skips; production scheduling remains R54/R48.

## Part 2 finish — Mitch's explicit 1 Nov 18:32 CT approval

- Approved older paging fixture isolation applied through `engagementFinishNov01Approved.ts`, chained after `engagementSurfacesReconcileNov01Approved.ts`. Only a new `EngagementTaskClose` null module mock was added; all prior mocks, assertions, inputs, expectations and names remain unchanged. This is **explicit approval, not a standing OK**. Exact-apply/drift/reapplication regression plus paging fixture: **4/4 passed**.
- Full units after paging isolation: **3,947/3,947 passed, 454 files**, 2 Nov 00:33–00:37 UTC. No other failure or standing-OK use.
- Before demo seed changes: read-only dependency inspection found no fixed test/count/dashboard expectation dependent on Tomás's contacts or caseload counts. Attempt rows do not affect successful-contact totals or the contact-cadence status; live attempt totals and engagement projections intentionally derive from records. `caseloadReview.ts` is not a target of any existing approved-source adapter; `demoInboxSeed.ts` is pinned and will remain unchanged. Rosa remains untouched.
- **STOP, 2 Nov 00:38 UTC:** the attempted registry-only seed addition imported `runAction` into `caseloadReview.ts`. Its focused new test failed before collection: `ReferenceError: Cannot access 'contacts' before initialization` at `caseloadReview.ts:125`, through `serviceClassification` → `afbiOutreach`. This is a newly introduced circular module-initialization dependency, **not known browser triage and not a standing-OK case**. In accordance with the stop rule, the attempted seed addition and its new uncollected test were removed, restoring the original seed rather than leaving a broken preview. No existing assertion or seed contact changed. Tomás's two additional contacts are **not implemented**; no Elevated task was seeded.
- Next scoped implementation option: pass the existing registry runner from the already initialized demo-inbox host into the caseload seed, rather than importing the registry into the contact store. This would require the approved exact-once re-pin of the pinned `demoInboxSeed.ts` and its regression; it has not been applied after this stop.
- Requested browser suites and five screenshots remain **not run** after the seed failure. Finish standing-OK uses: **none**. Clinical open items remain thresholds, weights, time windows/early step-up, HRSN interpretation and the enumerated needs-data branches; R54/R48 production scheduler remains open. No publication, persistence, Supabase, registry, permission or snapshot changes.
- Restoration verified: focused paging/approval/contact checks **10/10 passed**; full units **3,947/3,947 passed across 454 files**, 2 Nov 00:38–00:41 UTC. Latest preview diagnostics **build OK, 00:38:46 UTC**, after removal of the attempted seed/test. The removed new test had also reported type-only fixture errors; these were not reconciled or retained after the runtime stop. Logs: `/tmp/r57-finish/paging.log`, `full-units.log`, `demo.log`, `restored.log`, `restored-full.log` (temporary sandbox evidence). Only the explicit paging approval and its exact-once chain/regression remain from this finish.

## Part 2 option C — Mitch's 1 Nov 21:15 CT approval

- Started 2 Nov 2026 03:16 UTC (sandbox: **Monday UTC**, still Sunday evening in Pacific/Central). Draft — pending clinical sign-off. Browser-only real staff controls; no seed, application, registry, permission/snapshot, Supabase or persistence changes; no publishing.
- Existing attempt control confirmed: `/caseload-review`, patient row → **Log contact** → **Contact type: Attempted / no answer** → **Save**; calls `actFor("contact_log", "logContact", ...)` (`src/routes/caseload-review.tsx:158–204`). Chart drawer offers the same real registry path (`src/components/chart/DrawerForms.tsx:70–104`).
- Source prerequisite under investigation: contacts are a module-local array (`src/lib/caseloadReview.ts:84,111`), while the app-open sweep runs on mount (`src/hooks/useReminderSweep.ts:45–55`). A hard reload may discard the two live attempts before evaluating them; no storage/seed workaround is authorized. Browser verification will preserve this requirement rather than silently substitute client navigation or a dev hook.
- Option C standing-OK uses so far: **none**. Results recorded below as obtained.
- Preflight browser observation (no record writes): role control required waiting for its client-only `loading…` state to clear; early sign-in clicks before hydration had no effect. Once ready, existing staff identity menu and `/caseload-review` worked. Tomás is displayed as **ADL-2026-008**, with one seeded attempt from yesterday and a real contact 12 days ago. Authorized viewer: **Luz Herrera**, his primary caseload owner. Rosa's table shows **Engagement · Watch / coverage gap** for **Lupita Sanchez, MSW**. These are preflight observations, not completed spec results.
- New `e2e/engagementRiskR57.spec.ts` uses only UI sign-in, existing identity menu, contact form, rendered rows and screenshots. It preserves the requested hard-reload assertion and stops if attempts are lost; it does not use `window` hooks, direct store writes or storage injection. Both seed-file SHA-256 checks still match the start of this run.
- Browser tooling: expected build v1194 was absent; downloaded to temporary `/tmp/pw1194` only and verified **Chromium 141.0.7390.37** with available system libraries. No dependency/config changes or newer-browser substitution. Full units currently running; no browser suite started before the unit gate.
- Full units recorded immediately: **3,947/3,947 passed, 454/454 files**, 2 Nov 03:20:15–03:23:55 UTC, duration 219.43s. No failures or standing-OK use. Existing Radix accessibility warnings remain warnings, not failed checks. Temporary log: `/tmp/r57-option-c/units.log`.
- **STOP — new browser setup assertion, not listed triage:** first one-worker v1194 run of `engagementRiskR57.spec.ts`: **0 passed / 1 failed / 1 not run**, exit 1. Rosa test fails at new-spec line 30: after successful UI staff sign-in and selection of **Lupita Sanchez, MSW**, the URL remains `/case-manager`, not the spec's assumed `/my-work`. The selected-role label assertion passed. This is an incorrect new-test navigation assumption, not evidence of a badge or permission defect. It is neither a superseded-anchor regression nor a type-only error, so no standing OK was used; no test/assertion changed after failure. Log `/tmp/r57-option-c/engagement-browser.log`; original error context and trace under `/tmp/r57-option-c/results/`.
- No contacts were logged: the serial Tomás test did not run. No task was created or closed by this spec. No requested screenshots were captured; the preflight screenshots under `/tmp/browser/r57-option-c/` are not acceptance evidence.
- Remaining requested clinician/care-manager dashboard, caseload, `roleDashboards9c`, advocate and public browser suites **not run after the required stop**. Known **#16 was not run**, so neither passed nor failed in this batch. Sandbox date is **Monday 2 Nov UTC**; the corresponding Pacific date at start was **Sunday 1 Nov**, which still lacks the Mon/Wed/Fri c1 fixture prerequisite. No clock/date override was used.
- **New spec remains partial, not acceptance-complete:** it retains the hard-reload/contact-survival check, Elevated/owner/Close assertions and patient UI steps, but they were not reached. A real Tomás advocate session still needs an existing UI invitation path; the provided advocate demo points to Daniel (`p1`), and cannot substitute for Tomás evidence. No signed-out advocate screenshot or fabricated session was used. Reload retention remains a separate source-identified prerequisite: contact rows are in-memory and may be lost.
- Tomás **does not sit at Elevated in the demo data**. Option C requires two live staff logged attempts before an evaluation can reach Elevated. That live-action/evaluation flow is **not verified** here, and the spec's required hard reload may remove those attempts.
- Screenshot list for option C: **none captured**. Pending: Rosa Watch tile/member list; Tomás Elevated reasons+owned task; Close picker; Tomás advocate and patient views without flag/reason/task.
- Option C standing-OK uses: **none**. Open approval prerequisite: correct only the new spec's role-switch navigation assumption, then establish the live-reload and actual Tomás advocate-session prerequisites without changing seed/storage/permissions. Clinical open items remain Christi's thresholds, weights, time windows, early-reentry step-up and HRSN interpretation; disconnected/SMS/packet and uncaptured signal branches remain needs-data skips. R54/R48 scheduler remains open. **Part 2 is not done**; marking it done would misstate the observed stop.
- Evidence preserved in `docs/evidence/engagement-risk/option-c-stop/`: `units.log`, `browser.log`, `error-context.md`, `trace.zip` (failure evidence, not requested screenshots). Final seed checksums unchanged; latest preview **build OK, 2 Nov 03:25:16 UTC**. No existing tests or pinned files edited, no re-pin required, nothing published.

## Part 2 fix — Mitch's 2 Nov 07:28 CT approval

- Started 2 Nov 2026 13:29 UTC (sandbox: **Monday**). Draft — pending clinical sign-off. No seed, Supabase, registry, permission or snapshot changes; persistence OFF; nothing published.
- **Immediate re-check (cycle-free):** new `src/lib/engagementRecheck.ts` subscribes to the existing store change notification and compares per-member metadata only (attempt ids, missed/late-cancel visit ids, phone/address revision ids). When one changes after a successful staff write, it runs that member's step through the existing system-only `engagement_risk_automation` with the existing system actor (flag, one-open-task rule, owner chain, clearing audit, event HRSN with R53 cap/skip). `caseloadReview.ts`, `ehr.ts`, `runAction.ts`, the sweep and `useReminderSweep.ts` are unchanged; installed once from `AppShell` (not a pinned file, so no re-pin needed). It also catches the existing direct staff cancel path in `VisitActions`. Seeds that run before the shell mounts never trigger it. The app-open sweep remains the backstop.
- New unit tests `engagementRecheckR57.test.ts`: **7/7 passed** (third attempt → Elevated + one task owned by the primary clinician fallback; fourth attempt no second task; no-show; late cancel; phone change with cap and 14-day skip; refused and failed writes don't trigger; safety never counted). One fix to my own new test (wrong owner field name), no standing OK.
- Full units after the change: **3,954/3,954 passed, 455/455 files**, 2 Nov 13:34–13:38 UTC. No failures; no standing-OK use; no existing test or pinned file edited.
- Daniel (`p1`) starting state, observed in the browser before logging anything: **Clear (no engagement badge), 0 attempts this week, no contacts logged**; authorized care manager **Lupita Sanchez, MSW** (`s-cm2`, caseload `cm1`).
- New spec, run 1 (2 Nov): Rosa assertions (Watch, "coverage gap", Draft label) **passed**; the row screenshot then timed out because the spec's own row selector nested an absolute locator. **One allowed fix attempt used:** select the row by program ID `ADL-2026-002`. Daniel test did not run in run 1.
- New spec, run 2 after the one fix: **2/2 passed**. Rosa Watch (coverage gap) shown. Daniel went from Clear/0 attempts to **Elevated, "outreach not answered"** right after the **third** logged attempt, with no reload; exactly **one** "Engagement check-in needed" task, **assigned to s-cm2 (Lupita Sanchez, MSW, his primary care manager)**. Close picker: 4 outcomes, submit disabled until one is chosen, cancelled without closing. Advocate (6a, for Daniel) and Daniel's patient Home reached in-app with the flag state carried over: no badge, reason or task.
- Flag timing: the flag appears as soon as the third attempt is logged; the app-open sweep remains the unchanged backstop.
- Other suites, `--workers=1`, sandbox date **Monday 2 Nov 2026**: roleDashboards9c, statTiles9a1/9a2/9a3 (clinician, care manager and other dashboards), staffTables8b1 (caseload), advocateOnboardingActive, advocateSelfSeparation, publicWebsite, publicEarlyTap8a2 and **#16 accessClickThroughOct29**: **48/48 passed**. #16 passed. No failures, none from docs/browser-triage-oct30.md.
- Standing-OK uses this batch: **none**.
- Screenshots (`docs/evidence/engagement-risk/`): `rosa-watch-member-list.png`, `daniel-elevated-member-list.png`, `daniel-elevated-task.png`, `daniel-close-picker.png`, `daniel-advocate-no-engagement.png`, `daniel-patient-no-engagement.png`.
- Observation for Mitch (not changed): the task shows in Daniel's chart Tasks and in My work, but not in the Care Coordination "My tasks" list, which keys on the caseload ID (`cm1`) while the task's owner is the staff ID (`s-cm2`).
- Open for Christi: signal thresholds and levels, the four close outcomes, event HRSN cadence, and 90-day re-screen intervals — all still Draft — pending clinical sign-off.

## R57 follow-up: trainees can't close engagement check-ins (Mitch, 1 Nov 18:05 CT; Christi confirms Tue 3 Nov)

Draft — pending clinical sign-off. Not published; persistence OFF; no Supabase changes.

- **Close action:** `clinical_trainee` removed from `ENGAGEMENT_CLOSE_ROLES` (`src/lib/engagementRisk.ts:9`). `engagement_task_close` is now hidden for trainees with the existing neutral refusal ("This engagement task is not available for this staff member."). No other role changed. Trainee outreach/contact logging (`contact_log`) unchanged.
- **Supervisor link exists today:** `StaffMember.supervisedBy` (`src/lib/roles.ts:1101`); Kayla Nguyen `s-tr1` → `s-th1` (`roles.ts:1200`); Owen Tran `s-tr2` has none (`roles.ts:1212-1219`). No new field added.
- **Owner chain** (`engagementOwnerFor`, `src/lib/engagementRiskAutomation.ts`): primary care manager → ECM → primary clinician. If the result is a trainee: the recorded supervisor when they hold a close-allowed role and `chartEntryFor` passes for the member; otherwise the coordinator queue. The automation result (and so its one `engagement_risk_automation` audit row via `successAuditMeta`) carries `ownerRouting` (`supervisor` | `coordinator_queue`), `skippedTraineeId` (staff ID only) and `reassigned`.
- **Existing trainee-owned open tasks** are re-routed the same way on the next sweep/re-check, in the same automation step, audited as above; no second task is created.
- **Permission snapshot:** `vitest -u` on `runAction.test.ts` changed exactly one row: `clinical_trainee`: `"engagement_task_close": "allowed"` → `"hidden"`. No other row changed.
- **Unit tests** (`src/lib/__tests__/engagementTraineeCloseR57.test.ts`, 6/6): trainee refused neutrally; owner chain skip to supervisor-or-queue; unsupervised trainee → coordinator queue, audited; existing trainee task reassigned on sweep with audit. Full suite **3,960/3,960 passed**.
- **STOP — LVN / nurse RN close (not changed):** registry access stays "allowed" with chart access (tested), but the existing store gate `engagementTaskGate` (`engagementRiskAutomation.ts:15`) also requires worklist **write**, and nursing roles hold worklist **read** (`src/lib/roles.ts:845`). So an actual LVN/RN close is refused today, and the demo roster has no nursing staff. Making it work means widening nursing worklist access or relaxing that gate — a permission decision for Mitch. The LVN/RN test asserts registry access only and notes this.
- **Browsers** (`--workers=1`, dev server :8080, Chromium 1194 in a temp folder): roleDashboards9c, statTiles9a1/9a2/9a3 (clinician/care manager dashboards), staffTables8b1 (caseload) and engagementRiskR57: **33/33 passed**. No failures; none from docs/browser-triage-oct30.md.
- Standing-OK uses: **none**. No pinned files changed; no re-pins needed.

## R57 follow-up 3: worklist edit access for nursing and coordinators (Mitch, 2 Nov 10:31 CT; Christi confirms Tue 3 Nov)

Draft — pending clinical sign-off. Not published; persistence OFF; no Supabase changes. Started 2 Nov 16:33 UTC.

### 1. Permission-snapshot rows that would change (measured, before any kept edit)
Method: applied the three worklist grants and the two close-list removals in a scratch copy, ran `runAction.test.ts` **without** `-u`, read the diff, then restored both files byte-for-byte (`git diff` empty).

| Role | Action | Change | Record class / gate |
|---|---|---|---|
| peer_specialist | `engagement_task_close` | allowed → hidden | `ENGAGEMENT_CLOSE_ROLES` role gate (engagement task close) |
| physician | `engagement_task_close` | allowed → hidden | `ENGAGEMENT_CLOSE_ROLES` role gate (engagement task close) |

- The worklist grant for `nurse_rn`, `lvn`, `clinical_coordinator` changes **zero** snapshot rows: no registry action's visibility reads the `worklist` class (claim/release are store calls from `/worklist`; the close store gate `engagementTaskGate` reads it at run time, not in the snapshot). No other role or record class changed. Protocol initiation is `PROTOCOL_MANAGE_ROLES` (role list), unaffected.

### 2. STOP — conflicting existing assertion tied to the database grant seed (nothing kept)
Trial full units with the change: **3,955 passed / 5 failed**, 456 files.
- `runAction.test.ts` snapshot — the two approved rows above (expected).
- `roleDashboardParity9c2.test.ts` (roles.ts rollback parity) and `billingProjectionB3b.test.ts` ×2 (sys_admin, therapist source parity) — pinned-file checks; resolvable by an approved exact-once re-pin of `roles.ts`.
- **`foundationPhase1.test.ts` › "covers all 44 classes × 18 roles"** — asserts every row of `src/lib/persistence/grants.generated.json` equals `canAccess`. That JSON mirrors the Phase 1 Supabase grant seed `supabase/migrations/20261027021308_….sql`, whose `worklist` entry lists `nurse_rn`, `lvn`, `clinical_coordinator` as **read**. Making it pass needs either regenerating the JSON (app and database grant seed then disagree) or a new Supabase migration (excluded). Neither is a re-pin, a standing-OK case, or a worklist-only change, so I stopped.
- Not applied: `roles.ts` worklist grants, `ENGAGEMENT_CLOSE_ROLES` edit, snapshot update, re-pins, new tests, browsers. Standing-OK uses: **none**.
- Side note for Mitch: the same seed lists `physician` as worklist **write** (inherits PMHNP in the matrix), which differs from "physicians have no worklist access"; removing physician from the close list is still within scope, but the grant itself is unchanged.

### Options for Mitch
A. Approve regenerating `grants.generated.json` via `scripts/generate-phase1-grants.ts` (three worklist rows) and accept the Supabase seed stays read until a later approved migration (Beta foundation is synthetic-only, persistence OFF).
B. Approve both the JSON regeneration and a Supabase migration updating the three worklist grants.
C. Keep nursing/coordinator at read; ship only the close-list change (peer specialist and physician removed). LVN/RN/coordinator closes would still be refused by the worklist-write store gate.

Proposed close list for Christi (unchanged until approved): ecm_provider, cf_care_manager, community_health_worker, clinical_coordinator, therapist, sud_counselor, pmhnp, nurse_rn, lvn.

## R57 follow-up 3, option B — applied (Mitch, 2 Nov 12:52 CT; Christi confirms Tue 3 Nov)

Draft — pending clinical sign-off. Not published; persistence OFF. Physicians stay on the close list (clinical care team).

- `src/lib/roles.ts`: worklist `read` → `write` for `clinical_coordinator` (worklist matrix) and `nurse_rn`/`lvn` (`NURSE_GRANTS`), with Draft comments. No other grant changed.
- `src/lib/persistence/grants.generated.json` regenerated with `scripts/generate-phase1-grants.ts`: exactly three rows changed (worklist × nurse_rn, lvn, clinical_coordinator, read → write). `foundationPhase1.test.ts` passes unchanged.
- **Migration file written, not applied:** `supabase/migrations/20261102190000_r57_worklist_write_nursing_coordinator.sql` — updates only those three `app.record_class_grants` rows. Header: "Draft — pending clinical sign-off and the go-live permissions audit; not applied". No migration tool used; no project connected; nothing run.
- `ENGAGEMENT_CLOSE_ROLES`: `peer_specialist` removed only.
- Permission snapshot (`vitest -u` on `runAction.test.ts`): exactly one row, `peer_specialist` `engagement_task_close` allowed → hidden.
- `roles.ts` pin checks resolved by a new exact-once re-pin `src/test/worklistGrantNov02Approved.ts` (fixture `worklistGrantNov02.fixture.json`, two anchors: the three grant lines and their comments), chained after `withApprovedEngagementFinishNov01` in `credentialingOct27Approved.ts`; regression test `worklistGrantNov02Approved.test.ts`.
- Superseded-path standing OK used once: `engagementTraineeCloseR57.test.ts` LVN/RN case extended from registry-only to a real close (task status done).
- New `engagementCloseListR57.test.ts`: real `runAction('engagement_task_close')` closes with outcome and chart access for every close-list role (RN/LVN via `addStaffMember`; coordinator on a coordinator-queue task; physician); peer specialist and trainee refused neutrally; RN/LVN/coordinator claim and complete an ordinary worklist row; peer specialist stays worklist read. Note: worklist claim/update are store calls with no role check of their own; the read/write difference is enforced by `canAccess` in the worklist screen and the engagement close gate.
- Full units: **3,982/3,982**, 458 files.
- Browsers (:8080, `--workers=1`): engagementRiskR57, roleDashboards9c, statTiles9a1/9a2, first 29 of 33 passed before the 10-minute command limit; re-run of statTiles9a3 + staffTables8b1: 12/13. The failure was `statTiles9a3.spec.ts:39` (billing, then billing_coordinator on standalone re-run) — page-open timeout, each role passed in the other run; billing roles have no worklist grants. Not listed in docs/browser-triage-oct30.md; not a triage item. Sandbox Monday 2 Nov: #16's spec was not in this run.

**Final close list for Christi:** ecm_provider, cf_care_manager, community_health_worker, clinical_coordinator, therapist, sud_counselor, pmhnp, physician, nurse_rn, lvn.

## R57 follow-up 2: Care Coordination "My tasks" includes tasks assigned to my staff ID (Mitch, 2 Nov 09:28 CT; Draft)

### 1. Report first (measured before any change)
- **Source of "My tasks":** `src/components/tasks/TaskQueueCard.tsx:45-46` (`tasksFor` → `AdelanteEHR.caseTasksForCM(cmId)`, which is `src/lib/ehr.ts:16531-16533`, `assignedTo === cmId`). Rendered from `src/routes/case-manager.tsx:242`; `cmId` is the acting staff's `caseManagerId` (`case-manager.tsx:147`).
- **Counts from the same source:** only the card's own badges — "follow-up needed", "due today", "snoozed" (`TaskQueueCard.tsx:86-92, 110-113`) and the "Show all" list. No StatTile, Today count or Worklist statistic reads `caseTasksForCM`; `rg` finds no other caller outside tests. They derive from the same `tasks` array, so they match the list automatically.
- **Who sees the card:** staff with a caseload link — `s-cm2` Lupita → `cm1` and `s-peer2` → `cm2`.
- **Demo tasks assigned by staff ID (measured from the seeded store):** 10 — `s-sudc1` ×7 (ASAM assessment needed, Consider the Recovery Journey), `s-th1` ×3 (ASAM reassessment, CALOMS prompt). Neither `s-sudc1` nor `s-th1` has a caseload link, so they never render this card. **No seeded task newly appears** for Lupita or `s-peer2`. The only new rows are engagement check-ins routed to `s-cm2` (or `s-peer2`) by the sweep/re-check at run time.
- **Tests / numbers that would change:** none expected. `groupAAccessFixes` and `staffTable8b1Closeout` call the card without a staff identity / with no staff-ID tasks; `roleDashboardParity9c2` inventories `TaskQueueCard.tsx` bindings — the change adds no variable declarations or inventoried attributes.
