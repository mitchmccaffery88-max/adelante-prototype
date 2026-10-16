# Phase 8a-2 report — staff shell verification

Rollback point (preserved, unchanged): `e231f0dd8e26acd460acee64ee0f1535480d687c`. Verified Oct 15 2026.

## Result summary
| Item | Result |
|---|---|
| Consent signing overlap | **Not reproduced** at 390/768/1280 with a real signed Telehealth form (Sign, "I'm done", 988 all reachable). **No layout change.** |
| Workspace order + crisis banner | Rollback parity proven for every role checked; only grouping/order changed. |
| `/consent` | **Unchanged** (still in the member-style shell). Security finding recorded below. |
| + New audit | Test `e2e/staffShell8a2.spec.ts` "shell New creates a real Cathy task…" **blocked at line 12** (see Blockers). |
| 768 / coarse 48px / 390 admin-content width | `e2e/staffShell8a2.spec.ts` coarse tests pass at 390 and 768. |
| Homepage early taps | **Reproduced and fixed** (details below). 988 is a plain `tel:988` link before and after load. |

## Parity method
A temporary detached worktree at the rollback SHA ran on port 8090 next to the working preview (8080); it was removed afterwards (`git worktree list` shows only the main checkout). For each case the same acting person was set, and the visible lines, every visible button/link label and status chips inside `main` were compared as multisets. Simulated SMS delivery failure uses `Math.random()` (`src/lib/ehr.ts:9470`), so the comparison was repeated with a fixed random seed in both servers; times were normalised.

| Role (person) | Page | Lines | Actions | Status chips | Result |
|---|---|---|---|---|---|
| Cathy (`clinical_coordinator`, s-cc2) | /my-work | identical (75) | identical (29) | identical | Pass |
| Cathy | /clinician | identical (116) | identical (51) | identical | Pass |
| Clinician (therapist, s-th1) | /my-work | identical (158) | identical (59) | identical | Pass |
| Clinician | /clinician | rows identical; only per-section sub-headings split (Now 30 → 23 + 7, This week 11 → 7 + 4) | identical (94) | identical | Pass |
| Nurse (`nurse_rn`) | /nurse, /my-work | identical (134 / 60) | identical (52 / 21) | identical | Pass |
| Case manager (ecm_provider, s-cm1) | /case-manager, /my-work | identical apart from timestamps | identical | identical | Pass |
| Admin (sys_admin, s-admin1) | /admin-coordination, /my-work | identical apart from timestamps | identical | identical | Pass |

Without the fixed seed, nurse and case-manager differed only by the randomly simulated "Reach out — SMS delivery failed" task, which changes between any two loads (also rollback vs rollback).

**Fix made during verification** (`src/components/clinician/WorkspaceDashboard.tsx`): the "Waiting on others" list was repeating the filter buttons and the "See all escalations" link, and the remaining filter buttons counted only the "Needs you" rows. The waiting list now shows rows only, and the filter buttons count the full list again (All 41 / Now 30 / This week 11, as at rollback). This restores parity; no rows, permissions or statuses changed.

## Items that moved section (and why)
Ownership comes from `src/components/staff/workspaceOwnership.ts`; anything without a clear owner stays in "Needs you".
- **Tasks assigned to another staff member** → Waiting on others (clinician /clinician: 10 rows). Owner read from the task's `assignedTo`.
- **Pending lab results** (row "… result", from `myPendingLabs`) → Waiting on others (1 row; on /my-work the "Labs pending" list). They wait on the lab.
- **Re-screens already sent** (action "Open chart") → Waiting on others (waiting on the patient). Unsent re-screens ("Send re-screen") stay in Needs you (3 rows).
- **ASAM drafts awaiting co-signature** → Waiting on others on /my-work (none present in the seed for these people today, so not visually exercised).
- **Schedule, Today strip, Scheduling, My work "Today"** → Today.
- Default check: all other lists (cosigns owed, crisis items, coordinator queue, open items, re-screens due, caseload going quiet, HIE matches, plan reviews, task queue, coordination lists) stay in Needs you, which is where they were the viewer's own work at rollback. Nothing that waits on someone else was found in Needs you.
- On `/nurse` for `nurse_rn` no grouped sections render (that role sees the existing nurse view); content parity still passed.

## Crisis banner
| Person | Header count | My work banner |
|---|---|---|
| Cathy | 4 open crisis escalations | 4 open crisis escalations |
| Therapist s-th1 | 4 | 4 |
| Nurse | 4 | 4 |
| sys_admin | 4 | 4 |
| ECM provider s-cm1 | none (not authorized) | none |
The banner uses the same role/actor-scoped escalation projection as the header, shows only a count and a queue link (no names, no Part 2 text), has no dismiss button, and stays after leaving and coming back (browser test passes; axe: no serious/critical issues).

