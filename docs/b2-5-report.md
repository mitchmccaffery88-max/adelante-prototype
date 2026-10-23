# B2-5 — build STOP (Oct 23)

Rollback recorded before edits: **99a8b776587a9096492d3ee07293eccee1806580** (accepted B2-4 + plan-only checkpoint). B2-4 remains closed green at 4a3811ff, 224/224 EXIT 0. No publishing. Sections 1–6 retain the historical pre-build stop; the authorized resume and new stop are in §7. Partial source is applied, not validated or complete.

## 1. Required pre-edit roster probes — MATCH

| Probe | Patients | Flag-only Part 2 grants | Untyped records | Provenance |
|---|---:|---:|---:|---|
| Store import only | 15 | 7 | 1 | Daniel p1 cr-seed-1, active, no signature extension/document |
| Staff UI after demo initialization | 20 | 7 | 5 across 4 patients | Daniel active consent-tab + superseded cr-seed-1; Victor active intake (legacy); Jordan active consent-tab; Tomás active Front desk (demo), merge-held; no signature extensions/documents or signed copies |

Seven flag-only patients exactly match the plan: Marcus L., Alicia Serrano, Alicia R., Marcus Whitfield, Lucía Moreno, Luis Camacho and Jasmine Holt. Generated IDs differ normally; patient identities, sources, statuses, counts and provenance match. Both probes preceded project edits; scratch files/results are under `/tmp/browser/b25/`. First UI scratch probe timed out during cold dependency optimization; the read-only scratch probe was rerun after inspection of dev-server output and matched. No committed test timeout was changed. No migration or mutation was invoked by the probes.

## 2. Authorized before/after intentions (not implemented)

| Population | Intended migration-only access | Signed recapture permitted | Other boundaries |
|---|---|---|---|
| Luis / Jasmine / Marcus L. | flag-only denies | treatment-only part2_tpo_single, Adelante program, treatment, e_sign, complete checklist, actual date/current template/hash via consent_record_capture | no coordination/counseling/external/legal/advocate piggyback |
| Alicia Serrano / Alicia R. / Marcus Whitfield / Lucía Moreno | narrows | none | in-facility remains off |
| Daniel | unproven records non-granting | new records only for independently used demo scopes | no inherited-section verification |
| Jordan | unproven record non-granting | only the named higher-care referral's actual disclosure scope | no broader recipient/purpose/items |
| Victor | legacyUnverified, non-granting | none | explicit narrowing |
| Tomás | legacyUnverified, non-granting | none | merge hold retained |

Coordinator cohort remains empty / totals suppressed below 11; no counseling release. Every existing unauthorized role remains denied. Emergency functions/module/tests remain untouched. A complete implemented patient×role×surface delta table cannot be claimed before resolving the constraints below.

## 3. STOP A — narrowing-only delta authority does not cover retained record/reference changes

Decision 4 allows a NEW exact patient×role×surface list with only explained **true→false** deltas; Decision 5 separately allows exact itemized seed-event count changes. Existing parity snapshots also compare non-access provenance, identity relationships and disclosure output/log structure:

| File:line / retained field | Current baseline | Required consequence / why not an authorized boolean delta |
|---|---|---|
| `src/test/consentAuditB2Scenario.ts:38–44`; `consentAuditB2Parity.test.ts:45` | `gatesBefore[p3].active = null`; p1 active is a pre-B2 record ID | new signed typed grant must reference a new record; retiring/hiding old records changes active relationships. `null→record ID` / `old→new` is not true→false. Keeping a non-granting active-history accessor is possible, but it does not solve retained disclosure provenance below. |
| `src/test/consentEnforcementB2Scenario.ts:43`; matrix fixture p3 county decision | successful p3 county reference is literal **“Consent on file (legacy flag)”** | successful county use after the required Marcus treatment recapture must not falsely cite a legacy flag. A truthful typed-record reference changes a string with unchanged `ok=true`; the by-key canonicalizer cannot convert that legacy label to a record reference. |
| same matrix field / p1 external and advocate decisions | broad untyped legal-category grants carry **“Consent record … (Part 2 disclosure)”** | removing unsupported broad sharing yields reason strings/denied decisions. The access false is explainable, but exact retained shape/string/list consequences need explicit rules, not stripping or replacing baseline data. |
| `src/test/consentAuditB2Scenario.ts:80–86,100–103` | successful disclosure has notice + full entry; `log` and `disclosureAudits` contain that entry | narrowed denial returns reason and no entry; final log/audit row membership and downstream disclosure ID associations change. These are derived consequences, but not literal boolean replacements. Need exact, independently specified expected transforms; no broad strip or current-generated baseline. |
| `src/lib/__tests__/fixtures/consentAuditB2-rollback-5c335b7e.json:298–318` | p1 county `entry.consentRef = "Consent record wlu108pw"` | new capture must use truthful provenance; the old grant cannot stand in as the signer of a newly signed record. |

