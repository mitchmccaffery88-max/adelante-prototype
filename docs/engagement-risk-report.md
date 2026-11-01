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
