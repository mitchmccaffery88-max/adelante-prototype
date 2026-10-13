# Phase 3 — read-only red inventory

Count unit: matched source lines, not rendered instances. Patterns overlap; conditional branches are classified separately. Application and test files remain unedited. Static definition/dead-map locations are included, not claimed as visible UI.

**305 unique lines in 138 source files.**

## Destructive variants — 55 lines

**CHANGE non-safety — 43 lines**
- `src/components/ReferralTimelineDrawer.tsx:470`
- `src/components/careplan/AsamSuggestions.tsx:99, 124`
- `src/components/chart/AdelDrafts.tsx:180`
- `src/components/clinical/ClinicalRecordTabs.tsx:95`
- `src/components/clinical/MarTab.tsx:179, 803`
- `src/components/clinical/NoteRevisionPanel.tsx:119, 245`
- `src/components/clinical/OrdersTab.tsx:129, 337, 338, 640, 641, 747`
- `src/components/clinical/RecordTabs.tsx:811`
- `src/components/clinical/refusal/NurseRefusalWorklist.tsx:67`
- `src/components/consent/ConsentFormsPanel.tsx:129`
- `src/components/consent/PatientSignedForms.tsx:32`
- `src/components/coverage/CoverageAtReleasePanel.tsx:48`
- `src/components/documents/DocumentVerifyQueue.tsx:165`
- `src/components/documents/PatientDocumentsCard.tsx:40`
- `src/components/groups/GroupJoinRequestsQueue.tsx:111`
- `src/components/orders/MedicationDoseSection.tsx:201, 205`
- `src/components/prerelease/CapacityAuthorityStep.tsx:92`
- `src/components/prerelease/PreReleaseScreenerDialog.tsx:111`
- `src/components/prerelease/PreReleaseTimelineCard.tsx:22`
- `src/components/team/TeamThreads.tsx:128`
- `src/routes/admin-coordination.tsx:297`
- `src/routes/admin-facilities.tsx:589`
- `src/routes/admin-kpi-targets.tsx:406`
- `src/routes/admin-permissions.tsx:215`
- `src/routes/admin-scheduling-rules.tsx:479`
- `src/routes/caseload-review.tsx:140`
- `src/routes/cosign-inbox.tsx:445, 505`
- `src/routes/county-reporting.tsx:114`
- `src/routes/disclosure-log.tsx:104`
- `src/routes/group-audit.tsx:216`
- `src/routes/pre-release-import.tsx:264`
- `src/routes/pre-release.tsx:599, 677`

**KEEP safety — 8 lines**
- `src/components/clinical/AssistedSignupCrisisButton.tsx:46`
- `src/components/clinical/CrisisPanel.tsx:192, 218`
- `src/components/clinical/RecordTabs.tsx:670, 3166`
- `src/components/intake/AdelGuidedIntake.tsx:237`
- `src/components/voice/AdelVoice.tsx:55`
- `src/routes/clinician.tsx:1253`

**MIXED: KEEP explicit allergy safety override with existing reason gate. — 1 lines**
- `src/components/clinical/OrderSafetyPanel.tsx:78`

**MIXED: KEEP crisis-only variant branch. — 1 lines**
- `src/components/clinician/WorkspaceDashboard.tsx:106`

**MIXED: KEEP crisis-only badge branch. — 1 lines**
- `src/components/clinician/WorkspaceDashboard.tsx:125`

**MIXED: KEEP crisis action branch; existing other branch is outline. — 1 lines**
- `src/routes/escalations.tsx:131`

## Destructive text — 201 lines

**KEEP safety — 19 lines**
- `src/components/AppShell.tsx:393, 395`
- `src/components/CarePlanCard.tsx:149, 172`
- `src/components/CrisisNotice.tsx:21, 23`
- `src/components/WebsiteLayout.tsx:74`
- `src/components/clinical/CrisisPanel.tsx:88`
- `src/components/clinical/RecordTabs.tsx:838, 3155`
- `src/components/escalations/CrisisQueueDetails.tsx:131`
- `src/components/patient/AdelChat.tsx:342`
- `src/components/patient/CravingMoreHelp.tsx:93`
- `src/routes/assisted-signup.tsx:50`
- `src/routes/case-manager.tsx:428, 523`
- `src/routes/intake.tsx:1123, 1125, 1135`

