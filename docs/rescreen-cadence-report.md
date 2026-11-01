# R53 part 1 — Re-screen cadence and member auto-prompts

Mitch, 31 Oct 2026, 16:36 CT. All new clinical rules: **Draft — pending clinical sign-off**. No publication, persistence, Supabase, permission or permission-snapshot changes. Dashboard tile part 2 is excluded.

## Current cadence (before implementation)

- `src/lib/ehr.ts:14151` `rescreensDue` reads `RESCREEN_SCHEDULE` in `screeners.ts:404`: PHQ-9/GAD-7 fixed day 30/60/90 offsets from the first validated history result, then 90 days from the most recent result; AUDIT/DAST/PC-PTSD-5 90 days; PCL-5-20 30 days; HRSN 182 days. It requires scored history, ignores retired forms, and returns the latest unsatisfied fixed step once. Incomplete records are stored outside scored history; estimated results are in scored history.
- `ehr.ts:14202` `patientReassessmentDue` unions cadence rows and open per-instrument `rescreen` tasks after intake completion. Full active instruments only; SUD instruments require the existing `sud_treatment` consent. No weekly prompt cap, visit alignment or dated reminder lifecycle is implemented here today.
- My work derives screener rows from this same due projection. Its 30/60/90 Draft step describes the first-result offsets above, not a separate clock.
- Patient Home's existing `ReassessmentOrCompleteTile` (`src/components/PatientHome.tsx:670`) displays one Reassessment due tile with a list of due instruments and individual Start links. Explicit C-SSRS requests have their own safety path; no automatic C-SSRS administration.
- The weekly MH scheduling rule (`ehr.ts:5753`) matches active mental-health problems, generates routine coordination case tasks on an admin-triggered `runSchedulingRulesNow`, and uses `sourceRuleId`/creation time for a seven-day idempotency window even after task completion. It is not a background timer or a screener-completion clock.

## Requested integration map

1. Instrument intervals belong in the existing `screeners.ts` cadence configuration; `rescreensDue` remains the shared clinical due projection. Replace first-result fixed steps with last-scored per-instrument intervals; retain quick checks and C-SSRS gating. Preserve unrequested PCL-5-20 behavior.
2. Bundle/cap/recent completion/visit timing belong in the existing patient reassessment projection and existing patient-task lifecycle, not another scheduling engine. Staff `rescreen_send` remains immediate. Home retains its single tile and `/rescreen` retains existing answer/safety rules.
3. Prompt/reminder/day-10 writes must pass the registry runner. Reuse existing case-task storage, neutral in-app notifications and item-9 owner routing; do not bypass the existing system-only action gate or widen staff roles.
4. Inspect needs-store provenance before recognizing a member-initiated HRSN completion; absent evidence is **needs check**, not an invented timestamp.
5. Add rule tests and a hash-checked exact-once source adapter after the latest credentialing chain. Existing assertions/snapshots are protected; stop and identify any conflict.

## Results and open review

- Inspection recorded before product/test changes. Focused checkpoint: 38/38 across new R53 rules, protected reassessment/My work/Part 2 and registry snapshot tests. No assertion or snapshot edits.
- Shared `SCREENER_CADENCE` replaces fixed first-result steps; My work's interval projection now comes from the same last-scored clock. HRSN member-update completion signal is **needs check** (no verified signal found; none invented).
- Existing system-only `screener_item9_followup` registry gate gains a cadence-operation store reference, without changing role checks, action rows or permission snapshot. Day-10 tasks reuse clinician/on-call/coordinator routing and existing case-task storage.
- Automatic prompts use existing patient tasks as one bundle. Seven-day cap survives completion; staff requests are immediate. In-app reminders have neutral EN/ES text and day-specific dedupe; no outbound messaging. This runs on the existing app-open reminder sweep, not a continuously running production scheduler.
- Patient Home retains the existing single Reassessment due tile with one bundled Start; `/rescreen/bundle` reuses the existing keyed route and questionnaire writer. No staff/dashboard part-2 tile built.
- **Full-unit stop (31 Oct): 3,793 passed / 1 failed, 433 files, exit 1.** New cadence rules and exact-once regression passed. Sole failure: protected `src/lib/__tests__/consentInventoryB2.test.ts:103` (`consent ledger and separate-store entry points are called only where the inventory lists them`) expects `src/lib/ehr.ts: 46`, receives `47`. R53 adds an existing `isConsentCategoryAuthorized(..., "sud_treatment")` read in the automatic planner. No test/assertion edit, permission/snapshot change, bypass or inventory re-pin applied. Stopped at this conflict as instructed; not a previously listed browser-triage failure.
- **Validation remaining:** patient Home, bundled `/rescreen`, intake, clinician dashboard and public browser suites were not run because full units are not green. Requested bundled PHQ-9/GAD-7, no-SUD absence and immediate-staff-request screenshots have not been captured. No end-to-end claim is made.
- Latest preview compile signal: **build OK** (22:07:49 UTC). This does not replace the failed protected unit assertion or missing browser proof.
- Review findings retained for the next approved continuation: reminders currently run on exact elapsed day 3/7 only (an unopened app does not produce guaranteed dated delivery); cap uses task creation timestamps. Both need end-to-end confirmation alongside visit alignment and incomplete-bundle progression. No production scheduler or needs-update completion event invented.
- Christi: confirm 90-day instrument intervals and whether needs-store events establish an HRSN completion signal.
- Dr. Bagga/Christi: review all Draft cadence, prompt timing, reminder and outreach rules.
- State/CalOMS estimate allowance remains **needs check**; existing estimate exclusions unchanged.

