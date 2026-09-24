# Phase 8c — Clearinghouse-ready eligibility infrastructure

Scaffolding only. No real clearinghouse connection, no live 270/271 parsing, no vendor choice.

## 1. Verification record (`CoverageVerificationRecord`, src/lib/ehr.ts)
- New channel `electronic_270_271`, labelled "Electronic eligibility (270/271)". The staff check form never offers it, and `recordCoverageCheck` refuses it, the same way it already refuses `reported`.
- New optional `electronic` block, filled only on electronic records:
  - `transactionId` (the 270 trace number) and `vendor`
  - `rawResponseRef`: a pointer to where the raw response is stored (e.g. `vault://…`), never the payload itself
  - `responseStatus`: `active | inactive | not_found | error`, plus `errorReason` when it's an error
  - `benefits`: `aidCode`, `shareOfCostCents`, `managedCarePlan { payerName, planId? }`, `coverageStart`, `coverageEnd`, `payerId`
- The existing `result` is still filled in for older screens: active → `verified`, not_found → `not_found`, inactive or error → `pending`.
- Does an electronic response count as a staff check? Yes for the worklist's "checked" status, but it is labelled "Electronic" everywhere. Please confirm, or tell me it should need a staff sign-off.

## 2. Plan spans (`CoveragePlanSpan`)
- Add `aidCode`, `shareOfCostCents` and source `electronic_270_271`.
- An active response adds a span, or updates the open span with the same payer. It never deletes or backdates an older span. A change of payer closes the old span the day before the new start date. A reported span is kept as is, with the electronic span added next to it.
- The managed care plan is matched by name (ignoring case and extra spaces) to the 8b plan list, and the list's id is stored when it matches. If there's no match, only the name is stored, flagged "not on plan list". The plan list itself is never changed automatically.

## 3. Stubbed interface: src/lib/eligibility/
- `eligibility.ts`: `checkEligibility(patientId)` returns `{ status: "not_connected", detail }`. It writes one `eligibility_check_attempted` audit entry recording who asked and the outcome. It does not write a verification record, because nothing was checked. Same honest pattern as SMS "not configured".
- `adapter.ts`: an `EligibilityAdapter` interface with `send270(request) → NormalizedEligibilityResponse`. `applyEligibilityResponse(patientId, response, actor)` is the one write path: it records who and what system ran it, writes an audit entry, and only ever appends.
- Where a real vendor plugs in later: a server-only `*.server.ts` adapter chosen by an environment setting, called from a `createServerFn` in `eligibility.functions.ts`, with credentials kept as secrets. Only the normalized result is passed to `applyEligibilityResponse`. The raw response would be stored server-side, and only its pointer saved on the record.
- The chart's Eligibility section gets a "Check electronically" button. It shows "Electronic eligibility isn't connected yet — record a manual check instead", with a link to the existing check dialog. It never pretends a check happened.

## 4. Test-only mock adapter
- `src/lib/eligibility/__mocks__/mockAdapter.ts`, headed "MOCK — tests only". Nothing in the app imports it, and a test checks that no route or component file does.
- Sample responses: active with an HMO plan and share of cost; not found; error. Each is mapped end to end into the record, the span, the audit entry and the worklist state.

## 5. Show the source everywhere a verification appears
One shared `verificationSourceLabel(record)` and a badge, with three kinds:
- "Reported by patient / by staff for patient / by referrer / by partner — not verified"
- "Staff check · phone / portal / fax / in person"
- "Electronic 270/271 · status"

Used on the chart's check history, the eligibility worklist, the case manager summary card and the check dialog's history.

## 6. Same rules as everything else
Every write is attributed (the actor plus the system/vendor name) and audited. It goes through the coverage merge, so earlier records are never erased. An electronic "not found" or "inactive" never clears a CIN or closes a span on its own; it creates a Phase 3a follow-up task for staff.

## Tests
- Stub returns not_connected and writes no record.
- Mock active response fills every new field and adds or updates a span with aid code and share of cost.
- Plan matching: matched id vs name-only.
- not_found / error: no data loss, follow-up task created.
- The electronic channel is refused from the manual check form.
- Source labels for all three kinds.
- The mock adapter isn't imported anywhere in the app.

## Not in scope
No real vendor, no X12 parsing, no automatic monthly re-checks, no storing raw responses.