**CHANGE non-safety — 168 lines**
- `src/components/CaseloadUploadDialog.tsx:327, 387`
- `src/components/NotificationBell.tsx:91`
- `src/components/PostEnrollmentSetupCard.tsx:123`
- `src/components/ReferralProgressStrip.tsx:80`
- `src/components/ReferralStatusTimeline.tsx:219`
- `src/components/TimePicker.tsx:86`
- `src/components/admin/CaseloadTable.tsx:280, 306`
- `src/components/admin/CatalogResolutionMetricsCard.tsx:103`
- `src/components/admin/ContentAdminWorkspace.tsx:336, 538, 567`
- `src/components/admin/ContentForm.tsx:260`
- `src/components/admin/StructuredPracticeEditor.tsx:88`
- `src/components/advocate/AdvocateDesignationPanel.tsx:87`
- `src/components/advocate/AdvocateSection.tsx:125`
- `src/components/advocate/AdvocateStatusList.tsx:32`
- `src/components/advocate/AhcdValidationChecklist.tsx:28`
- `src/components/agentic/PrototypeChrome.tsx:141`
- `src/components/billing/PatientBalance.tsx:50`
- `src/components/billing/RatesPanel.tsx:49, 215`
- `src/components/careplan/CarePlanEditor.tsx:89`
- `src/components/chart/ChartExtraSections.tsx:47`
- `src/components/chart/ChartHeader.tsx:150, 155`
- `src/components/chart/ChartTabView.tsx:54`
- `src/components/chart/LabsAndMeasures.tsx:238, 283, 285`
- `src/components/chart/RestrictedChartGate.tsx:40`
- `src/components/clinical/AsamPanel.tsx:128, 175`
- `src/components/clinical/CareEpisodesPanel.tsx:194`
- `src/components/clinical/ClinicalRecordTabs.tsx:251, 283, 404, 546, 580, 588, 590`
- `src/components/clinical/DiagnosisPicker.tsx:177, 197`
- `src/components/clinical/MedReconTab.tsx:255`
- `src/components/clinical/NoteOrdersSection.tsx:198`
- `src/components/clinical/OrderSafetyPanel.tsx:52, 88`
- `src/components/clinical/OrdersTab.tsx:687, 840`
- `src/components/clinical/ProtocolsTab.tsx:150`
- `src/components/clinical/RecordSafetyBadges.tsx:91`
- `src/components/clinical/RecordTabs.tsx:401, 968, 1193, 1670, 1889, 2491, 2998, 3087, 3110`
- `src/components/clinical/RefillCuresStep.tsx:26`
- `src/components/clinical/StaffContactsEditor.tsx:54, 56`
- `src/components/clinical/SupervisionBanner.tsx:24`
- `src/components/clinical/TemplateForm.tsx:133, 170`
- `src/components/clinical/refusal/SignaturePad.tsx:161, 174`
- `src/components/consent/ConsentFormsPanel.tsx:58`
- `src/components/consent/ConsentRecordsPanel.tsx:260, 299`
- `src/components/dashboards/DrillDownDialog.tsx:94`
- `src/components/documents/PatientDocumentsCard.tsx:86`
- `src/components/frontdoor/SignupFlow.tsx:274, 466`
- `src/components/groups/GroupJoinRequestsQueue.tsx:89`
- `src/components/inbox/UnsignedNotesQueue.tsx:23`
- `src/components/intake/BenefitsStep.tsx:108`
- `src/components/messages/CareMessageThread.tsx:74`
- `src/components/messages/StaffMessagesTab.tsx:72`
- `src/components/orders/MedicationDoseSection.tsx:413`
- `src/components/patient/AdelChat.tsx:416`
- `src/components/patient/AdelHistoryPanel.tsx:88, 97`
- `src/components/patient/MyMedicationsCard.tsx:50`
- `src/components/prerelease/CapacityAuthorityStep.tsx:162`
- `src/components/prerelease/MatOrderCard.tsx:150`
- `src/components/prerelease/PreReleaseAppointmentCard.tsx:101`
- `src/components/prerelease/PreReleaseTimelineCard.tsx:60`
- `src/components/scheduling/BookVisitDrawer.tsx:193`
- `src/components/screeners/CssrsForm.tsx:96`
- `src/components/scribe/ScribeWorkspace.tsx:94, 158, 234, 294, 295`
- `src/components/signature/SignBlockerList.tsx:18`
- `src/components/tasks/TaskQueueCard.tsx:82`
- `src/components/tasks/TaskWorkRow.tsx:42`
- `src/components/ui/form.tsx:95, 153`
- `src/lib/noteClock.ts:117`
- `src/routes/admin-catalog-governance.tsx:275`
- `src/routes/admin-claims.tsx:473`
- `src/routes/admin-credentialing.tsx:60, 61, 175, 425, 530`
- `src/routes/admin-supervision.tsx:129`
- `src/routes/admin-vendors.tsx:205, 232`
- `src/routes/admin.tsx:443, 546, 595, 625`
- `src/routes/agentic.chart-review.$patientId.tsx:151`
- `src/routes/billing.tsx:388, 455, 582, 602`
- `src/routes/case-manager.tsx:418, 422, 515, 516, 638, 682, 881`
- `src/routes/clinician-credentials.tsx:55, 56, 243`
- `src/routes/clinician.tsx:100, 272, 506, 515, 873`
- `src/routes/consent.tsx:195, 234, 273`
- `src/routes/cosign-inbox.tsx:309`
- `src/routes/county-reporting.tsx:135`
- `src/routes/dmc-ods-readiness.tsx:99`
- `src/routes/eligibility-worklist.tsx:65, 68, 326`
- `src/routes/escalations.tsx:94`
- `src/routes/group-sessions.tsx:855, 865`
- `src/routes/message-queue.tsx:88`
- `src/routes/my-work.tsx:142, 459, 511, 533, 567, 596, 642, 682`
- `src/routes/pre-release-import.tsx:253, 305`
- `src/routes/pre-release.tsx:183, 607, 646`
- `src/routes/start.other-help.tsx:110, 150, 164`
- `src/routes/worklist.tsx:75, 396`

