# B2-1 — consent record model extension (STOPPED at validation)

Rollback: a2601c9f4b77e807e6b05d91a49fca6c676cea2a (HEAD before B2-1). Not published.

## Implemented (additive)
- NEW `src/lib/consentRecordModel.ts`: ConsentType, recipients, purpose/purposeCode, items, expiry by date/event, signature {method e_sign | wet_sign_upload | verbal_assent, signer, relationship, signedAt, recordedAt, recordedBy, witness?}, document {formKey, versionId, version, documentHash, uploadRef?}, part2Elements + redisclosureNoticeVersion, revocation {by, at, method, reason, onBehalfOfPatient}, disclosureIds[], legacyUnverified. All optional. Validation: Part 2 types need all eight elements + e_sign/wet_sign_upload; verbal assent only for referrer_authorization (purposeCode `enrolled_update`) and sms/portal reminders. Checklist labelled "Draft — pending counsel".
- `src/lib/ehr.ts`: `ConsentRecord extends ConsentRecordExtension`; `activeConsentRecord` and the `isConsentCategoryAuthorized` legacy-fallback check consider untyped records only (identical for existing data — none are typed); NEW `consentCovers` (live, denies expired/revoked/superseded/legacyUnverified/event-expired/disallowed verbal assent; not wired into any gate); `createConsentRecord` accepts optional `extension`, validates it, and supersedes only within the same type + recipient key (untyped path unchanged).
- Inventory pin (`consentInventoryB2.test.ts`, this session): line 11 regex `…|signChecked/` → `…|signChecked|consentCovers/`; line 49 `"src/lib/ehr.ts": 41` → `42` (the consentCovers definition only). Doc section "B2-1 additions" added.
- NEW `consentRecordModelB2.test.ts` 6/6 (run 3× green); rollback parity fixture captured from a git-archive copy of a2601c9f with the same pinned clock (generated seed IDs normalised to index).

## Stop
Full units: 2,904 / 2,909, 363 files, EXIT 1. Five failures, all whole-file byte-identity pins of `src/lib/ehr.ts` against earlier rollbacks:

| Test (file:line) | Current | Proposed |
|---|---|---|
| src/components/__tests__/roleDashboardParity9c2.test.ts:33 | ehr.ts compared byte-identical | wrap ehr.ts with a NEW exact-once `src/test/consentB2_1Approved.ts` adapter that reverses only the 10 B2-1 hunks |
| src/lib/__tests__/billingParity9a3.test.tsx:14 | same | same adapter |
| src/lib/__tests__/statTileParity9a2.test.tsx:29 | same | same adapter |
| src/lib/__tests__/billingProjectionB3b.test.ts:94 (therapist, sys_admin) | same | same adapter |

The B3b pre-approval covered only B3b items, so no adapter was added. Browser suite not run; no screenshots restored.

B2-1 hunks in ehr.ts (vs a2601c9f): :3 import; :3690 interface; :12687–12706 untyped filters; :12718–12741 consentCovers; :12754–12791 createConsentRecord extension.
