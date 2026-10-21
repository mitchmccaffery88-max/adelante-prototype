# B3b — Billing privacy narrowing

## Rollback and scope

- Rollback recorded before B3b edits: `b1d3c414de160babe95c541483a610853cb3e076` (current HEAD; B3a accepted final `2409b85c`).
- Narrowing only for billing / billing_coordinator claim surfaces. Shared clinical stores, other roles, permissions, rates, states, necessity validation, payment reconciliation, county / ISL exports and denied styling remain unchanged. Do not publish.
- B3a added saveAsamDraft / signAsam / cosignAsam store references to the existing asam registry entry (`chartActions.ts:419–422`). The asam action's `allowed` block (`:423–427`) is **byte-identical** to `2f56b883`: SHA-256 `2d1004bf8f1860b922eeacec92befa98db98b93a90cd4c0025ad2c3d510cf02b`.
- The committed permission snapshot `src/lib/__tests__/__snapshots__/runAction.test.ts.snap` is **byte-identical** to `2f56b883`: SHA-256 `47332ee1b11b32e437fdbacfcb3946ccdd6e4d0bdd99e988722c9d165eb1c08c`. Its generator `src/lib/actions/permissionMatrix.ts` and role definitions `src/lib/roles.ts` also compare byte-identical. No registry or permission edits in B3b.

## Required before/after inventory

**STOP before production edits:** an existing source-parity assertion pins the wide `/billing` reads. All “after” fields below are proposed, not implemented.

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