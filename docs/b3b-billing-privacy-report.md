# B3b — Billing privacy narrowing

## Rollback and scope

- Rollback recorded before B3b edits: `b1d3c414de160babe95c541483a610853cb3e076` (current HEAD; B3a accepted final `2409b85c`).
- Narrowing only for billing / billing_coordinator claim surfaces. Shared clinical stores, other roles, permissions, rates, states, necessity validation, payment reconciliation, county / ISL exports and denied styling remain unchanged. Do not publish.
- B3a added saveAsamDraft / signAsam / cosignAsam store references to the existing asam registry entry (`chartActions.ts:419–422`). The asam action's `allowed` block (`:423–427`) is **byte-identical** to `2f56b883`: SHA-256 `2d1004bf8f1860b922eeacec92befa98db98b93a90cd4c0025ad2c3d510cf02b`.
- The committed permission snapshot `src/lib/__tests__/__snapshots__/runAction.test.ts.snap` is **byte-identical** to `2f56b883`: SHA-256 `47332ee1b11b32e437fdbacfcb3946ccdd6e4d0bdd99e988722c9d165eb1c08c`. Its generator `src/lib/actions/permissionMatrix.ts` and role definitions `src/lib/roles.ts` also compare byte-identical. No registry or permission edits in B3b.

## Required before/after inventory

**IMPLEMENTED — VALIDATION STOP (BEHAVIOURAL ASSERTION):** all named billing boundaries, including mounted BillingWorkspaceTiles, receive projected inputs for billing audiences. Nonbilling selectors return original store records.

| Surface / source | Before: received fields | Implemented after: received fields |
|---|---|---|
| `/billing`, `billing.tsx:113–156` | Whole Patient / Appointment / Claim records; BillingRow retains Patient and Appointment | Explicit patient ID/program ID/authorized name, claim-needed payer/member/coverage/arrangement fields; appointment ID/patient ID/provider/start/duration/status/funding/service/modality/location/charge/ISL reason; explicit claim/financial projection. No appointment ASAM task ID or patient clinical subgraphs. Existing row date logic remains unchanged (standalone-date correctness is separate). |
| `/admin-claims`, `admin-claims.tsx:221–231,247–268,390–439` | Whole patients/claims; filtered clinical audit records; raw patient names; claim signature trace | Same claim-only projection and identity selector using existing staffPatientLabel/viewerCanOpenChart; projected blocked-attempt identifiers/service/reason. CSV stays program ID only with current columns. |
| Group popover, `admin-claims.tsx:395–432` | Group topic, occurrence, other attendees' IDs/program IDs/status | This claim's group-sourced flag and own session/occurrence reference only; no topic or other attendees. Clinical/sys_admin branch remains unchanged. |
| Amount/correction/payment popovers, `RatesPanel.tsx:41–125`, `PatientBalance.tsx:24–165` | Whole Claim including signature history and reviewFlag.noteId; scalar arrangement read | Explicit amount/code/program/unit/rate/correction/action identifiers, patient responsibility and all approved payment reconciliation fields; arrangement-only selector. No note ID/signature attestation reachable through props. |
| Signature, `ClaimSignatureLine.tsx:5–27` | Note ID/chart link, provider/role/date, author and attestation key/version | Billing: Signed / Cosigned by provider on date, or Blocked: note not signed; no note ID/link/attestation. Preserve honest seed designation and unchanged clinical-role branch. Store validation unchanged. |
| Ops claim forms/pickers, `OpsActionLauncher.tsx:130–285` | Whole claims/workspace and whole patient collection; identity search via whole patients | Explicit claims/financial fields, generic documentation block and identity/coverage/arrangement-only projection; retain duplicate counterpart claim reference and all reconciliation data. Existing action gates/mutations remain unchanged. Nonbilling branches unchanged. |

Claim financial fields retained include method, reference, recorder and void reason as approved in B3a. Necessity details remain inside existing validation; billing receives only the existing generic block. No claim-linked ICD field exists today: do not substitute patient diagnoses. County / ISL exports, denied appearance, permissions, rates and states stay unchanged.

## Existing-test stop: exact current / proposed