## /consent security finding (unchanged)
`/consent` is listed in the AppShell member exceptions (`src/components/AppShell.tsx:49,111`) and an earlier patient session reached it. The page was **not** moved into the staff shell and no access rule was changed. Recorded for the real-auth phase.

## Homepage early taps
Evidence (fresh load, tap at DOM-ready, before the app is interactive): at 390 the menu tap was lost (menu never opened); at 1280 the "ES" tap was lost (page stayed English). The same taps after load worked. No console errors, no failed requests; only the dev-only code-split warning for /shift-count. `tel:988` was present as a plain link before load in every run.
Fix: `src/lib/earlyTap.ts` + one inline head script (`src/routes/__root.tsx`) remember a tap on a **button** marked `data-early-tap` (EN/ES in the website header, the phone menu) and replay it once after load (`WebsiteLayout`). Links, including 988 and "Get started", are never intercepted. After the fix the early taps open the menu / switch to Spanish. With scripts artificially delayed 3s per file the page was still loading after 8s, so that case is unverified.

## New tests
- `e2e/publicEarlyTap8a2.spec.ts` (2 tests incl. axe on the website header).
- `src/lib/__tests__/staffDialogs8c2Parity.test.ts` (3 tests, see 8c-2 report).

## Totals
- Units: **2,648 passed / 2,649 listed** (`vitest list` = 2,649). Only failure: `src/lib/__tests__/runAction.test.ts:15` permission snapshot (waiting on Mitch).
- Browsers incl. axe, run sequentially in two halves after the unit run: **101 passed / 102** (32/32 and 69/70). Only failure: `e2e/staffShell8a2.spec.ts:12`.
- `src/lib/__tests__/contentCenterFinish.test.ts` timed out once at 60s in one full run under load and passed alone and in the next two full runs; no change.

## Blockers (need Mitch)
- `e2e/staffShell8a2.spec.ts:12` — Cathy's patient picker shows no rows until a search.
  Current: `await drawer.getByTestId("dashboard-patient-picker").getByRole("button").first().click();`
  Proposed: insert `await drawer.getByPlaceholder("Search name, DOB or program ID").fill("Luis");` before that unchanged line.

## Screenshots
`docs/screenshots/phase8a2/`: `my-work-cathy-*`, `consent-ledger-*`, `consent-signing-*` at 390/768/1280, light and dark (18 files).

## Unverified
- ASAM awaiting-co-signature placement (no such drafts for these people in the seed).
- Early taps when the network is very slow.
- `e2e/screenshots/*` (16 tracked files) were regenerated by the normal suite run.

## Every changed file vs rollback (excluding regenerated e2e/screenshots and new docs/screenshots)
- D	.lovable/plan.md
- A	.lovable/plan/phase-8-batch-8a-2-2026-10-15.md
- A	.lovable/plan/phase-8-batch-8a-2-approval-review-2026-10-15.md
- M	AGENTS.md
- A	docs/screenshots/phase8a2/consent-ledger-1280-dark.png
- A	docs/screenshots/phase8a2/consent-ledger-1280-light.png
- A	docs/screenshots/phase8a2/consent-ledger-390-dark.png
- A	docs/screenshots/phase8a2/consent-ledger-390-light.png
- A	docs/screenshots/phase8a2/consent-ledger-768-dark.png
- A	docs/screenshots/phase8a2/consent-ledger-768-light.png
- A	docs/screenshots/phase8a2/consent-signing-1280-dark.png
- A	docs/screenshots/phase8a2/consent-signing-1280-light.png
- A	docs/screenshots/phase8a2/consent-signing-390-dark.png
- A	docs/screenshots/phase8a2/consent-signing-390-light.png
- A	docs/screenshots/phase8a2/consent-signing-768-dark.png
- A	docs/screenshots/phase8a2/consent-signing-768-light.png
- A	docs/screenshots/phase8a2/my-work-cathy-1280-dark.png
- A	docs/screenshots/phase8a2/my-work-cathy-1280-light.png
- A	docs/screenshots/phase8a2/my-work-cathy-390-dark.png
- A	docs/screenshots/phase8a2/my-work-cathy-390-light.png
- A	docs/screenshots/phase8a2/my-work-cathy-768-dark.png
- A	docs/screenshots/phase8a2/my-work-cathy-768-light.png
- A	e2e/consentSigningClearance8a2.spec.ts
- A	e2e/publicEarlyTap8a2.spec.ts
- A	e2e/staffShell8a2.spec.ts
- M	roadmap.md
- M	src/components/StaffShell.tsx
- M	src/components/WebsiteLayout.tsx
- M	src/components/WebsiteNavigation.tsx
- A	src/components/__tests__/staffWorkspace8a2.test.tsx
- M	src/components/advocate/AdvocateDesignationPanel.tsx
- M	src/components/advocate/StaffAdvocatesTab.tsx
- M	src/components/billing/PatientBalance.tsx
- M	src/components/careplan/CarePlanEditor.tsx
- M	src/components/clinical/GroupEligibilityEditor.tsx
- M	src/components/clinical/RecordTabs.tsx
- M	src/components/clinician/WorkspaceDashboard.tsx
- M	src/components/consent/ConsentRecordsPanel.tsx
- M	src/components/scribe/ScribeWorkspace.tsx
- A	src/components/staff/StaffCrisisBanner.tsx
- A	src/components/staff/WorkspaceSectionOrder.tsx
- M	src/components/staff/confirm-dialog.tsx
- A	src/components/staff/confirmed-action.ts
- A	src/components/staff/use-confirm-dialog.tsx
- A	src/components/staff/workspaceOwnership.ts
- A	src/lib/__tests__/staffDialogs8c2Parity.test.ts
- M	src/lib/actions/runAction.ts
- M	src/lib/chartActions.ts
- M	src/lib/drawer-drafts.ts
- A	src/lib/earlyTap.ts
- M	src/routes/__root.tsx
- M	src/routes/admin-catalog-governance.tsx
- M	src/routes/admin-claims.tsx
- M	src/routes/admin-coordination.tsx
- M	src/routes/admin-note-templates.tsx
- M	src/routes/billing.tsx
- M	src/routes/case-manager.tsx
- M	src/routes/clinician.tsx
- M	src/routes/group-sessions.tsx
- M	src/routes/my-work.tsx
- M	src/routes/nurse.tsx
- M	src/styles.css

