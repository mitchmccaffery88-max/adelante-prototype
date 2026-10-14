# Phase 5 — Copy, Voice and Spanish

Review only; application and tests unchanged. Preserve Mitch’s English website copy verbatim, clinical/legal sign-off, Part 2 boundaries and phase-6 emotion assets.

**Audit limitation:** independent reviews returned contradictory counts and included identifiers/staff-only components. The confirmed findings below are useful, but the missing-Spanish and icon inventories are not yet exhaustive. Complete those inventories before approving a build file list; do not use the unreliable “32 strings / 62 screens” estimates.

References: `C/` = src/components, `L/` = src/lib, `R/` = src/routes. Counts below are source text literals, not rendered instances.

## 1. Voice batches

### Submit — 22 ordinary-copy literals / 21 lines

C/ReferralTimelineDrawer.tsx:283; admin/ContentAdminWorkspace.tsx:540; ops/OpsActionLauncher.tsx:242; ops/OpsWorkspace.tsx:59,101; referral/ReferralSubmissionForm.tsx:524; screeners/CssrsForm.tsx:112; L/chartActions.ts:153 (EN/ES),1179; contentPublishing.ts:352; countyReporting.ts:617,707; coverageRelease.ts:73; ehr.ts:10364; R/admin-claims.tsx:471; billing.tsx:683; county-reporting.tsx:102; intake.tsx:1980,2041; referral-queue.tsx:76,98.

Replace by outcome: “Send referral”, patient “Send to my team”, staff “Save answers”, “Send content for review”, “Send claim”, “Send county report (Simulated)”, “Send application / reactivation”, “Ready to send”. Commands only; method/action IDs and stored submitted states stay.

Related Submitted display copy: C/ReferralStatusTimeline.tsx:67; ReferralTimelineDrawer.tsx:98,158; referral/ReferralSubmissionForm.tsx:231,235,242; admin/ContentAdminWorkspace.tsx:679; admin/ReferralTrackerCard.tsx:136,203; billing/BillingStatusSummary.tsx:14; L/askAdel.ts:463; coverageRelease.ts:22; countyReporting.ts:681; i18n.tsx:232; R/admin-claims.tsx:349; reporting.tsx:598. Use “Sent” where factually true; simulation must say nothing was actually sent. Never rewrite historical records/audits.

### Overdue — 72 non-enum text candidates, plus one JSX count

Components: C/DemoStateSwitcher.tsx:133; clinical/CrisisPanel.tsx:106; clinical/RecordTabs.tsx:3302,3349; coverage/CoverageAtReleasePanel.tsx:48,65; referral/ReferralChasePanel.tsx:56. Additional count: tasks/TaskQueueCard.tsx:83.

Libraries: L/adelBrief.ts:164; adelBriefCheck.ts:154; adelDrafts.ts:181,196; agenticPrototype.ts:206,242,259,264; asam.ts:246; askAdel.ts:209,442,477,485; caseloadReview.ts:23; clinicianWorkspace.ts:115,134,171,234; coverageWorklist.ts:53,62; dashboardMetrics.ts:48; ehr.ts:6516,21369,21377; escalations.ts:305; myWork.ts:291; navSections.ts:349,516; noteClock.ts:89,100; referralAging.ts:22; reportingPeriods.ts:66; sdohAging.ts:36.

Routes: R/caseload-review.tsx:236; dashboards.tsx:60,156,162,166; data-exchange.tsx:122,145; eligibility-worklist.tsx:50,55,139,183; escalations.tsx:46,48,56,95,111; my-work.tsx:65,495,512,528,542,627,654,673; reporting.tsx:360,406,705,733,759,784,808; worklist.tsx:254.

Rows: owner-relative Your turn / With others, with “Waiting N days” only from authoritative waiting-start dates. Aggregate/filter labels cannot honestly say “Waiting N days”; use neutral “Follow-up needed”, retaining values. Deadline-age (`overdueByMs`, days past due) is not total wait: never relabel that number. Crisis remains urgent. Draft-policy definitions (coverageWorklist:53, referralAging:22, sdohAging:36), signed narrative and historical audit text remain excluded. Notification presentation stays neutral; no stored notification/data rewrite.

### No-show — 17 copy literals

C/DemoStateSwitcher.tsx:78,133; clinical/RecordTabs.tsx:2138; clinician/WorkspaceDashboard.tsx:24,96,106; scheduling/VisitActions.tsx:78,138,139; L/chartActions.ts:1419; ehr.ts:515,9550,9738,9739; i18n.tsx:93,174; library.ported.ts:2183.

Staff “Missed visit” / “Mark missed visit”; patient “Let’s find a new time”. Keep no_show data, methods, billing rules and `visit-no-show` hook (:77). Authored lesson feedback :2183 (“treated as avoidance”) needs person-first editorial review, not an automatic word substitution.

### Dismiss — 21 copy literals / 20 lines

