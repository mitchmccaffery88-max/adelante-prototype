# Quick-actions batch 4 — personal settings

Status: COMPLETE, Oct 17 2026. No publishing; no later batch started.
Batch rollback SHA: `1d8167d66c86b529278ad43320657bb3eb202798`.
Final-approval rollback SHA: `4c87f5ae7162d567d45e70b0584299d008ba6b37`.
The final managed commit SHA is reported in chat after these close-out files are recorded.

## Delivered and boundaries
Existing staff profile has a Quick actions prototype: choose/reorder up to eight, reset to role defaults, Saved on this device only per staff identity. Preferences are presentation-only, no audit, and read after hydration and acting identity are known. Eligibility follows the person's own role assignments and unchanged registry allowed() gates. Other-role entries remain disabled with a switch-role hint. Current-role actions without this launcher's handler are omitted. Pending nurse clinic-dose/refill actions remain excluded. Admin defaults remain out of scope. No clinical, Part 2, permission, role, or registry-gate changes in this final approval.

## Coordinator decisions and diagnoses
1. Declined dropping Task from therapist defaults. Task defaults resolve to dashboard_task on patientless pages and chart task with a patient; never both. Roles changed: therapist and sud_counselor. clinical_coordinator already used dashboard_task. allowed() unchanged.
2. Approved patientless therapist expectation in src/lib/__tests__/quickActionPrefs.test.ts verbatim:
```ts
expect(quickActionsFor({ role: "therapist", staffId: "s-th1" }).map((a) => a.id)).toEqual(["progress_note", "dashboard_book", "message_patient", "screener_request", "dashboard_task"]);
```
3. The new patient-context therapist test incorrectly assumed case_notes write. Approved only its title and `expect(ids).not.toContain("task")`; retained `not.toContain("dashboard_task")`. The title is `therapist chart defaults never show the patientless Task twin; chart Task follows the case_notes write gate`. No permission granted.
4. Browser fixture diagnosis: runAction signature is `(actionId, actor, patient, input)` at src/lib/actions/runAction.ts:145–150. The old setup passed `{ via, args }` as patient (argument three), so staffLifecycle.ts:19–20 received undefined arguments and failed. setActingStaff ignored nonexistent s-batch4 at src/lib/roles.ts:1594–1597, leaving ECM Provider Luz. Approved setup-only correction passes undefined patient and input fourth, awaits/asserts the staff_add result, and waits for the fixture's acting-role indicator. Real registry/store creation retained.
5. Approved literal-only replacements of Author consent form with registry label Edit consent form in the new browser spec (prior lines 28, 31, 38, 45, 46). App action name unchanged. Approved role-display literal Clinical Coordinator → Clinical coordinator at line 43; this approval also corrects only switch-hint casing at line 39.
6. Final launcher-scope decision: app behavior is correct. After switching to clinical coordinator, /my-work must omit Edit consent form (count zero), not route to another launcher's workflow. /admin-content must show it enabled and open its real authoring view. Only that approved block and literal hint casing changed. Disabled therapist, audit, axe, reset assertions and all other flow lines remain unchanged.

## Actual content-center target
`ContentNewLauncher` maps consent_form_author to the Legal & consent tab (src/components/admin/ContentNewLauncher.tsx:19,35). `ContentAdminWorkspace` renders ConsentFormLibrary there (src/components/admin/ContentAdminWorkspace.tsx:896–900). The tested authoring view is **data-testid="consent-form-library"** (src/components/admin/ConsentFormLibrary.tsx:35), not dashboard-action-drawer. The launcher does not directly open a sheet; a separate New version button opens the New version sheet. This check asserts the actual existing launcher target without creating a version or changing audit behavior. Escape is retained before unchanged reset steps.

## Validation
- Prior full unit run (before this final test-only approval): **2,686 passed / 2,686 listed**, 331 files. Not rerun in this turn; latest request asked for browsers only.
- Final full browser suite: **136 passed / 136 listed**, 35 files, **0 failed**, 27.7 minutes, exit 0.
- Full command: `E2E_BASE_URL=http://localhost:8080 bunx playwright test --workers=1`. Ran in background and polled to completion; no max-failures, no early kill, no skipped tests, retries/timeouts/config unchanged.
- New batch-four test passed, including other-role disabled/hint, no cross-launcher routing, real content authoring view, no action audit from preferences, axe, reset/default restoration.
- Restored 15 regenerated tracked images; all 108 pre-run tracked image hashes verified identical after restoration.
- Harness latest observed build: build OK (2026-10-17T05:57:36Z). Only tests/documentation changed in this final approval.
- Earlier stopped runs: 69/136 before fixture diagnosis; full 135/136 on label mismatch; full 135/136 on launcher-scope mismatch. Final corrected full run is green. No behavior assertion weakened outside coordinator approvals.

## Files / rollback scope
Batch implementation: src/lib/quickActionPrefs.ts, src/hooks/useQuickActionPrefs.ts, src/components/staff/QuickActionSettings.tsx, src/components/staff/NewActionMenu.tsx, src/routes/clinician-profile.tsx, src/lib/quickActions.ts; new unit/browser tests including quickActionPrefs.test.ts, quickActionTaskContext.test.ts and e2e/quickActionsBatch4.spec.ts; architecture/memory/roadmap documentation.
Final approval changes only: e2e/quickActionsBatch4.spec.ts, roadmap.md, docs/quickactions-batch4-report.md. Restored screenshots are not deliverable changes.

## Open question for Mitch
Therapists (case_notes read-only) get Task on patientless pages via dashboard_task but no Task quick action inside a patient chart; chart Task requires case_notes write — should therapists get chart Task (permission change), or should the chart + New offer the patient-prefilled dashboard Task instead?

Neither option is implemented; this question does not block completion of the approved device-only preferences track.

## Every changed line in the final approval
Compared with pre-edit SHA `4c87f5ae7162d567d45e70b0584299d008ba6b37`; all other test lines are unchanged.

### Line 39 — approved literal casing only
Old:
```ts
  await expect(menu.getByText("Switch to Clinical Coordinator to use this")).toBeVisible();
```
New:
```ts
  await expect(menu.getByText("Switch to Clinical coordinator to use this")).toBeVisible();
```

### Old lines 44–48 → new lines 44–54 — approved post-switch block
Old (each line shown):
```ts
  await page.getByTestId("staff-new-slot").getByRole("button").click();
  await expect(menu.getByRole("button", { name: "Edit consent form", exact: true })).toBeEnabled();
  await menu.getByRole("button", { name: "Edit consent form", exact: true }).click();
  await expect(page.getByTestId("dashboard-action-drawer")).toBeVisible();
  await page.keyboard.press("Escape");
```
New (each line shown):
```ts
  await page.getByTestId("staff-new-slot").getByRole("button").click();
  await expect(menu.getByRole("button", { name: "Edit consent form", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.evaluate(() => (window as any).__adelante.go("/admin-content"));
  await expect(page.getByTestId("acting-role-indicator")).toHaveText("Acting as: Clinical coordinator · Batch four test staff");
  await page.getByTestId("content-new-button").click();
  await expect(menu.getByRole("button", { name: "Edit consent form", exact: true })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Edit consent form", exact: true })).toBeEnabled();
  await menu.getByRole("button", { name: "Edit consent form", exact: true }).click();
  await expect(page.getByTestId("consent-form-library")).toBeVisible();
  await page.keyboard.press("Escape");
```
The former enabled assertion and click remain verbatim, now at lines 51–52. The opening click remains at line 44; Escape remains, now line 54. Reset continues unchanged from line 55.