## Oct 15 follow-up (approved items)
- e2e/staffShell8a2.spec.ts: approved search line inserted before the click line (unchanged).
- ASAM draft awaiting co-signature: fixture created only inside `src/lib/__tests__/asamCosignSection8a2.test.ts` through the real store functions (`saveAsamDraft` + `signAsamAssessment`), as SUD counselor s-sudc1 on the in-memory Part 2–consented demo patient (`sud_consented`). The shared demo seed was not edited. Result: author → "ASAM drafts awaiting co-signature" (`my-work-asam-waiting`) = **Waiting on others**; co-signer (cosign owner) → `my-work-asam` = **Needs you**. Roles that see it = roles that already saw that patient's named ASAM rows (Cathy and ECM provider still excluded). The ASAM visibility files are unchanged since rollback.
- Units: **2,653 passed / 2,653 listed**.
- Browser (dev server, two halves, not concurrent): 32/32 and 69/70 → **101/102**. Blocked: `e2e/staffShell8a2.spec.ts:22` fails because line 19 reads `.slice(before)`, but the audit log stores newest first, so the slice returns the oldest entry (`profile.tag_added`, system). The task itself is created for s-cc2. Proposed line change awaits Mitch; 8a-2 is NOT marked verified.

## Oct 15 final verification (approved items)
- `e2e/staffShell8a2.spec.ts:19`: `.slice(before)` replaced by `.slice(0, ehr.listAuditEvents({ category: "action" }).length - before)` as approved; nothing else changed.
- New `e2e/staffNewAudit8a2.spec.ts` (10 tests; no existing lines changed), "+ New" everywhere the shell shows it:
  - /clinician as Cathy (s-cc2) and therapist (s-th1): every add-menu option opens with zero audit entries, except "Review patient matching" (navigation-only), which writes exactly one `action.succeeded`/`review_matching` by the actor. "Medication order" hidden for both; "Progress note" hidden for Cathy.
  - /clinician task creation (both roles): task exists, assigned to the actor, exactly one `dashboard_task` entry by the actor.
  - /record/<id> (both roles): "Message team" creates a care team thread authored by the actor (threads store the display name), exactly one `message_team` entry with the actor's staff id; "Medication order" hidden.
  - /admin as sys_admin (s-admin1): feature flag toggle shows the new state, exactly one `feature_flag_set` entry; "Open Permissions & features" writes one `open_permissions` entry. As Cathy: flag, permissions and claim options hidden; "Review patient matching" writes one entry.
  - /admin-content (Cathy, sys_admin): no + New shown — asserted absent.
  - No route/option wrote zero (for a created item) or more than one entry. No app code changed.
- Read-only inventory: `docs/phase8-new-button-inventory.md` (every staff role × staff route).
- Units: **2,653 passed / 2,653 listed**.
- Browser (dev server, two halves, not concurrent, incl. axe): 32/32 and 80/80 → **112/112**.
- 8a-2 marked "verified Oct 15" in roadmap.md.
- Not verified: options that open a full form other than task/thread/flag were opened but not submitted.
