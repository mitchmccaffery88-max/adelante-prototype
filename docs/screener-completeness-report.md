# Screener completeness (R5) — 30 Oct 2026

Approved by Mitch 30 Oct. The clinical rules are **Draft — pending clinical sign-off** (Christi, Dr. Bagga). Nothing published. Persistence OFF. No Supabase changes.

## Write paths (all screener writes)
| Path | File:line | Coerced blanks before? | Now |
|---|---|---|---|
| Intake submit (PHQ-9, GAD-7, PC-PTSD-5, AUDIT-10, DAST-10, AHC-HRSN) | `src/routes/intake.tsx:784` → `src/lib/screenerIntake.ts:13` | Yes, blank → 0 | A blank shown item stays null. Incomplete goes to `recordIncompleteScreener` (`ehr.ts:10115`) |
| Intake review summary (member/assisted view) | `src/routes/intake.tsx` review step | Yes, previewed blank as 0 | Shows "Incomplete · N of M answered" |
| /rescreen | `RescreenForm.tsx:73` → `ehr.ts:14200` | Gated items only (completion already required) | Gated items listed in `notAskedItems` and scored per the instrument |
| QuickCheckCard (PHQ-2/GAD-2), caseload review | `QuickCheckCard.tsx:37`, `caseloadReview.ts:309` → `ehr.ts:11287` | Yes in the store (`Number(b) \|\| 0`); the UI already required every item | A blank item is recorded incomplete, with no score and no escalation |
| /safety-check C-SSRS (patient and staff) | `CssrsForm.tsx:103`, `demoInboxSeed.ts:110` → `ehr.ts:10839` | Gated items stored as -1 | -1 kept for older readers; `notAskedItems` added; staff display reads "Not asked" |
| Pre-release staff-entered screener | `PreReleaseScreenerDialog.tsx:49` → `ehr.ts:15823` | Length check only | Every shown item must be answered (`screenerComplete`) |
| Pre-release AHC-HRSN import | `ehr.ts:15804` | No (domain results only) | Unchanged |
| Screener drafts | `screenerDrafts.ts:85` | No. Drafts never reach history | Unchanged |
| Demo seeds | `ehr.ts:26600`, `26676`, `27160`, `identityDemoSeed.ts:62` | No. Seeded with full arrays | Unchanged. Stamped complete by `recordScreener` |

