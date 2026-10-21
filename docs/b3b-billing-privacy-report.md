# B3b — Billing privacy narrowing

## Rollback and scope

- Rollback recorded before B3b edits: `b1d3c414de160babe95c541483a610853cb3e076` (current HEAD; B3a accepted final `2409b85c`).
- Narrowing only for billing / billing_coordinator claim surfaces. Shared clinical stores, other roles, permissions, rates, states, necessity validation, payment reconciliation, county / ISL exports and denied styling remain unchanged. Do not publish.
- B3a added saveAsamDraft / signAsam / cosignAsam store references to the existing asam registry entry (`chartActions.ts:419–422`). The asam action's `allowed` block (`:423–427`) is **byte-identical** to `2f56b883`: SHA-256 `2d1004bf8f1860b922eeacec92befa98db98b93a90cd4c0025ad2c3d510cf02b`.
- The committed permission snapshot `src/lib/__tests__/__snapshots__/runAction.test.ts.snap` is **byte-identical** to `2f56b883`: SHA-256 `47332ee1b11b32e437fdbacfcb3946ccdd6e4d0bdd99e988722c9d165eb1c08c`. Its generator `src/lib/actions/permissionMatrix.ts` and role definitions `src/lib/roles.ts` also compare byte-identical. No registry or permission edits in B3b.

## Required before/after inventory

**PARTIALLY IMPLEMENTED — SECOND STOP:** the approved `/billing` adapter and target projections are applied, but the mounted BillingWorkspaceTiles still receives whole records. The table remains proposed until that boundary and validation are complete.

| Surface / source | Before: received fields | Proposed after: received fields |
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
