# Phase 8b-1 — completed

Completed October 17, 2026 under Mitch's delegated coordinator approval. No publishing; no 8b-2/8b-3; no existing test edits, permission, Part 2, status-mapping or registry-gate changes.

## Environment recovery

- Rollback SHA: `e822105ffca551809487f2403bc60f728bfe8d9b`.
- Starting working tree was clean; all four pilots contained the current table code. `git stash list` was blocked by the platform's Git safety wrapper; read-only `git for-each-ref refs/stash` returned no stash reference. No reverted source was found or restored.
- A fresh browser already rendered `.staff-table` on `/notes-queue` with no page errors. The requested supervised restart was performed once; Vite reported ready in 2,729 ms, :8080 returned HTTP 200, and a second fresh browser again rendered the current notes table without page errors. Cache deletion was unnecessary.
- The enclosing restart command hit its tool timeout, but its saved output confirmed restart, readiness, successful browser verification and background suite launch. The running suite was then polled, not restarted.
- Standalone unchanged `e2e/staffTables8b1.spec.ts`: **9 passed / 9 listed**. The previous 3/9 stale-module result required no application or test fix.

## Validation

| Check | Passed / listed | Evidence |
|---|---:|---|
| Full unit suite | **2,693 / 2,693** | 333 files; `vitest list` count matched `vitest run`; 73.98 s |
| Full browser suite | **145 / 145** | 36 files; :8080; one worker; background run polled to completion; 32.7 min |
| Standalone table pilots | **9 / 9** | 1280/390 keyboard, sorting, row parity and axe; billing denial |
| Screenshot matrix | **24 / 24** | Four pilots × 390/768/1280 × light/dark; reviewed contact sheet |
| Tracked screenshot restoration | **20 / 20 hashes** | 14 regenerated files restored to this turn's pre-run bytes |

No retries, timeouts, thresholds, assertions or existing tests were changed. Content-wiring passed in the full suite, so the approved flake exception was not needed. Latest observed automatic build: **build OK**. Current-source browser captures had no page errors.

## Row and selected-view parity

No second rollback substitution was necessary. `unsignedWork.ts`, `coverageWorklist.ts`, `caseloadScope.ts` and `inFacility.ts` are byte-identical to rollback. Worklist's caller-scoped filter block is also identical. Browser comparisons evaluated those same original projections against real seeded records and asserted exact ordered visible row IDs—not just labels or totals.

| Pilot and actor | View | Projection count / UI count |
|---|---|---:|
| Caseload, Lupita / ECM provider | Current caseload | **7 / 7** |
| Eligibility, Marisol / therapist | Needs a check / Needs you | **20 / 20** |
| Unsigned notes, Marisol | Needs you | **5 / 5** |
| Unsigned notes, Marisol | Everyone | **7 / 7** |
| Task worklist, Marisol | Needs you | **38 / 38** |
| Task worklist, Marisol | Current view | **40 / 40** |

Caseload retained ordered program IDs `ADL-2026-001`, `002`, `900`, `901`, `902`, `010`, `013`; unassigned Daniel M. and Rosa T. remain absent from the assigned table. All **28** other-discipline task rows remained absent under the therapist's default discipline filter. Billing's denied notes screen has zero table/record rows. CIN remains suffix-masked.

Worklist card values `(Total, Open, Unclaimed, Mine, Follow-up needed, STAT)` were **(38,38,38,0,1,0)** for Needs you and **(40,38,38,0,1,0)** for Current view. Both matched the rollback stat formulas applied to the selected subset; the Current view reproduces rollback's full scoped counts. Real time-dependent values were captured, not hardcoded into the app.

## Pending presentation items closed