**KEEP denied-claim exception (conditional branch only where applicable) — 5 lines**
- `src/components/billing/BillingStatusSummary.tsx:16`
- `src/routes/admin-claims.tsx:63, 471`
- `src/routes/billing.tsx:95, 638`

**MIXED: KEEP C-SSRS high only; CHANGE generic score/drug-level bands to attention. — 1 lines**
- `src/components/chart/BriefTab.tsx:26`

**MIXED: KEEP current C-SSRS high and authoritative MOUD urgency; CHANGE item-9, score changes and generic critical alerts. — 1 lines**
- `src/components/chart/ChartHeader.tsx:182`

**MIXED: KEEP genuine allergy-conflict warning; not generic missing-allergy validation. — 1 lines**
- `src/components/clinical/OrderSafetyPanel.tsx:62`

**MIXED: KEEP crisis-only variant branch. — 1 lines**
- `src/components/clinician/WorkspaceDashboard.tsx:106`

**MIXED: KEEP crisis-only heading; CHANGE shared urgent-social-needs heading. — 1 lines**
- `src/components/escalations/CrisisQueueDetails.tsx:68`

**DEFINITION: retain safety primitive; migrate non-safety callers — 3 lines**
- `src/components/ui/alert.tsx:13`
- `src/components/ui/badge.tsx:15`
- `src/components/ui/button.tsx:13`

**MIXED: KEEP crisis-clock branch. — 1 lines**
- `src/lib/noteClock.ts:116`

## Destructive fills — 110 lines

**KEEP safety — 14 lines**
- `src/components/AppShell.tsx:388`
- `src/components/CarePlanCard.tsx:149`
- `src/components/CrisisNotice.tsx:17`
- `src/components/clinical/CrisisPanel.tsx:88, 375`
- `src/components/clinical/RecordTabs.tsx:655, 3153`
- `src/components/intake/AdelGuidedIntake.tsx:230`
- `src/components/patient/AdelChat.tsx:337`
- `src/routes/case-manager.tsx:428, 523`
- `src/routes/intake.tsx:1121, 1135`
- `src/routes/safety-plan.tsx:68`

