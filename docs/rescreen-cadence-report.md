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
- Christi: confirm 90-day instrument intervals and whether needs-store events establish an HRSN completion signal.
- Dr. Bagga/Christi: review all Draft cadence, prompt timing, reminder and outreach rules.
- State/CalOMS estimate allowance remains **needs check**; existing estimate exclusions unchanged.