- **File/line:** `src/components/__tests__/roleDashboardParity9c2.test.ts:18–19,28`.
- **Current assertion:** line 28 compares `inventory(readFileSync(path, "utf8"))` to `inventory(withApprovedP3(path, old(path)))`. The inventory at lines 18–19 captures all variable declarations and selector expressions. `/billing` is included at line 8.
- **Current wide production expressions:** `billing.tsx:113` `const appointments = useEhr(() => AdelanteEHR.listAppointments());`; `:114` `const patients = useEhr(() => AdelanteEHR.listPatients());`; `:119` `const claims = useEhrExt(() => AdelanteEHRExt.listClaims());`. The test also pins `patient`/`appt`/`claim` row construction and its local declarations at `:122–156`.
- **Proposed production narrowing:** those selectors return explicit billing-safe projections for billing/billing_coordinator, with unchanged full-record branches for other roles, and rows receive only those projected values. This necessarily changes the exact captured declarations even when displayed billing values remain identical.
- **Approval needed:** only the `/billing` expected selector/row declarations that encode this narrowing in the line-28 comparison may change. Preserve all other inventory bindings, IDs, handlers, KPI calculations and other files; do not remove the comparison, skip `/billing`, or loosen the entire inventory. A NEW narrowly scoped expected-expression adapter could represent precisely the approved substitutions, if Mitch approves the corresponding line-28 binding.
- No existing tests or production files were changed, and no validation suites were started. Targeted B3a/table checks do not assert the forbidden group/topic/signature/name content; their amounts, states, denied class, blocked-action text and export columns can remain unchanged.

## Validation

Blocked by the existing-test stop above: NEW projection and browser tests; pinned-clock seeded clinician / sys_admin parity; restart; full units; exclusive background full browser suite on :8080 with one worker polled to literal EXIT; screenshot restoration; closeout. No production edits means no screenshot changes to restore. Nothing published.

## Oct 21 delegated approval — applied test changes

`src/components/__tests__/roleDashboardParity9c2.test.ts`, original line 5 insertion:
- Old: no billing adapter import.
- New: `import { withApprovedBillingB3b } from "@/test/billingB3bApproved";`

Original line 28 (now 29):
- Old: `expect(inventory(readFileSync(path, "utf8"))).toEqual(inventory(withApprovedP3(path, old(path))));`
- New: `expect(inventory(readFileSync(path, "utf8"))).toEqual(inventory(withApprovedBillingB3b(path, withApprovedP3(path, old(path)))));`

The NEW adapter returns every non-`src/routes/billing.tsx` input byte-identically and requires every anchor exactly once. Only these selectors change:
```text
const appointments = useEhr(() => AdelanteEHR.listAppointments());
→ const appointments = useEhr(() => billingAppointments());
const patients = useEhr(() => AdelanteEHR.listPatients());
→ const patients = useEhr(() => billingPatients());
const claims = useEhrExt(() => AdelanteEHRExt.listClaims());
→ const claims = useEhrExt(() => billingClaims());
```
No row-declaration substitutions were necessary: the existing row construction now receives projected inputs. All row expressions, IDs, handlers and KPI calculations remain unchanged.

## Second existing-test STOP — mounted workspace ingestion

The approved adapter is **billing.tsx only**. `roleDashboardParity9c2.test.ts` also pins `src/components/ops/OpsWorkspace.tsx` (original line 8, now 9), through the same comparison (original line 28, now 29), and the variable inventory (original lines 18–19, now 19–20). BillingWorkspaceTiles is mounted on `/billing`; its current reads bypass the new boundary.

Exact production declarations requiring a separately approved expected-expression adapter:

| Source | Current | Proposed |
|---|---|---|
| `src/components/ops/OpsWorkspace.tsx:44` | `const claims = useEhrExt(() => AdelanteEHRExt.listClaims());` | `const claims = useEhrExt(() => billingClaims());` |
| `src/components/ops/OpsWorkspace.tsx:45` | `const patients = useEhr(() => AdelanteEHR.listPatients());` | `const patients = useEhr(() => billingPatients());` |
| `src/components/ops/OpsWorkspace.tsx:46` | `const ws = billingWorkspace(role, claims);` | `const ws = billingOpsWorkspace(role, claims);` |

Proposed test extension: a NEW exact-once OpsWorkspace-specific adapter for only those three declarations, composed at the comparison; the existing billing-only adapter stays billing-only. Every other inventory record/expression remains pinned. OpsWorkspace has NOT been edited; no test assertion has been loosened and no additional failure was induced.

The workspace helper must preserve the existing eligibility-due rows via a safe coverage worklist projection rather than the current unfinished empty eligibility list; do not claim parity or completion before this is corrected and validated. This unfinished helper is not a completed workflow change.