## Approved finish — 31 Oct 18:25 CT

- Applied the exact approved consent-call count 46→47 with a new hash-checked adapter chained after `rescreenCadenceOct31Approved`; no other consent-inventory test text changed. Inventory now records `ehr.ts:14165`, category `sud_treatment` and the R53 auto-prompt purpose.
- Restored the item-9 registry entry from the immutable pre-R53 approval fixture, including its sole `createItem9FollowupTask` store reference. Cadence sweep now calls dedicated `rescreen_cadence_automation` using the same system actor; prompts/reminders/day-10 writes use that action.
- Snapshot checkpoint: `vitest run src/lib/__tests__/runAction.test.ts -u` **7/7 passed**. Compared complete before/after text: exactly **18 added `"rescreen_cadence_automation": "hidden"` rows**, one per staff role; no other added/removed rows.
- Reminders and day-10 tasks run only on the existing **app-open sweep**. Exact-day delivery needs a production server-side scheduler, build path **R48**; no scheduler was built here.

### Full-unit result and mandatory stop (finish continuation)

- Full units: **3,816 passed / 2 failed, 435 files (433 passed / 2 failed), 3,818 total**, exit 1. Approved consent inventory is green; new finish exact-once regressions (5/5), dedicated cadence audit/denial tests (19/19), and the registry snapshot are green.
- **Protected conflict 1:** `src/lib/__tests__/rescreenCadenceR53.test.ts:82` still calls `runAction("screener_item9_followup", ..., { via: "runAutomaticRescreenStep" })` and expects success. The approved item-9 restoration correctly removes that store reference, so the call is refused. The same obsolete action call also appears at line 89 but execution stops at line 82. Proposed narrow follow-up: approve changing only those two action IDs to `rescreen_cadence_automation` through an exact-once chained re-pin, retaining every assertion and all inputs. Not applied: this existing test was not among the approved test edits, and this is not the standing earlier-adapter exception.
- **Protected conflict 2:** `src/test/rescreenCadenceOct31Approved.test.ts:15` derives the earlier `chartActions.ts` baseline from current source; the later approved dedicated action supersedes that entry, so its earlier prior-source hash reconstruction fails. This is a candidate for the narrowly scoped standing earlier-adapter immutable-fixture exception; no change was applied after the mandatory conflict stop. Proposed follow-up: use the earlier immutable prior/replacement fixture only for this path, preserve exact/drift/reapplication assertions, and ensure the later regression verifies the final chart-action chain.
- Both failures are **unit conflicts, not entries in the browser triage list**. No other failures were reported. No existing test assertion was changed beyond the approved consent count; no unrelated snapshot row changed.
- **Browser suites and requested screenshots remain unrun** because the full-unit gate failed and the instructions require stopping on another conflicting assertion. Thus Home/bundle/intake/dashboard/public and immediate-staff-request UI proof are still open; no end-to-end completion claim is made.
- All changes remain Draft; no dashboard part-2 tile, publishing, persistence or Supabase changes. Christi's 90-day interval confirmation and the HRSN member-update signal (**needs check**) remain open, as does R48 exact-day production scheduling.
### Final reconciliation (approved 1 Nov 09:45 CT)

