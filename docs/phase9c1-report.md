# Phase 9c-1 closeout — October 20, 2026

## Result and scope

Complete. Rollback: `1e410aad83903e2950d62031329ff42b3ff18033`.
Validated application source SHA: `ffcccdf3bbec2e06e96d87b21d7b2d398640640a`.
The managed closeout checkpoint includes this report, roadmap and screenshot restoration; its SHA is reported separately after those changes are checkpointed.

No publishing. No permission, role, Part 2, data-visibility, billing or medical-necessity changes. Privacy P1/P2 rules remain in place. No test file was edited during this closeout/diagnosis. Phase 9c-2 is next, not started.

## Width measurements

Document scrollWidth in pixels; each cell is before → after. Inner width equals its column heading. Source evidence: `phase9c1-evidence/before.json` and `after.json`.

| Page | 390 | 768 | 1280 |
|---|---:|---:|---:|
| /case-manager | 390 → 390 | **1104 → 768** | 1280 → 1280 |
| /billing | **441 → 390** | 768 → 768 | 1280 → 1280 |
| /admin | **426 → 390** | 768 → 768 | **1330 → 1280** |
| /admin-staff | 390 → 390 | 768 → 768 | 1280 → 1280 |
| /dashboards | 390 → 390 | 768 → 768 | 1280 → 1280 |
| /reporting | 390 → 390 | 768 → 768 | 1280 → 1280 |
| /clinician | 390 → 390 | 768 → 768 | 1280 → 1280 |
| /my-work | 390 → 390 | 768 → 768 | 1280 → 1280 |

All 24 after checks pass. Case-manager uses a single-column grid below lg, min-w-0 and contained table scrolling. Billing heading stacks on small screens and its links wrap. Admin grid/cards use min-w-0; the Integrated vendors heading also wraps. Shared StaffTable contains horizontal scrolling without expanding the page.

## Roster mouse lock

StaffTable More-menu handlers defer the original callback using `setTimeout(select, 0)` so the modal menu closes before the roles/sites sheet opens. `onCloseAutoFocus` prevents the closing menu from moving focus over the sheet. No body pointer-events clearing. Existing registry, permissions and original handlers remain unchanged.

The full browser run passes the live flow: More → Change roles/sites → close sheet → mouse click another row (`e2e/overflow9c.spec.ts:34`).

## Chart color mapping

- `src/components/clinical/RecordTabs.tsx`: score lines use `SINGLE_COLOR` (chart-single); Cartesian grids use `chartDefaults.grid`.
- Timepoint reference line uses `chartDefaults.axis.stroke`, with `var(--ink-muted)` label. This is a timepoint, not a target.
- `src/components/chart/LabsAndMeasures.tsx:45,298–303`: stable `LAB_SERIES = ["bmi", "systolic"]`; BMI receives **series slot 1**, systolic **series slot 2**, through `seriesColorFor`. Grid uses `chartDefaults.grid`.
- `ui/chart.tsx` overrides untouched.

Twelve new screenshots retained in `phase9c1-evidence/`: tracking-chart and labs-chart, 390/768/1280, light/dark. Tracking evidence uses p1; metabolic evidence uses p3, after selecting Measures. Spot-checks show teal tracking and distinct blue/orange metabolic series; metabolic data has a single real dated observation, not fabricated connecting history.

## Explicitly approved test edits from the earlier implementation

`src/components/__tests__/staffTables8b2.test.tsx:34`:

```ts
// Old
expect(writes).toBe(1);
// Approved new
await vi.waitFor(() => expect(writes).toBe(1));
```

The containing test is async and imports vi. DEFAULT waitFor timeout; no timeout, retry, or exactly-one-write assertion change.

Fixture-field-only approvals: `occurrencesRecorded` added to both attendance objects in `src/components/__tests__/suppression9a2.test.tsx` (1/1) and `src/lib/__tests__/statTileParity9a2.test.tsx` (4/0). No assertions changed.

## Next-page diagnosis and accepted app fix

Failure: `e2e/contentInventoryTables8b2.spec.ts:25` timed out looking for Next page. The added inner overflow wrapper became the table's immediate parent; the test searches that parent for pagination, which was outside it. The control was visible, not clipped or delayed. min-w-0 and the More-menu defer were not causal.

Earlier diagnostic run results, recorded in the preceding exchange:

| Version | Run 1 | Run 2 | Run 3 |
|---|---|---|---|
| Current before app fix | Fail, 113s | Fail, 44s | Fail, 50s |
| Rollback 1e410aad | Pass, 73s | Pass, 37s | Pass, 27s |
| Fixed inventory + nine overflow tests | 10/10, 110s | 10/10, 129s | 10/10, 116s |

Rollback used git archive into a temporary directory with node_modules symlinked and an isolated server on 8091; no working-tree replacement or stash. Prior current/rollback screenshots were saved under temporary `/tmp/browser/9c1diag/`; that temporary directory did not survive into this closeout, so the report retains the recorded observations, not a claim of newly inspected comparison images.

Accepted app-only fix: remove the inner wrapper; put overflow-x-auto on StaffTable's existing container, retaining table and pagination as siblings. Saved views and pagination use sticky left-0. Current full browser suite passes inventory and all overflow/roster checks. No test, timeout or retry changes.

## PRE-EXISTING DMC readiness pair — awaiting Mitch

Previously recorded full units: **2,836/2,838**. The two accepted pre-existing failures, also seen on rollback, are:

1. `10d-3 medical necessity gate > Luis's treatment claim passes and can move to Ready`.
2. `10d-3 medical necessity gate > Jasmine's claim is blocked with the generic line for billing, specific for a therapist`.

Exact diagnosis: **time-of-day appointment seed collision, not ASAM age/window expiration**.

