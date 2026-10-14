# Phase 3 Part A — Safety-only red

## Result
Presentation only; Part B, permissions, routes, workflows, data, test assertions/retries/thresholds, primitive palettes, Draft-policy and KPI wording unchanged.

- Build: harness green (01:05:53 UTC). An intermediate missing StatusChip import in My work was corrected, then both full suites rerun.
- Final units: **307 files / 2,568 tests passed**.
- Final browsers: **78/79 passed**, all specs completed including axe and staff navigation; no staff timeout, so no conditional warm rerun. Earlier complete run: **79/79 passed**.
- Final failure: publicWebsite English test at line 17: strict selector found two “Switch language to English” buttons during initial render. WebsiteLayout was not edited. No test change, retry or threshold adjustment applied; cause evidenced as duplicate rendered controls, not a red-color assertion.
- Settled light contrast: errors 5.85:1; neutral problem-toast text 17.93:1; outline Revoke 13.84:1; simulated chip 6.70:1; simulated banner 6.83:1; safety comparison 5.51:1. Minimum **5.51:1**. Browser-only transitions/animations disabled and 600ms wait.
- Screenshots checked: 1280px staff weekly-check-in error, consent Revoke drawer, county simulated screen, voice guardrail banner and neutral problem toast; 390px patient sign-up error, scrollWidth 390px. Screenshots and measurement scripts live under `/tmp/browser/phase3/`.
- Visual-only consent setup used existing send/sign controls in a temporary browser; revocation was not submitted. “I'm done” was obscured by existing crisis support on mouse click; keyboard activation and the existing Staff: unlock step worked. No unrelated layout fix applied.

## Treatments
Neutral root toasts with attention CircleAlert; shared and inventoried form error text/icon/thicker neutral borders; outline explicit action verbs and untouched confirmation/reason gates; restricted chips/AI modifier; calm simulated/flask presentation and original tested words; owner-relative My work overdue chips; neutral counts. All KEEP safety lines audited against snapshots. Severe allergy remains red in its dedicated safety chip; the generic ChartHeader allergy list follows its CHANGE classification and is neutral.

## Inventory accounting

Original: 305 unique lines / 138 files; overlapping pattern counts unchanged in the read-only inventory. The line-reference parser additionally includes supplementary declarations: 308 references; 239 CHANGE-only, 11 conditional MIXED, 59 KEEP (overlap possible). This is not a replacement for the inventory’s 305-line count. Supplementary declarations and definitions are listed separately in the inventory. Dormant ProtocolsTab excluded. Final remaining-red scan is below; no blanket palette override.

## Actions without a separate confirmation (unchanged)

Five direct action controls: delete frequency (`admin-catalog-governance.tsx`), remove obligation (`ObligationsCard.tsx`), remove toolkit item (`LibraryBrowser.tsx`), delete AI sentence (`ScribeWorkspace.tsx`), deny refill (`AdelDrafts.tsx`, reason required). Also preserved: ASAM dismissal has an inline reason/edit step, and allergy override is a KEEP safety action with a reason gate; neither gains a dialog.

## Every changed file (116)