- **Conflict 1 fixed:** `rescreenCadenceR53.test.ts` lines 82/89 action ID `screener_item9_followup` → `rescreen_cadence_automation` only (inputs/assertions unchanged), via new exact-once re-pin `src/test/rescreenCadenceReconcileNov01Approved.ts` chained after `rescreenCadenceFinishOct31Approved.ts` in `credentialingOct27Approved.ts`. Own regression (exact apply, drift, reapplication, only-two-IDs, chain) passes.
- **Conflict 2 — standing OK used (1st recorded use):** `rescreenCadenceOct31Approved.test.ts` chartActions path now reads immutable prior/replacement fixture `rescreenCadenceOct31ChartActions.fixture.json` (prior hash matches the original adapter's `priorHash`; replacement equals the finish re-pin's `priorSource`) and calls its own adapter. Exact/drift/reapplication kept; no adapter hash, anchor or logic changed. The finish regression already verifies the final chartActions chain (`readFileSync === updatedSource` and byte-for-byte item-9 entry).
- Focused: 5 files, 50/50 passed.
- **Full units: 3,821/3,821 passed, 436 files.**
- Browser env note: sandbox browser build mismatch (needed v1194); installed into /tmp/pw2 only, no project/config changes. First launch attempt failed before any test ran.
- **Member/clinician browsers** (`continuity`, `group2Pathways`, `advocateOnboardingActive`, `advocateSelfSeparation`, `chartFoundation9b`, `consentCaptureB2`, `roleDashboards9c`; `--workers=1`, :8080): **21/23 passed**, EXIT 1, 7.2m. Failures: `consentCaptureB2.spec.ts:46` (Purpose is now a select — **known triage #7**) and `group2Pathways.spec.ts:18` (chip "Re-entry" vs "Re-entry + SUD" — **known triage #13**). No new failures. Log `docs/evidence/rescreen-cadence/member-clinician.log`.
- **Public browsers** (9 public/website specs, `--workers=1`, :8080): **50/53 passed**, EXIT 1, 20.4m. All three failures are the same "Back to top" check ending at `scrollY = 1` instead of 0: `websiteDaylight.spec.ts:7` (1280 en), `websiteDaylight.spec.ts:7` (390 en), `websitePolish.spec.ts:14` (/team). **Not in `docs/browser-triage-oct30.md` — new to this run.** R53 changed no website code. These runs used Chromium 147 linked in place of the expected build (see env note), so a one-pixel scroll difference from the browser build is the likely cause, but **unconfirmed**; no test or code change made. Log `docs/evidence/rescreen-cadence/public.log`.
- **Walkthrough screenshots** (`docs/evidence/rescreen-cadence/`), synthetic demo data via real store writers in the in-memory session:
  - `1_bundled_phq9_gad7.png` — member p1 with PHQ-9 and GAD-7 due sees one "Reassessment due" tile with a single "Start check-ins" button.
  - `2_no_sud_no_audit_dast.png` — same member p1 (no SUD flag) also had 400-day-old AUDIT/DAST-10 results; due list stayed `[phq-9, gad-7]`, AUDIT/DAST absent.
  - `3_staff_request_immediate.png` + `3b_rescreen_bundle.png` — member p4: `runAction("rescreen_send")` for PC-PTSD-5 returned ok; due list changed from `[phq-9, gad-7]` to `[pc-ptsd-5, phq-9, gad-7]` at once, and `/rescreen/bundle` opens on PC-PTSD-5.
- Reminders (day 3/7) and the day-10 task run on the existing app-open sweep; exact-day delivery needs a server-side scheduler in production (**R48**).

### Status

R53 part 1 is **done** apart from the items below:
- New public "Back to top" failures (3 checks, above): need a decision — rerun on the expected browser build, or triage.
- Christi: confirm the 90-day intervals (AUDIT/DAST, PC-PTSD-5, HRSN reentry) and the HRSN member-update signal (**needs check**).
- R48: production scheduler for exact-day reminders and the day-10 task.
- Known triage failures #7 and #13 unchanged.

## Part 2 — dashboard tile (Mitch, decided 31 Oct 16:36 CT; started 1 Nov)

Draft — pending clinical sign-off. No publishing, persistence, Supabase, permission or snapshot changes.

### Inspection (before changes)

- Clinician workspace Today tiles come from `workspaceTileOrder` (`src/lib/clinicianWorkspace.ts`): clinician roles (therapist, PMHNP, physician and other non-care, non-coordinator roles) render **4 tiles** — Schedule, Needs my action, My caseload, Requests & booking. Care roles render 3 (Needs my action, Scheduling, My caseload); coordinators render 3 (Coordinator queue, Scheduling, Needs my action).
- Screener rows today: `workspaceActionRows` adds one `screener` row per due instrument from `screenerDueRows(myCaseload(actor), { role })`; the same rows feed `attentionCaseload` (caseload badges). `screenerDueRows` already removes AUDIT/DAST per patient when the viewer's `screeners_sud` gate does not resolve.
- Pinned files touched by this batch: `clinicianWorkspace.ts` (byte check through the credentialing chain), `WorkspaceDashboard.tsx` (binding inventory in `roleDashboardParity9c2`), `RecordTabs.tsx` (Tracking instrument filter). `workspaceTileOrder` has an existing exact assertion, so it stays unchanged; the new tile is added beside it.
