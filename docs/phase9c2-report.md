# Phase 9c-2 — complete

## Baseline and scope
- Rollback: `aff263ff1aa707d68994b7f175f83aa9d09306fd`; accepted 9c-1 `b15085a8`.
- Layout regrouping plus accepted presentation-only accessibility fixes. No changes to roles, access, Part 2, metric selectors, values, suppression, handlers, crisis banner, patient screens, or denied-claim styling.
- No publishing. The DMC readiness pre-import Date freeze remains **unapproved and unapplied**; no production billing/medical-necessity change.
- Isolated rollback used `git archive` in `/tmp/rollback-9c2`, shared dependencies by symlink, separate preview on :8081. No stash or working-tree replacement.

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

The case-manager scope framing was subsequently made unframed inside the task card, reducing its vertical footprint. Horizontal tracks show first tiles, not all summaries simultaneously. The unchanged fixed crisis footer remains in place. The new spec passes every action/summary bounding check at 1280×800 and 390×844; it checks viewport bounds, not a separate footer-occlusion assertion.

## Axe classification and accepted fixes
The same whole-staff-shell scope used by the new spec was scanned on rollback :8081 and current :8080 at 1280×800 and 390×844. Complete rule/node evidence: `phase9c2-evidence/axe-classification.json`. Current has **zero violations on all ten role/viewport combinations**. No axe rule, filter, or scope was relaxed.

All findings below are **PRE-EXISTING**, reproduced on rollback, except the explicit NEW scroll-region finding. References are current source lines; rollback nodes retain their original source references in the evidence.

| Classification | Home / rule | Element(s) and fix | Current file:line |
|---|---|---|---|
| NEW | Billing / `scrollable-region-focusable` | Horizontal KPI track gets `tabIndex=0`, `role=region`, accessible name “Billing summary”, visible existing-token focus ring | `src/routes/billing.tsx:234` |
| PRE-EXISTING | Clinician / `aria-required-children` | Schedule tablist's “This week” button gets `role=tab` and `aria-selected`; existing handler preserved | `src/components/clinician/WorkspaceDashboard.tsx:108` |
| PRE-EXISTING | Clinician / `color-contrast` | Zero-count Today button (Cosign) no longer applies parent `opacity-45`; existing muted text token retained | `src/components/clinician/WorkspaceDashboard.tsx:84` |
| PRE-EXISTING | Clinician / `heading-order` | Both action groups' Now headings, including waiting group: h4 → h3; words unchanged | `src/components/clinician/WorkspaceDashboard.tsx:127` |
| PRE-EXISTING | Case manager / `button-name` | Case-manager picker receives accessible name | `src/routes/case-manager.tsx:259` |
| PRE-EXISTING | Case manager / `button-name` | Five caseload selects: episode day, coverage, program, clinician, care need receive accessible names | `src/components/admin/CaseloadTable.tsx:134,145,157,169,181` |
| PRE-EXISTING | Case manager and admin / `button-name` | Four referral selects: status, program, clinician, care need receive accessible names | `src/components/admin/ReferralTrackerCard.tsx:136,148,156,166` |
| PRE-EXISTING | Case manager / `button-name` | Check-in modality receives accessible name | `src/routes/case-manager.tsx:712` |
| PRE-EXISTING | Case manager / `label` | Desktop DOB from/to fields bind existing labels with htmlFor/id; mobile equivalents bind too; check-in date binds existing label. Rollback has three desktop unnamed date fields and one phone field | `src/routes/case-manager.tsx:315–333,361–379,681–684` |
| PRE-EXISTING | Case manager / `color-contrast` | ECM badge uses existing path-soft/path tokens, desktop and mobile; visible label unchanged | `src/routes/case-manager.tsx:443,538` |
| PRE-EXISTING | Billing / `color-contrast` | Ready-to-send zero strip label: remove `opacity-70`; existing muted text retained | `src/components/ops/OpsWorkspace.tsx:21–23` |
| PRE-EXISTING | Billing / `color-contrast` | Unselected billing entity button: replace foreground/60 with muted-foreground | `src/routes/billing.tsx:330` |
| PRE-EXISTING | Billing / `color-contrast` | County-reportable explanatory text: replace navy/80 with muted-foreground | `src/routes/billing.tsx:346` |
| PRE-EXISTING | Billing / `heading-order` | Blocked claims heading h3 → h2; sibling Duplicate holds and Eligibility headings aligned; text/counts unchanged | `src/components/ops/OpsWorkspace.tsx:76,85,94` |
| PRE-EXISTING | Billing / `select-name` | Lane and Status native filters receive accessible names | `src/routes/billing.tsx:378,392` |
| PRE-EXISTING | Admin / `button-name` | Episode day, coverage, consent purpose selects receive accessible names; existing Next contact type name retained | `src/routes/admin.tsx:262,273,433` |
| PRE-EXISTING | Admin / `color-contrast` | Blocked actions and Flags changed zero strip labels: same shared opacity removal as billing | `src/components/ops/OpsWorkspace.tsx:21–23` |

