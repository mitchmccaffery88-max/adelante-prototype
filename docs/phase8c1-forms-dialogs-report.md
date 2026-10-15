# Phase 8c-1 — checkpoint report (15 October 2026)

## Status: stopped at Mitch's existing-test failure checkpoint

Rollback before application edits: **97668bd969a632fe3706613359bb1d448f4ead27**.

- Latest harness build: **build OK**, 2026-10-15T13:11:58Z.
- Full unit suite: **2,638 passed / 2,638 vitest-listed**, 318 files; none skipped. Baseline 2,625 plus 13 new tests. Earlier intermediate full run: 2,635/2,635 before the final three adapter tests were added.
- New dialog browser coverage: **3/3 passed**, including axe on content, calendar and consent dialogs with invalid-reason feedback, safe initial focus, cancel and successful real-store audit readback.
- Full browser suite: **92 listed; 9 passed, 1 failed, 2 interrupted, 80 unstarted**, stopped with max-failures=1. Not a completed or green browser suite. No existing test deleted/skipped, and no retry/timeout/threshold changes.
- **18/18 requested screenshots saved** at `docs/screenshots/phase8c1/`: content/calendar/consent × 390/768/1280 × light/dark. Every capture measured minimum text 14px, no dialog horizontal overflow and in-viewport bounds. Three representative images visually inspected.

## Exact stop and proposed line for approval (not applied)

Existing failure: `e2e/cfProxyMode.spec.ts:37`, within the test starting at :95, “the SAME ECM Provider CAN proxy-enter for a PROXY-mode CF Care Manager”.

Current line:
```ts
  await option.click();
```
Candidate proposed exact line:
```ts
  await option.press("Enter");
```
Why: the Darnell Pope Radix option was found and became visible/stable, but pointer selection timed out at the existing 30-second test budget. The file already documents keyboard opening of these selects. This candidate is **unverified**, not an established diagnosis or applied fix. No rerun or investigation beyond reading the failure log occurred after the stop. Mitch can approve investigation/code correction instead of a test-line change.

The two consentWorkflow browser tests were interrupted by the suite stop; their approved publication step is therefore not yet verified in the complete existing workflow. The separate new consent browser test passed.

## Implemented

- Staff-only FormField: label/help linkage, reason label, blur/attempt validation, corrective gold/attention feedback, aria-invalid, 14px minimum and mouse/coarse-pointer sizing classes.
- Staff-only ConfirmDialog: controlled Radix alertdialog, safe focus, verb primary action, quiet keep choice, required trimmed reason, no callback on cancellation, double-click guard, failed operations retained for correction, no audit sink.
- CMS missing-review-note confirmation, inline editor reason upgrade, withdraw/discard dialogs; content store and registry unchanged.
- Location calendar removal confirmation; existing calendar stores, role gates, lifecycle event and registry event unchanged.
- Consent publication requires reason before state mutation; saves it in existing consent_form.published detail; real seed publication supplies a neutral Draft reason. Approval/version/signature rules unchanged.
- Exactly the two approved existing test locations changed. No other existing assertions changed.

## Real audit readback

New browser tests confirmed:
- CMS return reason `Add clearer draft wording`, withdrawal reason `Editorial revision needed`; exactly one registry success each for return/discard/withdraw.
- Calendar domain event reason `Usual hours restored`; exactly one calendar removal domain event and one existing registry success. Cathy remains read-only in location calendars.
- Consent v2 reason `Reviewed consent — Draft`; one matching publication event, v1 retired. Unit checks additionally prove one publication domain event plus one registry success and no version mutation on blank reason.
- Part 2 content unit checks preserve the exact reason in gated revision history and neutral masking in the generic lifecycle audit.

## Deviations and limits

1. **Existing RemoveControl was defined but not mounted anywhere** (source reference scan). Mounted the existing gated control in History/Audit so the planned withdrawal/discard dialogs could actually be used and verified. This exposes those already-implemented actions in that view; no new store actions or permission gates. This is a UI-placement deviation from the plan and needs Mitch's review.
2. Two initial new browser tests failed: CMS looked for the unmounted removal control; calendar switched actor before the nested sheet finished closing. Fixed mounting and added close-state waits in the new test only; no limits/retries changed. Final new tests 3/3 pass.
3. Screenshot run logged an existing clinician dashboard SSR hydration mismatch in a time-left label (server “1h 58m left”, client “1h 60m left”). No dashboard code changed; no claim that this is fixed.
4. Screenshot checks validate mouse dimensions/classes and responsive layout. **Actual coarse-pointer 48px sizing and focus-return after a removed trigger are not yet fully verified**; do not mark them complete.
5. Full browser regression and remaining broader new coverage (explicit integrity refusal, shipped-baseline readback, keyboard Escape/focus-return units, additional valid publish-review path) remain pending due to the stop. No 8c-2 work started.
6. Withdrawing copy explicitly warns a shipped baseline may reappear; no invented undo or notifications.

## Files

Application: `src/components/staff/form-field.tsx`, `confirm-dialog.tsx`; `src/components/admin/ContentAdminWorkspace.tsx`, `ConsentFormLibrary.tsx`; `src/routes/location-calendars.tsx`; `src/lib/consentForms.ts`.

