# B2-1 — consent record model extension (DONE)

Rollback: a2601c9f4b77e807e6b05d91a49fca6c676cea2a (HEAD before B2-1). Not published.

## Implemented (additive)
- NEW `src/lib/consentRecordModel.ts`: ConsentType, recipients, purpose/purposeCode, items, expiry by date/event, signature {method e_sign | wet_sign_upload | verbal_assent, signer, relationship, signedAt, recordedAt, recordedBy, witness?}, document {formKey, versionId, version, documentHash, uploadRef?}, part2Elements + redisclosureNoticeVersion, revocation {by, at, method, reason, onBehalfOfPatient}, disclosureIds[], legacyUnverified. All optional. Validation: Part 2 types need all eight elements + e_sign/wet_sign_upload; verbal assent only for referrer_authorization (purposeCode `enrolled_update`) and sms/portal reminders. Checklist labelled "Draft — pending counsel".
- `src/lib/ehr.ts`: `ConsentRecord extends ConsentRecordExtension`; `activeConsentRecord` and the `isConsentCategoryAuthorized` legacy-fallback check consider untyped records only (identical for existing data — none are typed); NEW `consentCovers` (live; not wired into any gate); `createConsentRecord` accepts optional `extension`, validates it, and supersedes only within the same type + recipient key.
- Inventory pin (`consentInventoryB2.test.ts`): line 11 regex `…|signChecked/` → `…|signChecked|consentCovers/`; line 49 `"src/lib/ehr.ts": 41` → `42`.
- NEW `consentRecordModelB2.test.ts` 6/6 (3× green); parity fixture from a2601c9f archive, pinned clock.

## First stop (resolved by approval)
Five failures from four session-written whole-file pins of `src/lib/ehr.ts`. Approved fix: NEW exact-once adapter `src/test/consentB2Approved.ts` (`withApprovedConsentB2`) applying the nine B2-1 substitutions (ten hunks; throws if any anchor is not found exactly once), composed only at the ehr.ts comparison in:

| Test | Old line | New line |
|---|---|---|
| roleDashboardParity9c2.test.ts:33 | rollback ehr.ts text compared directly | rollback text passed through `withApprovedConsentB2(path, …)` |
| billingParity9a3.test.tsx:14 | same | same |
| statTileParity9a2.test.tsx:29 | same | same |
| billingProjectionB3b.test.ts:94 | same | same |

Every other byte stays pinned.

## Validation
- Dev server restarted; full units 2,909/2,909, 363 files, EXIT 0.
- Full browser suite, `--workers=1`, E2E_BASE_URL=http://localhost:8080, background, alone: **217 passed (37.4m), EXIT 0** (log `/tmp/b21-browser.log`; an earlier run's log was lost to a sandbox reset, so it was relaunched once with the EXIT marker).
- Screenshots: 17 restored byte-identical to a2601c9f.