C/PatientHome.tsx:97; careplan/AsamSuggestions.tsx:98,99 (two),106; careplan/CarePlanEditor.tsx:163,164,167; clinical/RecordTabs.tsx:591,594,2239; hie/OutsideRecords.tsx:65,75,76,79; identity/PatientMatchingQueue.tsx:76,77; L/asamCarePlan.ts:289; hie.ts:244; structuredCarePlan.ts:544; R/clinician.tsx:963.

Temporary close: “Not now”; weekly suggestion: “Not this week”. Permanent draft rejection needs “Don’t use this draft” / “Draft not used”: “Not now” must not imply it returns. Keep existing reason gates and behavior.

### Person-first / streaks

Exact-word searches found no visible Action required, non-compliant/noncompliant, offender or person-label addict. “Understanding My Addiction” and “Medications for addiction treatment” are not person-label violations; do not rename them by substring. Technical failed delivery/request is not failed about a person. Authored passages still require editorial classification.

Streak/member-narrative targets: C/patient/HomeDashboard.tsx:621,622; patient/DailyCheckInSummaryCard.tsx:74; patient/AdelGreetingCheckIn.tsx:43,56; L/adelBrief.ts:197; adelBriefCheck.ts:179; privateNudge.ts:105,113,121; recoveryStages.ts:167,170; library.ported.ts:2392,2404,2415 — 15 literals. Staff weekly “of 7”: R/caseload-review.tsx:135,137; weekly AI fact: L/weeklyRecap.ts:150.

Member display: “4 check-ins this month” / “4 registros este mes”, deduplicating real dated dose/quick/mood check-ins in facility timezone; zero has no broken/reset streak. Read-only calculation, no new data. Preserve internal streak selection/IDs and weekly report/AI windows. Staff monitoring can say “4 check-in days this week” without denominator; do not rename weekly data monthly. Generic “a few days running” is not a scored streak.

### Symbols

Syntax scan: 75 candidates, including emotions/prose/technical strings, **not 75 icon violations**. Confirmed icon/status candidates: C/AssignClinicianButton.tsx:118; DemoStateSwitcher.tsx:445; ReferralProgressStrip.tsx:63 (two),70,75,80,85; consent/FormsToSign.tsx:95; voice/AdelVoice.tsx:58; UserNavigationDrawer.tsx:60; clinician/WorkspaceDashboard.tsx:106; L/i18n.tsx:245,246,659,660; R/admin-credentialing.tsx:601; auth.tsx:238; admin-claims.tsx:480,481.

Use Check, Flag, Volume2, X, ArrowRight plus words. Arrow/history candidates include C/CarePlanCard.tsx:467; admin/ContentAudit.tsx:18; careplan/CarePlanEditor.tsx:322; clinical/RecordTabs.tsx:528,1882; consent/ConsentRecordsPanel.tsx:284; L/i18n.tsx:215,629; R/admin-coordination.tsx:206; disclosure-log.tsx:98; reporting.tsx:648,767,768,840,845. Use “to” for history/time relations. Keep punctuation, mathematical multiplication and keyboard-key references; emotion assets wait for phase 6. Finish every-arrow/emoji classification before build.

## 2. Spanish

### Confirmed ordinary formal-address conversion sites

- C/patient/AdelGreetingCheckIn.tsx:51,53,54,56,60,111,187,192,193: “¿Cómo te sientes hoy?”, “Solo tú ves esto”, “Pregúntale…”, “Cámbialo… envía”, “Escribe…”.
- C/careplan/MyPlan.tsx:55,67,68,73; patient/NeedConnect.tsx:29,30,33; recovery/RecoveryCheckInNote.tsx:23,25,27,28: tu/te/contigo/quieres.
- L/intakeWelcomeCopy.ts:19,20,22,24,26,51,55,56,58; intakeVoiceCopy.ts:46,47,48,49,52,53,54 (two),57,58,60,61,63,64,66,67,69: léeme/busca/cambia/escribe/toca/cuéntanos/elige/revisa.
- L/adelIntakeScript.ts:71,74,81,83,90,142,153,163,171,202,242,272,299,317; intakeBackgroundCopy.ts:40; whatWouldHelp.ts:137,138,142,143,146,147,148,149.
- L/consentForms.ts:27,28 notification wrappers: “Tienes…” / “Abre…”, separate from legal form bodies.

Do not replace third-person su (advocate contact :43, counselor calendar), or subjunctives “que lo revise contigo” / “te avise”. No global search-replace.

**Exclude / list for sign-off:** consentForms.ts:132 onward uses English legal-body placeholders with draft ES suffixes; consent/FormsToSign.tsx:16 signatures, ConsentWithdrawSheet.tsx:31,36, SharedWithCard.tsx:18 and advocate legal authority descriptions remain counsel-controlled. cssrs.ts:20 approval=false; :33–38 await official Columbia ES. screeners.ts has English source questions; English textVerified does not prove approved Spanish; AUDIT :167, DAST :235, retired PCL :355 are unverified. safetyPlan.ts:37, safetyContent.ts:34 and crisisCopy.ts:16–19 remain pending clinical review; refusal.ts:68–74,167 ES risk text remains draft. Intake consent/sensitive instructions and validated needs questions stay excluded. No approval flag changes.

