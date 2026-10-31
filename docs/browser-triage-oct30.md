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

## Part 3 — 31 Oct (Mitch approved 08:28 CT): not started after mandatory A stop

Draft — pending clinical sign-off. No publishing, persistence change, Supabase change, permission change or permission-snapshot change.

The round-4b clinician comparison and new exact-once adapter passed **22/22**. The unchanged earlier harness regression then failed at `src/test/screenerHarnessOct31Approved.test.ts:10:31` (its older replacement anchor no longer appears in the approved final source): **22 passed / 1 failed** including that regression. This is not a failure on this browser-triage list. Per section A's mandatory stop, **sections B–D were skipped**; no browser specs were changed or run in Part 3.

Still open, with approved scope retained:
- **#21:** exact row-ID comparison using `listUnsignedWork({authorId:'c1', viewer:{role:'therapist', staffId:'s-th1'}})`, all existing filters retained, through a new exact-once adapter.
- **#19:** valid roster Intake Coordinator for pool assertion, separate clinical-coordinator oversight assertion, no widened access.
- **#18:** only the named Part 2 checkbox title replacement, seven-item count retained; stop on any subsequent legacy card/gate failure.
- **#20 and #16:** report-only investigations still pending; Part 2's unresolved findings remain provisional, not newly confirmed causes. No invented visit or relaxed booking/access rule.
- Every changed/investigated spec rerun with `--workers=1`, plus the requested screener-adjacent and public suites; combined failure report. No new browser count is claimed.

The protected harness assertion and proposed narrowly scoped resolution are recorded in `screener-completeness-report.md`, Round 4b. Earlier browser failures remain unwaived.
