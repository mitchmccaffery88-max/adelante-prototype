# B2-6 — consent audit events + disclosure links

Approved by Mitch, Oct 22. Rollback `5c335b7e65e203ae6d98dc91194b9fa92ccfc1fe` (B2-3 final); HEAD matched before any edit. Additive only. Enforcement stays OFF (B2-4). No access, permission or registry-key change; no new permission keys. Not published. B2-4/B2-5 not started. Draft — pending counsel.

## 1. Inventory (before editing, rollback line numbers)

### Consent writes and the audit entry each already writes
| Write | Store / file:line (rollback) | Existing audit entries |
|---|---|---|
| Staff capture (e-sign / verbal) | `consentCapture.ts:143` → `ehr.ts:12742` createConsentRecord | `action.succeeded` (registry `consent_record_capture`) + `consent_record_created` (`ehr.ts:12796`) = 2 |
| Paper upload (Simulated) | `consentCapture.ts:175` → createConsentRecord | `action.succeeded` (`consent_record_upload`) + `consent_record_created` = 2 |
| Patient e-sign | `consentCapture.ts:273` → createConsentRecord | `action.succeeded` (`consent_record_patient_sign`) + `consent_record_created` = 2 |
| Typed revoke (staff / patient) | `consentLifecycle.ts:40` → `ehr.ts:12842` revokeTypedConsentRecord (no domain audit) | `action.succeeded` (`consent_record_revoke` / `consent_record_patient_revoke`) = 1 |
| Renew | `consentLifecycle.ts:64` → captureConsentRecord | `action.succeeded` (`consent_record_renew`) + `consent_record_created` = 2 |
| Supersede | inside createConsentRecord `ehr.ts:12767-12776` | none of its own (rides on the create) |
| Untyped revoke | `ehr.ts:12813` revokeConsentRecord | `consent_record_revoked` (`ehr.ts:12828`) |
| Legacy forms: sign | `consentForms.ts:308` signOne → createConsentRecord (`consent_form_in_person` / portal) | `consent_record_created` + consentForms `audit()` (`:158`) |
| Legacy forms: revoke | `consentForms.ts:421` revokeForm → superseding createConsentRecord (`consent_form_revoke`) | `consent_record_created` + consentForms `audit()` |
| Legacy migration | `consentForms.ts:390` | `consent_record_created` |
| Other createConsentRecord callers (unchanged) | `ConsentRecordsPanel.tsx:86`, `DemoStateSwitcher.tsx:245`, `identityDemoSeed.ts:51`, `outpatientCare.ts:298,310`, `scribe.ts:243,266` | `consent_record_created` |
| Referrer authorization (separate store) | `referrerAuthorizationStore.ts:33,45` | `referrer_authorization_recorded/_revoked` (not ledger records; unchanged) |

### Disclosure-log writers
Only two functions write the disclosure log: `disclose()` (`part2Disclosure.ts:187`) and `logReferrerStatusDisclosure()` (`:276`). Callers of `disclose()`: `adelHistory.ts:191`, `carePartners.ts:234` (care-partner handoff), `coordinatorSudEmergency.ts:19`, `countyReporting.ts:127` (county share), `dataExchange.ts:194` (HIE), `dmcOdsReadiness.ts:305`, `ehr.ts:19515`, `outpatientCare.ts:245` (referral out), `:335` (legal disclosure), `printRecord.ts:159,275`, `notePdf.ts:332`. Caller of the referrer writer (P3): `referrerUpdateGate.ts:42`. `recordConsentDisclosure` (`ehr.ts:12863`) is an audit-only trail, not a log writer.

## 2. Consent events (§6 of the plan)
Neutral metadata on the EXISTING entry: `consentEvent`, `consentType` ("untyped" for legacy), `consentEventRecordId`, `consentEventActorRole`, `recipientKind` (person / org / none). Never names, wording, reasons or SUD content (`src/lib/consentEvents.ts`).

| Event | Entry it rides on |
|---|---|
| consent.captured | `consent_record_created` (staff capture; untyped default incl. migration) |
| consent.uploaded | `consent_record_created` (wet-sign upload) |
| consent.signed | `consent_record_created` (patient e-sign; legacy form sign, source `form:<key> v<n>`) |
| consent.renewed | `consent_record_created` of the renewal (passed explicitly) |
| consent.superseded | same create entry as `supersededConsentEvent` + `supersededRecordId` whenever a prior record was superseded |
| consent.revoked | typed: registry `action.succeeded` via the new optional `successAuditMeta` on the two revoke entries; untyped: `consent_record_revoked`; legacy form revoke: its superseding `consent_record_created` |
| consent.expired | ONLY new entry (`consent_record_expired`): first read via `consentRecordHistory` that finds a typed record expired; once per record; reads for a future date never emit; quiet write (no re-render) |

Per-action counts unchanged: capture/upload/sign/renew = 2, revoke = 1 (asserted in `consentAuditB2.test.ts`). Full unit suite showed no existing audit-count change from `consent.expired`.

## 3. Disclosure links
After a log entry is built (decision already made), `linkEntry` looks up the typed record via `AdelanteEHR.consentCoveringRecordId` — which is decided by `consentCovers` with the entry's type, recipient (name, then organization), purpose and time — stores `consentRecordId` on the entry (null = "No typed record (legacy)") and appends the entry id to the record's `disclosureIds`. Types tried per recipient: advocate → advocate_release; legal → legal_part2_disclosure, part2_specific_written; provider/hie/other → part2_specific_written, part2_tpo_single; internal/county → part2_tpo_single; referrer update → referrer_authorization; patient and coordinator emergency → none. The lookup never blocks, allows or alters a disclosure; the existing audit detail (including its untyped `consentRecordId`) is unchanged.

UI: record detail "Disclosures" lists each linked id with channel, date and recipient type; the consent audit view has a "Linked consent" column showing `staffPatientLabel` (program ID for viewers who cannot open the chart) and the link label. New filter option "Consent expired".

## 4. Parity (Date pinned 2026-10-22T12:00Z, seeded PRNG)
`src/test/consentAuditB2Scenario.ts` runs every seeded patient through nine disclosure kinds + a referrer update, captures covering typed records for three patients and reruns, builds the billing lifecycle QA scenario, and snapshots gate reads before/after, the full disclosure log, every disclosure audit's detail and the consent-audit count. Run on the rollback archive (git archive 5c335b7e, symlinked node_modules) and on current: byte-identical after stripping only `consentRecordId` (entry) and the consent.* keys. Fixture: `src/lib/__tests__/fixtures/consentAuditB2-rollback-5c335b7e.json`; the pinned test canonicalises random 8-char record tokens by first appearance (async module loads can shift the PRNG sequence). No other difference.

## 5. Approved test-adapter changes
- `src/test/consentB2Approved.ts`: five additive exact-once B2-6 substitutions for `ehr.ts` (import, `consentEvent` input, create detail spread, untyped revoke detail, `consentCoveringRecordId` + `linkConsentDisclosure`).
- `src/lib/__tests__/consentInventoryB2.test.ts:51`: `ehr.ts` entry-point count 42 → 44 (the new method's doc line and its `consentCovers` call).
No other existing test changed.

## 6. New tests
- `src/lib/__tests__/consentAuditB2.test.ts` (10) and `consentAuditB2Parity.test.ts` (1).
- `e2e/consentAuditB2.spec.ts` (1): registry capture → disclose → record detail lists the link; billing on /consent-audit sees the program ID, not the name; axe on both.

## 7. Validation
See the closing section below (filled after the full runs).
