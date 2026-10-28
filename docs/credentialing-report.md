# Clinician credentialing — 27 Oct batch, 28 Oct reconciliation

**Status: reconciled and validated in preview.** Draft — pending go-live permissions audit and compliance review. No publishing, Supabase operations, TEST secrets, persistence switches or external monitoring.

## What existed
- Non-clinical `credentialing_coordinator`, its demo staff member and `/admin-credentialing` action home; `staff_supervision` write tier, including the existing clinical-coordinator assistance grant. Chart entry, clinical notes and billing claims remain denied for the credentialing role. Additional held roles do not union permissions.
- `ehr-ext.ts` credential documents, verification, expiry history, follow-up and payer enrollment; roster credential text, clinician linkage, NPI and supervisor; credential CSV import/export without bytes.
- Billing readiness previously treated roster credential text as proof. Rendering calendars include licensed therapists, prescribers, registered associates/trainees and SUD counselors; non-billable support remains separate.

## Sole authority and writes
- Credential and enrollment records in **ehr-ext are the sole authority**. The independent credentialing record array and its module-load seeds were removed. `credentialing.ts` receives projections through self-registration; no module-load `STAFF_ROSTER` read or ehr → ehr-ext import was introduced. NPI comes only from the roster.
- Dashboard add/import/edit/verification/follow-up/clear/enrollment commands use existing store writers via registry references. The editor records manual verification, each exclusion-list result and payer/service enrollment. The extended-profile registry path writes back to the same credential documents, not another store.
- Existing owner-only document capture/deletion permissions are unchanged. Documents remain inline **preview memory only**, labelled **Simulated**; the projected document status reflects actual captured bytes vs missing files. No new byte storage. Secure storage waits for phase 5.
- Registry mutation audit occurs once; block/unblock transitions add their own content-free ids-only event only when the derived blocking state changes. No license numbers, payer facts, attestation answers or document content appear in those transition audits.

## Record fields
License/registration number/type/state/issue/expiry, source/date/actor/manual verification; associate supervision start/end/supervisor; roster Type 1 NPI; DEA/expiry; board certification; malpractice carrier/policy/expiry; education and CE attestations; OIG/SAM.gov/Medi-Cal checks with date/result/next due; IN 18-019 signed/date/actor and all five confirmations; payer/service status/effective date/CAQH ID; recredentialing due; document status. Extended fields reside in existing credential documents and payer rows, not duplicated authority arrays.

## Rule and consumers
- `evaluateCredentialing` is pure and historical: only the supplied service date is used; no current clock. Checks after that date cannot retrospectively unlock or block the service. Latest applicable check on each list must be clear/current; license/registration must be verified by that date and unexpired; enrollment must be active/effective for payer/service; associates/trainees require supervision active on the service date.
- `credentialedForService` resolves the self-registered read projection and delegates to that evaluator. Missing payer or missing service now returns review reasons, never a silent pass. Billing and Credentialing see neutral reasons; other readiness viewers receive only **Credentialing — needs review**.
- `careLifecycle` billing-readiness item uses this rule, replacing credential text. Booking invokes it inside the existing bookAppointment guard beside bookingRights, preserving the approved known-payer, billable-service scope; unknown-payer booking remains allowed pending coverage, but readiness does not pass. Non-billable support continues.
- Claim flags receive the service type from their existing encounter/appointment reference. Missing service remains a review flag, not an assumed enrollment. Existing appointments and claims are **flagged only**, never cancelled, deleted or changed.
- Billing display uses projected billing selectors in its isolated component. Credentialing Today receives **staff-id → count only** from the claim-ingestion boundary, never raw claims/patient rows.

## Role home, Today and monitoring
- Five Today tiles: Expiring soon, Exclusion checks due, Re-credentialing due, Payer enrollment pending, Blocked clinicians; each links to its existing in-page work home. Threshold projections use 90/60/30 days and clinician-only 30-day heads-up. These are preview Today worklists, not persistent background task delivery.
- Exclusion hits produce neutral urgent notices for clinical coordinator/sys_admin, visible on Escalations and acknowledged through the registry. No patient chart or claim details are carried.
- Draft monthly exclusion cadence is 30 days; recredentialing interval is at most three years, pending Tulare/Kings contract review and compliance approval.
- Manual lookup records real staff verification. Vendor, exclusion-file and CVO channels remain disabled/Simulated. The **simulated attempt flag** is enabled like other demo integrations; its action is a no-op with simulated audit outcome, not live success, and never fetches/connects any channel. The unchanged simulatedLabelsSL assertion passes for that reason.

## Fictional demo cases
c1 fully credentialed/enrolled; c4 supervised ASW; c2 license expiring in 25 days; c3 Medi-Cal active but DMC-ODS not started; c5 overdue exclusion checks; c6 missing supervision; c7 SUD counselor. Credential/DEA/policy identifiers are explicitly DEMO-prefixed. Fictional monthly check history supports historical evaluation and the unchanged workingCalendar clock through its booked service date, with cadence unchanged. Real received primary credentials replace demo evidence; genuine latest-renewal expiry behavior is preserved.

## Assertion and source-delta ledger
- Only the specifically approved obsolete missing-payer pass assertion was replaced; missing service and known active payer/service coverage were added. Existing readiness/claim fixture inputs were completed with payer/service facts **without changing their assertions**.
- `credentialingReconciliationOct28Approved.ts` lists narrowly approved exact-once source hunks for ehr/ehr-ext; the original approved credentialing adapter composes it. Every other byte stays pinned; no snapshot refresh or old assertion relaxation.
- Existing consent parity PRNG budget was preserved; no consent decision, record payload or canonicalization assertion changed.

## Validation
- Focused credentialing + unchanged SL: 67/67; existing five regression files: 55/55.
- Full units: **3,583/3,583**, **406/406 files**, exit 0, 126.24 seconds. New reconciliation coverage proves authority write/read agreement, historical checks, exact Draft settings, count-only ingestion, all-role writer gates and simulated single audit.
- Full public browser suite: **51/51 passed**, exit 0, 12.1 minutes; eight existing public specs, one worker on :8080, started only after the full unit suite completed. No assertion, timeout or test configuration changes.
- Credentialing UI readback ran **after public completion**: acting Credentialing Coordinator recorded a fictional payer + med-management enrollment with actual effective date; UI showed credentialed and the existing enrollment table read back enrolled/service/date with exactly one registry audit. An OIG match then appeared as a neutral urgent item for the acting clinical coordinator on Escalations; acknowledgment removed it. Desktop 1280 and phone 390 checked; no horizontal overflow or page errors. Latest preview build: build OK.
- UI evidence: `/tmp/browser/credentialing/enrollment-readback.png`, `urgent-readback.png`, `tiles-desktop.png`, `tiles-mobile.png`; browser result `/tmp/browser/credentialing/readback.log`. This is the explicitly requested fictional acting-role preview, not a hosted authenticated persistence test.
- Logs under `/tmp/credentialing-reconcile/`; no secrets.

## Outside this batch
Go-live permissions audit, compliance/IN 18-019 sign-off, county-contract cadence confirmation, real monitoring vendor/CVO agreement, persistent task/notification delivery and phase 5 secure file storage. No production compliance or storage claim is made.
