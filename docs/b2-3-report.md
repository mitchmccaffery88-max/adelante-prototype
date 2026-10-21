# B2-3 — consent lifecycle: revoke, renew, expiry, missing/expiring view (Oct 21)

Rollback: `945a6ba8f92d8c496ad8287e7edaa9a3439a5850` (B2-2 final; HEAD confirmed before edits).
Additive only. **Enforcement stays OFF**: no gate reads typed records; that switch is B2-4 and needs Mitch. Draft — pending counsel.

## What was built

1. **Revoke** — `revokeTypedConsent` (src/lib/consentLifecycle.ts) → new store method `AdelanteEHR.revokeTypedConsentRecord` (src/lib/ehr.ts). Records who, when, method (written / e-sign / oral, mapped onto the model's portal / written / in_person enum) and an optional note. Nothing is deleted; the record stays in history as "revoked". The store writes **no** domain audit — the registry action is the single audit event (verified: exactly +1 audit event per revoke). Part 2 revocation wording is "Draft — pending counsel". Staff confirm through the existing ConfirmDialog.
2. **Renew** — `renewTypedConsent` builds the draft from the old record's own terms and reuses B2-2's `captureConsentRecord`, so the ledger's create supersedes only within the same type + recipient key and the same capture rules apply (Part 2 checklist, verbal assent only where B2-2 allows). History shows the link old → new (`supersedesId`). Audit: **2 events** — the registry action plus the ledger's standard `consent_record_created` domain event, identical to a B2-2 capture (Mitch accepted this Oct 21; revoke remains exactly 1 event because the typed store method writes no domain audit).
3. **Expiry** — status is computed on read (`effectiveConsentStatus` + `expiryEventOccurredAt`); no background job. The patient's "My forms" shows "Expired / Vencido" with a "Sign again / Firmar de nuevo" button that reuses B2-2's e-sign path (`requestSelfReSign` in consentCapture.ts builds a self-service request from the record's own terms; the patient signs through the same `patientSignConsent`).
4. **Missing or expiring view** — src/lib/consentLifecycle.ts (`consentGapFor` / `consentGapWorklist` / `consentGapCounts`) + src/components/consent/ConsentGapWorklist.tsx. Required list (part2_tpo_single, hipaa_authorization, telehealth) is labelled "Draft — pending clinical sign-off"; expiring = within 30 days. Per-patient panel in the chart Consents section; all-patient worklist on /consent for roles with chart entry only. Labels follow staffPatientLabel (program ID without chart access — proven in e2e with a restricted record). Aggregated counts suppress below 11 ("<11"). Read-only except links into the existing capture/e-sign actions.

## Permission keys (additive; same per-role pattern as the key each copies)

| Key | Gate | Copies |
|---|---|---|
| `consent_record_revoke` | `consent_ledger` write | `consent_form_revoke` |
| `consent_record_patient_revoke` | patient self, own records only | `consent_record_patient_sign` |
| `consent_record_renew` | `consent_ledger` write | `consent_record_capture` |

No role gains a capability it doesn't have on the copied key. Advocates have no revoke key (pinned in the unit test).
Snapshot change: `src/lib/__tests__/__snapshots__/runAction.test.ts.snap` **+51 lines, 0 removed** (3 keys × 17 roles); every added line names one of the three new keys.

## Test changes (pre-approved class only)

| File | Old | New |
|---|---|---|
| src/test/consentB2Approved.ts | 9 substitutions | +1: hunk 10 reverses only the new `revokeTypedConsentRecord` method in ehr.ts; exact-once anchors |
| src/lib/__tests__/consentInventoryB2.test.ts | `"src/lib/consentCapture.ts": 2` | `"src/lib/consentCapture.ts": 3` (requestSelfReSign reads `listConsentRecords`) and added `"src/lib/consentLifecycle.ts": 4` |
| docs/b2-consent-inventory.md | — | B2-3 additions table |

No behaviour, value, access or audit assertion in any existing test was touched.

## Parity proof (enforcement off)

`consentGateSnapshot` (NEW test hook in consentLifecycle.ts) captures everything an EXISTING gate reads — `isConsentCategoryAuthorized` × 4 categories, `activeConsentRecord` id, `getConsentState` — for every seeded patient under a pinned clock (2026-10-21T12:00:00Z), before and after exercising revoke + renew + an expired record. Byte-identical.

Mitch's decision (Oct 21): `consentCovers` is deliberately EXCLUDED from the snapshot. It is supposed to change on revoke/renew — parity applies only to the gate reads today's surfaces use. Verified: no production surface reads `consentCovers` — the only references are its definition (src/lib/ehr.ts:12723) and the rollback adapter comment (src/test/consentB2Approved.ts). It stays unwired until B2-4.

## New tests

- `src/lib/__tests__/consentLifecycleB2.test.ts` — 8/8: revoke effective + history kept + one audit; renew supersedes within key only; renew capture rules; expiry under pinned clock + gap states (missing / expired / expiring); patient own-only revoke + store-level refusal + advocate denied on all three keys; sign-again path; worklist chart-entry gate; the parity proof.
- `e2e/consentLifecycleB2.spec.ts` — 3/3: staff revoke (ConfirmDialog, method) + renew (old superseded / new active, linked) + gap panel; patient revoke in Spanish at 390px + sign-again card fits 390px; worklist shows program ID (not name) for a restricted record to a chart-entry role off the care team, counts show "<11"; axe on every surface.

## Validation

- Dev server restarted after edits.
- Full units: **2,925 / 2,925 passed (365 files), EXIT 0** (/tmp/b23-units.log).
- New spec standalone: 3/3.
- FULL browser suite --workers=1 on E2E_BASE_URL=http://localhost:8080, background, alone, EXIT marker appended: see closeout below.
- Screenshots restored against 945a6ba8: see closeout below.

## App fix found during validation

`requestSelfReSign` pushed to the module-local e-sign request list without notifying subscribers, so the patient's sign card didn't render until an unrelated store change. Added `AdelanteEHR._emit()` (the existing store notification hook) after the push. No behaviour or access change.