**CHANGE non-safety — 88 lines**
- `src/components/CaseloadUploadDialog.tsx:327, 387`
- `src/components/NotificationBell.tsx:91`
- `src/components/ReferralStatusTimeline.tsx:219`
- `src/components/admin/CaseloadTable.tsx:306`
- `src/components/agentic/PrototypeChrome.tsx:134`
- `src/components/billing/RatesPanel.tsx:49`
- `src/components/chart/ChartHeader.tsx:149`
- `src/components/chart/ChartTabView.tsx:54`
- `src/components/clinical/CareEpisodesPanel.tsx:194`
- `src/components/clinical/ClinicalRecordTabs.tsx:251, 580, 587`
- `src/components/clinical/DiagnosisPicker.tsx:177, 197`
- `src/components/clinical/MedReconTab.tsx:255`
- `src/components/clinical/NoteOrdersSection.tsx:198`
- `src/components/clinical/OrderSafetyPanel.tsx:52`
- `src/components/clinical/OrdersTab.tsx:840`
- `src/components/clinical/RecordSafetyBadges.tsx:91`
- `src/components/clinical/RecordTabs.tsx:1669, 1889, 2998, 3087, 3110`
- `src/components/clinical/SupervisionBanner.tsx:24`
- `src/components/consent/ConsentFormsPanel.tsx:58`
- `src/components/consent/ConsentRecordsPanel.tsx:244, 260`
- `src/components/frontdoor/SignupFlow.tsx:314`
- `src/components/groups/GroupJoinRequestsQueue.tsx:89`
- `src/components/inbox/UnsignedNotesQueue.tsx:23`
- `src/components/messages/StaffMessagesTab.tsx:72`
- `src/components/patient/MyMedicationsCard.tsx:50`
- `src/components/prerelease/CapacityAuthorityStep.tsx:162`
- `src/components/prerelease/MatOrderCard.tsx:150`
- `src/components/prerelease/PreReleaseAppointmentCard.tsx:101`
- `src/components/prerelease/PreReleaseTimelineCard.tsx:60`
- `src/components/scheduling/BookVisitDrawer.tsx:192`
- `src/components/scribe/ScribeWorkspace.tsx:93, 234, 294, 295`
- `src/components/signature/SignBlockerList.tsx:18`
- `src/components/tasks/TaskQueueCard.tsx:82`
- `src/components/tasks/TaskWorkRow.tsx:42, 98`
- `src/components/voice/VoiceGuardrailNotice.tsx:4`
- `src/lib/noteClock.ts:117`
- `src/routes/admin-credentialing.tsx:60, 61, 529`
- `src/routes/admin-supervision.tsx:129`
- `src/routes/admin-vendors.tsx:205, 232`
- `src/routes/admin.tsx:443, 546, 595, 625`
- `src/routes/billing.tsx:388, 572, 582, 602`
- `src/routes/case-manager.tsx:638, 881`
- `src/routes/clinician-credentials.tsx:55, 56`
- `src/routes/clinician.tsx:100, 272, 506, 515`
- `src/routes/consent.tsx:195, 234`
- `src/routes/cosign-inbox.tsx:309`
- `src/routes/eligibility-worklist.tsx:65, 68`
- `src/routes/my-work.tsx:142, 459, 511, 533, 567, 596, 642, 682`
- `src/routes/pre-release.tsx:183, 607`
- `src/routes/start.other-help.tsx:108`
- `src/routes/worklist.tsx:75`

**KEEP denied-claim exception (conditional branch only where applicable) — 3 lines**
- `src/components/billing/BillingStatusSummary.tsx:16`
- `src/routes/admin-claims.tsx:63`
- `src/routes/billing.tsx:95`

**MIXED: KEEP C-SSRS high only; CHANGE generic score/drug-level bands to attention. — 1 lines**
- `src/components/chart/BriefTab.tsx:26`

**MIXED: KEEP genuine allergy-conflict safety banner; CHANGE any generic blocked-state styling. — 1 lines**
- `src/components/clinical/OrderSafetyPanel.tsx:61`

**DEFINITION: retain safety primitive; migrate non-safety callers — 2 lines**
- `src/components/ui/badge.tsx:15`
- `src/components/ui/button.tsx:13`

**MIXED: KEEP crisis-clock branch. — 1 lines**
- `src/lib/noteClock.ts:116`

## Destructive borders/rings — 62 lines

**KEEP safety — 15 lines**
- `src/components/AppShell.tsx:388`
- `src/components/CarePlanCard.tsx:149, 172`
- `src/components/CrisisNotice.tsx:17`
- `src/components/WebsiteLayout.tsx:72`
- `src/components/clinical/CrisisPanel.tsx:375, 394`
- `src/components/clinical/RecordTabs.tsx:655, 3153`
- `src/components/escalations/CrisisQueueDetails.tsx:139`
- `src/components/intake/AdelGuidedIntake.tsx:230`
- `src/components/patient/AdelChat.tsx:337`
- `src/components/patient/CravingMoreHelp.tsx:93`
- `src/routes/intake.tsx:1121`
- `src/routes/safety-plan.tsx:68`

