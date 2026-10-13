# Phase 2b — Staff/Admin StatusChip Review

Read-only review: no application, style, data, route, permission or test changes. All proposed chips use the existing record/display label and `lang="en"`. Counts, primitives, member views and explicit exceptions remain unchanged.

**Knowledge limitation:** the knowledge lookup returned architecture rules, not the referenced design-system status tables. Mappings below follow Mitch’s explicit rules; ambiguous domain statuses are identified rather than claimed to match an unavailable table.

## 1. Batch 2b-1 — Care Work

Paths below are exact; `C/` means `src/components/`, `R/` means `src/routes/`.

**Ownership rule throughout:** actionable waiting = `yourturn` for the existing assignee/eligible role, `team` for other viewers. Use existing ownership/claim/supervisor fields only; retain the record word and show the existing owner beside it. Never substitute invented names or change routing.

| Exact files | Status sites and proposed state mapping |
|---|---|
| `C/clinical/RecordTabs.tsx` | Notes: Draft/Declined → yourturn; Awaiting cosign → yourturn for actual cosigner, team otherwise; Signed/Cosigned → done. Preserve these current words, not “Draft — sign” or “Changes requested.” Handoffs: pending_review → viewer-relative yourturn/team; acknowledged → done. SDOH: identified/not_completed → yourturn for responsible role, team otherwise; sent/accepted/scheduled → team; completed → done. Refill/order-related review statuses in this large file need the table check below. |
| `R/cosign-inbox.tsx` | Awaiting cosign/Awaiting LPHA cosign → viewer-relative yourturn/team using existing cosign ownership; Needs a supervisor/not billable → yourturn. AI-draft marker remains a modifier, not completed work. |
| `C/clinical/AsamPanel.tsx` | Draft/Co-signature declined — back to draft → author’s yourturn, others team; Awaiting LPHA co-signature → cosigner’s yourturn, others team; Signed → done. Preserve current labels and Part 2 gates. |
| `C/clinical/NoteRevisionPanel.tsx` | Voided → closed; Corrected → done; Void pending approval → approver’s yourturn, others team. Late entry is provenance, not lifecycle: unchanged. |
| `C/clinical/OrdersTab.tsx`, `C/CarePlanCard.tsx` (staff medication branch) | Draft → signing clinician’s yourturn, others team; signed/Active → done; Held → upnext; Discontinued → closed; Completed → done. Keep actual words “Held” and “Discontinued.” Clinical attribute badges (STAT, PRN, controlled, strength, manual dose) are not lifecycle states. |
| `C/clinical/MedReconTab.tsx` | Completed reconciliation → done; unfinished reconciliation → responsible reviewer’s yourturn, otherwise team. Continue/Modify/Stop are clinical decisions: leave unchanged pending table confirmation. |
| `C/nursing/NursingSection.tsx` | Awaiting nurse review → nurse’s yourturn, others team; Verified by/Given by → done; Returned by → ordering/reviewing owner’s yourturn, otherwise team; dose cosign pending → cosigner’s yourturn, others team. Preserve Given in clinic and Ordered by metadata. Outpatient review is not assumed to be facility-gated. |
| `C/chart/LabsAndMeasures.tsx` | Result pending → team; Resulted/Completed → done; Waiting on patient → team; Missed questionnaire → responsible staff yourturn, otherwise team. Placeholder labels unchanged. |
| `C/chart/ChartDocumentsList.tsx`, `C/documents/DocumentVerifyQueue.tsx` | Verified → done; Rejected → yourturn for correction owner; Pending review → reviewer’s yourturn, others team. File type/uploader metadata unchanged. |
| `C/scheduling/VisitActions.tsx` | Staff-only: Checked in → treating clinician’s yourturn, others team; Attended → done; No-show → yourturn; Cancelled/Late cancel/Rescheduled → closed. Preserve current No-show word. Existing member LateCancelBadge branch untouched. |
| `R/group-sessions.tsx`, `C/groups/GroupJoinRequestsQueue.tsx` | Cancelled/Moved → closed; Attendance taken/Notes complete → done; Attendance not taken/notes owed → responsible staff yourturn, otherwise team (numeric notes count unchanged). Join pending → approver’s yourturn, others team; approved → done; declined → closed. Delivery sent → done; failed/missing configuration → yourturn. Group billing classifications stay unchanged. |
| `C/consent/ConsentFormsPanel.tsx` | Sent/Viewed → team (patient signature outstanding); Signed → done; Declined → closed; Expired → sending staff yourturn, otherwise team. Preserve `form-status-*` and exact STATUS_LABEL words. |
| `C/ReferralTimelineDrawer.tsx`, `C/admin/ReferralTrackerCard.tsx` | Submitted → intake owner’s yourturn, others team; Contacted → team; Enrolled → done; Declined → closed. Call needed/stale → responsible staff yourturn, others team. Open task → existing task owner’s yourturn, others team; Task closed → done. Preserve count badges. |
| `C/chart/BriefTab.tsx`, `C/clinical/CareEpisodesPanel.tsx`, `R/clinical-referrals.tsx` | HLOC drafted → author’s yourturn, others team; sent/accepted → team with existing destination/owner; admitted → done; declined/closed → closed. Active episode → done; Discharged → closed. Readmission remains a modifier. Urgent/emergent referral priority requires safety-table confirmation; do not make every operational urgency red. |
| `C/inbox/InboxActionQueue.tsx`, `C/inbox/AdvocateReviewQueue.tsx`, `C/inbox/CommunityInquiryQueue.tsx` | Unclaimed/Pending review/New → eligible viewer’s yourturn, otherwise team; claimed/Owner → viewer-relative yourturn/team; Contacted → team; Done/Resolved/Task made → done. Assigned by/owner-role metadata not blindly converted into status. Existing crisis-marked inquiry remains urgent. |
| `C/tasks/TaskWorkRow.tsx`, `R/worklist.tsx` | Pending/In progress → actual owner or role yourturn, others team; Completed → done; Cancelled → closed; Missed → yourturn; Upcoming/snoozed → upnext. Priority STAT/urgent is not automatically a safety state. Summary count badges in TaskQueueCard unchanged. |
| `R/admin-coordination.tsx`, `R/case-manager.tsx` | Active → done; Frozen/Unassigned → responsible coordinator’s yourturn, others team. Coverage Active → done; Suspended/Assistance → yourturn; Other needs table confirmation. Attended → done; Missed/contact overdue → responsible staff yourturn. ECM and caseload counts unchanged. |
| `C/careplan/CarePlanEditor.tsx` | Goal met → done; closed → closed; active → owner-relative yourturn/team. Plan review due/pathway changed/flag review → reviewer’s yourturn, others team; future review → upnext. Auto-added remains provenance. |
| `C/clinical/CrisisPanel.tsx`, `C/escalations/CrisisQueueDetails.tsx`, `R/escalations.tsx` | Active crisis/Open and crisis critical/urgent severity → urgent; Resolved → done. Noncrisis new/acknowledged → owner-relative yourturn/team; handed_off → team; overdue → yourturn, not red unless still safety-urgent. Claimed by uses existing claimant. Preserve retrigger counts and Draft policy/classification notices. |
| `C/chart/ChartHeader.tsx`, `C/chart/CoverageExtras.tsx`, `C/chart/SeverityFlagsPanel.tsx`, `C/clinical/ClinicalRecordTabs.tsx` | Medi-Cal active/eligible → done; needs check/missing custody time → yourturn; possible duplicate — in review → reviewer’s yourturn, others team. Worsening/Severity change → yourturn; Improving → done. Problem Active → done; Resolved → closed. Severe allergies and critical patient alerts unchanged. |
| `C/hie/OutsideRecords.tsx` | Accepted follow-up/medication → done; dismissed/ignored → closed; awaiting review → reviewer’s yourturn, otherwise team; withheld for consent/role → restricted. Keep existing Simulated/HIE/Draft banners and counts intact. |
| `C/clinical/refusal/RefusalRiskTextRecord.tsx` | Reviewed → done; clinical-role restriction → restricted. Draft translation, signed wording/version and language metadata unchanged. |

