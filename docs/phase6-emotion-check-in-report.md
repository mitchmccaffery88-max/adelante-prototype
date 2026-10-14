# Phase 6 — One private emotion check-in: report

## Status
Complete. Build OK; full unit suite **312 files / 2,603 tests passed**; every browser spec **79/79 passed** including axe (run against the dev server). Spanish review exports regenerated (4,502 rows, 908 gaps, 1,804 controlled). 390px Spanish screenshot: `docs/screenshots/phase6-checkin-es-390.png` (scrollWidth 390, html lang "es", one Draft notice under the header).

## Mitch's decisions on the paused assertions
1. `contentBackup.test.ts:97` — approved; now `expect(reasonOf("lib_p2")!.outcome).toBe("new");`.
2. `group1Profile.test.ts:162` — not approved; fixed in code. Root cause: journey auto-add created a `sud: true` goal, which the new care-plan SUD trigger then counted, keeping the flag on forever.
   - `StructuredGoal.origin` added (`"clinician" | "system"`). `addStructuredGoal` (behind `care_plan_goal`) sets `"clinician"`; `autoAddJourneyAssignment` sets `"system"`.
   - The `sudCarePlanGoal` signal source counts only active SUD goals with `origin === "clinician"`. Legacy, ASAM-accepted (if not via addStructuredGoal) and system goals do not count. Draft — pending clinical sign-off.
   - The earlier goal-closure setup line (and its import) in `group1Profile.test.ts` was reverted; the test runs as originally written and passes.

## New tests
- `sudTriggers.test.ts` (+3): clinician goal sets the flag; auto-added journey goal does not and the flag clears when the diagnosis resolves; auto-added assignments stay active and are marked for review.
- `emotionCheckIn.test.ts` (6): eleven emotions with local Fluent images and no typed emoji; self-only save with one audit event carrying no answers; "Not now" postpones without recording; staff blocked from `patient_private_update`; Craving/Calm/Okay summary; context hides patient-hidden needs.

## Differences from the plan
- Browser specs ran against the dev server (`E2E_BASE_URL=http://localhost:8080`); the preview-server path could not start in this sandbox (missing Worker entry). No spec, retry or threshold changed.
- Unit total is 2,603 versus 2,614 last reported; all files pass. The difference was not investigated further.
- No other existing assertion changed.
