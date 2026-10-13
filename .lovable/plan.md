# Phase 2b — Staff/Admin StatusChip Review

Read-only review: no application, style, data, route, permission or test changes. All proposed chips use the existing record/display label and `lang="en"`. Counts, primitives, member views and explicit exceptions remain unchanged.

**Knowledge limitation:** lookup returned architecture rules, not status tables. Mappings follow Mitch’s explicit rules; ambiguous statuses need table confirmation.

## 1. Batch 2b-1 — Care Work

Paths below are exact; `C/` means `src/components/`, `R/` means `src/routes/`.

**Ownership:** yourturn for existing assignee/eligible role; team for others. Preserve record word; name actual owner beside it. No invented names or routing changes.

| Exact files | Status sites and proposed state mapping |
|---|---|
| `C/clinical/RecordTabs.tsx` | Notes: Draft/Declined → yourturn; Awaiting cosign → yourturn for actual cosigner, team otherwise; Signed/Cosigned → done. Handoffs: pending_review → viewer-relative yourturn/team; acknowledged → done. SDOH: identified/not_completed → yourturn for responsible role, team otherwise; sent/accepted/scheduled → team; completed → done. Refill variants unconfirmed. |
| `R/cosign-inbox.tsx` | Awaiting cosign/Awaiting LPHA cosign → viewer-relative yourturn/team using existing cosign ownership; Needs a supervisor/not billable → yourturn. AI-draft stays a modifier. |
| `C/clinical/AsamPanel.tsx` | Draft/Co-signature declined — back to draft → author’s yourturn, others team; Awaiting LPHA co-signature → cosigner’s yourturn, others team; Signed → done.  |
| `C/clinical/NoteRevisionPanel.tsx` | Voided → closed; Corrected → done; Void pending approval → approver’s yourturn, others team. Late entry unchanged. |
| `C/clinical/OrdersTab.tsx`, `C/CarePlanCard.tsx` (staff medication branch) | Draft → signing clinician’s yourturn, others team; signed/Active → done; Held → upnext; Discontinued → closed; Completed → done. Attributes unchanged. |
| `C/clinical/MedReconTab.tsx` | Completed reconciliation → done; unfinished reconciliation → responsible reviewer’s yourturn, otherwise team. Continue/Modify/Stop are clinical decisions: leave unchanged pending table confirmation. |
| `C/nursing/NursingSection.tsx` | Awaiting nurse review → nurse’s yourturn, others team; Verified by/Given by → done; Returned by → ordering/reviewing owner’s yourturn, otherwise team; dose cosign pending → cosigner’s yourturn, others team. Metadata unchanged; outpatient review ungated. |
| `C/chart/LabsAndMeasures.tsx` | Result pending → team; Resulted/Completed → done; Waiting on patient → team; Missed questionnaire → responsible staff yourturn, otherwise team. Placeholder labels unchanged. |
| `C/chart/ChartDocumentsList.tsx`, `C/documents/DocumentVerifyQueue.tsx` | Verified → done; Rejected → yourturn for correction owner; Pending review → reviewer’s yourturn, others team.  |
| `C/scheduling/VisitActions.tsx` | Staff-only: Checked in → treating clinician’s yourturn, others team; Attended → done; No-show → yourturn; Cancelled/Late cancel/Rescheduled → closed.  |
| `R/group-sessions.tsx`, `C/groups/GroupJoinRequestsQueue.tsx` | Cancelled/Moved → closed; Attendance taken/Notes complete → done; Attendance not taken/notes owed → responsible staff yourturn, otherwise team (numeric notes count unchanged). Join pending → approver’s yourturn, others team; approved → done; declined → closed. Delivery sent → done; failed/missing configuration → yourturn. Group billing classifications stay unchanged. |
| `C/consent/ConsentFormsPanel.tsx` | Sent/Viewed → team (patient signature outstanding); Signed → done; Declined → closed; Expired → sending staff yourturn, otherwise team.  |
| `C/ReferralTimelineDrawer.tsx`, `C/admin/ReferralTrackerCard.tsx` | Submitted → intake owner’s yourturn, others team; Contacted → team; Enrolled → done; Declined → closed. Call needed/stale → responsible staff yourturn, others team. Open task → existing task owner’s yourturn, others team; Task closed → done.  |
| `C/chart/BriefTab.tsx`, `C/clinical/CareEpisodesPanel.tsx`, `R/clinical-referrals.tsx` | HLOC drafted → author’s yourturn, others team; sent/accepted → team with existing destination/owner; admitted → done; declined/closed → closed. Active episode → done; Discharged → closed. Readmission remains a modifier. Urgent/emergent referral priority requires safety-table confirmation; do not make every operational urgency red. |
| `C/inbox/InboxActionQueue.tsx`, `C/inbox/AdvocateReviewQueue.tsx`, `C/inbox/CommunityInquiryQueue.tsx` | Unclaimed/Pending review/New → eligible viewer’s yourturn, otherwise team; claimed/Owner → viewer-relative yourturn/team; Contacted → team; Done/Resolved/Task made → done. Metadata unchanged. Existing crisis-marked inquiry remains urgent. |
| `C/tasks/TaskWorkRow.tsx`, `R/worklist.tsx` | Pending/In progress → actual owner or role yourturn, others team; Completed → done; Cancelled → closed; Missed → yourturn; Upcoming/snoozed → upnext. Priority STAT/urgent is not automatically a safety state.  |
| `R/admin-coordination.tsx`, `R/case-manager.tsx` | Active → done; Frozen/Unassigned → responsible coordinator’s yourturn, others team. Coverage Active → done; Suspended/Assistance → yourturn; Other needs table confirmation. Attended → done; Missed/contact overdue → responsible staff yourturn. Crisis → urgent; counts unchanged. |
| `C/careplan/CarePlanEditor.tsx` | Goal met → done; closed → closed; active → owner-relative yourturn/team. Plan review due/pathway changed/flag review → reviewer’s yourturn, others team; future review → upnext. Auto-added remains provenance. |
| `C/clinical/CrisisPanel.tsx`, `C/escalations/CrisisQueueDetails.tsx`, `R/escalations.tsx` | Active crisis/Open and crisis critical/urgent severity → urgent; Resolved → done. Noncrisis new/acknowledged → owner-relative yourturn/team; handed_off → team; overdue → yourturn, not red unless still safety-urgent. Claimed by uses existing claimant. Counts/Draft unchanged. |
| `C/chart/ChartHeader.tsx`, `C/chart/CoverageExtras.tsx`, `C/chart/SeverityFlagsPanel.tsx`, `C/clinical/ClinicalRecordTabs.tsx` | Medi-Cal active/eligible → done; needs check/missing custody time → yourturn; possible duplicate — in review → reviewer’s yourturn, others team. Worsening/Severity change → yourturn; Improving → done. Problem Active → done; Resolved → closed. Severe allergies and critical patient alerts unchanged. |
| `C/hie/OutsideRecords.tsx` | Accepted follow-up/medication → done; dismissed/ignored → closed; awaiting review → reviewer’s yourturn, otherwise team; withheld for consent/role → restricted. Banners/counts unchanged. |
| `C/clinical/refusal/RefusalRiskTextRecord.tsx` | Reviewed → done; clinical-role restriction → restricted. Metadata/Draft unchanged. |