## Partial implementation and verification

- Added billingProjection allowlists: patient identity/claim coverage, appointment session data, claim/financial fields; history retains only at/state for existing dates/sparklines, no signature trace/notes. Payments retain every B3a reconciliation field.
- Applied boundary to billing/admin-claims and OpsActionLauncher claim/patient forms; amount/balance components narrow inputs; billing signature shows provider/date without note link/attestation; billing group popover shows only own reference; nonbilling display branches retained.
- Focused existing checks: `roleDashboardParity9c2.test.ts` 19/19 and `billingParity9a3.test.tsx` 9/9, total 28/28. Latest automatic check: build OK at 02:51:19 UTC.
- Not complete: OpsWorkspace boundary; NEW projection/browser tests; seeded pinned-clock clinician/sys_admin parity; final restart/full units/full exclusive browser suite; screenshot restoration and final closeout. No full validation was started and nothing published.
- Reviewer's suggestion to remove provider name is rejected: Mitch explicitly authorizes `Signed / Cosigned by <provider> on <date>`.

## Oct 21 second-stop approval — third existing-test STOP

The OpsWorkspace-only exact-once adapter and its three declarations are approved. Implementation is stopped before further production/test edits because the newly required reuse of `billingWorkspace` on projected coverage inputs conflicts with two additional byte-identical assertions. Neither assertion is covered by the approved inventory adapter. Rollback remains `b1d3c414de160babe95c541483a610853cb3e076`.

### Current / proposed production text

`src/lib/billingWorkspace.ts:36`:
```ts
// Current
export function billingWorkspace(role: StaffRole, claims: Claim[] = AdelanteEHRExt.listClaims()): BillingWorkspace {
// Proposed
export function billingWorkspace(role: StaffRole, claims: Claim[] = AdelanteEHRExt.listClaims(), coverageRows: CoverageWorklistRow[] = coverageWorklistRows()): BillingWorkspace {
```

`src/lib/billingWorkspace.ts:44`:
```ts
// Current
    eligibilityDue: coverageWorklistRows().filter((r) => ELIGIBILITY_DUE.includes(r.state)),
// Proposed
    eligibilityDue: coverageRows.filter((r) => ELIGIBILITY_DUE.includes(r.state)),
```

These two substitutions permit the original workspace computations to consume projected coverage worklist rows without copying any list/filter logic. Existing callers retain the original default; the billing-only helper would supply safe projected coverage rows and projected claims. No rates, gates, state rules, exports or clinical-store changes are proposed. Avoid global mocks or store monkey-patching to inject inputs into production.

### Conflicting existing tests: exact current / proposed

1. `src/components/__tests__/roleDashboardParity9c2.test.ts:31–32` includes `src/lib/billingWorkspace.ts` in its byte-identical source list.
```ts
// Current line 32
    expect(readFileSync(path, "utf8")).toBe(withApprovedP3(path, old(path)));
// Proposed (requires approval)
    expect(readFileSync(path, "utf8")).toBe(withApprovedBillingWorkspaceB3b(path, withApprovedP3(path, old(path))));
```

2. `src/lib/__tests__/billingParity9a3.test.tsx:13,19` includes the same file in `SELECTORS`.
```ts
// Current line 19
  it.each(SELECTORS)("%s is byte-identical to rollback", (p) => expect(readFileSync(p, "utf8")).toBe(old(p)));
// Proposed (requires approval)
  it.each(SELECTORS)("%s is byte-identical to rollback", (p) => expect(readFileSync(p, "utf8")).toBe(withApprovedBillingWorkspaceB3b(p, old(p))));
```

Proposed NEW `src/test/billingWorkspaceB3bApproved.ts` would apply **only** the two production substitutions above, **only** to `src/lib/billingWorkspace.ts`, requiring each anchor exactly once and returning every other file unchanged. Both tests would import that adapter. This is distinct from the approved OpsWorkspace inventory adapter and the billing.tsx-only adapter; it removes no comparisons and leaves all other source bytes pinned.

No additional production files or existing tests were edited after discovering this conflict. No full validation or browser suite was started. Pending: approved OpsWorkspace adapter/comparison, safe coverage inputs and workspace ID/count parity for both billing roles on both seeds, new privacy and browser tests, clinician/sys_admin parity, restart/full validation/screenshot restoration/closeout SHA. The partial helper's empty eligibility list remains an acknowledged unfinished implementation, not a validated change. Nothing published.

