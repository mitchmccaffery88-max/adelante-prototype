# B2-5 — pre-build STOP (Oct 23)

Rollback recorded before edits: **99a8b776587a9096492d3ee07293eccee1806580** (accepted B2-4 + plan-only checkpoint). B2-4 remains closed green at 4a3811ff, 224/224 EXIT 0. No publishing. No B2-5 app or test changes applied.

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