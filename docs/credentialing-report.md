# Clinician credentialing — 27 Oct batch, 28 Oct continuation

**Status: partial; stopped at the required architecture boundary.** Draft — pending go-live permissions audit and compliance review. Nothing published; no Supabase operations, TEST secrets, persistence switches or external monitoring used.

## What existed
- `credentialing_coordinator` already existed as a non-clinical role, with Marcus Webb (`s-cred1`) and `/admin-credentialing` as its action home. Its existing `staff_supervision` write tier permits credential assistance; chart entry and billing/clinical record classes remain denied. Additional held roles do not create an acting-role permission union.
- `credentialRoster.ts` already provided CSV import/export of clinician, credential kind/number/state/issue/expiry/status/verification and document presence, without document bytes.
- `ehr-ext.ts` already owned credential documents, verification/expiry edits, follow-up and payer-level enrollment. Its current UI writes directly to these methods. Credential files currently support inline bytes.
- The staff roster carried a free-text credential, clinician linkage, NPI and supervisor information. `careLifecycle.ts` used that free-text credential as its readiness proxy. Existing booking already stopped on license expiry.
- Rendering calendars cover licensed therapy and prescribing roles, associates/trainees and SUD counselors. Non-billable support work is separate. No grants or role classes were widened by this continuation.

## New work currently present
- `credentialing.ts` adds typed credentialing data, evaluation, guarded verification/exclusion/enrollment/attestation operations, monitoring descriptors, due-work projections and review flags.
- License fields: type, number, state, issue/expiry, source, verification date/actor and manual method. Registration fields: type, number, expiry, verification and supervision start/end/supervisor. Additional fields: NPI, DEA/expiry, board certification, malpractice carrier/policy/expiry, education/CE attestations, exclusion list/date/result/next due, signed IN 18-019 attestation elements, payer/service enrollment status/effective date/CAQH ID, re-credentialing due and document status.
- Five Today tiles are mounted on the existing credentialing home: Expiring soon, Exclusion checks due, Re-credentialing due, Payer enrollment pending and Blocked clinicians. They link to worklists on that page. Expiry thresholds are 90/60/30 days; the clinician's own credentials page has a neutral 30-day heads-up. These are read projections, not completed persistent task delivery.
- Registry entries exist for verification, exclusion checks, enrollment, attestation, simulated monitoring and acknowledgment of neutral exclusion-hit notices. Existing direct credential writers have not been converted or synchronized; see stop boundary below.
- `careLifecycle` readiness calls `credentialedForService` instead of the credential-string proxy. Billing and credentialing role projections receive reasons; other viewers receive `Credentialing — needs review`.
- New booking checks run inside `ehr.ts` `bookAppointment`, alongside existing booking-rights checks, **not inside `bookingRights.ts`**. They apply to listed billable types when the patient has a known active payer and the rendering clinician maps to a staff record; non-billable support and unknown-payer bookings are not blocked by this new check. Existing appointments/claims are not cancelled, deleted or rewritten.
- `CredentialingReviewFlags.tsx` isolates Billing's flag projection and display using existing Billing ingestion selectors, preserving pinned route bindings. Credentialing Today displays affected claim counts, not claim details; its current ingestion still obtains full claim rows before counting and needs a proper count-only boundary.

## Rule and limitations
The evaluator checks verified, unexpired license/registration; clear/current checks for OIG, SAM.gov and Medi-Cal Suspended & Ineligible Provider List; active payer/service enrollment; and associate/trainee supervision. `credentialedForService` reads the current module's records and delegates to `evaluateCredentialing`.

This is **not yet the requested authoritative pure rule**: the evaluator reads today's clock and evaluates exclusion currency at the earlier of service date/today; it is not fully historical. Missing payer/service skips enrollment checking. Claim flags pass no service type, so service-specific enrollment failures are not covered for claims. These limitations must not be presented as go-live readiness.