Audit-count additions alone do not authorize these other retained changes. No baselines were regenerated, no fields stripped, no comparison relaxed. **STOP before applying source/test changes.** Needed decision: may the expected-delta adapter additionally apply exact, enumerated record-reference and denial-derived disclosure/log/audit membership transformations, preserving full comparisons and immutable archived fixtures? Widening remains forbidden.

## 4. STOP B — current legal capture has no mapped published form/version

- Daniel's independent partner-sharing need is confirmed at `src/lib/carePartners.ts:277–286`: recipient **Porterville Community Resource Center (fictional)**, purpose **Reentry coordination**. This is not permission for all external providers or advocates.
- Jordan's referral is confirmed at `src/lib/outpatientCare.ts:395–406`: recipient **Tulare Recovery House (residential, demo)**. The legacy capture stores purpose **Referral to residential treatment** (:405), while actual outbound `disclose()` uses **Referral for treatment** (:249) and **SUD referral information** (:251). These purposes must be reconciled explicitly, not silently broadened.
- Required recapture is through `consent_record_capture` and current form version/hash. However `TEMPLATE_FOR` (`src/lib/consentCapture.ts:28–38`) has **no legal_part2_disclosure mapping**. `documentFor` (:87–102) falls back to **capture:legal_part2_disclosure / capture-v1**, hashes terms with no published form body, and cannot supply a real current legal-form version. Using the internal-team Part 2 form as an external legal release is not the same signed scope.
- No old row was marked verified. The new build decision permits NEW signatures, not inventing an existing legal template or treating the fallback as an existing form version. Needed decision: approve a narrowly scoped Draft legal/specific-release template through the existing form publishing workflow (or expressly approve the terms-only capture document), and specify Jordan's exact outbound purpose to sign.

## 5. Test-edit ledger / seed-event list / delta list

- **Existing test edits: none.** No assertions, timeouts, retries, emergency tests, source-pinned adapters or fixtures changed.
- **New seed events: zero applied.** Intended capture events cannot be itemized as observed events until scope/template/parity stops are resolved; no exact-count expectation changed.
- **Delta list: no applied delta.** The intended access narrowing is recorded in §2; no widening or unlisted difference has been accepted. Metadata/derived-list transforms require the explicit authority in §3 before tests can be changed faithfully.
- NEW migration unit/browser tests not created: implementation did not begin past pre-build constraints. Their required coverage remains flag/untyped denial, legacyUnverified, idempotence, provenance refusal, exactly recaptured scopes, neutral lock, demo readback and axe.

## 6. Validation and status

No full-unit or B2-5 browser run was launched because the pre-build STOP was reached; no `/tmp/b25-browser.log` process is running and no EXIT result is claimed. B2-4's accepted 224/224 remains historical evidence only. No migration code, app source, emergency source/module or tests changed, so no screenshots were generated/restored in this stopped batch. Changes are only authorization memory, roadmap and this report. Final documentation checkpoint is reported in chat. Resume requires the two decisions above; do not publish.

## 7. Authorized resume — new unlisted-difference STOP

### Fresh pre-edit probes

Recreated read-only scratch probes under `/tmp/browser/b25` because earlier temporary artifacts were absent. Both ran before application edits and passed: store **15 patients / 7 flag-only / 1 untyped**; staff UI **20 / 7 / 5 untyped across four patients**, no signature extensions/documents/signed copies; Tomás's merge hold remains. Names and sources match §1 exactly. Store `EXIT 0`, UI `EXIT 0`.

### Partial source, not a completed migration

- `consentMigration.ts` queues only authorized captures until the existing registry runner is ready; legacy-history marking has a sys_admin registry entry. Treatment requests are Marcus L., Luis Camacho and Jasmine Holt only, program recipient, treatment purpose, no counseling/coordination/external grants.
- ONE `part2_named_org` form definition with Draft counsel/Spanish-review labels; workflow uses the existing author/review/approve/publish actions. Legal mapping added in `consentCapture.ts`. This is prototype FNV text hashing, not production cryptographic storage.
- Daniel request: Porterville Community Resource Center (fictional), Reentry coordination, outreach slice `Social needs (SDOH)`, `Appointments`, `Minimal clinical summary` (`carePartners.ts` original :35,:274–286). Jordan request: named residential provider, Referral for treatment, SUD referral information (original `outpatientCare.ts:249–251,395–406`). Victor/Tomás no capture requests.
- Legacy fallback in `consentGate` no longer grants. Bare untyped creations carry legacyUnverified; legacy history keeps existing statuses and merge holds.
- Source remains incomplete: named legal disclosure lookup/readback and signed-form compatibility have not been completed; the narrow captures and seed audit inventory are not claimed fully verified. No expected-delta file or adapter has been applied.

