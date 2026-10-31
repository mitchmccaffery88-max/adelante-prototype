# Browser triage — 30 Oct (after R5 screener batch)

Draft. Nothing published, persistence OFF, no Supabase changes.

## 1. Permission snapshot (approved)
`src/lib/__tests__/__snapshots__/runAction.test.ts.snap` updated with `vitest -u` on that file only.
Diff: 18 added lines, all `"screener_item9_followup": "hidden"` (one per staff role). No other row changed. `runAction.test.ts` 7/7.

## 2. Method
The 24 failures from the R5 full run were re-run (`--workers=1`, current e2e specs) against:
- **Pre-R5**: tree of `806e33c9` (parent of `2aaa5168`), served separately on :8090.
- **HEAD**: `2aaa5168` on :8080.

Result: **all 24 were already failing before R5. None is new with R5.**
Pre-R5: 24 failed / 17 passed. HEAD: 21 failed / 20 passed (the 390px fix below landed during this run; the roster count passed on HEAD).

## 3. Classification

| # | Spec | Pre-R5 | Cause (one line) | Class |
|---|---|---|---|---|
| 1 | overflow9c.spec.ts:22 `/case-manager` 390px | failing | Referral tracker row had a `shrink-0` right column; the long lifecycle chip ("Stage 7 — … missing: paperwork") pushed the page to 619px | **Product bug — fixed** |
| 2 | overflow9c.spec.ts:22 `/admin` 390px | failing | Same referral tracker row (shared card) | **Product bug — fixed** |
| 3 | staffTables8b1.spec.ts:21 `/case-manager` 390 (:56 width 619) | failing | Same row | **Product bug — fixed** |
| 4 | adelBrief.spec.ts:27 (:15) | failing | Opens Luis's chart as an off-team role; 27 Oct access rule now shows "You're not on Luis's care team" + reason gate | Out-of-date (access rules) |
| 5 | adelHistory.spec.ts:16 (:63) | failing | Same gate before the shared summary | Out-of-date (access rules) |
| 6–8 | consentAuditB2:23 (:50), consentCaptureB2:45 (:51), consentLifecycleB2:47 (:55) | failing | Freshly enrolled patient's chart shows the reason gate, so `consent-capture-panel` never renders | Out-of-date (access rules) |
| 9–12 | crossRole.spec.ts:62 J7 ASAM ×4 | failing | pmhnp/sud_counselor/peer charts hit the reason gate; nurse_rn lands on Worklist (`reached` false at :78) | Out-of-date (access rules) |
| 13 | group2Pathways.spec.ts:16 (:48) | failing | Reason gate hides the pathway chip | Out-of-date (access rules) |
| 14 | quickActionsMenu.spec.ts:51 (:55) | failing | Reason gate on Daniel's chart; New slot never mounts | Out-of-date (access rules) |
| 15 | staffShell8a1.spec.ts:79 (:83) | failing | Same: `/record/p1` shows the reason gate, no New slot button | Out-of-date (access rules) |
| 16 | accessClickThroughOct29.spec.ts:3 (:10) | failing | `ADL-2026-002` button not in the Today region for the acting role | Needs check — likely seed/caseload change (coverage c5 rename / scheduling demo mix) |
| 17 | access.spec.ts:18 (:50) | failing | Search option for `otherProgramId` never appears; reason-gated minimal search (27 Oct) | Out-of-date (access rules) — needs confirm |
| 18 | consentWorkflow.spec.ts:32 (:49) | failing | Patient intake packet checkbox "I agree to this form: …" not found | Needs check — likely B2-5 named-form/consent migration |
| 19 | crossRoleJourneys.spec.ts:39 (:51) | failing | `inPool` false for the new referral | Needs check — likely 27 Oct referral lifecycle / Intake rules |
| 20 | quickActionsBatch4.spec.ts:4 (:62) | failing | `pref-progress_note` missing under the other assigned role | Needs check — held-roles rule (primary + explicit, no union) |
| 21 | remainingQueueTables8b2.spec.ts:82 (:86) | failing | Unsigned table shows one fewer row than `listUnsignedWork({authorId:'c1'})` | Needs check — table now filters (access gate) vs raw store; may be a real parity gap |
| 22–23 | staffTables8b1.spec.ts:21 `/notes-queue` 1280 & 390 (:40) | failing | 4 rows vs pinned 7 | Seed count drift (coverage/scheduling fictional demo mix) |
| 24 | staffRosterCredentialTables8b2.spec.ts:5 (:14) | failing (pre); passed HEAD | 24 vs 23 staff: CHW/RN calendar staff added in scheduling (c) | Out-of-date (scheduling) / count-sensitive |

