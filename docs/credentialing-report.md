# Clinician credentialing — 27 Oct batch, 28 Oct reconciliation

**Status: reconciled and validated in preview.** Draft — pending go-live permissions audit and compliance review. No publishing, Supabase operations, TEST secrets, persistence switches or external monitoring.

## 29 Oct catalog-based DEA checkpoint (supersedes optional appointment flag)

**Draft — pending clinical sign-off.** The service catalog has no dedicated MOUD buprenorphine induction/maintenance or controlled-medication-management entry. Per Mitch's fallback instruction, the matching existing **`med_management` (Medication visit)** entry now carries `controlledSubstanceDraft: true`, pending Mitch's confirmation. This provisional classification applies to all visits choosing that existing entry; it does not distinguish controlled from noncontrolled medication visits. No SUD/counseling/group entry is flagged and no patient diagnosis/category is used. Mitch must confirm this matching entry before go-live.

`credentialedForService` derives DEA requirements through a self-registered read of that single catalog. Removed the previous optional controlled flag from Appointment, bookAppointment input, evaluator input/options, and review appointment/claim shapes. Booking already chooses service type and needs no new UI. Service-date license/registration/DEA/supervision/enrollment and booking-time exclusion freshness remain unchanged; careLifecycle uses DOS mode. Existing ehr-ext credentials and verification remain the sole authority.

Billing allowlists, codes/dates/provider/units and note-text restrictions are unchanged. Billing's existing appointment serviceType and claim-to-appointment serviceType lookup drive the existing evaluator result; no catalog flag enters either projection. Live preview used the actual registry credential edit to invalidate fictional c3 DEA verification, then the existing Billing **Credentialing** view showed three appointment DEA review results. No visit was cancelled. Screenshot: `/tmp/browser/dea-catalog/billing-flags.png`; script/output remain under `/tmp/browser/dea-catalog/`. This is preview-memory verification, not production authentication or persistence acceptance.

Tests: focused DEA/as-of/Billing projection **29/29**; full units **3,662/3,662**, **414/414 files**, exit 0, 196.51s. Ten DEA/catalog tests cover both prescriber identities, service-date expiry/verification, unflagged SUD counseling, non-prescriber isolation, single matching catalog classification, unchanged projection fields and real store booking parity. Initial full run **3,661 passed/1 failed** used a nonexistent exported catalog in the new test; corrected to the existing accessor. Source pins verified the prior SHA-256 text before updating only approved output; no projection assertions weakened.

Full public browser suite after green units: **53/53**, 12.6m, one worker :8080, no overlap; includes unchanged HLOC required-element/disclosure test. Post-suite registry credential edit → Billing DEA readback repeated successfully with no page errors; `/tmp/browser/dea-catalog/final-out.txt`. Shared-gate regression also passed 1/1 after the suite. Build OK.

Deferred: real OIG/SAM.gov/Medi-Cal screening, secure file storage phase 5, phase 2d transport/persistence and confirmation of the matching Draft service entry. Access Step 5 SQL vectors/counts and separately approved policy openings remain unstarted; all three groups closed. Nothing published; persistence OFF.

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

## 28 Oct fix — exclusion freshness judged at booking time (Mitch, Draft)
**Problem.** `evaluateCredentialing` took the latest exclusion check on or before the date of service and failed when its `nextDueAt` fell before that date. Future checks cannot exist yet, so every billable booking more than ~30 days out failed.

**Rule (one evaluator, two moments).** `credentialedForService(staffId, payer, serviceType, dateOfService, { asOf })`, `asOf` defaults to now.
- Judged on the date of service (unchanged): license/registration verified and unexpired, payer enrollment for the service type, active supervision for associates/trainees.
- Judged as of `asOf`: no OIG / SAM.gov / Medi-Cal S&I hit on the latest check, and the latest check not overdue as of `asOf`. It never requires a check that hasn't happened yet.
- Booking (staff and self-scheduled, both through `bookingCredentialingBlock` in `bookAppointment`): `asOf` = now.
- Billing readiness (`careLifecycle.billableService`) and claim review flags: `asOf` = date of service — unchanged mode. Calling the pure evaluator without `asOf` is the same historical mode.
- Booked appointment review flags: `asOf` = now until the visit day, then the visit day. An overdue check on the visit day flags the visit for Billing review; nothing is cancelled or changed.
- "Exclusion checks due" tile: a clinician whose next check falls due before booked billable visits is listed with "Check due before booked visits" (count of visits only) and a "Record the check" link to the existing record-check controls. ehr self-registers its appointment list (`registerBookedVisitSource`), no import cycle.
- A recorded hit still blocks new bookings immediately and flags existing ones.
- Historical scope note: DEA was not added in the exclusion-freshness fix; the explicitly approved Part B carry-over below adds the service-date evaluator check.

