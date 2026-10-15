# Phase 8a-1 staff shell — report

Rollback commit: `1a622225b55f2e2425e4cc843d54696715f3e86f` (one-step revert point, reported before edits).

## Status: complete (8a-1 only; 8a-2, 8b, 8c not started)

- Build: automatic preview build **OK** after final edits.
- `vitest list --json` total **2,625**; full unit run **2,625 passed / 2,625**, 314 files, zero skipped. (2,607 before + 18 new 8a-1 unit tests.)
- Browser: **89 / 89 passed** including axe (79 existing + 10 new). The final full run hit the 10-minute command limit after 73 passes and 0 failures; the two unstarted files (`staffShell8a1`, `websitePolish`) were then run to completion with `staffNav.rbac` (35/35).

## Approved test-line changes applied (only these)
- `userNavigationShell.test.ts:19`, `:20`, `:24`; `publicReferralShell.test.ts:18`.

## Bugs found and fixed during verification
1. Staff pages (`/clinician`, `/my-work`, `/admin-content`) failed to server-render: sidebar tooltips had no `TooltipProvider`. StaffShell now wraps its tree in one.
2. The header Quick jump input shared the sidebar's accessible name; renamed "Search staff surfaces".

## New tests
- `src/components/__tests__/staffShell8a1.test.ts` (18): compact density, no language toggle, 32px logo/home label, role-scoped crisis count hidden at zero, registry-filtered Quick jump, launcher portal fallback, density on seven staff overlays, three launchers through the New slot, neutral Simulated demo bar, provider-reference via `canReadProviderRef`, `/consent` untouched.
- `e2e/staffShell8a1.spec.ts` (10): compact shell + 14px text floor + axe on /my-work, /clinician, /record/p1, /admin-content; 56px header; keyboard Quick jump; no crisis count for billing; 390px navigation sheet with no horizontal scroll; chart New opens the existing launcher; patient Home outside the staff shell.

## Screenshots
`docs/screenshots/phase8a1/`: my-work, record_p1, admin-content at 1280 and 390, light and dark (12), plus `home-after.png`.

## Differences from the plan
- The pre-edit patient Home capture was lost when the sandbox temp folder cleared, so no pixel diff. `home-after.png` shows the unchanged patient chrome (gold demo pill, patient header, Get help now, EN/ES) and the browser test confirms no staff shell or compact density on /home.
- Shell New appears only on routes that already mount a launcher (record, clinician, admin, admin-claims, billing); no create action is fabricated elsewhere.
- Not separately tested: exactly-one-audit on a real create through the New slot (launcher code and registries unchanged), 768px breakpoint, and touch 48px sizing. Suggested for 8a-2 verification.
- Dark screenshots use the `dark` class applied in-browser.