### STOP: billing is outside the permitted transform list

Two focused unchanged parity tests ran: **0/2, EXIT 1**. Current-only diagnostic snapshots were then written to `/tmp/browser/b25/current-matrix.json` and `current-audit.json`, never to immutable fixtures. Both diagnostic writers completed `EXIT 0` (this is snapshot collection, not passing parity).

| Snapshot field | Immutable baseline | Current | Classification |
|---|---|---|---|
| Enforcement `billing` | `[paid, receipt_balance, denied, writeoff_reversed, blocked, sliding_fee, dmc_ods]` | `error: Not available for your role.` | Unlisted workflow change — STOP |
| Audit `billing` | same seven keys | same error | Unlisted workflow change — STOP |

`billingLifecycleScenario.ts:48–49` grants only a bare Part 2 flag through `consent_purpose_set`; :51–52 then requests the clinical trainee's ASAM draft through the real registry. The removed fallback now correctly refuses that flag-only access. Changing the seven-key success result to an error is not access true→false, denial-derived **disclosure** membership, same-access provenance replacement, or itemized new seed audits. An adapter cannot hide it.

Proposed, **not applied**: retain the existing independently documented DMC QA flow, assert its flag alone denies, then replace its positive consent fixture with a current signed scope-minimal program-treatment capture through `consent_record_capture`, with a full checklist and current form version/hash. This needs explicit authority for this application-side QA scenario: the delegated rule covers existing **test** fixture edits, and the approved default recapture list names only five people. No additional QA patient was granted access merely to obtain a passing test. Its added capture events and any cohort effect would also need exact itemization and parity review.

Matrix roster counts remain 15 seed / 22 after billing; captured and emergency arrays remain 22 each. Coordinator cohort remains empty at all three checkpoints. These facts do not make full parity green.

### Edit ledger, audits and validation

- Existing test edits: **none**. Baselines, assertions, retries, timeouts, pinned adapters and emergency tests unchanged.
- Expected transforms: **none applied**; billing difference is explicitly refused, not listed as an allowed transform.
- Seed events: audit snapshot consent count changes **11→15** in the partial state; not yet independently itemized, so no count expectation was edited. Final form/capture/migration event ledger is pending; do not treat this delta as approved.
- Emergency module SHA-256 current and rollback match: `24e9fc9d83ceb9e071635080adb6c655f98b41ca66c2ad258beae7ad9922f24c`. `coordinatorSudAccess.ts` has no edits; emergency functions/map/constant remain untouched. Full behavior parity is not claimed because the full snapshots fail.
- Latest automatic preview signal: **build OK** at 12:41:04 UTC. No manual build/typecheck.
- NEW unit/e2e migration tests, full unit run, restart/full browser run to `/tmp/b25-browser.log`, screenshot restoration and final successful closeout remain **not done**. No full-browser process was launched; no literal full-suite EXIT is claimed. Scratch probes generated no screenshots; immutable screenshot files were not changed.
- STOP holds pending the application-side DMC QA-fixture authority above. No publishing.
## 8. Billing QA capture applied; NEW STOP — unmapped post-B2 consent writers (Oct 23)

### Done under the latest authorization
- `billingLifecycleScenario.ts` DMC-ODS fictional patient: flag write replaced by ONE `runAction("consent_record_capture")` (ecm_provider), `part2_tpo_single`, recipient Adelante program, purpose treatment, e_sign, full checklist, patient signer, real date, current form version/hash, before ASAM/claim steps. All seven billing keys, amounts, states, payments and per-transition audit counts equal the immutable baselines; the patient is not in the coordinator cohort.
- Parity: matrix and audit parity both GREEN against the untouched 0089ca4f / 5c335b7e fixtures with transforms i–iv. The only extra handling in `consentAuditB2Parity.test.ts` (`canon`) maps sequential disclosure-log IDs `dl-<n>`, under the `id` / `disclosureLogId` keys only, to placeholders by first appearance. This is a dependent disclosure-ID consequence of the listed (ii) denials, which no longer use a number. Every other value stays literal. **Mitch to confirm** this counts as (ii).
- `part2Disclosure.ts`: a named legal disclosure (legacy legal row) now also needs the signed typed `legal_part2_disclosure` record with the same recipient and purpose. The legacy category alone grants nothing. This keeps Jordan's Tulare send and Daniel's Porterville link working with no widening (parity green).
- Import-order fix: the migration seed now runs only once the action registry (`chartActions.ts`, end of module) and the runner (`runAction.ts`) are both ready. Before, 19 suites failed with "Unknown action".
- NEW tests passing: `consentMigrationB2.test.ts` (8) and `billingLifecycleB25.test.ts` (2: flag alone grants nothing, ASAM draft refused; one signed treatment-only record; not in the cohort).