- `src/lib/ehr-ext.ts:1825–1830`: both treatment encounter seeds derive start from Date.now() minus three hours, round minutes down, then call demoBusinessTime.
- `src/lib/demoTime.ts:33–48`: outside business hours, slot zero is moved to 09:00 on the same Pacific date.
- `src/lib/ehr.ts:26631–26644`: p3/c1's scheduled visit uses Date.now() +120 minutes, business-time rounding.
- At **2026-10-20T14:02:00Z (07:02 Pacific)**, both treatment seeds become **2026-10-20T16:00:00Z (09:00 Pacific)**. p3/c1 already owns that start.
- `src/lib/ehr.ts:9258–9265` rejects the clinician's taken slot. allowPatientOverlap does not bypass the clinician check. `src/lib/ehr-ext.ts:1848–1850` swallows the seed exception, so neither treatment claim is created.
- `src/lib/__tests__/dmcOdsReadiness.test.ts:23–24` therefore returns undefined from treatmentClaim. Luis then reads program in gateApplies (`dmcOdsReadiness.ts:69`); Jasmine reads c.id (`test.ts:37`). The patients and ASAM records exist; the gate never gets a treatment claim in these failing cases.

Read-only reproduction, with temporary external Vitest setup/config and original test file unchanged:

| Pinned UTC clock | Original DMC file result |
|---|---|
| 2026-10-20T14:02:00Z | 6/8 pass; exact pair fails (undefined program/id); trace shows p3/c1 collision |
| 2026-10-20T14:22:00Z | 8/8 pass |
| 2026-09-29T15:00:00Z | 8/8 pass |

At 14:22 UTC, p3's +120-minute time rounds to 09:15 Pacific instead of 09:00, avoiding the exact-start collision. Fresh full units at 14:22:29 UTC pass **2,838/2,838, 352 files, 65.95s**, without any project edits. This does not remove the pre-existing instability or its approval requirement.

### Smallest proposed setup-only change — NOT APPLIED

Freeze Date **before ehr/ehr-ext imports initialize seeds**, for this DMC test only. A normal beforeEach or the existing freezeClock beforeAll is too late for module-import seeding. Proposed test-local hoisted setup (add vi/afterAll imports), pending Mitch's approval:

```ts
vi.hoisted(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-29T15:00:00.000Z"));
});
afterAll(() => vi.useRealTimers());
```

The equivalent pre-import Date-only setup was verified externally at that timestamp; the specific hoisted insertion remains a proposal, not an applied or separately validated patch. No assertions, production seed/billing/medical-necessity rules, timeout or retry changes. Pending: Mitch's approval of the setup-only lines.

## Final validation and restoration

- Prior full unit result retained: **2,836/2,838**, pair named above and accepted PRE-EXISTING. Additional fresh read-only full run: **2,838/2,838 (352 files)**.
- FULL browser suite: `E2E_BASE_URL=http://localhost:8080 bunx playwright test --workers=1`, background process, polled through its **literal EXIT 0**; **200/200 passed, 29.0m**, zero failures, no flake exceptions. Last validation run before closeout edits. Log was `/tmp/browser/9c1/e2e.log`; tests were not filtered or retried.
- Restored **17** regenerated tracked screenshots from rollback; inspected and verified **194/194** rollback image files byte-identical. Retained all 12 new chart captures and before/after JSON evidence.
- Preview build log: build OK. No application or test edits in this closeout; only report/roadmap and requested screenshot restoration.

## Addendum — approved DMC Date freeze and CalAIM decision (Oct 20)

Complete; not published. Batch rollback / starting HEAD after P3 and its documentation commit: `66bc81a63aef1b021fa22a1ce246f25b5aa668fc` (recorded before editing).

- Applied exactly the approved test-local `vi.hoisted` Date-only freeze at `2026-09-29T15:00:00.000Z`, plus `afterAll(() => vi.useRealTimers())` and the missing imports in `src/lib/__tests__/dmcOdsReadiness.test.ts`. No assertion, timeout, retry, other test, production seed or billing/medical-necessity logic changed.
- The historical temporary external harness was not retained. Recreated the same external pre-import Vitest setup/config approach in `/tmp/dmc-date-freeze/pinned.setup.ts` and `pinned.config.ts`: setup pins Date to `2026-10-20T14:02:00Z` before loading the edited file. Its test-local hoisted freeze then overrides that clock before EHR/EHR-ext seed imports. An external beforeAll assertion independently confirms the resulting clock is `2026-09-29T15:00:00.000Z`; both seeded treatment-claim tests pass without any assertion changes.
- Collision-clock runs: **8/8, 8/8, 8/8**, all **EXIT 0**; durations **1.68s, 1.96s, 2.32s**. Current-clock run started **2026-10-20T23:06:08Z**, **8/8**, **EXIT 0**, **1.48s**. Logs: `/tmp/dmc-date-freeze/pinned-{1,2,3}.log` and `current.log`.
- Full units: **2,893/2,893**, **359/359 files**, **EXIT 0**, **106.77s**; DMC file **8/8** including the formerly unstable pair. Log: `/tmp/dmc-date-freeze/full-units.log`. The existing production-bundle inspection unit test also passed; no separate build was run.
- Mitch DECIDED: **keep the CalAIM Your turn chip whenever ≥1 discharge is eligible**, even below 11; the count remains **<11**. No CalAIM code change; removed this decision from roadmap open items.
- Changed project files are only the approved test, `roadmap.md`, and this requested report addendum. No application files changed, so no browser suite or screenshot regeneration was needed. Next batch: seeded claims.
- Final managed SHA is reported after the documentation changes are checkpointed; no manual Git commit.