## 4. Fixed now (2c)
`src/components/admin/ReferralTrackerCard.tsx`: the referral row wraps (`flex-wrap`, `min-w-0`), the right column no longer `shrink-0`. Presentation only; no wording, gate or action changed. Verified `/case-manager` and `/admin` at 390px: scrollWidth 390.

## 5. Proposed assertion updates (2d — awaiting Mitch, not edited)
- **Access-gate group (#4–15, #17)**: before opening a chart, either act as a care-team member of the patient, or select a reason in "Reason for opening" and continue (the approved gate), then keep the existing assertion. Proposed helper: `openWithReason(page, "<approved reason code>")` called after `go('/record/…')`. Peer J7 hidden case keeps `toHaveCount(0)` and the text check.
- **#24**: `expect(ids).toHaveLength(24)` (CHW/RN added in scheduling c), or assert the roster projection length instead of a literal.
- **#22–23**: replace `toHaveCount(7)` with the count from the in-page unsigned-notes projection for the acting role.
- **#16, #18–21**: need one more look each before a proposed assertion; I have not confirmed whether they are out-of-date tests or product gaps. #21 in particular may be a real parity bug and should not be re-pinned blind.

## 6. Report only (2e)
None found that would require changing decided behaviour, permissions or Part 2 handling. The access gate (#4–15) is working as decided on 27 Oct.

## 7. Final run
Affected specs re-run (overflow9c + staffTables8b1): 16 passed, 2 failed — only the two `/notes-queue` row-count cases (#22–23). A full 270-test browser run takes about two hours on one worker and was not completed in this round; the last full run remains 246/270 with the 24 above, of which 3 are now fixed.

## Part 2 — 31 Oct (Mitch approved 30 Oct)

Draft — pending clinical sign-off. No publication, persistence change or Supabase change. The open R5 stop at `reassessment.test.ts:23` and R5 screener sources are outside this batch and unchanged.

### Approved changes
- Access-group specs receive `openWithReason(page, "covering_consult" | "scheduling_admin")` after chart navigation, using the existing radio and Open chart UI. Direct-entry charts are left alone. Existing assertions, including J7 peer hidden count and text checks, are unchanged.
- Roster count reads the in-page `STAFF_ROSTER.length`; notes-queue Everyone count reads `listUnsignedWork` with the acting role/staff viewer, not raw unrestricted rows.
- `browserTriageOct30Approved.ts` chains the existing approval adapters, checks the complete prior SHA-256, requires each substitution exactly once and checks the resulting hash. No permission snapshot or unrelated test changed.
- #17 receives the approved helper after the peer chart opens. Its separate program-ID restriction-picker failure is **not** repaired by changing that assertion; further scope requires review.

### Investigation report before any unresolved-case changes
| # | Cause / classification | Proposed fix (not yet applied) |
|---|---|---|
| 21 | Out-of-date scope comparison: Inbox calls `listUnsignedWork({authorId, viewer:{role,staffId}})` in `UnsignedNotesQueue.tsx`; test :85 calls `{authorId:'c1'}` without a viewer. Shared `viewerSeesUnsignedRow` checks chart entry and existing note/Part 2 gates. No evidence of a table/store parity defect. | Compare exact IDs to `listUnsignedWork({authorId:'c1', viewer:{role:'therapist',staffId:'s-th1'}})`. Retain all existing filters. Await Mitch approval; assertion unchanged. Live excluded-row evidence pending. |
| 19 | Out-of-date actor: `crossRoleJourneys.spec.ts:39–51` checks the new referral's pool under clinical coordinator. `referralChase.ts` uses `CHASE_POOL_ROLE = intake_coordinator`, consistent with approved Intake ownership. | Read a valid Intake actor from the roster for the pool assertion; retain coordinator oversight separately. Do not widen pool access. Await approval; test unchanged. |
| 18 | Out-of-date form title: named packet now offers `part2_standard`, not legacy `part2`. Current title is “Sharing substance-use information for your care (Part 2)”. The reentry+SUD fixture has seven items: hipaa, telehealth, portal, sms, part2_standard, group, po_release. | Replace only the legacy checkbox title with the current title; seven-item count stays seven. Audit subsequent legacy Part 2-card/gate assertions before requesting their approval. Test unchanged. |
| 20 | Still investigating: the test **does switch back to therapist** before :62. No clinicianId is required by progress-note permission. Settings and launcher inventories are deliberately distinct; neither held-role permission unions nor a coordinator default explain this failure. | Reconcile live actor, default inventory, preference and settings state before proposing any change. Earlier “still acting as coordinator” theory is rejected. |
| 16 | Still investigating: Rosa's late-cancel seed is attempted via real booking in `demoInboxSeed.ts:229–236` and silently omitted when current booking checks refuse it; the test targets a pinned program ID in a Today region. | Inspect actual appointments, acting clinician scope, bucket/date and region. Do not invent a visit or relax booking/access rules to satisfy a locator. |

### Validation
Single-worker run of all touched and investigated specs started against :8080; no full browser suite requested. Final counts and every failure will be recorded below after completion. Any approved-update test that fails for another reason is stopped at that assertion without further changes.

## Part 3 — 31 Oct (approved 08:28 CT; continued Round 4c/4d)

Draft — pending clinical sign-off. No publishing, persistence change, Supabase change, permission change or permission-snapshot change.

Round 4b stopped at the earlier regression; Round 4c resolved that exact case under Mitch's narrowly scoped standing OK, with immutable-stage fixture, unchanged adapter logic/hashes/anchors and final-chain regression. Focused 23/23. Round 4c applied only the approved #21 viewer-scoped IDs, #19 roster Intake pool actor plus separate coordinator oversight, and #18 named Part 2 checkbox title through `browserTriagePart3Oct31Approved.ts`, chained after the earlier browser approval, with exact-once equality/drift/reapplication tests. Round 4d edits no product or tests.

**Round 4d step 1:** isolated full units **3,763/3,763**, 428 files, exit 0, no unhandled errors. Earlier temporary error text is unavailable after restart; current run is clean.

**Round 4d step 4, group 1 recorded immediately:** `remainingQueueTables8b2.spec.ts`, `crossRoleJourneys.spec.ts`, `consentWorkflow.spec.ts`, :8080 `--workers=1`: **11/11 passed**, exit 0, 4.0 minutes. #21 exact IDs, #19 pool/oversight and #18 seven-item packet plus later card/gate assertions all passed without further changes. Full log `docs/evidence/r5-round4/part3-round4d.log`.

### Round 4e — remaining run/check/report only

No product or test changes. #21/#19/#18 remain completed: all eleven containing-spec tests passed in Round 4d and are not rerun.

**Part 2 evidence recorded immediately:** therapist `s-th1` on Daniel (`p1`) sees AUDIT-10/DAST-10 incomplete records and `Item 1: Not answered` in Measures → Tracking; gate `{level:"read",locked:false}`, SUD visibility true. Clinical coordinator `s-cc1` has `{level:"none",locked:true}`, visibility false: the entire Measures tab is absent; `?section=tracking` falls back to Brief with no instrument, missing-answer detail or SUD stub. Existing gate/roles only; no new relationship or consent. Screenshots and readback in `docs/evidence/r5-round4/part2-{therapist,clinical_coordinator}.png` and `part2-readback.txt`.

**#16, confirmed seed/date projection mismatch:** at 19:46:46 UTC on 31 Oct, Rosa's `c1` late-cancel visit exists but starts **1 Nov 15:00 UTC**; her same-day `c1` visit is attended and her same-day future visit is `c2` scheduled. `scheduleSegments(...c1..., now).closed` is empty. `clinicianWorkspace.ts:60–67` includes only same-day closed statuses; `demoInboxSeed.ts:229+` explicitly seeds a cancellation for tomorrow. Thus `accessClickThroughOct29.spec.ts:10` pins a tomorrow visit's patient into today's closed bucket. **Proposed test-only fix, not applied:** derive existing eligible off-team visit/patient IDs from the acting clinician's current Today/closed projection and preserve every subsequent reason-gate assertion; if the projection has no suitable row, report that fixture prerequisite rather than inventing a visit, substituting an on-team patient or relaxing booking/access. Current evidence `causes-readback.txt`; no product parity defect found.

**#20, historical failure not reproduced by isolated role/default readback:** a valid synthetic multi-role therapist/coordinator created through the existing registry, with **no clinicianId**, has `progress_note` in its therapist defaults both before and after coordinator reset → therapist switch; saved preferences read back null and UI displays Progress note. `chartActions.ts:362–375` does not require clinicianId for this action, so the earlier missing-clinician explanation is rejected. `QuickActionSettings.tsx` uses the live actor/default projection when preferences are null, and `useActingStaff` subscribes to active role independently of the roster primary role. **Classification:** the historical :62 failure remains an unconfirmed full-flow state/timing issue, not proven permission/held-role or seed drift. **Proposed investigation/fix for approval, not applied:** capture final live actor, device preference and `quickActionsFor(actor)` together with settings row IDs immediately after the actual role-switch UI; compare exact displayed IDs to that in-page current-role projection once the settings state has updated. Keep the disabled-other-role and reset assertions. No role grant/permission change is justified by current evidence. Full original flow still needs cause isolation; isolated evidence `docs/evidence/r5-round4/causes-readback.txt`.

**Public result recorded immediately:** **53/53 passed**, 20.2 minutes, all nine public/website specs, one worker. No failures to mark against the triage list. Log `docs/evidence/r5-round4/public-round4e.log`.

Screener run results and their different spec lists are recorded in the close-out below.

The earlier harness stop was resolved in Round 4c; final Round 4d units passed 3,763/3,763. Earlier browser failures remain unwaived.

**Round 4e close-out — 31 Oct (docs only):** the screener runs used different spec sets, not a regression comparison. Round 4d ran `continuity.spec.ts`, `group2Pathways.spec.ts`, `advocateOnboardingActive.spec.ts`, `advocateSelfSeparation.spec.ts`, and `chartFoundation9b.spec.ts`: **9/10 passed**, known **#13** only. Round 4e ran `continuity.spec.ts`, `group2Pathways.spec.ts`, `advocateOnboardingActive.spec.ts`, `advocateSelfSeparation.spec.ts`, and `consentCaptureB2.spec.ts`: **8/10 passed**, known **#7 and #13**; log `docs/evidence/r5-round4/screeners-round4e.log`. Both #7 (consentCaptureB2) and #13 (group2Pathways) appear in the original triage table; **nothing is new**. Part 3 is 11/11 and public is 53/53 as recorded above; no reruns for this close-out.

**R5 verification done. Exactly still open:** #16 projection-based test-only fix pending Mitch approval; #20 full-flow cause unconfirmed; remaining known browser failures in the triage table remain unwaived (latest screener set: #7/#13); Christi/Dr. Bagga clinical review; State/CalOMS estimate allowance **needs check** (estimates remain excluded absent explicit permission). No product/test/permission/persistence/Supabase changes in this close-out; nothing published.

### Label-only follow-up — 31 Oct
Shared singular/plural estimate label check: full units **3,770/3,770**; existing Tracking/clinician-dashboard browser specs **13/13**, one worker, no failures to mark against this triage list. Tracking screenshot saved under `docs/evidence/r5-round4/tracking-estimate-label-oct31.png`. Direct due-panel walkthrough is unavailable: `RescreenDuePanel` is defined but not mounted by the current clinician route; no product/tests changed to mount it. See screener report Label fix note. #16 approval, #20 unconfirmed cause and remaining known browser failures stay open; clinical review and State/CalOMS needs check unchanged.


## Part 4 — 31 Oct (Mitch approved 15:46 CT)

Draft. No product code, Supabase, permissions, permission snapshots, booking, access or role-rule changes. Persistence OFF; nothing published.

### #16 approved test-only change
Only the Today click setup in `e2e/accessClickThroughOct29.spec.ts:10` changes. The page reads the live acting staff, the host's `resolveWorkspaceActor`/appointment scope and `scheduleSegments(...).closed`, and selects an existing off-team patient whose unchanged chart entry requires a reason. No visit is created and no on-team/direct-entry substitute is accepted. A missing eligible row fails with “fixture prerequisite missing”. Every later reason-gate assertion remains byte-identical. New `browserTriagePart4Oct31Approved.ts` chains after Part 3, checks complete prior/replacement hashes and an exact-once anchor; its regression tests exact apply, drift and reapplication refusal. Earlier adapters remain unchanged.

Validation results will be recorded immediately below. #20 remains investigation only; its spec and product code are unchanged. Evidence: `docs/evidence/triage-part4/`.

**Adapter validation recorded:** Part 4 + unchanged Part 3 regressions **4/4 passed**, 2 files, exit 0. Log `docs/evidence/triage-part4/adapter-tests.log`.

**Full units recorded:** **3,771/3,771 passed**, 431/431 files, exit 0, 311.74s; no unhandled errors. Existing Radix accessibility warnings are in the log, not failed assertions. Log `docs/evidence/triage-part4/units.log`.

**#16 spec recorded:** **0/1 passed**, exit 1, 12.4s, known triage **#16**. The approved prerequisite assertion at `accessClickThroughOct29.spec.ts:30` reports: `fixture prerequisite missing: Today/closed has no eligible off-team reason-gated visit for s-th1; closed visits: none`. This is the explicitly requested missing-fixture outcome; no later gate assertion was reached or changed. Stop on #16: no further edits or reruns. Log `docs/evidence/triage-part4/access-spec.log`; trace/context preserved below. #20 continues independently, investigation only.

**#20 unchanged spec recorded:** **0/1 passed**, exit 1, 31.1s; known triage **#20**, original `quickActionsBatch4.spec.ts:62` missing `pref-progress_note` (30s test limit reached during visibility wait). No test changes. Log `docs/evidence/triage-part4/quick-spec.log`; original trace/context preserved. Full-flow instrumentation follows without repository test/product edits.

### #20 real-flow diagnosis recorded immediately

**Exact cause: deterministic role-switch navigation invalidates the test's settings host assumption — an out-of-date test, not a timing race, stale preference, wrong actor or demonstrated product defect.** `StaffRoleSwitcher.tsx:42–53` explicitly navigates a same-person/different-role switch to the role's permitted home. The real coordinator → therapist switch lands on `/my-work`; `QuickActionSettings` belongs to `/clinician-profile` and unmounts. The unchanged test checks its saved settings locator without returning to that page. Waiting longer cannot bring back an unmounted section.

The standalone instrumentation copied the complete original flow (registry staff fixture, add/reorder, Axe, audit count, disabled-other-role check, actual role switches, content launch, reset) without modifying the original spec or app. It discovered the already-loaded module URLs through CDP and imported those exact URLs, avoiding duplicate bare-source module instances. A single checkpoint immediately before the original line 62 captured:
- URL `/my-work`; live actor `{role:"therapist",staffId:"s-batch4",staffName:"Batch four test staff"}` (no clinician ID, correctly).
- Device preference `null`.
- `quickActionsFor(actor)` exactly `[progress_note, dashboard_book, message_patient, screener_request, dashboard_task]`.
- Settings not mounted; rendered settings row IDs `[]`.
- Mutation timeline confirms settings **did update** after the role switch: therapist default rows appeared at 16027.4ms, followed by host unmount at 16090.1ms. This is not an uncommitted preference/role read.
- Pending tracked timers: two 4000ms Sonner toast timers and one 15000ms NotificationBell interval at the line-62 checkpoint. After the visibility wait, only the bell interval remained; host still absent. Timers scheduled before dev-hook readiness were not introspectable, and are explicitly outside this timer capture; no claim of globally exhaustive timer inventory.

After the existing navigation settled, actor/preference/defaults remained identical and settings remained absent. Instrumentation then returned through existing `go('/clinician-profile')`, waited for the section and checked **exact ordered row equality** against the in-page current-role projection: `[pref-progress_note, pref-dashboard_book, pref-message_patient, pref-screener_request, pref-dashboard_task]`. Progress note visible; consent-form-author count zero. Script exit 0. This diagnostic navigation is not a change to the test. Temporary script initially needed an explicit browser context for the existing Axe check; corrected under `/tmp` only. Its copied visibility assertion used the standalone expect default (5s); the authoritative unchanged one-worker spec retained its existing 15s expectation/30s test limits.

**Proposed fix — test-only host navigation plus state wait/projection assertion; not applied, awaiting Mitch approval:** after the therapist acting-role assertion, wait for the existing role-home navigation, return to `/clinician-profile`, wait for `quick-action-settings`, then keep the original `pref-progress_note` visibility and `pref-consent_form_author` zero assertions. Optionally also compare ordered rendered IDs with the existing in-page `quickActionsFor(actor)` projection after preferences are ready. A timing-only wait on `/my-work` is not sufficient. No product fix, role grant, permission change or navigation-rule change is justified.

Evidence: `quick-flow-readback.json` (joint actor/preference/default/options/DOM/lifecycle/timer checkpoints), `quick-instrumented.log`, `before-line62.png`, `settled-role-home.png`, `returned-settings.png`, and original `quick-results/` trace/context, all under `docs/evidence/triage-part4/`. Screenshots were reviewed: role home has no settings; returned profile displays the five therapist defaults.

### Part 4 final validation and remaining failures

| Check | Result | Remaining failure |
|---|---|---|
| New Part 4 + unchanged Part 3 adapter tests | 4/4 passed | None |
| Full units (final code) | 3,771/3,771 passed, 431 files, exit 0 | None; no unhandled errors |
| #16 spec, one worker | 0/1 passed, exit 1 | Known **#16**: explicit missing fixture prerequisite; Today/closed empty for s-th1 |
| #20 unchanged spec, one worker | 0/1 passed, exit 1 | Known **#20**: line 62 settings-host assertion after navigation to My work |
| #20 diagnostic full-flow/checkpoints/readback | exit 0 | Reproduced original missing host, then exact settings projection verified after returning |

Browser specs combined: **0 passed / 2 failed**, both already in this triage list; no new failure. No full/public suite requested or run. #16 stopped at its required missing-fixture assertion with no later changes. #20 cause is now confirmed; proposed test-only fix remains unapplied. Full units were run after the only test/adapter changes and before serial browser runs; subsequent work changed docs/evidence only. Latest preview signal: build OK.

**Part 4 run/report scope done. Still open:** #16 needs an existing eligible Today/closed off-team fixture before its later gate assertions can run (no seed/visit fabricated); #20 proposed host-navigation test fix requires approval; remaining known browser failures stay unwaived. Prior Christi/Dr. Bagga Draft clinical reviews and State/CalOMS estimate allowance **needs check** remain unchanged. Persistence OFF; no product, Supabase, permission/snapshot, booking, access or role-rule changes; nothing published.
