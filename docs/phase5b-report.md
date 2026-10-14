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
- Harness build green. Initial and final full units: 308 files / 2,570 tests passed; another final run after the six corrupted Spanish words were corrected is recorded below.
- Complete browser suite: **74/79 passed (11.7 minutes)**, every spec completed, including all three websitePolish axe/Back-to-top checks and all 22 staffNav checks. No assertions/retries/thresholds changed.
- Failures: adelBrief.spec.ts:46 measured 1,536ms against the existing 1,500ms limit (performance threshold, not a timeout; no rerun allowed by the timeout-only rule). cfProxyMode.spec.ts:75 hit the existing 30s timeout. advocateOnboardingActive.spec.ts:40 and group2Pathways.spec.ts:90 in Spanish wait for English-only `Add another contact`, now correctly displayed `Añadir otro contacto`; publicWebsite.spec.ts:70 in Spanish waits for English-only `About you`, now `Sobre ti`. These three frozen-selector conflicts are reported, not hidden with English accessible labels or test edits. Mitch must approve those specific test selector changes for a green browser suite.
- One permitted warm rerun of cfProxyMode.spec.ts: **0/2 passed**; both exceeded 30s at page.evaluate entering pre-release. Initial full run was 1/2. Before-edit warm runs were 2/2 twice. This remains a timing/navigation diagnostic, not claimed fixed; no permissions/workflows changed.
- All 15 requested screens in active Spanish returned document scrollWidth **390** at a 390px viewport: Home, My care, Intake, Sign up, Auth, Check-in, Craving, Crisis, Medications, Profile, Advocate home, Advocate appointments, Referral, Slip and Weekly recap. Screenshots reviewed in `/tmp/browser/5b/`; connected advocate home/appointments use a Demo-labeled invitation created and claimed through real store functions (temporary browser state only). The first storage-after-hydration run rendered English and was discarded.
- Screenshots reveal remaining computed/dynamic English (for example advocate summaries and weekly recap sentences) which the original literal-only gap inventory does not capture. This is not certification of complete runtime Spanish; those expressions need a separate editorial inventory. Controlled consent/authorization content intentionally remains as it was.
- Duplicate useI18n calls are unconditional context reads, not a hook-order violation. No functional language-isolation defect found. Local dictionaries decode JSX entities to preserve displayed English (not change it). Shared dialog/sheet edits are included in the final file manifest.


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
