# Phase 9c-2 — stopped pending scope decision

## Baseline
- Rollback recorded before edits: `aff263ff1aa707d68994b7f175f83aa9d09306fd`; accepted 9c-1 `b15085a8`.
- No publishing, existing-test edits, Date freeze, or billing/medical-necessity changes.
- Status: **not complete**. New whole-home accessibility checks failed; the full browser suite was not launched after these unapproved failures.

## Before / proposed order (shared before editing)
| Home | Baseline desktop / phone | Proposed order and baseline source |
|---|---|---|
| Clinician | action panel y409 / y638; Today summary below fold | Existing Today strip first, then action/work sections; WorkspaceDashboard.tsx:82–98 |
| Case manager | My tasks y396 / y609; scope summary below fold | Task controls, scope summary, task rows; case-manager.tsx:222–276, TaskQueueCard.tsx:95–139 |
| Billing | Today action strip y306 / y493; KPIs below fold | Existing action strip, KPIs, action details; billing.tsx:259–310, OpsWorkspace.tsx:56–116 |
| Admin | Today strip y198 / y307; KPIs below navigation | Existing action strip, heading, KPIs, navigation; admin.tsx:183–245 |
| Compliance | review queue and summaries already fit | Review queue, unusual-volume summary, access table; quality-compliance.tsx:63–125 |

## Implemented presentation only
- Clinician: lift existing Today strip ahead of WorkspaceSectionOrder. Work sections retain caller gates, callbacks and IDs.
- Case manager: existing scope summary passes into TaskQueueCard between task controls and task rows. Outer scope section is unframed within the queue; the coordinator-only staff picker remains outside the queue. No patient selector changed.
- Billing: existing KPI node passes into BillingWorkspaceTiles between Today controls and action details. For non-writers it renders directly under the header as before. Horizontal compact summary track on smaller screens; denied Kpi and chip unchanged.
- Admin: existing KPI block precedes navigation; smaller screens use a horizontally scrolling summary track.
- Compliance: move unusual-volume block before outside-caseload table. Existing review and restriction handlers unchanged.
- Crisis components, patient screens, records, metric selectors, Part 2/access/suppression rules unchanged.

## Measured after (top–bottom, desktop / phone)
Measurements in `phase9c2-evidence/after.json`; widths 1280×800 and 390×844.
| Summary/action region | Desktop | Phone |
|---|---:|---:|
| Clinician Today strip | 365–431 | 594–660 |
| Case-manager task controls start | 344 | 513 |
| Case-manager scope summary | 413–515 | 654–828 |
| Billing Today controls | 306–358 | 493–545 |
| Billing KPI region | 370–628 | 557–815 |
| Admin Today controls | 198–250 | 307–419 |
| Admin KPIs | 374–592 | 543–725 |
| Compliance review region | 260–346 | 369–455 |
| Compliance unusual-volume region | 366–472 | 475–601 |

The case-manager scope framing was subsequently made unframed inside the task card, reducing its vertical footprint. Horizontal tracks show first tiles, not all summaries simultaneously. Phone screenshots show the existing fixed crisis footer covering the lower part of the original 828px scope measurement; final unobscured fold acceptance remains pending.

## Validation / stop
- Full units: **2,857/2,857, 353 files**, 75.44s. Unchanged known DMC pair passed; setup freeze remains unapplied.
- New static AST parity: **19/19**. Existing value/ID/handler bindings and non-JSX selector expressions match rollback; role/access/store/suppression modules byte-identical. This is **not** the complete requested rendered per-role visible-testid/value parity; that remains pending.
- New focused browser spec: initial **2/11 passed, 9 failed**. All ten role/viewport bounding checks reached and passed before axe. Eight failures were whole-home accessibility findings; the ninth was an incorrect new denial-test assumption that `/admin` redirects billing to `/billing`. It actually redirects to another permitted home. Corrected only that new test to assert route denial and absence of admin tiles; standalone **1/1 passed**, 17.2s. No existing assertions/timeouts/retries edited.
- Clinician axe: tablist child semantics (WorkspaceDashboard.tsx:108), skipped heading level (:127), low-contrast zero-count strip labels (:85).
- Case-manager axe: unnamed select/table controls and form labels, contrast. Examples: case-manager.tsx:259 and its existing shared tables. Details retained in the focused test log during this session.
- Billing axe: unnamed selects (billing.tsx:377/390), heading ordering, zero-count strip contrast (OpsWorkspace.tsx:21–23). **New** phone KPI scroll region also requires keyboard focusability (billing.tsx:234).
- Admin axe: unnamed controls (admin.tsx:262/273/433) and zero-count strip contrast (OpsWorkspace.tsx:21–23).
- These findings are not approved flake exceptions. Most arise from unchanged markup, but no rollback browser accessibility comparison was run, so they are not claimed as validated pre-existing exceptions. The new scroll-focus issue is acknowledged as introduced by this layout.
- **Stopped without altering assertions or expanding scope** to relabel controls, change contrast, or fix heading/tab semantics. No full browser suite run; no literal EXIT or final acceptance claimed.
- Build telemetry latest: build OK, 15:20:01 UTC.

## Evidence and restoration
- Baseline ten captures plus 30 after captures (each home 390/768/1280 light/dark) retained in `docs/phase9c2-evidence/`.
- All **206** rollback image files checked; **0** differences/restorations needed. New evidence preserved.
- Current checkpoint before report write: `9d694cb10929746488b5b5e03cf2c21af91ee2b1`; managed final checkpoint reported in chat, not an accepted phase-final SHA.

## Remaining blockers
1. Approval to resolve full-home accessibility findings outside reorder-only scope, plus new KPI scroll focusability.
2. Complete rendered rollback parity by acting role, verify summaries above the fixed footer, and exercise each existing next-action flow with real actionable state (compliance baseline queue is empty).
3. Then run full one-worker browser suite on :8080 in background and poll through literal EXIT, restore images, and finish closeout.