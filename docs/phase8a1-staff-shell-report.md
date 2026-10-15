# Phase 8a-1 staff shell — stopped checkpoint

Rollback commit: `1a622225b55f2e2425e4cc843d54696715f3e86f` (reported before edits).

## Status

Incomplete. Stopped immediately after the full unit suite exposed an existing assertion outside the three approved replacements. No assertion, retry, threshold, deletion or skip changes followed the failure. No 8a-2, 8b or 8c work was started.

- Automatic preview build: **OK**, latest entry 2026-10-15 03:00:41 UTC. Earlier intermediate type errors were corrected.
- `vitest list --json`: **2,607**, zero skipped.
- Full unit run: **2,606 passed, 1 failed / 2,607**, 312 files passed and 1 failed / 313. No new tests were added before this checkpoint.
- Every-browser/axe run: **not run**, blocked by the stop rule.
- Requested final screenshots: **not taken**, blocked by the stop rule. Pre-edit patient Home capture exists at `/tmp/browser/phase8a1/home-before.png`; it is not final comparison evidence.
- End-to-end launcher action/audit parity, mobile layout, contrast, nested-preview isolation and all-route density remain **unverified**.

## Approval needed

`src/components/__tests__/userNavigationShell.test.ts:24`

Current:
```ts
expect(demoBar).toContain('className="sticky top-0');
```

Proposed exact replacement:
```ts
expect(demoBar).toContain('className={cn("sticky top-0');
```

Reason: staff-only demo styling now uses a conditional class expression. The sticky/top-0 classes remain, but the existing test pins a literal JSX attribute instead of that expression. This replacement is **not applied**. An alternative is preserving the literal attribute in source; no fix was made after the stop checkpoint.

## Implemented but not yet verified

- StaffShell with 56px header, 32px compact logo, registry-filtered Quick jump, neutral acting staff identity, staff bell/account, 240/56px sidebar and phone sheet.
- Crisis count reads real open crisis rows through existing escalation visibility/ownership filters. No count is emitted when zero rows are visible.
- Provider reference boundary was verified: `canReadProviderRef` in `providerReference.ts`, used by its existing leaf page. Staff classification reuses that function; no new grant, role list or navigation entry.
- `/consent` classification is untouched.
- Route launchers retain their forms, patient context and existing buses, while their trigger portals into the shell slot. On routes without a mounted launcher, no shell create action is fabricated. This differs from a universally available New button; parity remains to be tested.
- Compact density is propagated through React context to staff-owned Radix overlays. Member/public instances remain unmarked. Staff demo styling is conditional; default demo appearance retained.
- Staff typography floor and control sizing are scoped, with nested member preview and Recharts exclusions. Broader dashboard/StatTile styling isolation still needs validation; do not treat this checkpoint as production-ready.

## Files changed from rollback

`AGENTS.md`, `roadmap.md`, `docs/phase8a1-staff-shell-report.md`, `src/styles.css`;

`src/components/AppShell.tsx`, `DemoControlsBar.tsx`, `StaffBreadcrumbs.tsx`, new `StaffDensity.tsx`, `StaffNavSidebar.tsx`, new `StaffShell.tsx`;

`src/components/chart/ChartActionLauncher.tsx`, `src/components/clinician/DashboardActionLauncher.tsx`, `src/components/ops/OpsActionLauncher.tsx`;

`src/components/ui/alert-dialog.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, `popover.tsx`, `select.tsx`, `sheet.tsx`, `tooltip.tsx`;

`src/components/__tests__/publicReferralShell.test.ts` and `userNavigationShell.test.ts` (only the three approved lines).

StaffRoleSwitcher, DemoStateSwitcher and StaffPatientSearch were not directly edited; density/context applies at their staff hosts.

## Remaining before completion

Resolve the approval checkpoint; add all planned 8a-1 foundation tests; verify/fix staff header/mobile/launcher equivalence and dashboard/member isolation; run full unit/list and all browser/axe suites; capture 1280px and 390px light/dark My work, record and content center plus unchanged patient Home; update this report with final evidence.