## Third-stop approval — implemented exact changes

Rollback remains b1d3c414. The two production changes are exactly the current/proposed blocks above: billingWorkspace adds the defaulted coverageRows parameter, and eligibilityDue filters that input. All other billingWorkspace bytes are pinned by the NEW billingWorkspaceB3bApproved adapter, scoped only to that file, with exact-once anchors.

NEW opsWorkspaceB3bApproved adapter applies only the three approved declarations in OpsWorkspace; their old/new text is recorded above. The billing.tsx adapter remains billing-only.

Existing test changes (line numbers refer to rollback):

- roleDashboardParity9c2.test.ts:28 old `expect(inventory(readFileSync(path, "utf8"))).toEqual(inventory(withApprovedP3(path, old(path))));`
- New `expect(inventory(readFileSync(path, "utf8"))).toEqual(inventory(withApprovedOpsWorkspaceB3b(path, withApprovedBillingB3b(path, withApprovedP3(path, old(path))))));`
- roleDashboardParity9c2.test.ts:32 old `expect(readFileSync(path, "utf8")).toBe(withApprovedP3(path, old(path)));`
- New `expect(readFileSync(path, "utf8")).toBe(withApprovedBillingWorkspaceB3b(path, withApprovedP3(path, old(path))));`
- billingParity9a3.test.tsx:19 old `it.each(SELECTORS)("%s is byte-identical to rollback", (p) => expect(readFileSync(p, "utf8")).toBe(old(p)));`
- New `it.each(SELECTORS)("%s is byte-identical to rollback", (p) => expect(readFileSync(p, "utf8")).toBe(withApprovedBillingWorkspaceB3b(p, old(p))));`
- Imports added to the first test: withApprovedBillingB3b, withApprovedOpsWorkspaceB3b, withApprovedBillingWorkspaceB3b from their corresponding NEW src/test adapters; second test imports only withApprovedBillingWorkspaceB3b. No assertions removed, skipped or loosened. No further pre-approved substitutions were needed.

### Safe coverage and preserved lists

Coverage rows are derived/sorted by the existing coverageWorklistRows first, then projected to patientId, programId, county, coverageStatus, verified, cinOnFile, activePlanPayer, daysSinceCheck, state and policy-approved name; openFollowUps is empty and no verification/report/task graph leaves the selector. Name masking occurs after original sorting so all list IDs and order remain identical. billingOpsWorkspace calls the original billingWorkspace; no list logic is copied. Original claims still drive generic documentation validation inside the existing store boundary.

### Focused checks

- Approved source/inventory parity tests: 28/28.
- NEW billingProjectionB3b.test.ts: 5/5; exact root/nested allowlists, private-key recursion, payment reconciliation, every workspace list ID/order/count/reason for both billing roles on both default and B3a seeds; lane parity; pinned clinician/sys_admin selector/workspace parity and shared clinical files byte-identical to rollback.
- NEW billingPrivacyB3b.spec.ts: 3/3; both billing roles re-walk all seven lifecycle branches, exact amounts/dual audits/CSV headers, blocked Ready, unchanged denied class, no note links or provenance, program IDs on admin claims, and axe.
- Default seed contains no group claim: the NEW browser fixture uses existing public group creation/attendance/documentation/claim stores on fictional B3a patients (no record patching or ID injection), then verifies no topic, other attendee ID/program ID or attendance list in the group popover. No group permission or registry changes.
- Screenshots visually inspected: group reference only; signed provider/date; receipts/balances and denied look retained. Temporary images are under /tmp/browser.

Full validation follows after the required restart. Nothing published.

## Full validation result — STOP, no test or access/audit changes

- Required supervised dev-server restart completed before full units.
- Full units: **2,900/2,900**, 361 files, **EXIT 0** (149.78s).
- Exclusive background full browser suite: **216 passed / 1 failed**, 41.3m, polled continuously to literal **EXIT 1** before any closeout work. NEW B3b tests 3/3 and existing B3a tests 3/3 passed inside this run. No retries or concurrent validation.
- Failure is an existing **behaviour/audit assertion**, outside the third-stop source-adapter delegation and outside the named flake exceptions; stopped without changing it, audit logic, permissions or production code.

### Exact file / line / current / proposed