Tests: new `src/components/__tests__/staffFormField.test.tsx`, `staffConfirmDialog.test.tsx`, `staffDialogs8c1.test.tsx`, `src/lib/__tests__/consentPublishReason.test.ts`, `e2e/staffDialogs8c1.spec.ts`; approved edits only in `src/lib/__tests__/consentWorkflow.test.ts:65` and `e2e/consentWorkflow.spec.ts:104`.

Documentation: `AGENTS.md`, `roadmap.md`, this report and 18 screenshots. Existing browser runs also regenerated eight tracked `e2e/screenshots/*` files (access bell/compliance/peer chart, Adel history shared/staff, advocate active EN, calendar coordinator/Luis ES); these are test artifacts, not intentional application edits.

No changes to canAuthorContent/canPublishContent, clinical/Spanish gates, Part 2 rules, StatusChip mappings, contentPublishing, workingCalendar, runAction, chartActions, public/member UI or global form/dialog primitives.

## Continuation (15 October 2026, 15:35 UTC) — stopped again at an existing-test checkpoint

### cfProxyMode.spec.ts:37 investigation (no test line changed)
- Current HEAD (5066dbc), spec run alone, 1 worker: run 1 pass (2/2), run 2 pass (2/2), run 3 pass (2/2).
- Rollback 97668bd in a temporary detached worktree on port 8090 (working branch untouched; worktree removed after): run 1 pass, run 2 pass, run 3 pass.
- No "element intercepts pointer events" line in any run; the original failure log only reported the 30 s click timeout, and no line naming an intercepting element was preserved. No leftover dialog/portal was observed.
- Conclusion: not reproducible at either commit; the earlier timeout appeared only under full-suite load. Per rule 2(d) no application fix was made. It passed in the full run below (both tests).

### RemoveControl
Stays mounted in History/Audit (Mitch approved). Permissions unchanged.

### New coverage finished
- `src/components/__tests__/staffDialogs8c1Coverage.test.tsx` (4 tests): Escape closes with no action and focus returns to the trigger; real integrity refusal (lesson used in a live Journey) keeps the dialog open, content live and no success event; withdrawing an edited shipped lesson removes the published edit so the shipped baseline reappears, with the reason in revision history; valid review publish via `content_publish` with one success event and the reviewer's reason.
- `e2e/staffDialogs8c1.spec.ts` coarse-pointer test: on an emulated touch phone (pointer: coarse) the Keep/Publish buttons and the reason box compute to at least 48px. Note: the on-screen box measured 46px because the emulated mobile page renders slightly zoomed out at 390px on /admin-content — a possible width overflow on that page, not investigated (outside 8c-1).

### Totals
- Units: **2,642 passed / 2,642 vitest-listed**, 319 files, none skipped.
- Full browser suite (24 files, run to completion): **82 passed, 11 failed, 93 listed**. All 4 new dialog tests passed; both consentWorkflow tests passed (:32 and :114); both cfProxyMode tests passed.

### STOP — existing failures (all public website; 8c-1 changed no public file)
Re-run alone: same 11 fail, so not load-related.
- `e2e/publicWebsite.spec.ts:17` (en, es) — language switch button click times out (30 s).
- `e2e/publicWebsite.spec.ts:78` (about, team, partners, who-its-for) — `/#about` is not redirected to its page; URL stays `http://localhost:8080/#about`.
- `e2e/publicWebsite.spec.ts:86`/`:89` (from /, /about, /team) — homepage anchors: click/alignment predicate times out.
- `e2e/publicWebsite.spec.ts:102` — mobile menu click times out.
- `e2e/websitePolish.spec.ts:12` (/) — axe "No elements found for include".
These passed in the 8a-1 run. `git diff 97668bd -- src` touches no public file. Pattern suggests the public homepage is not hydrating its interactive parts in the test browser. No proposed test-line change: these look like an application/environment problem to diagnose, which Mitch must approve.

### e2e/screenshots
The eight regenerated files are written by existing specs on every run and have been committed by earlier runs, so they were left as normal suite output.

### Still unverified
Public website failures above; 768px tablet layout of the dialogs beyond screenshots; possible 390px overflow on /admin-content on mobile emulation.

## Public-website failure investigation (Oct 15)
- Reproduction at current HEAD (c54921c): `publicWebsite.spec.ts` + `websitePolish.spec.ts` passed 14/14 with 1 worker and 14/14 with the normal 3 workers. Because HEAD could not reproduce the failure, the older-commit comparison (97668bd, 0cc7ce73) was not run.
- Homepage evidence (Playwright on `/`): no hydration-mismatch errors, no uncaught page errors, no failed network requests; only a dev-only TanStack code-split warning for `/shift-count`. EN/ES toggle and mobile menu respond. In one scratch run a click made right after load didn't register (not reproduced), which fits a click arriving before the page was interactive under load, not a time-dependent mismatch.
- Conclusion: the earlier 11 failures did not reproduce. No public-website application change was made.
- "1h 60m left" fix: new `hoursMinutesLeft()` in `src/lib/escalations.ts` rounds to whole minutes before splitting hours/minutes; used by the escalation countdown and the clinician workspace crisis countdown (`src/lib/clinicianWorkspace.ts`). Tests: `src/lib/__tests__/hoursMinutesLeft.test.ts` (2). No homepage hydration browser test was added because no hydration error exists to guard against yet.
- Totals after the fix: units 2,644/2,644 passed (`vitest list` 2,644); browsers including axe 93/93 (24 spec files, run in two halves to fit the 10-minute limit). No existing test was changed, skipped or retimed.
