# Quick-actions batch 3 — "+ New" on five more staff pages

Status: done Oct 16 2026. Batch 4 (personal settings) not started. Not published.
Rollback SHA before the first edit: `e3565bc8a2dae2dca1ee5154f14219a3afec7ce4`.

## Approved 8a-2 test lines (e2e/staffNewAudit8a2.spec.ts)
Applied verbatim. Note: the test title is at line 129 in the file (the approval named 130; line 130 is `actAs(...)`, left unchanged).
- `  test(\`${role}: content center shows one + New\`, async ({ page }) => {`
- `    await expect(page.getByTestId("staff-new-slot").locator("button")).toHaveCount(1);` (line 133)
Passes for both Cathy and sys_admin — both hold content_authoring write, so no access was granted to satisfy it.

## Per-page action sources
| Page | Launcher | Items |
|---|---|---|
| My work, Worklist, Case manager, Inbox | `PageNewLauncher` → existing `DashboardActionLauncher` (shared NewActionMenu) | Same registry list as /clinician: `CHART_ACTIONS` with `menu !== false`, filtered by each action's `allowed()`; role quick actions on top |
| Content center (/admin-content) | `ContentNewLauncher` (shared NewActionMenu) | `content_create` (canAuthorContent) and `consent_form_author` (sys_admin \| clinical_coordinator), each filtered by `allowed()` |

Patient-scoped actions on the four patientless pages **ask for a patient first** (the launcher's existing picker; the chosen patient is re-checked with `allowed()`). None are omitted. Opening a chart goes to `/record/<id>`. Single-key and ⌘K shortcuts stay on /clinician only.
Content center: "Create content" opens Manage and focuses the existing title box; "Edit consent form" opens Legal & consent. Opening writes nothing; saving still runs `runAction`.
Roles with zero permitted items get no "+ New" (e.g. billing on Inbox; medical assistant and billing in the content center), including the mobile button.

## Removed buttons
None. No page had a legacy add launcher. Kept deliberately: Case manager "Upload caseload" (import workflow), the content center "New entry" button (it is the create form's own submit next to the title box), Worklist claim/release and Inbox claim/assign/done (row actions, not creates).

## App fix found during testing
After in-app navigation the previous page's "+ New" lingered in the shell slot while the next page loaded, so an early click opened nothing (seen on /admin and /admin-content). `StaffNewTrigger` now renders only on the page (first path segment) it mounted on.

## Pending
Nurse "Give clinic dose" and "Coordinate a refill" stay hidden pending Dr. Bagga's sign-off.

## Files changed
- src/components/staff/PageNewLauncher.tsx (new), src/components/admin/ContentNewLauncher.tsx (new)
- src/components/clinician/DashboardActionLauncher.tsx (`shortcuts` prop; no trigger when nothing permitted)
- src/components/admin/ContentAdminWorkspace.tsx (controlled tabs for "+ New")
- src/components/StaffShell.tsx (new routes; mobile "+ New" only when the slot has a button)
- src/components/StaffDensity.tsx (stale trigger fix)
- src/routes/my-work.tsx, worklist.tsx, case-manager.tsx, inbox.tsx (mount launcher)
- Tests (new): src/components/__tests__/quickActionsBatch3.test.ts, e2e/quickActionsBatch3.spec.ts (all 5 pages, roles that must not see items, axe on each menu type)
- e2e/staffNewAudit8a2.spec.ts (the two approved lines only), roadmap.md, src/components/AGENTS.md

## Totals
- Units: 2,677 passed / 2,677 listed.
- Browsers (--workers=1, E2E_BASE_URL=http://localhost:8080, no --max-failures): 135 passed / 135 listed (39 + 96). Regenerated screenshots restored.