### Items not safely table-certified

- Refill review variants and “Other” coverage; HLOC urgent/emergent priority; C-SSRS risk bands (`C/screeners/CssrsStaffControl.tsx`); historical severity flags; pre-release continuity/MAT statuses in shared `CarePlanCard`.
- Facility-only `C/clinical/ProtocolsTab.tsx`: active/completed/stopped and round Pending/Upcoming/Done/Cancelled are real statuses, but exclude dormant in-facility UI from an outpatient build unless explicitly requested.
- Episode summary strings (`C/clinical/EpisodeHeaderBadge.tsx`), pathway chips, verification provenance, Readmission, clinical decisions and request types are classifications/modifiers, not necessarily workflow statuses. Do not guess.
- `ConsentRecordsPanel.tsx` has status in a combined text heading, not a badge; `R/consent-audit.tsx` badges are event categories, not consent status. Leave prose alone rather than turning every status mention into a chip.

## 2. Batch 2b-2 — Operations File List and Counts

Counts are **render sites**, not number of records or enum values; conditional variants at one position count once. Includes the existing content lifecycle table cell; excludes ordinary status prose. Names use the prefixes above.

| Area | Files | Sites |
|---|---|---:|
| Claims | `R/admin-claims.tsx`; `C/ops/OpsActionLauncher.tsx` | 4 (denied branches unchanged) |
| Coverage | `R/eligibility-worklist.tsx`; `C/coverage/CoverageAtReleasePanel.tsx`; `C/coverage/CoveragePlansCard.tsx` | 4 |
| Credentialing | `R/admin-credentialing.tsx` | 4 |
| Content/forms | `C/admin/ContentBrowse.tsx`; `C/admin/ContentInventoryTable.tsx`; `C/admin/ResourceVerificationQueue.tsx`; `C/admin/ClinicalContentReviewCard.tsx`; `C/admin/RiskTextReviewPanel.tsx`; `C/admin/ConsentFormLibrary.tsx` | 7 |
| County reporting | `R/county-reporting.tsx` | 1 |
| Data exchange | `R/data-exchange.tsx` | 2 |
| Admin/vendor/supervision/staff | `R/admin-vendors.tsx`; `R/admin-supervision.tsx`; `R/admin-staff.tsx` | 4 |
| Compliance | `R/quality-compliance.tsx` | 1 |