**CHANGE non-safety — 43 lines**
- `src/components/ReferralStatusTimeline.tsx:219`
- `src/components/TimePicker.tsx:46`
- `src/components/agentic/PrototypeChrome.tsx:134`
- `src/components/chart/BriefTab.tsx:108`
- `src/components/chart/ChartHeader.tsx:149`
- `src/components/clinical/CareEpisodesPanel.tsx:194`
- `src/components/clinical/ClinicalRecordTabs.tsx:587`
- `src/components/clinical/DiagnosisPicker.tsx:177`
- `src/components/clinical/MedReconTab.tsx:255`
- `src/components/clinical/NoteOrdersSection.tsx:198`
- `src/components/clinical/NoteRevisionPanel.tsx:112`
- `src/components/clinical/OrderSafetyPanel.tsx:52`
- `src/components/clinical/OrdersTab.tsx:840`
- `src/components/clinical/RecordTabs.tsx:399, 1669, 3087, 3110`
- `src/components/clinical/SupervisionBanner.tsx:24`
- `src/components/clinical/TemplateForm.tsx:177`
- `src/components/clinical/refusal/SignaturePad.tsx:115`
- `src/components/consent/ConsentRecordsPanel.tsx:244`
- `src/components/frontdoor/SignupFlow.tsx:314`
- `src/components/groups/GroupJoinRequestsQueue.tsx:89`
- `src/components/messages/StaffMessagesTab.tsx:72`
- `src/components/prerelease/CapacityAuthorityStep.tsx:162`
- `src/components/prerelease/MatOrderCard.tsx:150`
- `src/components/prerelease/PreReleaseAppointmentCard.tsx:101`
- `src/components/prerelease/PreReleaseTimelineCard.tsx:60`
- `src/components/scheduling/BookVisitDrawer.tsx:192`
- `src/components/scribe/ScribeWorkspace.tsx:93`
- `src/components/signature/SignBlockerList.tsx:18`
- `src/components/tasks/TaskWorkRow.tsx:98`
- `src/components/voice/VoiceGuardrailNotice.tsx:4`
- `src/routes/admin-credentialing.tsx:529`
- `src/routes/admin-supervision.tsx:129`
- `src/routes/billing.tsx:388`
- `src/routes/case-manager.tsx:680`
- `src/routes/clinician.tsx:506`
- `src/routes/cosign-inbox.tsx:548`
- `src/routes/my-work.tsx:533`
- `src/routes/pre-release-import.tsx:253`
- `src/routes/pre-release.tsx:607`
- `src/routes/start.other-help.tsx:108`

**MIXED: KEEP C-SSRS high only; CHANGE generic score/drug-level bands to attention. — 1 lines**
- `src/components/chart/BriefTab.tsx:26`

**MIXED: KEEP genuine allergy-conflict safety banner; CHANGE any generic blocked-state styling. — 1 lines**
- `src/components/clinical/OrderSafetyPanel.tsx:61`

**MIXED: KEEP crisis retriggers; CHANGE any non-safety SDOH branch. — 1 lines**
- `src/components/escalations/CrisisQueueDetails.tsx:189`

**DEFINITION: retain safety primitive; migrate non-safety callers — 1 lines**
- `src/components/ui/alert.tsx:13`

## Raw red / rose utilities — 1 lines

**KEEP KPI exception; no KPI wording/state changes — 1 lines**
- `src/components/dashboards/KpiVsTargetSection.tsx:36`

## Crisis tokens — 13 lines

**KEEP safety — 9 lines**
- `src/components/PatientSidebar.tsx:60`
- `src/components/UserNavigationDrawer.tsx:94`
- `src/components/patient/AdelChat.tsx:401, 403`
- `src/components/patient/GetHelpNowModal.tsx:127, 155`
- `src/components/patient/PatientMoreSheet.tsx:71`
- `src/components/patient/PatientPage.tsx:78`
- `src/components/patient/Slim988Bar.tsx:15`

**DEFINITION: retain safety primitive; migrate non-safety callers — 2 lines**
- `src/components/ui/button.tsx:22, 23`

**CHANGE non-safety — 2 lines**
- `src/routes/naloxone.tsx:88, 89`

## Rich-color toaster — 1 lines

**CHANGE non-safety — 1 lines**
- `src/routes/__root.tsx:242`