- `e2e/staffSlowLoadLanding8c2.spec.ts:31`
- Current: `expect(denied.length).toBe(1);`
- Observed: `denied.length === 0` after the throttled denied deep link already reached `/worklist`; snapshot shows Cathy / clinical coordinator.
- Proposed diagnostic only (NOT applied; requires delegation): wait for the expected existing audit using `await expect.poll(async () => page.evaluate(() => (window as W).__adelante.AdelanteEHR.listAuditEvents({}).filter((a: W) => a.action === "nav_access_denied").length)).toBe(1);` before the existing audit read/assertions. This preserves the exact audit count/actor assertions, but changes synchronization in an older behaviour test, so it is not covered by the source-only pre-approval. Do not treat the missing audit as an accepted flake or loosen the value to zero.
- Alternative: approval for a diagnostic standalone rerun/rollback comparison before proposing a correction. No rerun performed after the required full-suite last validation step.
- The changed B3b files do not modify navGuard, roles, shared clinical stores or the coordinator route; parity verifies those sources byte-identical. That alone does not establish the failure's cause.

Screenshot restoration against b1d3c414 is recorded in docs/b3b-evidence/screenshot-restoration.json; all rollback e2e screenshots compare byte-identical. Full failure summary retained in docs/b3b-evidence/full-browser-summary.txt.

B3b is implemented but **not validated complete**. Remaining blocker: resolve the existing slow-load audit assertion under explicit approval, then repeat required final validation. Nothing published.

## Validation stop — full browser suite (Oct 21)

- Full units: 2,907 passed / 1 skipped (360 files) — green.
- Full browser suite --workers=1 on :8080 (background, alone, polled to literal EXIT): 214 passed, 1 failed, EXIT 1.
- Failure: `e2e/staffSlowLoadLanding8c2.spec.ts:31` — expected exactly one `nav_access_denied` audit under 6x CPU throttle; observed 0. Redirect to /worklist itself succeeded.
- Stop-rule check: `git diff b1d3c414..HEAD` over RouteAccessGuard.tsx, navGuard.ts, roles.ts, StaffShell.tsx, worklist.tsx is EMPTY — no B3b change touches the guard, audit, or landing path. New spec `e2e/billingPrivacyB3b.spec.ts` passed 3/3 in the same run.
- Assessment: timing-sensitive audit-read race under CPU throttling (the audit effect and the test's `listAuditEvents` read), not a B3b regression. Prior full suites on this test were green (214/214 in B3a).
- STOPPED here per the stop rule; no screenshots restored, no final SHA claimed. Awaiting Mitch's decision (rerun vs. investigate).

## Slow-load diagnosis (Oct 21, Mitch-directed; no code or test edits)

### Standalone runs on current code (E2E_BASE_URL=http://localhost:8080, --workers=1)

| Run | Result | Test duration | Wall time |
|-----|--------|---------------|-----------|
| 1 | PASS | 39.3s | 2.4m |
| 2 | PASS | 32.6s | 52.9s |
| 3 | PASS | 33.0s | 53.5s |

### Standalone runs on rollback b1d3c414 (git archive copy at /tmp/b3b-rollback, node_modules symlinked, own dev server on :8090, no stash)

| Run | Result | Test duration | Wall time |
|-----|--------|---------------|-----------|
| 1 | PASS | 33.8s | 1.6m |
| 2 | PASS | 56.6s | 1.3m |
| 3 | PASS | 32.1s | 57.4s |

### Import-chain finding for the /case-manager → /worklist path

No B3b-changed module is imported on that path. `src/routes/case-manager.tsx:1,229` and `src/routes/worklist.tsx:3,223` mount `PageNewLauncher`, which imports `DashboardActionLauncher` (src/components/staff/PageNewLauncher.tsx:7) — not OpsActionLauncher or OpsWorkspace. The B3b-touched modules (billingProjection, billingWorkspace, OpsWorkspace, OpsActionLauncher, ClaimSignatureLine, RatesPanel, PatientBalance, routes billing/admin-claims/admin) are reachable only from the billing, admin-claims and admin surfaces; StaffShell and StaffNavSidebar import none of them. The earlier byte-identity diff over the guard/audit/landing files already showed no behavioural change; this confirms there is also no bundle-weight change on the failing path.

### Assessment

The test passes 3/3 standalone on current code AND 3/3 on the rollback, and no B3b code path is involved. The single full-suite failure (0 audits instead of 1) did not reproduce in six standalone runs. Per Mitch's instruction this is reported and STOPPED here: the test is an audit assertion, is not on the flake list, and no rerun of the full suite or test change has been made. Awaiting Mitch's decision.
