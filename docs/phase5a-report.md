# Phase 5a — Copy, tú and staff English

## Scope
Presentation only. Stored action IDs/states, permissions, routes, reason gates, clinical/legal source, historical records and audits remain unchanged. Public English copy is untouched. Missing Spanish is not drafted; Build 5b uses the gap export.

## Voice accounting
From the pre-edit literal audit, changed source locations: Submit commands 13; Overdue/deadline/aggregate labels 32; No-show 6; Dismiss 9; icon/history symbols 55. These are source-location counts, not runtime occurrences, and overlapping edits are not additive. Additional reviewed send displays, translated counterparts, monthly summaries and fixes are listed in the manifest.

- Outcome verbs replace commands. Factual referral sends say Sent; claim state reads With payer; county simulation says it was not sent. Action IDs and submitted states stay.
- Deadline ages say Due N days ago. Aggregate/filter follow-up counts retain values. Crisis remains urgent; the crisis-note workspace word overdue is retained because crossRoleJourneys.test.ts:154 pins it and is not approved for edits.
- Missed visit/Mark missed visit retain no_show and visit-no-show. Permanent draft rejections say Don't use this draft/Draft not used; temporary closes say Not now.
- Monthly member count deduplicates dose reports, quick checks and private mood date keys in facility timezone, excludes future/prior-month keys, and does not rewrite weekly windows or grounding. Two new tests cover this projection.
- Confirmed icon candidates use Lucide; history/time arrows read to. Emotion check-in emoji stay for phase 6; punctuation, mathematics, keyboard references, clinical/source prose, comments and historical/audit text stay.

## Spanish review
4531 source rows, 1657 ordinary empty-Spanish gap keys and 1746 controlled rows. All ordinary rows remain draft: no explicit Spanish approval was found. CSV has key,english,spanish,screen,status, quotes/newline escaping and formula-prefix protection. It is deterministic and source-only, not a runtime patient-data export.

The gaps report groups source keys by consumer screen. Source dependency reachability may include shared branches; authored dynamic/computed values and publication metadata require manual review. This is not a certified exhaustive runtime inventory. Those limitations are stated in spanish-gaps.md; do not blindly draft all reachable text. No source approval flags change.

Confirmed tú sites changed in AdelGreetingCheckIn, MyPlan, NeedConnect, RecoveryCheckInNote, intakeWelcomeCopy, intakeVoiceCopy, adelIntakeScript, intakeBackgroundCopy, whatWouldHelp ordinary wrappers and consentForms notification wrappers. Validated needs questions, consent/sensitive instructions, third-person su and clinical/legal sources are retained. Clinical screener action wording has a paired Spanish Save answers label; screener questions are untouched.

## Staff language and frozen contracts
AppShell applies a non-persistent English context to staff/admin; document lang is en. Browser verification found no staff EN/ES header toggle and a stored es preference remained es. Member/public toggle stays. Patient-directed outreach/template language stays.

The proposed Preview in Spanish switch was tested directly and worked locally with html lang=en and no member preference write, but e2e/staffContent.spec.ts:16–17 freezes the existing ES · Draft button and aria-pressed. Mitch approved no changes to those assertions, so the local EN / ES · Draft controls are retained and the switch is **not applied** pending approval of those exact two lines.

Only approved assertion text changed in six files (seven assertions because outpatientMeds has two): e2e/continuity.spec.ts:30; myWorkStartOfDay.test.ts:10; outpatientMeds.test.ts:10,16; recoveryStages.test.ts:111; goalStatusAudit.test.tsx:76; e2e/adminContent.spec.ts:18. No retries, thresholds or other assertions changed.

