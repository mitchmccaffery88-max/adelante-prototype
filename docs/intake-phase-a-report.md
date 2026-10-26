# Intake Coordinator — Phase A

## Scope

Mitch's Phase A supersedes the earlier referral/identity-only narrowing. No generic booking right, chart entry, record-class access, account-support grant, consent writer, eligibility, clinical SDOH, importer or facility access was added. No publication or database/connector changes.

## Boundaries

### A1 — first visit and group request

- `intakePhaseA.ts` requires an active staff identity holding `intake_coordinator`, acting in that role; confirmed referral-to-patient linkage; open administrative intake; recorded referral/packet indication; and one of five first-visit kinds.
- Care manager and peer contacts, intake assessment, psych evaluation and MAT intake use existing service types and eligible-role calendars. Psych/MAT are never inferred. Administrative assessment and psych evaluation use the existing `intake` service but distinct referral first-kind metadata.
- Booking passes the real actor, requires a future available slot/default duration and eligible service/location, and delegates unchanged credentialing/service fit, telehealth/group consent and conflict checks to `bookAppointment`. Generic rescheduling/cancelling/chart access remains denied. The private appointment projection contains only ID/time/status for this referral's first visits; other rows return a lock and reason.
- On-behalf group requests record the Intake actor and patient attribution; no automatic membership. The existing approval path requires a clinical approver for these requests. Protected group selection/store gates require current treatment authorization. Tasks go to the facilitator's existing Today work, never an Intake clinical queue.

### A2 — administrative completion and initial assignment

- Active targets must hold the applicable care-manager or clinical role and have an existing manager/calendar identity. Only the linked patient and an empty initial assignment are eligible, before completion; later reassignment is denied.
- Uses existing `assignCaseManager` and `reassignPrimaryClinician`, including their existing continuity/audit artifacts. Completion writes only administrative checklist/completion state, not `completeIntake`, needs, notes, consent, clinical assessment, or a recomputed care plan.
- Picker shows roster language/location/hours and count-only caseload. Missing roster fields say “not recorded”; no fabricated schedules. Staff without an eligible service calendar cannot offer booking slots.
- Each assignment/request creates a real first-contact task with an explicit due date. Existing Today task surfaces remain; no new dashboard/tile/page. Patient header Care team is read-only.

### A3 — safety escalation

- Intake can escalate only a recorded structured referral/signup source or an existing `crisisFlagged` public inquiry. It cannot create/edit source safety narrative or read clinical detail.
- Linked sources call `flagCrisis` with the real Intake staff ID. Amber selects the active assigned care manager and sends the clinician a summary pointer; red selects the active assigned clinician and uses the existing crisis queue. Receipts show only owner/name/role/time and any owner gap.
- Unlinked work uses a source-keyed patient-independent triage store. No chart/fake patient is created. Assigned owners see real work rows in existing Today and Escalations hosts; care-manager owners see no clinical source narrative. Clinical source access is ownership/role/Part 2 gated.
- Confirmed later referral/signup linkage can attach the work item through `prechart_triage_link`; resemblance cannot link it. Unlinked messages remain source-keyed until a verified message-to-record contract exists.

## Owner/data gaps (not broader grants)

- No existing on-call clinician assignment was defined: unassigned safety items route to the clinical-coordinator queue, explicitly recorded in the receipt. This is the requested fallback, not an invented on-call person.
- Referral/signup models do not expose an existing universal safety flag feed. Phase A provides clinical-only structured ingestion for real source IDs; Intake does not scan private signup answers or invent flags. Existing flagged public inquiries are projected directly. Automatic ingestion from future source systems is not claimed.
- Some care-manager roster members have no bookable calendar/hours; their assignment remains valid, but booking needs an active eligible calendar. No fabricated hours/services.
- New administrative/triage state follows the existing preview-memory model. No hosted authorization, persistence, delivery or production readiness is claimed. Existing demo status bar remains authoritative; clinical/tier policy is labelled Draft — pending clinical sign-off.
- Phase B remains entirely deferred: paperwork/typed capture, billing request/result, packet-source SDOH, staging import/documents.

## Demonstration and tests

- Four real-store referrals: new, outreach, public-unverified family waiting on paperwork/safety, and linked ready-to-schedule with real initial assignment tasks. Seed action uses the registry and real stores.
- `intakePhaseA.test.ts` proves all five bookings, denied adjacent services/rescheduling/details, consent/calendar/location preservation, attributed clinical-only group approval, initial-assignment targets/Today tasks, administrative-only completion, linked/unlinked tier owners, signup and flagged-message receipts, no chart creation and confirmed later linkage.
- Historical EHR pin adapter is exact-once additive booking/group-only substitutions; non-Intake checks and historical selectors remain pinned. Existing paging test isolates the unrelated new triage child without changing its task fixture/assertions. Registry snapshot includes only Phase A additions.
- Actual preview flow: booking recorded; administrative completion reads back as Handed off; clinical coordinator sees the real pre-chart item in Escalations; 390px Intake has no document overflow. Screenshots under `/tmp/browser/intake-a/`.

## Validation

FULL units: **3,359/3,359**, **392 files**, exit 0. FULL public browser isolated rerun: **47/47**, exit 0, **12.9 minutes**. Build OK. Initial public run: 46/47, Axe context destroyed during navigation. Overlapping full-unit/public rerun: 43/47, four landing timeouts under load (Axe/evaluate/menu); no assertions, retry or timeout changes. Final run used the same eight public specs, one worker on :8080, no concurrent unit work or code edits; all earlier failed checks passed in the full run. Nothing published.

## Changed files

- Core: `src/lib/intakeBookingBoundary.ts`, `intakePhaseA.ts`, `intakeTriage.ts`, `intakePhaseADemo.ts`, `ehr.ts`, `chartActions.ts`, `website/signupStore.ts`.
- UI: `src/components/staff/IntakePhaseAActions.tsx`, `PreChartTriageRows.tsx`, `src/components/chart/AssignedCareTeam.tsx`, `ChartHeader.tsx`, `src/components/clinician/WorkspaceDashboard.tsx`, `src/components/tasks/TaskQueueCard.tsx`, `src/routes/intake-workspace.tsx`, `escalations.tsx`.
- Tests/pins: `src/lib/__tests__/intakePhaseA.test.ts`, `consentInventoryB2.test.ts`, `runAction.test.ts` and snapshot; `src/components/__tests__/roleDashboardParity9c2.test.ts`, `staffTable8b1Closeout.test.tsx`; `src/test/intakePhaseAApproved.ts`, `signupOct26Approved.ts`.
- Documentation: `AGENTS.md`, `roadmap.md`, `docs/b2-consent-inventory.md`, `docs/intake-scoped-responsibilities-stop.md`, this report; product memory updated for Phase A scope.