**Seeds.** All credentialing seed dates are now relative to today (issued/effective dates, monthly check history starting 24 cycles back). The fixed 2026-11-20 future check for c1 was removed. All seven fictional cases kept; c5 is still overdue (checked 45 days ago) and still blocked at booking.

**Tests** (`src/lib/__tests__/credentialingAsOfOct28.test.ts`, 14): last check 8 days ago bookable 45/90/180 days out; real staff and self-scheduled bookings 45/90/180 days out succeed; overdue-as-of-today blocks; demo c5 blocked; hit blocks; license expiring before DOS blocks only that booking; readiness keeps DOS mode; booked visits after due date show on the tile; overdue on visit day flags without mutation; future visits not falsely flagged; neutral label carries no reasons. Existing role/button-vs-store credentialing tests unchanged and passing.

**Re-pins (pre-approved exact-once adapter).** `src/test/credentialingAsOfOct28Approved.ts` composes after the access-rules adapter in `credentialingOct27Approved.ts`:
- `src/lib/ehr.ts` — 3 hunks (import, booking `asOf`, booked-visit registration). Pinned by roleDashboardParity9c2, billingParity9a3, billingProjectionB3b (therapist, sys_admin), statTileParity9a2.
- `src/lib/ehr-ext.ts` — 13 hunks (relative seed dates, removed fixed future check, comment). Pinned by roleDashboardParity9c2, billingParity9a3.
No assertion was weakened; no matrix or permission change.

**Validation (real results).**
- Full units: **3,599/3,599**, 408 files, exit 0.
- Public browser (one worker, :8080, after units finished, no overlap): nine public/website specs, **52 passed / 1 failed**, 14.6 min. The failure is `websiteSignup5 › HLOC panel…`: an off-team therapist opening a freshly created patient now lands on the access-rules "reason needed" gate, so the chart's Send button never renders. It comes from the access-rules batch's chart gate, not this fix (no credentialing code on that path); left unchanged per "don't start access-rules here" and listed for that batch.
- Not checked in a live preview session this turn: the tile's "Check due before booked visits" row visually.

**Deferred (not for Beta, Mitch 28 Oct):** real OIG / Medi-Cal / SAM.gov checks (adapter stays Simulated until go-live); real signed-copy credential file storage (phase 5); Phase 2d.

## 28 Oct Part B carry-over — DEA checkpoint, incomplete Billing integration

**Draft — pending clinical sign-off and go-live permissions audit.** Persistence OFF; no Supabase operations or publishing.

- Physician (`s-np1`/c5) and PMHNP (`s-th3`/c3) require an actual DEA number, verification on/before DOS and recorded expiry on/after DOS only for an explicitly controlled-substance service. Medication management and SUD alone never imply that fact. Missing/unverified/future verification and missing/expired expiry return neutral review reasons.
- The existing ehr-ext credential document remains sole authority; its actual verification is projected/persisted and relative fictional DEA dates are preserved. `Appointment.controlledSubstance` is an optional explicit service fact, passed through the existing booking guard; `careLifecycle` passes it for DOS readiness. No additional credential store or mutation action was introduced.
- Eight concrete DEA regressions pass for both actual prescriber identities, non-controlled/non-prescriber negatives, sole-authority expiry-edit invalidating verification, and booking guard parity. The two reason-log/gate regressions pass too.
- Full units **3,658/3,658**, **413/413 files**, exit 0, 176.97s, after correcting a projected-object fixture to use the real registry credential writer. Earlier run: 3,657 passed/1 failed; not hidden. Exact-once SHA-256 re-pins of ehr.ts/ehr-ext.ts compose through `credentialingDeaOct28Approved.ts`; all source-equality tests pass, no billing codes/dates/provider/units/note-text assertions weakened.
- On-team HLOC browser carry-over: unchanged required-element/disclosure assertions **1/1 passed**, exit 0, one worker on :8080 after green units. The fictional therapist is assigned through `chart_team_assignment` before chart entry. Full public suite not run at this checkpoint.

**Stop boundary:** Billing's approved `APPOINTMENT_KEYS` and `CLAIM_KEYS` exclude the controlled-service fact; the current flag component receives those projections. The evaluator accepts the fact, but real Billing appointment/claim DEA flag readback and credentialing claim-count propagation are **not complete**. No allowlist, matrix, permission or claim schema was expanded. The booking editor also has no explicit controlled-service capture yet; guard tests do not prove that unflagged UI bookings are DEA-screened. A privacy-safe derived review projection/capture path must be settled before claiming complete carry-over acceptance.

