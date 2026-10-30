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

### Current checkpoint: stopped on existing assertion conflicts

Implementation is partial, not accepted as complete. No existing tests or snapshots were edited. No new source re-pin was written after finding the conflicts. Nothing published; persistence OFF; no Supabase changes.

- Added a separate total-only estimator: PHQ-9 with 1–2 missing shown items and GAD-7 with exactly 1 missing item; rounded answered mean × instrument length. Other instruments remain unscored when incomplete. The original completeness assessment still reports the missing raw answers faithfully.
- Intake and rescreen share the member writer. Estimated results carry `estimated: true`, `missingItems`, raw null responses and declined/skipped provenance in scored history. The item-9 crisis check reads only raw answers; the existing follow-up registry action is still called for a blank/declined item 9.
- Follow-up routing now uses primary licensed clinician → licensed on-call clinician → clinical coordinator role pool, never case manager. Due at the next scheduled/checked-in contact within seven days, otherwise two business days for outreach (weekends excluded). Neutral task title: “Screening follow-up needed”; chart task detail uses Mitch's specified wording plus the Draft label.
- Shared intake/rescreen controls and quick check offer “Prefer not to answer”; the member-required submit blocks were removed. Staff pre-release entry requires an explicit answer or decline for each shown item. Declines are stored as null responses with `declinedItems`; untouched blanks have `skippedItems`. C-SSRS was not changed.
- Intake/rescreen have a once-only item-9 re-prompt; **remaining**: focus/scroll back to item 9 and visibly prove 988 on that prompt screen. Spanish copy is Draft.
- Tracking rows/score tables carry estimate labels, and missing-item detail distinguishes Declined/Not answered. **Remaining**: audit every score display/tooltip and care-plan display, fully verify reassessment/caseload readers, and remove member intake score previews (the earlier “no scores” claim above was not true in source).
- Unsupported agentic/content-tag readers and the population reporting projection exclude estimated results. No direct ScreenerResult field was found in the structured CalOMS export. **Needs check**: external state/CalOMS specifications explicitly allowing estimates; no such permission is assumed.
- Store/registry module-cycle protection uses `screenerWriteBoundary`; the member writer registers itself without importing the registry into the EHR store. **Remaining**: verify all rescreen store entry points initialize that writer.

### Existing assertion conflicts (unchanged tests)

Focused run: `src/lib/__tests__/screenerCompletenessR5.test.ts`, **3 passed / 3 failed**.

1. **Line 45** (related assertions 46–48): one missing PHQ-9 item previously had to be in `incompleteScreeners`, without a score. It now belongs in scored history as an estimate. Proposed assertion: latest scored PHQ-9 has `estimated: true`, `missingItems: [3]`, `responses[3] === null`, score **7**, and no new incomplete record.
2. **Line 60** (source record lookup line 59): blank item 9 previously read from incomplete records. Proposed assertion: read latest scored PHQ-9, expect `estimated: true`, `missingItems: [8]`, raw item 9 null, `itemDisplay(result, 8) === "Not answered"`, estimated total **9**; retain existing task-present and no-crisis assertions.
3. **Line 76**: one missing item previously could not create a severity flag. Proposed assertion: score **24**, estimated marker and missing index **7**, with severity allowed to evaluate the estimate; add a separate ≥3-missing case proving no score or severity action. No assertion is changed pending Mitch's approval.

### Remaining validation

New follow-up rule tests, approved exact-once source adapter, full units, and the requested targeted/public browser run remain pending at this stop. No browser run was started. The earlier browser-triage failures were not rerun or waived.

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