## Simulated monitoring
Manual lookup is the only enabled channel. Vendor, exclusion-file and CVO descriptors are disabled and Simulated; there is no vendor/API/file ingestion or CVO delegation running. The registry feature flag is off by default. Documents in the new model are status-only; the existing inline-file UI remains unresolved. IN 18-019, county cadence and compliance review remain Draft; this batch does not establish regulatory compliance.

## Demo cases
Current scenarios include: c1 fully credentialed/enrolled; c4 associate with supervision; c2 license expiring in 25 days; c3 Medi-Cal services enrolled but DMC-ODS service not started; c5 overdue exclusion checks. c6 lacks supervision and c7 is a SUD counselor. The earlier seeded p1 visit was moved from blocked c5 to enrolled c3, without bypassing the booking check. Current credential numbers/NPI values are not consistently marked with an obvious fake prefix; seed ownership/fictional labeling also needs reconciliation before acceptance.

## Three requested blocker fixes
1. Corrected only the clinician-fit insertion anchor in `credentialingOct27Approved.ts` to the actual existing comment. The comment names this batch; exact-once matching and byte-identical comparisons remain intact.
2. c1's exclusion seed now starts with a fresh check and the unchanged 30-day cadence. Its runway covers workingCalendar's 20 Nov clock. The fixed clock and calendar assertions were not changed.
3. Moved the new Billing derivation/UI into a separate component, removing the additional route memo and flag bindings. Existing pinned expressions/handlers remain unchanged.

## Validation
- Unchanged blocker regressions plus credentialing: **90/90**, six files, exit 0 (7.17 seconds).
- Full unit suite after those fixes: **3,574 passed / 1 failed, 3,575 total**, 404 passed files / one failed, exit 1 (180.72 seconds).
- Sole failing assertion: `simulatedLabelsSL.test.tsx`, `credential_monitor_simulated: every tied registry action writes exactly one simulated action audit`. The transport assertion expects success, but the monitor feature is deliberately off and `runAction` correctly blocks it before calling the substituted transport. No assertion was weakened and the disabled channel was not enabled to force a pass.
- Full run also exposed import-order seed errors: `bookingCredentialingBlock` reads an uninitialized `STAFF_ROSTER` in some module graphs. These caught seed errors are not an acceptable clean run even though their containing tests pass.
- Full public browser suite **not started**: units are not green, and work stopped at the explicit conflict boundary. No overlapping test suites.
- Preview build telemetry is absent in this sandbox; no manual build/typecheck was run. Credentialing UI end-to-end remains unverified, and no completion claim is made.
- Logs: `/tmp/credentialing-targeted.log`, `/tmp/credentialing-full-units.log` (sandbox only; no secrets).

## Clean-boundary conflict and next decision
The existing credential/enrollment store in `ehr-ext.ts` and the new independent record arrays in `credentialing.ts` both contain license verification/expiry and payer enrollment facts. Editing the existing dashboard does not update the new booking/readiness source. This violates Mitch's **no parallel stores** requirement and risks contradictory booking decisions. The existing inline-byte/direct-write credential workflow also conflicts with status-only simulated documents and registry-only writes.

Stopped rather than broaden the approved parity adapter, bypass the monitor flag, suppress seed errors or silently replace existing writers. Completion requires a narrowly approved reconciliation: extend the existing credential/enrollment records as the sole authority, make credentialing evaluation consume those records without an import cycle, convert existing mutations through matching registry gates, and reconcile simulated status-only documents. Corresponding pinned-source deltas need exact approved adapters; existing assertions should remain intact.

Remaining acceptance gaps include complete field-edit UI, count-only claim ingestion, service-specific claim review, historical/pure rule behavior, threshold task/notification delivery, ids-only block/unblock audit coverage and obvious fictional identifiers. The current scaffolding is not a finalized credentialing workflow; full green units and sequential public/browser credentialing readback must follow reconciliation. No database migration or permission widening is needed to decide this memory-store architecture.