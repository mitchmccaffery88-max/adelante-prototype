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