## Indirect variants and direct urgent tokens (additional references)
- CHANGE non-safety: `src/components/clinical/OrdersTab.tsx:141` discontinued variant; `src/routes/caseload-review.tsx:53` overdue variant. These are mapping declarations, not extra rendered counts.
- KEEP denied-claim exception: `src/routes/billing.tsx:287` KPI tone caller; `:638` renderer included above.
- CHANGE non-safety: `src/routes/eligibility-worklist.tsx:136,139` count tone callers; `:326` renderer included above.
- KEEP safety: `src/components/AppShell.tsx:169`, `src/components/patient/CrisisHeader.tsx:39` Get help now; `src/components/clinical/RecordSafetyBadges.tsx:71` severe-allergy branch.
- DEFINITION KEEP: `src/components/ui/status-chip.tsx:12` urgent palette. Audit every caller by clinical condition, not token name.
- CSS definitions KEEP: `src/styles.css:50–51,93–94,178–179,210–211,267–268,299–300`. Crisis/urgent aliases stay raspberry; never redefine destructive globally. Website crisis-height variables are geometry, not color. No raw red/rose CSS declarations found.

## Treatment notes
- Validation/blocked-state/change sites: attention text with CircleAlert, thicker neutral border, preserved aria-invalid/description/live-region behavior. No red field borders.
- Operational overdue/Unassigned: owner-relative yourturn/team, existing words and real-date captions. Counts retain values and use neutral text; never invent a wait duration for an aggregate or missing date.
- Delete/revoke/write-off/deactivate/dismiss/deny: outline secondary treatment with explicit existing verb and preserved confirmation/reason controls. Refill denial is not a denied-claim exception.
- Part 2/access restrictions: restricted chip with the existing word and unchanged masking; AI labels: AI draft modifier, not a red warning. Signing/validation issues remain attention.
- Generic high BP/BMI/lab results, score bands, critical-alert metadata and stat priority do not establish safety by themselves. Change to attention unless an existing explicit safety predicate qualifies. Severe allergy, high C-SSRS and crisis prompts keep raspberry.
- Simulated/Prototype/Not built yet: simulated chip; Coming later only for genuinely unbuilt capability. Whole-screen calm simulated banner retains specific guardrail wording. Preserve literal Simulated for external sync and tested messages.

## Destructive actions without a separate confirmation today
- `src/routes/admin-catalog-governance.tsx:159–170,275`: delete frequency executes directly (in-use rejection is not confirmation).
- `src/components/reentry/ObligationsCard.tsx:116`: remove obligation directly.
- `src/components/library/LibraryBrowser.tsx:323`: remove toolkit item directly.
- `src/components/scribe/ScribeWorkspace.tsx:309`: delete AI sentence directly.
- `src/components/chart/AdelDrafts.tsx:180`: deny refill has a reason field but no separate confirmation.
- `src/components/careplan/AsamSuggestions.tsx:99`: dismissal has an inline reason/edit step, no separate confirmation.
- `src/components/clinical/OrderSafetyPanel.tsx:78`: safety override requires reason but no separate confirmation; KEEP safety, do not introduce workflow changes.
Do not add dialogs in this color-only batch. Existing consent revocation, chart removal, note voiding, order/MAR changes and Adel-history deletion retain their current prompts/dialogs. Write-off controls retain whatever existing review/confirmation applies; no new write-off workflow.

## Test impact
- No direct red/destructive/richColors assertions found in searched unit/browser suites. `MedicationDoseSection.test.tsx:54` asserts border-amber-500, not red; preserve it.
- Exact words protected: `e2e/staffContent.spec.ts:15` Read aloud (Simulated voice); `e2e/adelHistory.spec.ts:63` Shared from Adel (summary, Simulated); `playerEngagement.test.tsx:47`; `adelHistory.test.ts:81`.
- Simulation audit/confirmation invariants: `batchAFoundations.test.ts:48`, `mergeFinishSimulated.test.ts:160`, `part2SimulatedHardening.test.ts:122,131,143`. Replacing all Simulated labels with Coming later would break contracts; do not do that.
- Preserve adminContent Verified wording, consentWorkflow form-status-* hooks, cfProxyMode attribution, groupBillingStatus, RefusalRiskTextRecord wording, KPI states and counts. No assertion/retry/threshold edits.
- Full validation is deferred until build approval. No tests or contrast runs were executed for this read-only review.
