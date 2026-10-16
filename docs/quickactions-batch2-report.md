# Quick-actions batch 2 — complete, 16 Oct 2026

## Scope and rollback

Batch 2 only: shared menu on the three existing launchers. Batches 3 and 4 were not started; nothing was published.

- Original batch-2 rollback: `d49aa2b4a728f8b9a0aecee46f10c69bd8585366`.
- Whole-menu search rollback: `969a669bb15daf8bf7d43a959e3dedab7a1c92fd`.
- Rollback before the final approved heading/dialog fixes: `747729ae07ee6228ad2361dab7477a7062d2174c`.

## Files changed across batch 2

Application:
- `src/lib/quickActions.ts`: approved role defaults, including Mitch's swaps, filtered through existing registry permissions.
- `src/lib/chartActions.ts`: `contact_log` remains registered but has `menu: false`, removing the duplicate Log contact menu entry without changing its permission gate.
- `src/components/staff/NewActionMenu.tsx`: shared grouped menu, whole-menu search, heading/empty states, arrow-key navigation and live result count.
- `src/components/clinician/DashboardActionLauncher.tsx`.
- `src/components/chart/ChartActionLauncher.tsx`.
- `src/components/ops/OpsActionLauncher.tsx`.

New tests:
- `src/lib/__tests__/quickActions.test.ts`.
- `src/components/__tests__/newActionMenu.test.tsx`.
- `src/components/__tests__/newActionMenuSearch.test.tsx`.
- `e2e/quickActionsMenu.spec.ts`.

Close-out: this report, `roadmap.md`, and the shared-menu architecture rule in `src/components/AGENTS.md`. Automatically regenerated tracked browser screenshots were restored to their pre-turn contents.

## Shared launchers

| Launcher | Existing surfaces |
| --- | --- |
| DashboardActionLauncher | `/clinician` |
| ChartActionLauncher | `/record/<patientId>` |
| OpsActionLauncher | `/admin`, `/admin-claims`, `/billing` |

Existing shell triggers, forms, handlers, registry/runAction paths and role gates remain in place. The menu does not grant permissions; hidden actions are not offered. Role-dependent content remains behind the existing acting-role loading boundary.

## Duplicate removal and registry labels

Quick actions are removed from the All actions list, so an action is displayed once. The duplicated launcher-specific menu bodies were replaced with the shared component. The double Log contact entry (`contact_log` and `dashboard_contact`) is now represented in menus by `dashboard_contact`; the other registry entry is retained outside menus.

The ops label override map was removed:

| Action ID | Old launcher label | Registry label now displayed |
| --- | --- | --- |
| `claim_correct` | Fix a claim | Correct claim |
| `claim_status` | Move claim status / resubmit | Change claim status |
| `eligibility_check` | Run eligibility check | Eligibility check |
| `note_template_create` | Note template (create) | Create note template |
| `note_template_clone` | Note template (clone) | Clone note template |
| `scheduling_rule_save` | Scheduling rule | Save scheduling rule |

## Search, headings and accessibility

- Search filters both Quick actions and All actions by registry English label. Non-matching quick actions disappear; clearing search restores the available set without duplicates.
- During active search, a section heading is hidden when that section has no matches. Zero matches across both groups shows one `No matching actions.` message.
- Without search, Quick actions appears when the role has quick actions, and All actions always appears. If all available actions are already above, the muted note reads `Everything for your role is listed above.` Existing no-actions-for-role feedback remains for an empty available set.
- The screen-reader live result count follows both filtered groups. Arrow keys move across the filtered action items; Escape closes the popover and returns focus to its trigger.
- All three New popover contents have `aria-label="New action"`.
- Staff UI remains English; registry action labels retain their existing bilingual values. Adelante tokens are used for the changed presentation.

## Pending clinical sign-off

Nurse Give clinic dose and Coordinate a refill remain hidden, pending Dr. Bagga's clinical sign-off. No clinical approval or permission change was made.

## Approved test-line changes

Only the two previously approved lines in `src/components/__tests__/newActionMenuSearch.test.tsx` were corrected during the search follow-up:

```tsx
fireEvent.click(screen.getByTestId(`search-${expected[0]}`));
expect(onPick).toHaveBeenCalledWith(expected[0]);
```

No test source lines changed in this final heading/dialog fix. `e2e/quickActionsMenu.spec.ts:30` (`toHaveCount(0)`), `:58` (All actions visible), and `:69` (no serious/critical axe violations) remain unchanged and pass. No retries, timeouts, thresholds, deletions or skips were introduced.

## Final validation

Executed sequentially: units first, then all browsers on the same usual dev server.

- `bunx vitest list`: **2,671 listed**.
- `bunx vitest run`: **2,671 passed / 2,671 listed**, 328 files passed.
- `E2E_BASE_URL=http://localhost:8080 bunx playwright test --list`: **128 listed**, 33 files.
- `E2E_BASE_URL=http://localhost:8080 bunx playwright test --workers=1`: **128 passed / 128 listed**, 0 failures, 0 unrun, including axe; duration 15.7 minutes. No `--max-failures` used.
- The prior All actions heading and unnamed-dialog failures both pass unchanged. Browser coverage exercises real attributed task creation and the shared menus, including permission exclusions, whole-menu search, Escape/focus return and accessibility.
- Latest harness build signal: **build OK**.

Logs retained under `/tmp/quickactions-closeout/` for this verification session. Final commit SHA is reported in the close-out reply after documentation is saved.