### Missing localization: candidate scope, not an exhaustive string count

Confirmed English-only copy includes PatientHome.tsx:85–88 install prompt; DailyCheckInSummaryCard headings/body/buttons; AdvocateAppointmentsPanel headings/empty state/RSVP; HomeDashboard.tsx:338 chooses English recommendation title/body.

Candidate line counts from the broader scan: HomeDashboard 18; DailyCheckInSummaryCard 8; CravingFlow 11; ToolkitPage 7; WeeklyRecap/AdelChat 8; SlipSupportFlow 9; SignupFlow 28; AdvocateWorkspace 21; advocate.my-profile 10; LibraryBrowser/ExercisePlayer 9; start.reconnect/start.other-help/referral 14. **These are candidate lines, not verified missing-string totals**; remove existing bilingual branches, clinical/legal text and staff-only consumers, then enumerate exact keys/file:line before implementation.

Also review shared voice ARIA (AdelVoice.tsx:42,48), shared Close/pagination/carousel labels, public ReferralSubmissionForm ordinary labels/errors and real-store reason labels displayed to members. Do not translate patient-authored data or mutate stores. StaffAdvocatesTab/AHCD validation are not member screens merely because of their directory.

Lovable drafts ordinary missing Spanish in tú, without a translation service. Existing AppShell.tsx:346 notice covers member drafts; WebsiteLayout owns public draft notice. Standalone entry/CMS previews need one local notice if no shell notice exists. Clinical/legal notices are separate, never collapsed into ordinary translation review.

## 3. Review export — technical proposal

Development-only script → docs/spanish-review.csv; exactly `key,english,spanish,screen,status`.

Collect merged dictionaries, domain/local COPY pairs, authored ES overrides and publication metadata. Stable namespaced keys; preserve placeholders in template/function strings; empty Spanish gaps marked draft. Map every member/public consumer; exclude staff-only text and all patient records/messages. Include controlled source text unchanged for reviewers, not drafted. Approved only with explicit ES approval, never English textVerified. CSV escaping, spreadsheet-formula protection and deterministic ordering; report unresolved dynamic keys. No import, approval write, server endpoint or publication change.

Current organization: i18n.tsx merges website/player/recovery/benefits dictionaries and local COPY modules use the same language; useRecoveryText falls back to English. Draft provenance differs: member/public notices, RECOVERY_ES_REVIEW=false, CMS esStatus, template esReviewed, refusal reviewed flags. Preserve those distinctions.

## 4. Staff language

Remove staff/admin header EN/ES in AppShell.tsx:188–210; keep members/public. Hiding buttons alone is insufficient: I18nProvider:870–938 adopts persisted language. Supply non-persistent English using existing surface classification, including html lang=en, without calling setLang or writing preferences.

ContentPreviewLanguage:946–956 / RealContentPreview.tsx:22–30 stay local; use “Preview in Spanish” switch. Preserve patient-directed outreach language (chart/AdelDrafts.tsx:225–230) and clinical template output (RecordTabs.tsx:2579,2835,3032): output language is not staff-interface language.

## 5. Tests — no assertion changes proposed

Confirmed conflicts if corresponding source copy changes:
- e2e/continuity.spec.ts:30 — “1 overdue reactivation”.
- L/__tests__/myWorkStartOfDay.test.ts:10 — “3d overdue”.
- L/__tests__/outpatientMeds.test.ts:10,16 — overdue literal/regex.
- L/__tests__/recoveryStages.test.ts:111 — “You've checked in 7 days in a row”.
- C/__tests__/goalStatusAudit.test.tsx:76 — literal arrow in status history.
- e2e/adminContent.spec.ts:18 — resource link with arrow.

Conditional: advocateOnboardingActive.spec.ts:56 and group2Pathways.spec.ts:109 support Finish/Terminar, not Send to my team; publicWebsite.spec.ts:133,138 already accept Send referral. weeklyRecap.test.ts:87 pins “1 of 7” in AI grounding; preserving grounding avoids conflict.

Unchanged: advocateOnboardingActive:85,86 legal signature labels; group2Pathways:135 “Esperando su registro” is third-person advocate signup; consentWorkflow:47,55 counts completed forms, not streaks. Existing documents/public tú wording, Simulated phrases, clinical/template/risk-text contracts and enums remain.

This verified list is not yet an exhaustive every-key test matrix. Finish it against the accepted localization inventory. Do not promise green tests while changing pinned words with assertions frozen; report those failures unless Mitch approves specific lines.

## 6. Recommendations / later validation

Finish exact localization/icon reachability before build; prefer display adapters over persisted-status/audit edits. Monthly member totals must not change weekly clinical reporting or AI grounding. Clinical/legal approval gaps remain a review backlog.

Later: full units, then every browser spec including axe to completion; report all failures together. No assertion/retry/threshold changes without specific approval. Check every changed member screen at 390px in Spanish for no horizontal scroll. Report every changed file. No validation suites run during this read-only review.