- `docs/phase3-red-cleanup-report.md`
- `roadmap.md`
- `src/components/CaseloadUploadDialog.tsx`
- `src/components/NotificationBell.tsx`
- `src/components/PostEnrollmentSetupCard.tsx`
- `src/components/ReferralProgressStrip.tsx`
- `src/components/ReferralStatusTimeline.tsx`
- `src/components/ReferralTimelineDrawer.tsx`
- `src/components/TimePicker.tsx`
- `src/components/admin/CaseloadTable.tsx`
- `src/components/admin/CatalogResolutionMetricsCard.tsx`
- `src/components/admin/ContentAdminWorkspace.tsx`
- `src/components/admin/ContentForm.tsx`
- `src/components/admin/StructuredPracticeEditor.tsx`
- `src/components/advocate/AdvocateDesignationPanel.tsx`
- `src/components/advocate/AdvocateSection.tsx`
- `src/components/advocate/AdvocateStatusList.tsx`
- `src/components/advocate/AhcdValidationChecklist.tsx`
- `src/components/agentic/PrototypeChrome.tsx`
- `src/components/billing/PatientBalance.tsx`
- `src/components/billing/RatesPanel.tsx`
- `src/components/careplan/AsamSuggestions.tsx`
- `src/components/careplan/CarePlanEditor.tsx`
- `src/components/chart/AdelDrafts.tsx`
- `src/components/chart/BriefTab.tsx`
- `src/components/chart/ChartExtraSections.tsx`
- `src/components/chart/ChartHeader.tsx`
- `src/components/chart/ChartTabView.tsx`
- `src/components/chart/LabsAndMeasures.tsx`
- `src/components/chart/RestrictedChartGate.tsx`
- `src/components/clinical/AsamPanel.tsx`
- `src/components/clinical/CareEpisodesPanel.tsx`
- `src/components/clinical/ClinicalRecordTabs.tsx`
- `src/components/clinical/DiagnosisPicker.tsx`
- `src/components/clinical/MarTab.tsx`
- `src/components/clinical/MedReconTab.tsx`
- `src/components/clinical/NoteOrdersSection.tsx`
- `src/components/clinical/NoteRevisionPanel.tsx`
- `src/components/clinical/OrderSafetyPanel.tsx`
- `src/components/clinical/OrdersTab.tsx`
- `src/components/clinical/RecordSafetyBadges.tsx`
- `src/components/clinical/RecordTabs.tsx`
- `src/components/clinical/RefillCuresStep.tsx`
- `src/components/clinical/StaffContactsEditor.tsx`
- `src/components/clinical/SupervisionBanner.tsx`
- `src/components/clinical/TemplateForm.tsx`
- `src/components/clinical/refusal/NurseRefusalWorklist.tsx`
- `src/components/clinical/refusal/SignaturePad.tsx`
- `src/components/consent/ConsentFormsPanel.tsx`
- `src/components/consent/ConsentRecordsPanel.tsx`
- `src/components/consent/PatientSignedForms.tsx`
- `src/components/coverage/CoverageAtReleasePanel.tsx`
- `src/components/dashboards/DrillDownDialog.tsx`
- `src/components/documents/DocumentVerifyQueue.tsx`
- `src/components/documents/PatientDocumentsCard.tsx`
- `src/components/escalations/CrisisQueueDetails.tsx`
- `src/components/frontdoor/SignupFlow.tsx`
- `src/components/groups/GroupJoinRequestsQueue.tsx`
- `src/components/inbox/UnsignedNotesQueue.tsx`
- `src/components/intake/BenefitsStep.tsx`
- `src/components/messages/CareMessageThread.tsx`
- `src/components/messages/StaffMessagesTab.tsx`
- `src/components/orders/MedicationDoseSection.tsx`
- `src/components/patient/AdelChat.tsx`
- `src/components/patient/AdelHistoryPanel.tsx`
- `src/components/patient/MyMedicationsCard.tsx`
- `src/components/prerelease/CapacityAuthorityStep.tsx`
- `src/components/prerelease/MatOrderCard.tsx`
- `src/components/prerelease/PreReleaseAppointmentCard.tsx`
- `src/components/prerelease/PreReleaseScreenerDialog.tsx`
- `src/components/prerelease/PreReleaseTimelineCard.tsx`
- `src/components/scheduling/BookVisitDrawer.tsx`
- `src/components/screeners/CssrsForm.tsx`
- `src/components/scribe/ScribeWorkspace.tsx`
- `src/components/signature/SignBlockerList.tsx`
- `src/components/tasks/TaskQueueCard.tsx`
- `src/components/tasks/TaskWorkRow.tsx`
- `src/components/team/TeamThreads.tsx`
- `src/components/ui/form.tsx`
- `src/components/ui/sonner.tsx`
- `src/components/voice/VoiceGuardrailNotice.tsx`
- `src/lib/noteClock.ts`
- `src/routes/__root.tsx`
- `src/routes/admin-catalog-governance.tsx`
- `src/routes/admin-claims.tsx`
- `src/routes/admin-coordination.tsx`
- `src/routes/admin-credentialing.tsx`
- `src/routes/admin-facilities.tsx`
- `src/routes/admin-kpi-targets.tsx`
- `src/routes/admin-permissions.tsx`
- `src/routes/admin-scheduling-rules.tsx`
- `src/routes/admin-supervision.tsx`
- `src/routes/admin-vendors.tsx`
- `src/routes/admin.tsx`
- `src/routes/agentic.chart-review.$patientId.tsx`
- `src/routes/billing.tsx`
- `src/routes/case-manager.tsx`
- `src/routes/caseload-review.tsx`
- `src/routes/clinician-credentials.tsx`
- `src/routes/clinician.tsx`
- `src/routes/consent.tsx`
- `src/routes/cosign-inbox.tsx`
- `src/routes/county-reporting.tsx`
- `src/routes/disclosure-log.tsx`
- `src/routes/dmc-ods-readiness.tsx`
- `src/routes/eligibility-worklist.tsx`
- `src/routes/escalations.tsx`
- `src/routes/group-audit.tsx`
- `src/routes/group-sessions.tsx`
- `src/routes/message-queue.tsx`
- `src/routes/my-work.tsx`
- `src/routes/naloxone.tsx`
- `src/routes/pre-release-import.tsx`
- `src/routes/pre-release.tsx`
- `src/routes/start.other-help.tsx`
- `src/routes/worklist.tsx`