## Verification
- Harness build green.
- Full units: 308 files / 2570 tests passed (2 new monthly tests).
- Initial complete browser run: 75/79, including all axe/Back-to-top specs. All failures were collected: crossRole clinical_coordinator duplicate Search patients controls during role transition; crossRole sys_admin missing Luis row/undefined dob during transition; staffContent waits for frozen ES · Draft after the proposed switch (restored); staffNav clinical_coordinator redirect remained /case-manager instead of /worklist at 10 seconds.
- Final complete browser run: **76/79 passed**. staffContent, both crossRole failures and staffNav all passed in this final full run. Three other failures: cfProxyMode proxy-enter, consentWorkflow packet and Spanish tablet; exact causes recorded below. One permitted warm staffNav rerun: **22/22 passed**; initial 21/22 failed only on the clinical_coordinator redirect timeout.
- 390px Spanish: Home, My care, Intake, selected lesson, Profile, Next steps, Check-in each scrollWidth 390. Screenshots in /tmp/browser/phase5. Existing English gaps remain deliberately undrafted.
- Direct content preview switch worked before contract restoration; local controls remain non-persistent. Monthly same-day check-in stays deduplicated (1 before/after), with saved private acknowledgement; no new counted day invented.
- Direct admin-content initial SSR showed existing role-dependent legal-tab hydration mismatch; no permissions or workflow changes applied. Record this as a diagnostic, not a passing no-error claim.

## Editorial / clinical review left unchanged
- library.ported.ts:2183 treated as avoidance and authored library streak passages: editorial review; no automatic rewrite of authored clinical lessons.
- Consent form legal bodies and draft English placeholders with Spanish suffixes; Part 2 notices, advocate authority, safety plan/content, PHQ-9/GAD-7 and other validated screeners, C-SSRS official Spanish placeholders and refusal/risk text: clinical/legal sign-off required, controlled in CSV.
- Intake Submit intake remains: frozen onboarding selectors support Submit/Finish/Terminar, not Send to my team; no assertion change approved. Clinical consent handoff/sensitive instructions retained except confirmed ordinary tú wrappers.
- Patient-directed template/output language and weekly AI grounding (1 of 7) remain unchanged.

