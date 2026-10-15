# Phase 8c-1 — Staff fields and content/calendar confirmations

**Plan only; application code and tests unchanged. Approve this batch and the two exact existing-test edits below before building.**

## Scope and rollback

Rollback commit verified this turn: **`930af524e53ae4f2be2f4bc55ebb56d7de25a36f`**. The working tree also has a pre-existing `bun.lock` modification; leave it untouched and identify it separately in the build report. The previous 8a-1 rollback is not the rollback for this batch.

Only shared staff FormField/ConfirmDialog, CMS browser-dialog replacements, location-calendar browser-dialog replacement, and required consent-publication reason. No 8c-2, table migration, staff delete confirmations, patient/advocate/public restyle, dashboard changes, new permission gates, or StatusChip mapping changes. `/consent` ledger revocation stays in 8c-2.

## A. Verified browser-pop-up inventory

Current source still contains **17 call sites: 13 prompts, 4 confirms; no browser alert calls**. Paths below are relative to project root. One source call may serve several actions. Consent publication currently has no browser pop-up: its new confirmation is additional, not one of the 17.

| # | File:line | Purpose | Batch |
|---|---|---|---|
| 1 | `src/components/admin/ContentAdminWorkspace.tsx:33` | Missing content-change reason fallback | **8c-1** |
| 2 | `src/components/admin/ContentAdminWorkspace.tsx:308` | Withdraw published item / discard draft reason | **8c-1** |
| 3 | `src/routes/location-calendars.tsx:85` | Remove closed day reason | **8c-1** |
| 4 | `src/components/advocate/AdvocateDesignationPanel.tsx:72` | Remove advocate access reason | 8c-2 |
| 5 | `src/components/advocate/StaffAdvocatesTab.tsx:92` | Optional verification reference | 8c-2 |
| 6 | `src/components/billing/PatientBalance.tsx:163` | Void payment reason | 8c-2 |
| 7 | `src/components/careplan/CarePlanEditor.tsx:163` | Dismiss suggestion reason | 8c-2 |
| 8 | `src/components/careplan/CarePlanEditor.tsx:252` | Close goal reason | 8c-2 |
| 9 | `src/components/careplan/CarePlanEditor.tsx:253` | Goal met versus closed binary choice | 8c-2 |
| 10 | `src/components/clinical/GroupEligibilityEditor.tsx:56` | Remove group eligibility reason | 8c-2 |
| 11 | `src/components/clinical/RecordTabs.tsx:2308` | Clear care-plan summary note | 8c-2 |
| 12 | `src/components/consent/ConsentRecordsPanel.tsx:109` | Revoke consent record reason | 8c-2 |
| 13 | `src/lib/drawer-drafts.ts:19` | Discard unsaved drawer edits | 8c-2 |
| 14 | `src/routes/admin-claims.tsx:489` | Claim denial reason | 8c-2 |
| 15 | `src/routes/admin-note-templates.tsx:476` | Confirm version-changing template save | 8c-2 |
| 16 | `src/routes/billing.tsx:205` | Reason-required claim transition | 8c-2 |
| 17 | `src/routes/group-sessions.tsx:510` | End enrollment reason | 8c-2 |

**New 8c-1 confirmation:** `src/components/admin/ConsentFormLibrary.tsx:51`, approved-version Publish.

Calendar scan includes `/my-calendar`, `/team-calendar`, `/location-calendars`, clinician availability and `components/calendar/*`; only the location-calendar removal prompt is present there. Group enrollment/eligibility are not calendar pop-ups and remain 8c-2 under this narrower request. PWA install prompts and local functions named `confirm` are not browser dialogs.

## B. What to build

### 1. Shared staff FormField

Create `src/components/staff/form-field.tsx`, exporting `FormField` without changing or colliding with the react-hook-form Controller export in `src/components/ui/form.tsx`.

- Label above; connected 14px ink-muted help below. Label/control linkage, `aria-describedby`, and `aria-invalid` when an invalid field has been touched or confirmation attempted.
- No validation message on initial display. Show corrective guidance on blur; after the first blur, update it as the person fixes the value. A confirmation attempt also reveals required-field guidance and never submits invalid input.
- Gold validation fill, on-gold words, attention line and CircleAlert; never urgent/red. Do not change StatusChip mappings or global error primitives.
- Radius-sm, 1.5px line-strong control edge; 14px floor; compact controls 36px minimum on mouse, 48px on touch, including the reason textarea. Use existing semantic tokens and StaffDensity context; no global member overrides.
- Optional reason variant: visible label **“Reason (saved to the audit log)”**. Required where the caller requests it; preserve existing minimum-length rules rather than inventing one. Help asks for the decision rationale, not patient details.
- Keep the existing CMS edit field's accessible name **“Content change reason”** so its existing exact selector remains valid; the visible reason label gains the audit explanation.