### Items not safely table-certified

- Refill review variants and “Other” coverage; HLOC urgent/emergent priority; C-SSRS risk bands (`C/screeners/CssrsStaffControl.tsx`); historical severity flags; pre-release continuity/MAT statuses in shared `CarePlanCard`.
- `C/clinical/ProtocolsTab.tsx`: active/completed/stopped and round states exist; dormant facility UI excluded from outpatient build pending direction.
- Episode summary/pathway/provenance/Readmission/clinical-decision/request-type labels are not necessarily workflow states.
- `C/consent/ConsentRecordsPanel.tsx`: combined prose heading, not badge; `R/consent-audit.tsx`: event categories, not status. Unchanged.

## 2. Batch 2b-2 — Operations File List and Counts

Counts are render positions, not records/enum values; conditional variants count once. Ordinary prose excluded.

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

**Total: 27 sites.** Excludes taxonomy, provenance, KPIs, numeric counts, Simulated/Prototype/Not built yet and Draft-policy labels. Risk-text Draft untouched; Approved included.

## 3. Test Contracts

Safe with exact words/selectors retained:
- `e2e/consentWorkflow.spec.ts:41,60,61,125,135`: Sent/Signed/Declined, `form-status-*`.
- `e2e/adminContent.spec.ts:39–41`: Verified and verifier provenance. Line 29 is a filter, not a badge.
- `e2e/cfProxyMode.spec.ts:81–83,98–99`: proxy text/visibility/count; context badges unchanged.
- `src/components/__tests__/groupBillingStatus.test.tsx:14–22,42–46`: billing words/data-billable; unchanged.
- `src/components/clinical/refusal/__tests__/RefusalRiskTextRecord.test.tsx:46–47,64,89`: version/Draft/Reviewed/restriction words.
- `src/lib/__tests__/badgeInline.test.tsx:8`: single-span Badge markup; primitive unchanged.

Shared hazard: `e2e/group2Pathways.spec.ts:127,134–135` and `e2e/advocateOnboardingActive.spec.ts:76,88,126` pin advocate words and domain `data-status=waiting/signed`. Direct conversion breaks attributes: StatusChip writes its semantic state. Keep paragraph unchanged.

`MedicationDoseSection.test.tsx:55` pins amber input border, not badge; `SupervisionBanner.test.tsx` pins billability text. Both unchanged. No direct staff badge color/class assertions located. Store-status assertions are not display contracts; suites were not run in this review.

## 4. Shared Boundaries

CarePlanCard: staff audience only, including helper branches. LateCancelBadge: default staff only. RecoveryStagePanel: preserve actor/member rendering. AdvocateConsentStatus: retain domain-valued paragraph. Staff content previews retain member player styling. FormsToSign, PatientConsentStatusCard and patient/advocate chips unchanged; no global primitive/theme edits.

## 5. Recommendations / Validation

Obtain missing tables before certifying ambiguous mappings. Preserve current words and show actual owners separately. Convert badge positions, not prose/taxonomy. Restricted chips must not expose hidden Part 2 rows. Waiting captions require real start dates; otherwise omit.

Later: full units, then all browsers including axe to completion; report failures together. Settled light contrast, transitions off; dense-table/long-label checks; exact changed-file report. No assertions, permissions or workflows changed.