## Changed-file manifest (including protected literal restorations)
- `AGENTS.md`
- `docs/phase5a-report.md`
- `docs/spanish-gaps.md`
- `docs/spanish-review.csv`
- `e2e/adminContent.spec.ts`
- `e2e/continuity.spec.ts`
- `roadmap.md`
- `scripts/export-spanish-review.cjs`
- `src/components/AppShell.tsx`
- `src/components/AssignClinicianButton.tsx`
- `src/components/CarePlanCard.tsx`
- `src/components/DemoStateSwitcher.tsx`
- `src/components/PatientHome.tsx`
- `src/components/PostEnrollmentSetupCard.tsx`
- `src/components/ReferralProgressStrip.tsx`
- `src/components/ReferralTimelineDrawer.tsx`
- `src/components/UserNavigationDrawer.tsx`
- `src/components/__tests__/goalStatusAudit.test.tsx`
- `src/components/admin/ContentAudit.tsx`
- `src/components/admin/ReferralTrackerCard.tsx`
- `src/components/billing/RatesPanel.tsx`
- `src/components/careplan/AsamSuggestions.tsx`
- `src/components/careplan/CarePlanEditor.tsx`
- `src/components/careplan/MyPlan.tsx`
- `src/components/clinical/CrisisPanel.tsx`
- `src/components/clinical/DemographicsCard.tsx`
- `src/components/clinical/MarTab.tsx`
- `src/components/clinical/MedReconTab.tsx`
- `src/components/clinical/RecordTabs.tsx`
- `src/components/clinician/WorkspaceDashboard.tsx`
- `src/components/consent/ConsentRecordsPanel.tsx`
- `src/components/consent/FormsToSign.tsx`
- `src/components/coverage/CoverageAtReleasePanel.tsx`
- `src/components/groups/GroupJoinRequestsQueue.tsx`
- `src/components/hie/OutsideRecords.tsx`
- `src/components/identity/PatientMatchingQueue.tsx`
- `src/components/library/ModuleTemplate.tsx`
- `src/components/patient/AdelGreetingCheckIn.tsx`
- `src/components/patient/DailyCheckInSummaryCard.tsx`
- `src/components/patient/HomeDashboard.tsx`
- `src/components/patient/NeedConnect.tsx`
- `src/components/recovery/RecoveryCheckInNote.tsx`
- `src/components/referral/ReferralChasePanel.tsx`
- `src/components/referral/ReferralSubmissionForm.tsx`
- `src/components/reporting/PopulationHealthSection.tsx`
- `src/components/scheduling/VisitActions.tsx`
- `src/components/screeners/CssrsForm.tsx`
- `src/components/tasks/TaskQueueCard.tsx`
- `src/components/voice/AdelVoice.tsx`
- `src/lib/__tests__/monthlyCheckIns.test.ts`
- `src/lib/__tests__/myWorkStartOfDay.test.ts`
- `src/lib/__tests__/outpatientMeds.test.ts`
- `src/lib/__tests__/recoveryStages.test.ts`
- `src/lib/actions/permissionMatrix.ts`
- `src/lib/adelBrief.ts`
- `src/lib/adelBriefCheck.ts`
- `src/lib/adelDrafts.ts`
- `src/lib/adelIntakeScript.ts`
- `src/lib/agenticPrototype.ts`
- `src/lib/asam.ts`
- `src/lib/askAdel.ts`
- `src/lib/caseloadReview.ts`
- `src/lib/chartActions.ts`
- `src/lib/checkInStreak.ts`
- `src/lib/clinicianWorkspace.ts`
- `src/lib/consentForms.ts`
- `src/lib/countyReporting.ts`
- `src/lib/coverageRelease.ts`
- `src/lib/dashboardMetrics.ts`
- `src/lib/ehr.ts`
- `src/lib/escalations.ts`
- `src/lib/i18n.tsx`
- `src/lib/intakeBackgroundCopy.ts`
- `src/lib/intakeVoiceCopy.ts`
- `src/lib/intakeWelcomeCopy.ts`
- `src/lib/myWork.ts`
- `src/lib/navSections.ts`
- `src/lib/noteAutofill.ts`
- `src/lib/noteClock.ts`
- `src/lib/preReleaseTimeline.ts`
- `src/lib/privateNudge.ts`
- `src/lib/recovery.buildingALifeThatWorks.authored.ts`
- `src/lib/recoveryStages.ts`
- `src/lib/reportingPeriods.ts`
- `src/lib/severityRules.ts`
- `src/lib/staffThreads.ts`
- `src/lib/whatWouldHelp.ts`
- `src/routes/admin-claims.tsx`
- `src/routes/admin-coordination.tsx`
- `src/routes/admin-credentialing.tsx`
- `src/routes/admin-kpi-targets.tsx`
- `src/routes/admin-scheduling-rules.tsx`
- `src/routes/admin-vendors.tsx`
- `src/routes/admin.tsx`
- `src/routes/auth.tsx`
- `src/routes/billing.tsx`
- `src/routes/caseload-review.tsx`
- `src/routes/clinician.tsx`
- `src/routes/county-reporting.tsx`
- `src/routes/dashboards.tsx`
- `src/routes/data-exchange.tsx`
- `src/routes/disclosure-log.tsx`
- `src/routes/eligibility-worklist.tsx`
- `src/routes/escalations.tsx`
- `src/routes/my-work.tsx`
- `src/routes/pre-release.tsx`
- `src/routes/referral-queue.tsx`
- `src/routes/reporting.tsx`
- `src/routes/shift-count.tsx`
- `src/routes/team-messages.tsx`
- `src/routes/worklist.tsx`

## Final browser failure causes
- cfProxyMode.spec.ts:96: Rosa T. role option did not appear within the existing 2-second lookup. No role/permission/test change applied.
- consentWorkflow.spec.ts:40: send-intake-packet click waited for navigation until the existing 240-second timeout. No consent behavior/test change applied.
- consentWorkflow.spec.ts:114: browser execution context destroyed during navigation while reading patient id. No test retry/threshold change applied.
- Initial staff preview timeout was caused by the unapproved ES · Draft contract; the proposed switch was rolled back. Final staffContent passed. Initial crossRole role-transition/duplicate-search failures passed in final full run.

Metadata completed for four changed pages lacking social title/description; no new route or public English copy change.

Final changed-file manifest: 111 files (including temporary protected-literal restorations); seven approved assertion texts in six files. No assertion/retry/threshold changes outside that list.