**Total: 27 sites.** Clinical/reading-grade tags, verification-source provenance, KPI Met/Close/Below target, numeric billing/count badges, Simulated/Prototype/Not built yet and Draft policy/configuration labels are excluded. Risk-text Draft remains untouched; Approved is included. Public/member LibraryBrowser is not silently swept into admin scope.

## 3. Tests and Contract Risks

Confirmed badge-text/markup contracts:

- `e2e/consentWorkflow.spec.ts:41,60,61,125,135`: staff Sent/Signed/Declined. Safe only with exact labels and `form-status-*` retained.
- `e2e/adminContent.spec.ts:39–41`: Verified and “Verified by Cathy ·”. Preserve exact badge label and separate provenance. The Not verified assertion at line 29 is a filter control, not a badge.
- `e2e/cfProxyMode.spec.ts:81–83,98–99`: proxy-blocked/proxy-mode text, visibility and count. Keep proxy context badges unchanged; these are not lifecycle statuses.
- `src/components/__tests__/groupBillingStatus.test.tsx:14–22,42–46`: H0005/H2014/Non-billable and data-billable. Leave billing classification panel unchanged.
- `src/components/clinical/refusal/__tests__/RefusalRiskTextRecord.test.tsx:46–47,64,89`: Risk text version, Draft translation, Reviewed, clinical-role restriction. Preserve words and disclaimer.
- `src/lib/__tests__/badgeInline.test.tsx:8`: exact single-span Badge markup; safe because Badge primitive stays unchanged.

Shared-boundary regression contracts:

- `e2e/group2Pathways.spec.ts:127,134–135`; `e2e/advocateOnboardingActive.spec.ts:76,88,126`: raw advocate-form `data-status=waiting/signed` and advocate status words. **Would break if its shared paragraph were replaced directly**: StatusChip writes semantic `data-status`. Leave it and member rendering untouched.
- `src/components/orders/__tests__/MedicationDoseSection.test.tsx:55` pins amber input border, not a status badge. `SupervisionBanner.test.tsx` pins billability text; neither is part of the chip conversion.

No direct staff badge class/color assertions were found beyond the primitive markup contract. Domain-status unit assertions are store tests, not display contracts. The later full suite/browser run remains required; no assertions will be changed to accommodate migration.

## 4. Shared Components — Member Isolation

- `CarePlanCard`: change only `audience !== "patient"`; pre-release helper must branch on audience too. Patient goals/allergies remain unchanged.
- `RecoveryStagePanel`: preserve actor/member branch and existing member sunrise treatment; no blanket shared-selector edits.
- `LateCancelBadge`: change only default staff branch; member opt-in unchanged.
- `AdvocateConsentStatus`: preserve shared status paragraph and its domain-valued attributes; no migration of member status list.
- Staff content previews use the actual member player/library components: do not restyle them just because mounted in admin.
- `FormsToSign`, `PatientConsentStatusCard`, patient quick checks/medication chips and all advocate workspace chips remain untouched. Do not change `.patient-theme`, Badge, Button or StatusChip globally.

## 5. Recommended Differences and Build Checks

1. Obtain the referenced mapping tables before table-certifying ambiguous statuses; no invented clinical meanings.
2. Preserve current labels exactly, including Draft, Declined, Held, Discontinued and No-show. Only state changes; existing owners appear beside words.
3. Convert badge-like status positions, not all prose, taxonomy or event categories. Restricted chips must never introduce hidden Part 2 teaser rows.
4. Real waiting captions only from an existing task/status timestamp; omit if no reliable start date. No fake waits or policy changes.
5. Later build: full units, then every browser spec including axe to completion; collect all failures. Settled light-mode contrast with transitions disabled, dense-table/long-label checks, and exact changed-file report. No test, permission or workflow changes.
