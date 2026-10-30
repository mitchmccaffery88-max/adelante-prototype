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
Affected specs re-run: see roadmap/closing note. A full 270-test browser run takes about two hours on one worker and was not completed in this round; the last full run remains 246/270 with the 24 above, of which 3 are now fixed.