## Rules installed
- **Not asked** (the instrument's own skip logic, e.g. the PC-PTSD-5 gate or C-SSRS gating): recorded in `notAskedItems` and scored by the instrument's published rule (0 for every gate in use). These count as complete.
- **Unanswered** (shown, left blank): stored as `null`. The screener is **incomplete**: no total, no severity band, no prorating. It is stored with its answered count ("7 of 9 answered") in `Patient.incompleteScreeners`, never in `screeners` or `screenerHistory`.
- Because incomplete screeners are kept apart, these all skip them by construction and never read them as low: severity rules and notifications, reassessment-due logic, caseload review, care-plan score bands, tag-based content suggestions, population reports and CalOMS/state exports. The staff Tracking tab lists each one as "Incomplete · N of M answered", with Part 2 gating applied to SUD instruments.
- PHQ-9 item 9 left blank: staff see "Item 9: Not answered". A neutral task, "Self-harm question not answered — ask at next contact", goes to the primary clinician (or the case manager if there isn't one) through the registry entry `screener_item9_followup`, run by the system follow-up actor only.
- Crisis path unchanged: any **answered** item 9 above 0 still raises the crisis flag, the crisis task and the C-SSRS request, even when the PHQ-9 is incomplete.
- Member: no scores. After intake, a member who skipped questions sees "You skipped some questions. That's okay — your care team may ask about them." The Spanish is a draft.
- Existing records: a result with no completeness stamp (recorded before this fix) shows "may include unanswered items" in the staff Tracking tab. No data migration.
- Members can still skip any intake question. /rescreen and the quick check still ask for every shown item before submit, as they did before; the store now refuses to coerce blanks if one ever arrives.

## Approved re-pin
- `src/test/screenerCompletenessOct30Approved.ts` (exact-once, `src/lib/ehr.ts`, prior c5da7490… → updated), chained after the family-request Oct 30 layer in `src/test/credentialingOct27Approved.ts`.

## Tests
- New: `src/lib/__tests__/screenerCompletenessR5.test.ts` (6 tests): blank stays blank; instrument-skipped items score per the instrument; incomplete has no total; blank item 9 creates the task and doesn't trip the crisis rule; answered item 9 of 1+ trips it (complete and incomplete); severity rules ignore incomplete screeners.
- Full units: **3,724 passed, 1 failed (3,725)**. The failing existing assertion was not edited:
  - `src/lib/__tests__/runAction.test.ts:14` "role × action × outcome matrix matches the committed snapshot". The snapshot `src/lib/__tests__/__snapshots__/runAction.test.ts.snap` lacks the new registry row `"screener_item9_followup": "hidden"` for every staff role (diff at snapshot line ~234). Needs Mitch's approval to update the snapshot.
- Full browser suite, once, after units: `E2E_BASE_URL=http://localhost:8080 bunx playwright test --workers=1`. Result: **246 passed, 24 failed, 1.0 h, EXIT 1** (`/tmp/r5/browser.log`). Nothing was rerun or waived. None of the failures is on a screener, intake-scoring or Tracking path. Whether each predates this batch **needs check**: the last full-suite run on record was 224/224 (B2-4), and every batch since ran only the public suite.
  - access.spec.ts:18 (click timeout at :50); accessClickThroughOct29.spec.ts:3 (click timeout at :10)
  - adelBrief.spec.ts:27 (openBrief wait at :15); adelHistory.spec.ts:16 (shared-summary text at :63)
  - consentAuditB2.spec.ts:23 (:50), consentCaptureB2.spec.ts:45 (:51), consentLifecycleB2.spec.ts:47 (:55): `consent-capture-panel` not visible
  - consentWorkflow.spec.ts:32 (click timeout at :49)
  - crossRole.spec.ts:62 J7 ASAM section ×4 (pmhnp, sud_counselor, peer_specialist :79; nurse_rn :78)
  - crossRoleJourneys.spec.ts:39 (:51); group2Pathways.spec.ts:16 (pathway chip text at :48)
  - overflow9c.spec.ts:22 /case-manager and /admin at 390px (scrollWidth 619)
  - quickActionsBatch4.spec.ts:4 (:62); quickActionsMenu.spec.ts:51 (:55)
  - remainingQueueTables8b2.spec.ts:82 (projection at :86); staffRosterCredentialTables8b2.spec.ts:5 (roster 24 vs 23 at :14)
  - staffShell8a1.spec.ts:79 (New slot button at :83)
  - staffTables8b1.spec.ts:21 /notes-queue 1280 and 390 (row count at :40), /case-manager 390 (width 619 at :56)

## Open for Christi / Dr. Bagga
- Prorating rules (none applied).
- Task wording and owner for an unanswered item 9.
- Whether /rescreen and the quick check should also let members skip.

## Follow-ups (30 Oct)

Mitch's follow-up decisions supersede the original no-prorating, case-manager fallback and member-required-item rules above. Every clinical rule below is **Draft — pending clinical sign-off** (Christi, Dr. Bagga).

### 31 Oct completion attempt — stopped at a newly exposed existing assertion

Not complete; the roadmap remains open rather than incorrectly marked done. Nothing published; persistence OFF; no Supabase changes. Permission snapshot unchanged. Only the three approved assertion blocks in `screenerCompletenessR5.test.ts` were updated; no other existing test was edited.

**Implemented and checked before the stop:**
- The approved R5 tests pass **6/6**. Added `screenerFollowupsR5.test.ts`: **18/18** pass (24 focused checks total), covering PHQ-9 one/two blanks, three-blank exclusion, GAD-7 thresholds/rounding, all other instrument exclusions including C-SSRS/AHC-HRSN, null item 9/crisis separation, clinician/on-call/coordinator ownership, contact/outreach dates, decline/skip storage, staff explicit recording, and incomplete severity exclusion.
- Staff timeline/table/answer details retain estimate labels. Generic trend excludes estimates rather than displaying an unlabelled value. Per-series latest header shows a newer incomplete submission instead of the older score.
- Care-plan screener highlights retain estimate metadata; staff badges and focus-area bands label it. Care-plan population averages and the older screener-population summary exclude estimates. Member intake review now shows answered counts, never scores. Incomplete HRSN no longer supplies a zero-filled domain preview at submission.
- Severity may evaluate estimates as approved; derived score-change text labels both current/prior estimates. Clinician due-list score comparisons label both. Prerelease result displays distinguish newer incomplete submissions. Task-list collapsed text stays neutral; clinical item-9 detail appears only in the expanded clinician/coordinator view.
- Intake/rescreen prompt moved inside item 9, with a local 988 call/text line and focus/scroll effect. **Not verified end-to-end**: the live mobile check was disrupted by Vite dependency reload/hydration recovery; do not treat it as a pass. Desktop/Spanish/intake checks remain open.
- Fixed the store-only rescreen writer initialization gap: the writer no longer imports the registry; item-9 commands queue until the registry runner is available, then execute through `runActionOrThrow`. Focused tests prove the ordinary complete rescreen now saves/closes its task and the item-9 tests still pass.
- Approved exact-once adapter: **`screenerFollowupsOct30Approved.ts`**, chained after the original R5 adapter via `credentialingOct27Approved.ts`; covers `ehr.ts`, `clinician.tsx`, and `populationHealth.ts`, with prior/replacement hashes and exact-once anchors. Final adapter updates after the stop have not been rerun.

### All validation failures together

Full units (before writer-initialization fix/final adapter completion): **3,739 passed / 4 failed**, 423 files, 180.06 seconds.
1. `billingProjectionB3b.test.ts:100` therapist source parity — clinician score-label source not yet included in adapter. Adapter added; focused rerun passed.
2. Same line, sys_admin source parity — same cause and passing focused rerun.
3. `statTileParity9a2.test.tsx:40` populationHealth source parity — earlier estimate exclusion not yet included in adapter. Added to final adapter; not rerun after the mandatory stop.
4. `reassessment.test.ts:16` — “Screener writer not ready.” Fixed the actual initialization defect; this assertion passes in focused rerun.

**Newly exposed blocking assertion (not changed):** `src/lib/__tests__/reassessment.test.ts:23`:
```ts
expect(() => AdelanteEHR.completeRescreen(p.id, "phq-9", [0, 1], { actorId: p.id, actorRole: "patient" })).toThrow();
```
Focused rerun: **26 passed / 1 failed** (reassessment 2/3 + R5 24/24). This expects missing answers to be refused and conflicts with Mitch’s approved member-optional rescreen rule. As instructed, stopped without changing it. Proposed approval: replace that assertion with an incomplete result assertion, `status === "incomplete"`, responses `[0, 1, null, null, null, null, null, null, null]`, seven skipped items, no score, no new scored history, and any existing rescreen task still open. Item 9 follow-up remains registry-only.

No requested targeted/public browser suite was started after the stop; no final full unit rerun. None of the unit failures above is a browser-triage-list entry. The prior 21 known browser failures remain unwaived.

### Downstream audit inventory and remaining work

| Production reader/display | Current handling / remaining check |
|---|---|
| `screenerIntake.ts`, `screenerCompleteness.ts`, `ehr.ts` result/history storage | Estimates preserve null answers, missing indices and decline/skip provenance; incomplete separate/unscored |
| `ehr.ts` recordScreener/_applySeverity; `severityRules.ts`; Brief/severity task consumers | Estimates allowed; score-change text labelled; raw item 9 only for crisis |
| `trackingTimeline.ts`; `RecordTabs.tsx` timeline, series tables/tooltips, missing-item detail | Estimate metadata carried; generic unsupported trend excludes; newest incomplete series header added; final browser check pending |
| `ehr.ts` care-plan summary/highlights/focus/metrics; `CarePlanCard.tsx` | Staff highlights/focus labelled; member summary withholds estimated bands; population averages exclude |
| `structuredCarePlan.ts` latestScore/planSuggestions | Approved estimates used in score-band suggestions; no numeric score display here |
| `clinician.tsx` RescreensDueCard | Current/prior displayed scores labelled; newer incomplete fallback still needs final review |
| `ehr.ts` rescreensDue/patientReassessmentDue/completeRescreen; `caseloadReview.ts` | Cadence uses scored dates (including estimates); incomplete does not reset it; caseload PHQ-2/GAD-2 cannot estimate; optional-blank test approval blocks final verification |
| `contentTags.ts`; `agenticPrototype.ts` | Unsupported readers exclude estimates; hidden-count wording and historical fallback semantics still need final audit |
| `populationHealth.ts`; `ehr.ts` screenerPopulationSummary/getPopulationCarePlanMetrics | Estimates excluded before numeric projection; final source-pin/unit rerun pending |
| `ehr.ts` getScreenerResult/viewScreenerResult; `pre-release.tsx`; `PreReleaseScreenerDialog.tsx` | Existing Part 2 gate preserved; prerelease labels/incomplete fallback added; generic API unsupported-reader policy needs final audit |
| Intake/re-screen/QuickCheckCard | No member scores; explicit decline allowed; item-9 prompt visual/one-time/skip verification pending |
| `CssrsForm.tsx`, `CssrsStaffControl.tsx`, `/safety-check` | Unchanged administration/gating; no estimates; targeted browser verification pending |
| `PatientHome.tsx`, `whatWouldHelp.ts`, `ehr.ts` HRSN materialization | HRSN domains only, never eligible for estimation; incomplete source exclusion final review pending |
| `chartBrief.ts`, `BriefTab.tsx`, `adelDrafts.ts` latestFromHistory | C-SSRS risk-only reads; not eligible for estimates |
| `reportingTotalsExport.ts`, admin caseload CSV, structured CalOMS/state projections | No direct screener score columns found; estimates excluded from shared population projections; external estimate allowance remains **needs check**, not assumed |
| `notePdf.ts`, disclosure/packet exports | Authored note text/not live score projection; no stripping of signed narrative or change to disclosure gates |
| Demo/version seeds and migration readers, `chartOrders.ts`, `patientMerge.ts`, `adelBrief.ts` cache key | Storage/version/existence/date consumers; no new estimate scoring or export authority |

Remaining: Mitch approval of `reassessment.test.ts:23`; finish the audit gaps above and deeper store-level staff-entry/queue tests, confirm all UI score labels and incomplete fallback, verify prompt at 390/1280 EN/ES, rerun full units then targeted/public browser once with one worker, and only then mark done.

### Clinical review register (Christi / Dr. Bagga)

Each item is **Draft — pending clinical sign-off**:
- PHQ-9 1–2-missing and GAD-7 1-missing estimation thresholds, rounding, and all never-prorate exclusions.
- No imputed item 9, unchanged positive-answer crisis routing, and blank/declined-item follow-up even for estimated totals.
- Use of estimated totals in severity/reassessment/caseload/care-plan score bands; explicit estimate label at every score display and fail-closed unsupported readers.
- Exclusion from unspecified state/CalOMS exports; external specification review remains needs check.
- Clinician → on-call → coordinator-pool follow-up ownership, specified clinical detail and neutral notification/task-list wording.
- Next-contact within seven days versus two-business-day outreach deadline (holiday calendar not yet specified).
- One member item-9 re-prompt with visible 988, skip afterward, no other-item re-prompt; Draft Spanish/native-speaker review.
- Explicit declined versus skipped provenance, member optional answers, staff explicit-answer-or-decline requirement; unchanged C-SSRS administration/gating.