### 2. Shared ConfirmDialog

Create `src/components/staff/confirm-dialog.tsx` using the existing Radix AlertDialog and Button variants.

- Controlled open state, question title naming the action, connected consequence description, explicit safe focus on **“Keep <thing>”**, keyboard focus trap and focus return to the trigger.
- Primary path-action button repeats the actual verb, e.g. “Withdraw lesson”, “Discard draft”, “Remove closed day”, “Publish consent form”. No destructive variant.
- Optional required FormField reason. An attempted confirmation with a blank/whitespace reason shows guidance and cannot call the action. Do not auto-close on an invalid attempt or store refusal; retain the entered reason for correction.
- Call the supplied action once; guard double clicks. The component does not write audits or decide permissions. Cancel/Escape writes nothing and changes nothing.
- Responsive width, scrolling body/footer clearance, wrapped text; 14px minimum in light/dark, mouse/touch targets. Use scoped styling if required, not a rewrite of shared AlertDialog defaults.

### 3. Content center adapters

Replace both browser prompt sites without changing the action registry or content store.

- Keep the synchronous execution helper for inputs that already contain a reason; move missing-reason collection to controlled UI state, then resume the original operation once with that reason. Never introduce Promise returns into callers expecting `ContentResult`.
- CMS editor save/create/submit/publish already checks its inline reason. Upgrade that reason field to FormField; keep existing action ordering, validations, toasts, clinical-review routing and outcomes. No extra confirmation on these already explicit edit-form steps.
- Review Publish/Send back with no note opens an action-specific ConfirmDialog with required reason. Existing nonblank reviewer notes remain usable; do not force a second reason or add a duplicate review step.
- Withdraw and Discard always use ConfirmDialog with required reason; preserve `content_withdraw`/`retireContent` and `content_discard`/`discardContentDraft`, disabled controls and integrity guards.
- Consequences must match the store: withdrawal keeps history and stops the managed version being served, **but a shipped baseline may reappear** (`contentPublishing.ts:430–440`). Do not promise disappearance in that case. Draft discard permanently removes the never-published entry/history; no automatic undo or invented notifications. Review returns the draft to the author; publishing changes the version served, not past completions.
- Preserve all eight content types, author/browse boundaries, existing publisher checks, independent clinical-review and Spanish gates, Part 2 CONTENT visibility and gated revision reasons. No new second approver for editorial content; no role widening or narrowing for Cathy.

### 4. Location-calendar adapter

Replace removal at `location-calendars.tsx:85` with “Remove this closed day?”, “Keep closed day”, “Remove closed day” and required reason. Keep `act` → `runAction("calendar_site_closed_remove")` → `removeSiteClosedDay`, the existing sys_admin edit boundary, soft-removal history and toast. Describe the calendar-date effect and that this removal does not automatically cancel/reschedule visits or send a new notification. Keep focus return inside the existing closed-days sheet; leave closure creation, time off and external Simulated sync unchanged.

### 5. Required consent-publication reason — Mitch decision 7

Current `publishForm(vid, actor)` requires sys_admin and approved status, retires the earlier published version, and writes `consent_form.published` without a reason (`consentForms.ts:200–206`).

Add a required third reason argument; reject empty/whitespace **before any state mutation**. Append the trimmed reason to the existing publication audit detail; keep its event name, version rules and Draft/counsel labels. Do not add a generic registry event or change approval behavior. The existing seed-library publication call receives an explicit neutral seed reason through the real store function; no bypass or UI default reason.

Open ConfirmDialog from ConsentFormLibrary Publish: **“Publish this consent form?”**, **“Keep consent form”**, **“Publish consent form”**. Description explains that the new version becomes available to send, the previous version retires, existing signed copies remain unchanged, and publishing itself sends no patient notice. Reversal is not an automatic undo; another version follows the existing workflow. Required reason goes through the existing `consent_form_publish` action, `via: "publishForm"`, args `[versionId, storeActor, reason]`.

## C. Exact existing test edits requiring approval

Only **two existing lines** need replacement based on current callers. No assertion changes proposed; all existing expectations remain.

**1. `src/lib/__tests__/consentWorkflow.test.ts:65`**

Current:
```ts
    publishForm(v2.id, admin);
```
Proposed:
```ts
    publishForm(v2.id, admin, "Reviewed consent version for publication — Draft");
```
Why: supply the newly required store argument; keep all version/signature assertions unchanged.

**2. `e2e/consentWorkflow.spec.ts:104`**

Current:
```ts
  await row.getByRole("button", { name: "Publish" }).click();
```
Proposed replacement block:
```ts
  await row.getByRole("button", { name: "Publish", exact: true }).click();
  const publishDialog = page.getByRole("alertdialog", { name: "Publish this consent form?", exact: true });
  await publishDialog.getByRole("textbox", { name: "Reason (saved to the audit log)", exact: true }).fill("Reviewed consent version for publication — Draft");
  await publishDialog.getByRole("button", { name: "Publish consent form", exact: true }).click();
```
Why: complete the new required confirmation instead of merely opening it. Keep :105 and :108 unchanged.

