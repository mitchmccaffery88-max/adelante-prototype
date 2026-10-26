# Intake responsibilities — 26 Oct boundary review

## Why the prior work was narrowed

The later request explicitly allowed only the Intake workspace, public referral path and identity review, and expressly excluded clinical navigation/tasks, chart entry and writes. That scope instruction—not test cost—caused all seven responsibilities to be dropped. Scheduling, handoff and escalation affected clinical workflows; paperwork, SDOH and packets also needed separate Part 2 boundaries; eligibility needed a billing-only request/result contract. No inherent conflict with the existence of an Intake role was established.

## Current implementation outcome

No application permissions or clinical stores were changed in this run. The requested restoration is **not implemented**. Investigation stopped at the existing importer and pre-account crisis boundaries rather than enabling broad actions or using a fake patient identity. The seven tasks remain open. New dedicated adapters would be needed; absence of those adapters is not evidence that the responsibilities are inherently impossible.

## Responsibility-by-responsibility findings

1. **First-visit scheduling and group request:** feasible with new referral-scoped authorization. `bookAppointment` (`src/lib/ehr.ts:9191`) checks generic booking rights only when a staff actor is passed; Intake is denied today. Do not omit `bookedBy`, impersonate a clinician or grant generic `scope: any`. A new first-visit boundary must enforce the service allowlist, referral indications, first-only semantics, active eligible calendar and unchanged consent/location/conflict checks. `requestJoinGroup` (`src/lib/ehr.ts:24854`) currently attributes the request to the patient; an actor-aware on-behalf path is needed. Approval stays clinical.

2. **Paperwork/typed capture/status:** feasible with a new constrained capture/send permission. `captureConsentRecord` and `uploadPaperConsent` require broad ledger write; `requestConsentESign` and `sendForms` require chart entry. Neither grant should be enabled for Intake. Existing `ConsentCapturePanel` includes scope/history/disclosure/revoke/renew controls and must not be mounted wholesale. Reuse its purpose-picker/capture mechanisms through an intake-only boundary, with actual checklist/signature attestations and a status-only projection.

3. **Eligibility request/result:** feasible as a write-only billing request plus coverage-only result. Existing `eligibility_check` grants eligibility write and calls a simulated vendor, not a Billing handoff. Manual `recordCoverageCheck` is a separate path. Intake must not receive result-entry access, verification history, identifiers or clinical/billing records. A dedicated Billing-owned request contract is missing.

4. **Referral/packet SDOH:** feasible through a source-bound projection and checklist store. Existing provenance distinguishes referral/partner/intake/clinical origins, but there is no established referral-packet SDOH attachment contract. A clinician-note filter is not enough: source provenance must be validated when ingesting the packet and again when projecting/checking it. No inference from clinician notes or unrelated needs is permitted.

5. **Existing roster import and referral packets — STOP boundary:** `src/routes/pre-release-import.tsx:118–190` directly creates or updates pre-release patient episodes, writes county/coverage and imports HRSN domains into episode/clinical stores. It is not a referral-only import or attachment path. Simply adding Intake to `canImportPreReleaseRoster` would permit more chart writes than the requested assignment-only limit, and facility navigation must remain off. There is no referral-owned packet document store in the inspected path. Meeting the exact scope requires a new referral-staging importer/attachment contract rather than enabling this importer, including Part 2-safe pending-consent attachment/status handling.

6. **Completion/assignment:** feasible with a new administrative completion boundary and active-roster target validation. `completeIntake` writes needs, notes and legacy consent flags and recomputes the care plan; it is unsuitable. Reuse `assignCaseManager` and `reassignPrimaryClinician` only after dedicated actor/referral/target checks. Completion cannot attest clinical assessment or create consent. No general reassignment or chart grant.

7. **Safety flag/escalation — STOP boundary:** `flagCrisis` (`src/lib/ehr.ts:21285–21300`) requires an existing patient. An unclaimed referral or signup can have no patient ID; the current referral/signup models also lack the requested structured safety-source contract. Calling this existing path for those cases would require creating/linking a chart just to escalate, contrary to identity/matching boundaries, or pretending a case has a patient. A patient-independent clinical triage source/owner contract must be added before the universal referral/signup/message action can be true. For already-linked referrals, a write-only wrapper can safely reuse the existing crisis owner path without reading crisis details.

## Preserved boundaries

- No broad chart entry, record-class grant, general calendar/reschedule, clinical task or crisis-detail access.
- Separate account-support grant; one acting role, never a union.
- No Part 2 consent fabrication, legacy-flag authorization, inferred clinical needs or invented safety flags.
- No database, connector, delivery or publication changes.
- Existing narrow workspace/review behavior remains unchanged.

## Validation

The full unit suite completed with **3,340/3,340 passing**, 391 files, exit 0. The first public run was interrupted by the command's 600-second execution limit after 31 passing checks; it is not counted as a completed suite. A clean detached full public rerun uses the same eight public specs, one worker and no timeout/retry changes. Its final result is recorded in the roadmap once complete.