## Every remaining red source line and reason

- `src/components/AppShell.tsx:388` — KEEP crisis/988/safety presentation from inventory (member safety unchanged).
- `src/components/AppShell.tsx:393` — KEEP crisis/988/safety presentation from inventory (member safety unchanged).
- `src/components/AppShell.tsx:395` — KEEP crisis/988/safety presentation from inventory (member safety unchanged).
- `src/components/CarePlanCard.tsx:149` — KEEP existing safety/medication-risk presentation.
- `src/components/CarePlanCard.tsx:172` — KEEP existing safety/medication-risk presentation.
- `src/components/CrisisNotice.tsx:17` — KEEP crisis/988/safety presentation from inventory (member safety unchanged).
- `src/components/CrisisNotice.tsx:21` — KEEP crisis/988/safety presentation from inventory (member safety unchanged).
- `src/components/CrisisNotice.tsx:23` — KEEP crisis/988/safety presentation from inventory (member safety unchanged).
- `src/components/PatientSidebar.tsx:60` — KEEP crisis/988/safety presentation from inventory (member safety unchanged).
- `src/components/UserNavigationDrawer.tsx:94` — KEEP crisis/988/safety presentation from inventory (member safety unchanged).
- `src/components/WebsiteLayout.tsx:72` — KEEP crisis/988/safety presentation from inventory (member safety unchanged).
- `src/components/WebsiteLayout.tsx:74` — KEEP crisis/988/safety presentation from inventory (member safety unchanged).
- `src/components/billing/BillingStatusSummary.tsx:16` — KEEP denied-claim/KPI exception.
- `src/components/chart/BriefTab.tsx:160` — MIXED: C-SSRS high only; generic score bands changed.
- `src/components/chart/ChartHeader.tsx:182` — MIXED: existing C-SSRS/MAT continuity predicate only; generic critical neutral.
- `src/components/clinical/AssistedSignupCrisisButton.tsx:46` — KEEP crisis/988/safety presentation from inventory (member safety unchanged).
- `src/components/clinical/CrisisPanel.tsx:88` — KEEP crisis/988/safety presentation from inventory (member safety unchanged).
- `src/components/clinical/CrisisPanel.tsx:192` — KEEP crisis/988/safety presentation from inventory (member safety unchanged).
- `src/components/clinical/CrisisPanel.tsx:218` — KEEP crisis/988/safety presentation from inventory (member safety unchanged).
- `src/components/clinical/CrisisPanel.tsx:375` — KEEP crisis/988/safety presentation from inventory (member safety unchanged).
- `src/components/clinical/CrisisPanel.tsx:394` — KEEP crisis/988/safety presentation from inventory (member safety unchanged).
- `src/components/clinical/ProtocolsTab.tsx:150` — Excluded dormant facility surface.
- `src/components/clinical/OrderSafetyPanel.tsx:62` — KEEP real allergy conflict and reason-gated safety override.
- `src/components/clinical/OrderSafetyPanel.tsx:63` — KEEP real allergy conflict and reason-gated safety override.
- `src/components/clinical/OrderSafetyPanel.tsx:79` — KEEP real allergy conflict and reason-gated safety override.
- `src/components/clinical/RecordTabs.tsx:656` — KEEP crisis/988/safety presentation from inventory (member safety unchanged).
- `src/components/clinical/RecordTabs.tsx:671` — KEEP crisis/988/safety presentation from inventory (member safety unchanged).
- `src/components/clinical/RecordTabs.tsx:839` — KEEP crisis/988/safety presentation from inventory (member safety unchanged).
- `src/components/clinical/RecordTabs.tsx:3150` — KEEP crisis/988/safety presentation from inventory (member safety unchanged).
- `src/components/clinical/RecordTabs.tsx:3152` — KEEP crisis/988/safety presentation from inventory (member safety unchanged).
- `src/components/clinician/WorkspaceDashboard.tsx:106` — KEEP crisis/988/safety presentation from inventory (member safety unchanged).
- `src/components/dashboards/KpiVsTargetSection.tsx:36` — KEEP explicit KPI Met/Close/Below exception.
- `src/components/escalations/CrisisQueueDetails.tsx:68` — KEEP crisis escalation/safety; SDOH mixed branches neutral.
- `src/components/escalations/CrisisQueueDetails.tsx:131` — KEEP crisis escalation/safety; SDOH mixed branches neutral.
- `src/components/escalations/CrisisQueueDetails.tsx:139` — KEEP crisis escalation/safety; SDOH mixed branches neutral.
- `src/components/escalations/CrisisQueueDetails.tsx:189` — KEEP crisis escalation/safety; SDOH mixed branches neutral.
- `src/components/intake/AdelGuidedIntake.tsx:230` — KEEP crisis/988/safety presentation from inventory (member safety unchanged).
- `src/components/intake/AdelGuidedIntake.tsx:237` — KEEP crisis/988/safety presentation from inventory (member safety unchanged).
- `src/components/patient/CravingMoreHelp.tsx:93` — KEEP crisis/988/safety presentation from inventory (member safety unchanged).
- `src/components/patient/GetHelpNowModal.tsx:127` — KEEP crisis/988/safety presentation from inventory (member safety unchanged).
- `src/components/patient/GetHelpNowModal.tsx:155` — KEEP crisis/988/safety presentation from inventory (member safety unchanged).
- `src/components/patient/PatientMoreSheet.tsx:71` — KEEP crisis/988/safety presentation from inventory (member safety unchanged).
- `src/components/patient/PatientPage.tsx:78` — KEEP crisis/988/safety presentation from inventory (member safety unchanged).
- `src/components/patient/Slim988Bar.tsx:15` — KEEP crisis/988/safety presentation from inventory (member safety unchanged).
- `src/components/patient/AdelChat.tsx:338` — KEEP crisis/988/safety presentation from inventory (member safety unchanged).
- `src/components/patient/AdelChat.tsx:343` — KEEP crisis/988/safety presentation from inventory (member safety unchanged).
- `src/components/patient/AdelChat.tsx:402` — KEEP crisis/988/safety presentation from inventory (member safety unchanged).
- `src/components/patient/AdelChat.tsx:404` — KEEP crisis/988/safety presentation from inventory (member safety unchanged).
- `src/components/ui/alert.tsx:13` — KEEP primitive/token definition; palettes unchanged.
- `src/components/ui/badge.tsx:15` — KEEP primitive/token definition; palettes unchanged.
- `src/components/ui/button.tsx:13` — KEEP primitive/token definition; palettes unchanged.
- `src/components/ui/button.tsx:22` — KEEP primitive/token definition; palettes unchanged.
- `src/components/ui/button.tsx:23` — KEEP primitive/token definition; palettes unchanged.
- `src/components/voice/AdelVoice.tsx:55` — KEEP crisis/988/safety presentation from inventory (member safety unchanged).
- `src/routes/assisted-signup.tsx:50` — KEEP crisis/988/safety presentation from inventory (member safety unchanged).
- `src/routes/intake.tsx:1121` — KEEP crisis/988/safety presentation from inventory (member safety unchanged).
- `src/routes/intake.tsx:1123` — KEEP crisis/988/safety presentation from inventory (member safety unchanged).
- `src/routes/intake.tsx:1125` — KEEP crisis/988/safety presentation from inventory (member safety unchanged).
- `src/routes/intake.tsx:1135` — KEEP crisis/988/safety presentation from inventory (member safety unchanged).
- `src/routes/safety-plan.tsx:68` — KEEP crisis/988/safety presentation from inventory (member safety unchanged).
- `src/routes/admin-claims.tsx:63` — KEEP denied-claim inventory exception; original combined renderer untouched.
- `src/routes/admin-claims.tsx:471` — KEEP denied-claim inventory exception; original combined renderer untouched.
- `src/routes/billing.tsx:95` — KEEP denied-claim/KPI exception.
- `src/routes/billing.tsx:638` — KEEP denied-claim/KPI exception.
- `src/routes/case-manager.tsx:429` — KEEP crisis/988/safety presentation from inventory (member safety unchanged).
- `src/routes/case-manager.tsx:524` — KEEP crisis/988/safety presentation from inventory (member safety unchanged).
- `src/routes/clinician.tsx:1253` — KEEP crisis/988/safety presentation from inventory (member safety unchanged).
- `src/lib/noteClock.ts:116` — MIXED: crisis note only; standard overdue neutral.
