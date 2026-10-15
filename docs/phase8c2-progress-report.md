# Phase 8c-2 progress report

Kept by Mitch (Oct 15 2026). This turn did steps 1–3 only; remaining 8c-2 work was not continued.

## 1. "mat" failure
`REGISTRY_VERSION` in `src/lib/chartActions.ts` changed from `2026-10-15.staff-confirmations` to `2026-10-15.staff-dialogs`. `src/lib/__tests__/batchAFoundations.test.ts:130` now passes unchanged.

## Pop-ups replaced vs remaining
At rollback I count **14** native `window.prompt` / `window.confirm` call sites in `src` (not 17 — please send the list of 17 if it differs). Now **13 replaced** by the shared ConfirmDialog, **1 remains** by design:
| Site | Now |
|---|---|
| Care plan: close goal (+ met/closed confirm) | "Close this goal?" |
| Care plan: dismiss suggestion | "Do not use this suggestion?" |
| Care plan note: clear | "Clear this care-plan note?" |
| Group eligibility: remove | "Remove group eligibility?" |
| Group enrollment: end | "End this enrollment?" |
| Consent: revoke | ConfirmDialog with required reason |
| Patient balance: void payment | ConfirmDialog with reason |
| Billing: reason prompt | ConfirmDialog |
| Claims: deny | "Deny this claim?" |
| Advocate document: verify | "Verify this document?" |
| Advocate access: remove (staff, /pre-release) | "Remove this advocate's access?" |
| Note templates: publish | "Publish this template version?" |
| Unsaved drawer edits | "Discard these unsaved edits?" |
| **Remaining:** patient's own advocate removal (`AdvocateDesignationPanel.tsx:79`) | native prompt kept — member surface, outside staff scope |

Staff deletes confirmed: **Delete this frequency?** (catalog), **Delete this draft sentence?** (scribe), plus advocate access removal. **Not done:** lesson archive and lesson withdrawal confirmations.

## 2. Permission parity (rollback gate vs new registry)
New unit test `src/lib/__tests__/staffDialogs8c2Parity.test.ts` checks every staff role × 6 patients against the gate copied from rollback code (file:line in the test). Passing.

Mismatches found and fixed in the registry (no widening or narrowing vs rollback):
- `advocate_document_verify`: rollback also required consent-ledger **write** on the Advocates section (`StaffAdvocatesTab.tsx:40-41`, `recordSections.tsx:442`). The new entry allowed `cf_care_manager`, which has no write there → now hidden, as before.
- `advocate_access_remove`: the staff path at rollback is `/pre-release` (gate `canReadPreRelease`, `pre-release.tsx:123`), not the inviter list. The new entry blocked sud_counselor, therapist, physician, pmhnp and clinical_coordinator, who could remove it before → now allowed again. The episode attribution check still controls whether the panel shows.
- Care-plan actions now also require care-plan section **write**, as the rollback editor did; group enrollment and frequency delete use the exact rollback page check (write level). These produced no role differences for the test patients.
- Consent revoke runs through `consent_capture` (consent-ledger write); matches rollback for every role.

Role × action (Yes = allowed):
| Role | plan_goal_close | plan_suggestion_dismiss | plan_summary_clear | group_eligibility_remove | group_enrollment_end | frequency_delete | advocate_document_verify | advocate_access_remove | consent_capture |
|---|---|---|---|---|---|---|---|---|---|
| ecm_provider | Yes | Yes | Yes | Yes | Yes | — | Yes | Yes | Yes |
| cf_care_manager | Yes | Yes | Yes | — | — | — | — | Yes | — |
| sud_counselor | Yes | Yes | Yes | — | Yes | — | — | Yes | Yes |
| clinical_trainee | Yes | Yes | Yes | — | — | — | — | — | — |
| medical_assistant | — | — | — | — | — | — | — | — | — |
| peer_specialist | — | — | — | — | — | — | — | — | — |
| community_health_worker | — | — | — | — | — | — | — | — | — |
| therapist | Yes | Yes | Yes | Yes | Yes | — | — | Yes | — |
| physician | Yes | Yes | Yes | Yes | Yes | — | — | Yes | — |
| pmhnp | Yes | Yes | Yes | Yes | Yes | — | — | Yes | — |
| nurse_rn | — | — | — | — | — | — | — | — | — |
| lvn | — | — | — | — | — | — | — | — | — |
| billing | — | — | — | — | — | — | — | — | — |
| clinical_coordinator | — | — | — | — | Yes | Yes | — | Yes | — |
| credentialing_coordinator | — | — | — | — | — | — | — | — | — |
| billing_coordinator | — | — | — | — | — | — | — | — | — |
| sys_admin | — | — | — | — | Yes | Yes | Yes | Yes | Yes |


