# Phase 5b — Member and public screen Spanish

## Scope and accounting
Presentation only; local screen dictionaries use draft tú Spanish. No machine translation service, clinical rule, permission, route, workflow, stored data, test assertion, retry or threshold changes. Public English copy remains unchanged. Clinical/legal intake strings were retained in English; authored lessons/journeys remain for phase 7. Shared CarePlanCard/RecoveryStagePanel preserve audience/actor language boundaries. Website and member shells own their existing single draft notice; duplicate signup verification notice removed. Shared modal Close labels translate through the existing language context.

- 608 previously empty screen keys drafted, including 47 crisis-adjacent priority keys. No Spanish approval claimed.
- 72 staff-only keys dropped from the source export via reviewed source/branch manifest. Already-localized false positives are also excluded.
- 908 remaining ordinary empty-Spanish keys: authored library/lesson/journey content only.
- 1611 empty controlled review keys (1804 controlled rows total), unchanged for clinical/legal review.
- 79 changed files including documentation and the manifest.

## Before-edit re-check
cfProxyMode.spec.ts and consentWorkflow.spec.ts both ran twice before 5b edits: 4/4 passed in each run (2.1 minutes and 1.2 minutes). Their three 5a failures are recorded as timing flakes. No send-intake-packet app correction or test edit was needed.

## Validation
Pending final suite and mobile results; the initial full unit run passed 308 files / 2,570 tests. Final units and all 79 browser tests are being collected to completion. Build is green. An initial mobile check only set browser storage after hydration and still rendered English; that run is not counted as Spanish verification.

## Changed-file manifest
- `AGENTS.md`
- `docs/phase5b-report.md`
- `docs/spanish-gaps.md`
- `docs/spanish-review.csv`
- `roadmap.md`
- `scripts/export-spanish-review.cjs`
- `scripts/spanish-review-exclusions.json`
- `src/components/CarePlanCard.tsx`
- `src/components/CrisisNotice.tsx`
- `src/components/InstallAppButton.tsx`
- `src/components/PatientHome.tsx`
- `src/components/PatientProfileDialog.tsx`
- `src/components/advocate/AdvocateAppointmentsPanel.tsx`
- `src/components/advocate/AdvocateDesignationPanel.tsx`
- `src/components/advocate/AdvocateDocumentChecklist.tsx`
- `src/components/advocate/AdvocateIdentityBanner.tsx`
- `src/components/advocate/AdvocateInviteForm.tsx`
- `src/components/advocate/AdvocateMessagesPanel.tsx`
- `src/components/advocate/AdvocateNextStepsPanel.tsx`
- `src/components/advocate/AdvocateNoPatientPrompt.tsx`
- `src/components/advocate/AdvocatePoAwarenessPanel.tsx`
- `src/components/advocate/AdvocateViewParts.tsx`
- `src/components/advocate/AdvocateWorkspace.tsx`
- `src/components/documents/DocumentUploadForm.tsx`
- `src/components/frontdoor/QuestionCard.tsx`
- `src/components/frontdoor/SignupFlow.tsx`
- `src/components/identity/SignupVerificationHelp.tsx`
- `src/components/intake/AdelGuidedIntake.tsx`
- `src/components/library/ExercisePlayer.tsx`
- `src/components/library/LibraryBrowser.tsx`
- `src/components/patient/AdelChat.tsx`
- `src/components/patient/CheckInPage.tsx`
- `src/components/patient/CravingFlow.tsx`
- `src/components/patient/DailyCheckInCard.tsx`
- `src/components/patient/HomeDashboard.tsx`
- `src/components/patient/MyMedicationsCard.tsx`
- `src/components/patient/NotifyCareTeamCard.tsx`
- `src/components/patient/PostIntakeResources.tsx`
- `src/components/patient/ProfilePanels.tsx`
- `src/components/patient/RecoveryDateCard.tsx`
- `src/components/patient/RefillRunwayCard.tsx`
- `src/components/patient/SlipSupportFlow.tsx`
- `src/components/patient/ToolkitPage.tsx`
- `src/components/patient/WeeklyRecap.tsx`
- `src/components/recovery/RecoveryModuleBrowser.tsx`
- `src/components/recovery/RecoveryStagePanel.tsx`
- `src/components/reentry/CommunityResourceCenter.tsx`
- `src/components/reentry/ObligationsCard.tsx`
- `src/components/reentry/ReentryDayZeroModule.tsx`
- `src/components/reentry/ResourceCard.tsx`
- `src/components/reentry/ResourceDetail.tsx`
- `src/components/reentry/SavedResources.tsx`
- `src/components/referral/ReferralSubmissionForm.tsx`
- `src/components/scheduling/VisitActions.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/sheet.tsx`
- `src/components/voice/AdelVoice.tsx`
- `src/routes/advocate.appointments.tsx`
- `src/routes/advocate.coordination.tsx`
- `src/routes/advocate.documents.tsx`
- `src/routes/advocate.index.tsx`
- `src/routes/advocate.library.tsx`
- `src/routes/advocate.messages.tsx`
- `src/routes/advocate.my-documents.tsx`
- `src/routes/advocate.my-profile.tsx`
- `src/routes/advocate.next.tsx`
- `src/routes/advocate.resources.$categoryId.$orgId.tsx`
- `src/routes/advocate.support-for-myself.tsx`
- `src/routes/advocate.tsx`
- `src/routes/auth.tsx`
- `src/routes/crisis.tsx`
- `src/routes/documents.tsx`
- `src/routes/intake.tsx`
- `src/routes/medications.tsx`
- `src/routes/naloxone.tsx`
- `src/routes/profile.tsx`
- `src/routes/safety-plan.tsx`
- `src/routes/start.other-help.tsx`
- `src/routes/start.reconnect.tsx`