- StaffTable uses selected-view empty content, then caller empty content, then generic fallback, preserving the chosen view and excluding other-view rows. The new closeout zero-result test passed. Notes and worklist retain explicit empty messages; eligibility preserves its existing caller-filter empty screen; caseload supplies its empty message inside the shared table.
- The actual TaskQueueCard/TaskWorkRow closeout test typed an unfinished note, paged forward and back across the 50-row boundary, and read back the draft. Passed in the full suite. Cache ownership remains actor-keyed and session-only; role switches discard it. No write, persistence or audit for editor state.
- Table measurements fit all requested widths. Mobile/tablet rows are stacked; desktop rows are table rows. **Existing non-table case-manager content still expands the 768px document to 1,104px**; the pilot table itself is 438px wide with no internal overflow. No unrelated layout repair was attempted. Desktop worklist narrow-column wrapping and long mobile documentation labels remain visible in the matrix; captured, not claimed as a broader layout polish.

## Documented pre-existing flake

Prior standalone comparisons: **3/3 current and 3/3 rollback**, recorded in `phase8b1-diagnostic-stop.md`. Coordinator classified `e2e/contentWiring.spec.ts:47` as a pre-existing intermittent flake, likely a development reload. The test is untouched and passed in this full run.

`src/lib/devInspect.ts:5,10-17` exposes `setActingStaff`; `src/lib/roles.ts:1594-1606` changes identity/storage and notifies subscribers without navigation. `src/components/RouteAccessGuard.tsx:24-30,61-62` only navigates on denial. StaffTable has no navigation effect. The previously recorded Vite dependency optimizer `fullReload()` path (`config.js:34241-34243`, client reload handler `client.mjs:874-881`) is a plausible mechanism, not a proven causal trace of the original failure. No guard or role-change fix was made.

## Existing privacy gaps — unchanged; for Mitch

1. **Caseload scope is not authorization.** `src/lib/caseloadScope.ts:2-8,60-72`: assigned is a default listing filter; broad views, search and direct links remain available.
2. **Caseload SUD program classification has no local role-specific Part 2 check.** `src/components/admin/CaseloadTable.tsx:51-56,149-155`: existing program filter is retained, not converted into a permission gate.
3. **Whole-clinic unsigned documentation lacks per-row actor/Part 2 visibility filtering.** `src/lib/unsignedWork.ts:56-110`; `src/routes/notes-queue.tsx:125,147-150,162-172`: patient names, owner and service details may appear; signing authorization is not visibility authorization.
4. **Task worklist discipline is toggleable, not authorization.** `src/routes/worklist.tsx:139-170,356-360`: turning the existing filter off can broaden task/patient visibility. Default excluded rows stay absent; no hidden row became a locked placeholder. Existing outpatient exclusion remains unchanged.
5. **TaskQueueCard source assignment is not a new actor permission boundary and can contain in-facility details.** `src/components/tasks/TaskQueueCard.tsx:30-50,70-82,126-130`: the existing source can include medication-pass/custody task text even with the outpatient segment default off. Recorded, not repaired in this presentation-only approval.

These are existing limitations, not newly granted access, and require a separately approved security/clinical scope. No permission or Part 2 changes were made to close them here.

## Files and retained evidence

Application changes from rollback: `src/components/staff/StaffTable.tsx`; `src/components/admin/CaseloadTable.tsx`; `src/components/tasks/{TaskQueueCard,TaskWorkRow}.tsx`; `src/components/tasks/taskWorkDraft.ts`; `src/routes/{eligibility-worklist,notes-queue,worklist}.tsx`; `src/styles.css`. Architecture rules: `src/components/AGENTS.md`.

New tests from the batch: `e2e/staffTables8b1.spec.ts`; `src/components/__tests__/{staffTable8b1,staffTable8b1Closeout}.test.tsx`. This closeout changed documentation/roadmap only and the standing coordinator flake exception memory; it did not change app or test source.

Retained project evidence: `docs/phase8b1-evidence/source-parity.json`, `view-parity.json`, and `screenshots/` (24 PNGs). Temporary full logs: `/tmp/phase8b1/{unit-list,units,browser-list,full-browser,pilots}.log`. Prior stop remains historical in `docs/phase8b1-diagnostic-stop.md`.

Validated application/restored-screenshot SHA before this report: `664cfb6812d72e51c91c91c3b9f3124fcf585059`. The platform manages final commits automatically; final post-report HEAD is reported in chat, not manually committed.