Actual logs: `/tmp/access-oct28/units2.log`, `focused2.log`, `hloc.log`. Deferred real screening, phase 5 secure storage and phase 2d remain unchanged.

## 28 Oct MOUD service type

**Draft — pending clinical sign-off (Mitch, 28 Oct).** No publishing; persistence OFF. No Supabase change: the service-type catalog has no database mirror (no migration file or table references `med_management`).

- **One catalog entry added** to the existing `SERVICE_TYPES` in `src/lib/ehr.ts`: `controlled_med_moud`, "Controlled medication / MOUD visit" (ES draft "Visita de medicamentos controlados / MOUD", marked pending translation review in `scheduleCopy.ts`); video + in person (same as med_management), 30 min, billable (`BILLABLE_SERVICE_TYPES`), prescriber calendars only (`PRESCRIBER_SERVICE_TYPES`, PMHNP/physician credentials). No parallel list.
- **Draft controlled flag moved** from `med_management` to `controlled_med_moud`. med_management is non-controlled again, so its bookings no longer check DEA. The evaluator still reads the flag from the appointment's service type through the existing catalog registration.
- **Wired where med_management appears:** staff booking drawer and patient self-scheduling (read the catalog; prescriber filter applies), bookingRights, careLifecycle readiness (via billable list), Billing projection (unchanged `APPOINTMENT_KEYS`; only the new value), staff-profile "MAT / prescribing" specialty, medication request duplicate check, Visalia in-person services, c3/c5 services and availability, MAT continuum classification (only with an existing SUD episode). Reporting groups by catalog ids and the existing cohort-11 guard; no reporting rule changed.
- **No code or rate invented.** `CODE_MAPPING_NEEDS_REVIEW` in `rates.ts`: a claim from this type gets no service code and shows "Code mapping needs review (Draft)" (no-rate). Rate card `chargeForService` keeps its default.
- **Payer enrollment:** every clinician gets an explicit `controlled_med_moud` row per payer they hold (Medi-Cal FFS when none), status "not started"; only c3 (Anita Brooks, PMHNP, fully credentialed) is active on Medi-Cal FFS. A service-specific row now takes precedence over a payer-wide `*` row for that payer, so "not started" is never overridden.
- **Demo seeds (fictional, real booking call):** one c3 `controlled_med_moud` video visit for p1 in 14 days. c5 (Dr. Bagga) DEA now expires in 20 days: controlled visits after that date are blocked (`dea_expired`), med_management unaffected; c5's overdue exclusion case is unchanged.
- **Tests** `src/lib/__tests__/moudServiceTypeOct28.test.ts` (8): catalog entry/flag move; DEA required for the new type but not med_management; prescriber-only picker (c3, c5); store refuses a non-prescriber clinician; enrollment rows for every clinician, only c3 active, specific row beats `*`; seeds; Billing projection same keys/new value/no note text, no code mapping; picker = store for all 18 staff roles. `credentialingDeaOct28.test.ts` moved to the new type; `reminders.test.ts` service list adds it.
- **Re-pins (pre-approved exact-once adapter)** `src/test/moudServiceOct28Approved.ts`, composed last in `credentialingOct27Approved.ts`: `src/lib/ehr.ts` (7 hunks) and `src/lib/ehr-ext.ts` (7 hunks); pinned by roleDashboardParity9c2, billingParity9a3, billingProjectionB3b (therapist, sys_admin), statTileParity9a2. No assertion weakened.
- **Full units:** 3,670/3,670, 415 files.
- For Mitch to confirm: the Draft controlled list is this one entry; real billing code mapping remains open.

## 29 Oct coverage rules (Mitch, Draft — pending Christi)
- `credentialedForService` takes the resolved funding source (`opts.fundingSource`). Private pay and grant visits now check license, supervision, DEA (MOUD type) and exclusion ("Adelante policy (Draft)") but never enrollment; commercial without in-network enrollment and Medicare raise neutral Billing flags without blocking; non-billable services get no credential check. Callers without a funding source keep the earlier behaviour.
- Billable roles without a clinical license: peer certification + supervising provider, CHW certificate/attestation + supervising licensed provider, ECM training + organization ECM contract per plan — Draft, confirm with compliance; checked only when billable. New Today tile "Peer, CHW and ECM credentials" and expiry items.
- Demo: c5 renamed "Dr. R. Sample" (fictional) and stays the overdue-exclusion case; the DEA-expires-in-20-days case moved to c3, which is fully credentialed and MOUD-enrolled (Medi-Cal FFS and Tulare County DMC-ODS), so DEA expiry is its only block.
- Full details, delivery-system table and confirm-lists: `docs/coverage-rules-report.md`.