### STOP: real (non-seed) consent writers are unmapped
`ehr.ts` `createConsentRecord` currently marks every untyped record without a signature extension as `legacyUnverified`, and `isConsentCategoryAuthorized` needs `signature` + `document`. That also narrows records written TODAY by real workflows, not only pre-B2 history:
- `consentForms.ts:309` signOne. The patient's own signed form has a frozen signed copy with versionId/textHash, but the record carries no extension, and it carries prior sections forward (:306–316).
- `scribe.ts:243,266` (AI recording grant/withdraw), `ConsentRecordsPanel.tsx:86` (staff entry), `consentForms.ts:423` (revocation), `outpatientCare.ts:299,311`, `DemoStateSwitcher.tsx:245`.
Plan §c: "stop on any unmapped writer". Measured: full units 116 failed / 2,844 passed. A probe that turns off only this writer rule leaves 57 failures, so about 59 come from the writer rule alone (advocate ROI, scribe, form signing, telehealth). The other 57 are the flag/untyped fixtures and pinned `ehr.ts` byte-parity adapters that the plan table expects.

Decision needed (proposal, not applied):
1. Form signing (`signOne`) attaches its real provenance (signature e_sign/typed, document formKey/versionId/version/textHash from the signed copy), and grants ONLY the categories of that form version. Carried-forward sections from an unverified prior stay non-granting.
2. Scribe, staff panel, revocation and outpatient legal writers: each is either mapped to a typed record through `consent_record_capture`, or stays non-granting (needs an explicit decision per writer).
3. Then the remaining ~57 test edits under the keep/tighten rule, and the pinned-parity adapters as additive exact-once substitutions.

Not run: full browser suite, screenshot restore, final SHA. Emergency module untouched; no counseling release; <11 unchanged; no publish.

## 9. Writer scope applied; NEW STOP — typed mapping conflicts (Oct 23)

### Applied under decisions 0–2
- Decision 0: `dl-<n>` by-key placeholders under `id` / `disclosureLogId` only — kept as already implemented in `consentAuditB2Parity.test.ts`.
- Decision 1: `ehr.ts` `createConsentRecord` no longer auto-marks new writes `legacyUnverified`. Only `markLegacyConsentsUnverified` (records present when the migration runs) and flag-derived rows (`ehr.ts` ~:13011, `consentForms.ts` `migrateLegacyConsents`) are marked.
- `isConsentCategoryAuthorized`: with no applicable typed record, only a live non-legacy record answers; flags never do. `activeConsentRecord` skips legacyUnverified records, so sections can never be carried forward from an unverified record.
- Form signing (`consentForms.ts` signOne): record now carries the signed copy's real signature (e_sign, signer, signedAt) and document (formKey, versionId, version, textHash). Same categories, same single audit.
- Full units after this: 32 failed / 2,928 passed (was 116). Remaining failures are the flag/untyped fixtures and pinned `ehr.ts` byte-parity adapters the plan expected; no test edited yet.

### STOP: four writers cannot become typed records with the SAME scope and audit
Untyped section records and typed records are two separate models: `activeConsentRecord` (category gate) only reads untyped records, and typed records supersede only per type + recipient. So:
- Scribe grant/withdraw (`scribe.ts:243,266`), staff entry (`ConsentRecordsPanel.tsx:86`), outpatient legal rows (`outpatientCare.ts:299,311`) and DemoStateSwitcher (`:245`):
  - making the existing record typed removes its sections (incl. carried-forward categories) from the category gate — narrows scope;
  - adding a second typed record alongside adds one more `consent_record_created` audit per action — changes the audit count.
- These writers currently keep granting exactly today's scope (untyped, not legacyUnverified) — not silently non-granting, but not typed either.
- Exception to flag: outpatient `recordLegalDisclosureConsent` with recipient/purpose — `part2Disclosure.ts` named legal sends need the typed named-org record, so for patients other than Jordan/Daniel that walkthrough is now blocked until mapped.

Decision needed: (a) allow one extra itemized capture audit per live action (second typed record), or (b) keep these writers untyped with signature provenance attached, or (c) other.
Not run: test edits, browser suite, screenshots, final SHA. Emergency module untouched; no counseling release; <11 unchanged; no publish.