Compliance is axe-clean on rollback and current. No classified finding remains unfixed. The original NEW billing scroll finding was recorded during the pre-fix current scan; the current archive evidence contains its corrected state. The prior stop report remains the historical record below, not a claim of unapproved scope expansion.

## Accepted new denial-test correction
`e2e/roleDashboards9c.spec.ts:46–51`: billing requesting `/admin` must be denied (`not.toHaveURL(/\/admin$/)`) and **zero** `admin-kpis` must render. The previous assumption that the destination must specifically be `/billing` was incorrect. The accepted correction retains route denial plus tile absence, not a weaker check. No existing assertion, timeout, retry, threshold, deletion, or skip changed.

## Pinned rendered value parity
- Reproducible diagnostic: `phase9c2-evidence/pinned-parity.py`; complete per-role captured values and visible-testid inventories: `phase9c2-evidence/pinned-parity.json`.
- Clock pinned **before browser module evaluation** on both previews to `2026-10-20T16:47:00.000Z`; timezone UTC, locale en-US, 1280×1800.
- Both start in fresh isolated browser contexts with empty device storage and the same source seeds. `Math.random` is fixed to 0.5 on both before module evaluation, making random seed IDs and simulated delivery outcomes identical (`ehr.ts:4469,9479`; `ehr-ext.ts:491`). This is diagnostic-only, not an app/test clock change.
- The same automatic mount reminder sweep runs on both through unchanged `useReminderSweep.ts:49–62`; no interval clock advancement or manual sweep. Date stays pinned while timers work normally.
- Compares exact strings (no number rounding, timestamp masking, whitespace collapsing, or value substitutions): sorted visible-testid **sets and multiplicities**, each node's own text excluding nested testid owners, each StatTile's full text and value, every Today-strip button, and every `data-count` tile.
- Descendant testid owners are compared independently, so relocating a section does not falsely compare a parent containing its moved child. Every actual tile value remains included; non-testid tile text remains in its nearest identified owner. This is a layout-order-independent comparison, not ignoring unequal values.

| Role / home | Visible testid set size on both | Result |
|---|---:|---|
| therapist / clinician | 37 | Byte-identical values and inventories |
| ecm_provider / case manager | 28 | Byte-identical values and inventories |
| billing / billing | 47 | Byte-identical values and inventories |
| sys_admin / admin | 36 | Byte-identical values and inventories |
| credentialing_coordinator / compliance | 14 | Byte-identical values and inventories |

**Remaining value differences: zero.** Earlier unpinned differences are superseded, not accepted as parity: time-dependent Last outreach differed, random simulated SMS failure/sweep outcomes changed notifications/tasks, and moved sections changed parent text ordering. With identical clock, randomness, and sweep these differences disappear without app changes. No real value changed; no stop condition triggered.

## Validation — complete
- Full fresh units: **2,857/2,857**, **353/353 files**, EXIT 0; 70.86s. Known DMC pair passed unchanged. Prior accepted run: same totals.
- Static rollback binding/selector parity: 19/19, included in full units.
- NEW role-dashboard spec: **3/3 standalone runs**, **11/11 each**, EXIT 0 each (1.4m, 1.5m, 1.4m). All five homes × two viewports pass summary/action bounds and full-shell axe. Existing action readbacks for clinician, case manager, billing pass; compliance seed has no waiting review item, so no fabricated review mutation.
- FULL browser suite: `E2E_BASE_URL=http://localhost:8080 bunx playwright test --workers=1`, launched in background and polled to literal **EXIT 0**: **211/211 passed**, **31.0m**. This was the **last validation step**; no further test suite or browser scan afterward.
- No flake exceptions needed; contentWiring:47 and staffNewAudit8a2:29 remain unchanged. No other failures.
- Build telemetry: latest read **build OK**, 2026-10-20T17:33:50Z.
- Route metadata inspected on index and all five content homes; existing app-specific title, description, Open Graph and Twitter tags retained.

## Evidence, restoration and next phase
- Retained ten baseline captures, thirty home light/dark captures at 390/768/1280, before/after measurements, original unpinned diagnostic, new pinned parity, and raw rollback/current axe evidence.
- After browser EXIT, restored **17** regenerated tracked screenshots against aff263ff. Checked **223** rollback image files (including SVGs): **zero byte differences**. Details: `phase9c2-evidence/screenshot-restoration.json`; new evidence untouched.
- Phase 9c-2 **done**. **Privacy P3 next**, not started.
- No publishing. DMC setup freeze awaits Mitch and remains unapplied.
- Final managed closeout SHA is reported in chat after these documentation/restoration changes; source validation checkpoint was `e6b33b0722f3ec5d3dfbb83ec1dd326bd805ea69`.