No CMS/calendar existing tests were found mocking these browser prompts; store tests stay unchanged. Preserve `staffContent.spec.ts:26`'s “Content change reason” selector and calendar field IDs. No snapshot updates anticipated: registry IDs/gates are unchanged.

**Stop rule:** if any other existing assertion fails, stop and list file:line, current and proposed exact line for Mitch. No deleted/skipped tests; no retry, timeout or threshold changes.

## D. Files

**Create:**
- `src/components/staff/form-field.tsx`, `confirm-dialog.tsx`
- `src/components/__tests__/staffFormField.test.tsx`, `staffConfirmDialog.test.tsx`, `staffDialogs8c1.test.tsx`
- `src/lib/__tests__/consentPublishReason.test.ts`
- `e2e/staffDialogs8c1.spec.ts`
- `docs/phase8c1-forms-dialogs-report.md` and dialog screenshot files

**Change:** `ContentAdminWorkspace.tsx`, `ConsentFormLibrary.tsx`, `src/routes/location-calendars.tsx`, `src/lib/consentForms.ts`, the two approved test locations above, `AGENTS.md` and `roadmap.md`. `src/styles.css` only for narrowly scoped staff field/dialog styling if utilities cannot express it. No changes planned to ContentForm schemas, contentPublishing, workingCalendar, runAction, chartActions, member components, or global form/alert-dialog/Button primitives.

## E. Tests and final validation

- Rendered FormField units: untouched/blur/confirmation-attempt validation, correction clears feedback, gold/attention not urgent, reason label, help relationships, aria-invalid and density styling.
- Rendered ConfirmDialog units: safe initial focus, verb-labelled primary, blank/whitespace reason blocks callback, valid reason, Escape/cancel, focus return, double-click guard and refusal retains reason.
- Real-store adapter units: exactly one registry success per action and no audit on cancel; reason readback, existing lifecycle audit parity, Cathy author/publisher behavior, denied roles, Part 2 masking, integrity refusal, never-published discard, shipped-baseline withdrawal and unchanged save→submit/publish ordering.
- Consent store units: required reason, whitespace rejected without retiring/publishing, exact saved neutral reason, only sys_admin, one publication lifecycle event plus one registry success, signed-copy/version invariants and seeds retained.
- Source census: no browser prompt/confirm remains in CMS, calendar or consent-publication code; explicitly allow the 14 deferred call sites. Do not mistake install prompts/local callbacks for browser dialogs.
- Browser tests through real screens: CMS missing-review-reason, withdraw/discard cancel and confirm; calendar removal with reason and sys_admin versus Cathy's read-only access; consent publish blank/cancel/valid, audit readback and earlier signed version preserved. Axe on all three dialogs, including validation state, using existing accessibility standards without weakening thresholds.
- At build completion: inspect automated build result; `vitest list` total alongside the **full** unit pass count; run **every browser spec including axe** to completion, subject to the stop rule.
- Capture one content-center dialog, one calendar dialog and consent publish dialog at **390/768/1280**, **light/dark**: 18 screenshots. Verify no clipping, safe focus and readable validation; touch target checks as well as mouse sizing.
- Short report: totals, failures if any, rollback SHA, changed files, audited reason/event readback, screenshot locations and plan deviations.

## F. Risks and deliberate differences

**Audit-count clarification:** existing CMS and calendar mutations can write a domain/lifecycle event **and** a registry `action.succeeded`; consent publish does too. CMS editor publish may first save then publish (two actions). “One audit entry” will mean no duplicate event for each existing action/event type, **not deleting established lifecycle records to force one total row**. ConfirmDialog adds no audit sink.

**Highest risk:** async dialog state replaying an operation against a changed actor/item. Resolve current actor, record and gates at confirmation; prevent stale-target/double-submit execution and keep store rechecks. Cancellation must never resume a mutation. Nested calendar sheet focus and CMS member-preview density need regression coverage.

**Cathy:** do not change `canAuthorContent`, `canPublishContent`, clinical sign-off/Spanish blockers or Part 2 patient-data boundaries. She retains current editorial author/publish/withdraw abilities and calendar read-only access; consent-form publishing remains sys_admin only. Controlled draft content and privacy-neutral audit text rules remain unchanged.

**Narrower than the old Phase 8 outline:** group-sessions and GroupEligibilityEditor move to 8c-2 as requested; existing content schemas/general calendar forms are not migrated wholesale. Three staff delete confirmations, remaining prompts, consent-ledger revocation, undo infrastructure and Phase 9 dashboards stay for later. No backend connection, external integration or broader persistence work.
