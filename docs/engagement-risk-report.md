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