## 3. Audit reason privacy
- Scrubbing: `auditSafeReason()` at `src/lib/actions/runAction.ts:66`, applied at `:194` before the event is written; `write()` also applies `part2SafeText` at `:136`. It removes Part 2 / SUD terms and SUD medication names (existing list), diagnosis codes (ICD-10 shape, e.g. F11.20, Z59.0), and the patient's first and last name.
- Blank reasons (`""`, spaces, missing) write no `reason` field and never the text "undefined".
- Only the dialog's reason reaches audit; store arguments (e.g. note text) are never copied into the event.
- Tests: `staffDialogs8c2Parity.test.ts` ("scrubs…", "writes the scrubbed reason…").

## Proposed permission snapshot change (NOT written — needs Mitch's sign-off)
`src/lib/__tests__/runAction.test.ts:15` / `src/lib/__tests__/__snapshots__/runAction.test.ts.snap`: **136 lines added, 0 changed or removed** (8 new actions × 17 roles). The `consent_capture` lines are unchanged.
```diff
+ Received
  "billing": {
+     "advocate_access_remove": "hidden",
+     "advocate_document_verify": "hidden",
+     "frequency_delete": "hidden",
+     "group_eligibility_remove": "hidden",
+     "group_enrollment_end": "hidden",
+     "plan_goal_close": "hidden",
+     "plan_suggestion_dismiss": "hidden",
+     "plan_summary_clear": "hidden",
  "billing_coordinator": {
+     "advocate_access_remove": "hidden",
+     "advocate_document_verify": "hidden",
+     "frequency_delete": "hidden",
+     "group_eligibility_remove": "hidden",
+     "group_enrollment_end": "hidden",
+     "plan_goal_close": "hidden",
+     "plan_suggestion_dismiss": "hidden",
+     "plan_summary_clear": "hidden",
  "cf_care_manager": {
+     "advocate_access_remove": "allowed",
+     "advocate_document_verify": "hidden",
+     "frequency_delete": "hidden",
+     "group_eligibility_remove": "hidden",
+     "group_enrollment_end": "hidden",
+     "plan_goal_close": "allowed",
+     "plan_suggestion_dismiss": "allowed",
+     "plan_summary_clear": "allowed",
  "clinical_coordinator": {
+     "advocate_access_remove": "allowed",
+     "advocate_document_verify": "hidden",
+     "frequency_delete": "allowed",
+     "group_eligibility_remove": "hidden",
+     "group_enrollment_end": "allowed",
+     "plan_goal_close": "hidden",
+     "plan_suggestion_dismiss": "hidden",
+     "plan_summary_clear": "hidden",
  "clinical_trainee": {
+     "advocate_access_remove": "hidden",
+     "advocate_document_verify": "hidden",
+     "frequency_delete": "hidden",
+     "group_eligibility_remove": "hidden",
+     "group_enrollment_end": "hidden",
+     "plan_goal_close": "allowed",
+     "plan_suggestion_dismiss": "allowed",
+     "plan_summary_clear": "allowed",
  "community_health_worker": {
+     "advocate_access_remove": "hidden",
+     "advocate_document_verify": "hidden",
+     "frequency_delete": "hidden",
+     "group_eligibility_remove": "hidden",
+     "group_enrollment_end": "hidden",
+     "plan_goal_close": "hidden",
+     "plan_suggestion_dismiss": "hidden",
+     "plan_summary_clear": "hidden",
  "credentialing_coordinator": {
+     "advocate_access_remove": "hidden",
+     "advocate_document_verify": "hidden",
+     "frequency_delete": "hidden",
+     "group_eligibility_remove": "hidden",
+     "group_enrollment_end": "hidden",
+     "plan_goal_close": "hidden",
+     "plan_suggestion_dismiss": "hidden",
+     "plan_summary_clear": "hidden",
  "ecm_provider": {
+     "advocate_access_remove": "allowed",
+     "advocate_document_verify": "allowed",
+     "frequency_delete": "hidden",
+     "group_eligibility_remove": "allowed",
+     "group_enrollment_end": "allowed",
+     "plan_goal_close": "allowed",
+     "plan_suggestion_dismiss": "allowed",
+     "plan_summary_clear": "allowed",
  "lvn": {
+     "advocate_access_remove": "hidden",
+     "advocate_document_verify": "hidden",
+     "frequency_delete": "hidden",
+     "group_eligibility_remove": "hidden",
+     "group_enrollment_end": "hidden",
+     "plan_goal_close": "hidden",
+     "plan_suggestion_dismiss": "hidden",
+     "plan_summary_clear": "hidden",
  "medical_assistant": {
+     "advocate_access_remove": "hidden",
+     "advocate_document_verify": "hidden",
+     "frequency_delete": "hidden",
+     "group_eligibility_remove": "hidden",
+     "group_enrollment_end": "hidden",
+     "plan_goal_close": "hidden",
+     "plan_suggestion_dismiss": "hidden",
+     "plan_summary_clear": "hidden",
  "nurse_rn": {
+     "advocate_access_remove": "hidden",
+     "advocate_document_verify": "hidden",
+     "frequency_delete": "hidden",
+     "group_eligibility_remove": "hidden",
+     "group_enrollment_end": "hidden",
+     "plan_goal_close": "hidden",
+     "plan_suggestion_dismiss": "hidden",
+     "plan_summary_clear": "hidden",
  "peer_specialist": {
+     "advocate_access_remove": "hidden",
+     "advocate_document_verify": "hidden",
+     "frequency_delete": "hidden",
+     "group_eligibility_remove": "hidden",
+     "group_enrollment_end": "hidden",
+     "plan_goal_close": "hidden",
+     "plan_suggestion_dismiss": "hidden",
+     "plan_summary_clear": "hidden",
  "physician": {
+     "advocate_access_remove": "allowed",
+     "advocate_document_verify": "hidden",
+     "frequency_delete": "hidden",
+     "group_eligibility_remove": "allowed",
+     "group_enrollment_end": "allowed",
+     "plan_goal_close": "allowed",
+     "plan_suggestion_dismiss": "allowed",
+     "plan_summary_clear": "allowed",
  "pmhnp": {
+     "advocate_access_remove": "allowed",
+     "advocate_document_verify": "hidden",
+     "frequency_delete": "hidden",
+     "group_eligibility_remove": "allowed",
+     "group_enrollment_end": "allowed",
+     "plan_goal_close": "allowed",
+     "plan_suggestion_dismiss": "allowed",
+     "plan_summary_clear": "allowed",
  "sud_counselor": {
+     "advocate_access_remove": "allowed",
+     "advocate_document_verify": "hidden",
+     "frequency_delete": "hidden",
+     "group_eligibility_remove": "hidden",
+     "group_enrollment_end": "allowed",
+     "plan_goal_close": "allowed",
+     "plan_suggestion_dismiss": "allowed",
+     "plan_summary_clear": "allowed",
  "sys_admin": {
+     "advocate_access_remove": "allowed",
+     "advocate_document_verify": "allowed",
+     "frequency_delete": "allowed",
+     "group_eligibility_remove": "hidden",
+     "group_enrollment_end": "allowed",
+     "plan_goal_close": "hidden",
+     "plan_suggestion_dismiss": "hidden",
+     "plan_summary_clear": "hidden",
  "therapist": {
+     "advocate_access_remove": "allowed",
+     "advocate_document_verify": "hidden",
+     "frequency_delete": "hidden",
+     "group_eligibility_remove": "allowed",
+     "group_enrollment_end": "allowed",
+     "plan_goal_close": "allowed",
+     "plan_suggestion_dismiss": "allowed",
+     "plan_summary_clear": "allowed",
```
