# B2-2 — consent capture, e-sign, paper upload, view/history

Rollback: 7d97392583e77bcf8e47c7200bbad6aeef6feb66 (B2-1 final). Not published. Additive only: no existing gate reads typed records yet (B2-4).

## Flows (screens and roles)
| Flow | Screen | Who |
|---|---|---|
| Record a consent (in-person e-sign: typed name + attestation; or verbal assent where allowed, with the exact words and who heard it) | Chart → Consents → "Consent records" | roles with `consent_ledger` write (same gate as `consent_form_revoke`): ecm_provider, sud_counselor, sys_admin |
| Upload paper copy (wet signature scan, optional witness) — **Simulated** | same | same as above |
| Send for e-sign | same | `roleHasChartEntry` (same gate as `consent_form_send`) |
| Patient e-sign (EN/ES, tú; Spanish covered by the member shell's single review notice) | Patient Home + Profile, beside Forms to sign | the patient, own requests only |
| History (versions, status, template + hash, witness, words read, superseded link, linked disclosures) | Chart → Consents (typed-record timeline + detail sheet) | anyone who already sees chart Consents |
| My forms (own typed records, plain status) | Patient Profile | the patient, own records only |
| Advocate own release status ("On file" / "Ended") | Advocate → My documents | the advocate, only records whose recipient directory ref is their own link |

Part 2 types require all eight elements + e-sign or wet-sign upload; verbal assent is refused for every type except referrer "enrolled" update and SMS/portal reminders. Labelled "Draft — pending counsel".

## New permission keys (snapshot: 68 lines added = 4 keys × 17 roles, 0 changed/removed)
| Key | Gate | Allowed for |
|---|---|---|
| consent_record_capture | consent_ledger write (= consent_form_revoke) | ecm_provider, sud_counselor, sys_admin |
| consent_record_upload | consent_ledger write; flag `consent_upload_simulated` (simulated: true) | ecm_provider, sud_counselor, sys_admin |
| consent_record_request_esign | roleHasChartEntry (= consent_form_send) | same roles as consent_form_send |
| consent_record_patient_sign | patient self only | hidden for every staff role |

Each runs through `runAction` and writes exactly one `action.succeeded` (upload: outcome "simulated", `simulated: true`). The ledger's existing store-level `consent_record_created` event stays.

## Changed files
- NEW `src/lib/consentCapture.ts`, `src/components/consent/ConsentCapturePanel.tsx`, `src/components/consent/PatientConsentESign.tsx`, `src/components/advocate/AdvocateOwnReleaseStatus.tsx`.
- `src/lib/chartActions.ts`: four registry entries + import. `src/lib/features.ts`: `consent_upload_simulated` flag.
- `src/lib/consentRecordModel.ts`: optional `signature.assentWording`.
- `src/lib/consentForms.ts:381`: legacy migration skips only when an UNTYPED record exists (typed records must never suppress it; identical for all existing data — proven by the pinned parity snapshot staying byte-identical before/after captures).
- Mounts: ChartExtraSections (staff panel), PatientHome + ProfilePanels (e-sign, My forms), advocate.my-documents (own release). Each renders nothing when there are no typed records/requests, so existing screens are unchanged.

## Test changes (pre-approved kind)
| Test | Old | New |
|---|---|---|
| consentInventoryB2.test.ts:48 (new line) | — | `"src/lib/consentCapture.ts": 2,` (new entry point file) |
| runAction.test.ts.snap | 4 keys absent | 4 `consent_record_*` keys added per role, nothing else changed |
| docs/b2-consent-inventory.md | — | "B2-2 additions" table |

No adapter substitutions were needed (ehr.ts untouched in B2-2).

## New tests
- `src/lib/__tests__/consentCaptureB2.test.ts` 7/7 (3× green): one audit per action, gates byte-identical, verbal-assent limits, Part 2 validation, Simulated upload + witness, patient-only e-sign, advocate own-status, key gating parity.
- `e2e/consentCaptureB2.spec.ts` 2/2: staff capture / Part 2 refusal / upload / history / send (axe), patient ES e-sign at 390px (axe, My forms).

## Validation
- Dev server restarted; full units 2,917/2,917, 364 files, EXIT 0.
- Full browser suite, `--workers=1`, E2E_BASE_URL=http://localhost:8080, background, alone: **219 passed (34.1m), EXIT 0** (log `/tmp/b22-browser.log`).
- Screenshots: 17 of 21 restored; all now byte-identical to 7d973925.
