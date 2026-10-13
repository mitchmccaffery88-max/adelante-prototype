# Phase 2b — Staff/Admin StatusChip Review

Review only; no app/test edits. Chips use existing labels and lang="en"; counts/primitives/members/exceptions unchanged.

**Knowledge limitation:** lookup returned architecture rules, not status tables. Mappings follow Mitch’s explicit rules; ambiguous statuses need table confirmation.

## 1. Batch 2b-1 — Care Work

Paths below are exact; `C/` means `src/components/`, `R/` means `src/routes/`.

**Ownership:** yourturn for existing assignee/eligible role; team for others. Preserve record word; name actual owner beside it. No invented names or routing changes.

| Exact files | Status → state |
|---|---|
| `C/clinical/RecordTabs.tsx` | Notes: Draft/Declined → yourturn; Awaiting cosign → yourturn for actual cosigner, team otherwise; Signed/Cosigned → done. Handoffs: pending_review →  yourturn/team; acknowledged → done. SDOH: identified/not_completed → yourturn for owner, team otherwise; sent/accepted/scheduled → team; completed → done. Refill variants unconfirmed. |
| `R/cosign-inbox.tsx` | Awaiting cosign/Awaiting LPHA cosign →  yourturn/team ; Needs a supervisor/not billable → yourturn. AI-draft stays a modifier. |
| `C/clinical/AsamPanel.tsx` | Draft/Co-signature declined — back to draft → author’s yourturn, others team; Awaiting LPHA co-signature → cosigner’s yourturn, others team; Signed → done.  |
| `C/clinical/NoteRevisionPanel.tsx` | Voided → closed; Corrected → done; Void pending approval → approver’s yourturn, others team. Late entry unchanged. |
| `C/clinical/OrdersTab.tsx`, `C/CarePlanCard.tsx` (staff medication branch) | Draft → signing clinician’s yourturn, others team; signed/Active → done; Held → upnext; Discontinued → closed; Completed → done. Attributes unchanged. |
| `C/clinical/MedReconTab.tsx` | Completed reconciliation → done; unfinished reconciliation → reviewer’s yourturn, others team. Decisions unconfirmed. |
| `C/nursing/NursingSection.tsx` | Awaiting nurse review → nurse’s yourturn, others team; Verified by/Given by → done; Returned by → ordering/reviewing owner’s yourturn, others team; dose cosign pending → cosigner’s yourturn, others team. Metadata unchanged; outpatient review ungated. |
| `C/chart/LabsAndMeasures.tsx` | Result pending → team; Resulted/Completed → done; Waiting on patient → team; Missed questionnaire → owner yourturn, others team. Placeholder labels unchanged. |
| `C/chart/ChartDocumentsList.tsx`, `C/documents/DocumentVerifyQueue.tsx` | Verified → done; Rejected → yourturn for correction owner; Pending review → reviewer’s yourturn, others team.  |
| `C/scheduling/VisitActions.tsx` | Staff-only: Checked in → treating clinician’s yourturn, others team; Attended → done; No-show → yourturn; Cancelled/Late cancel/Rescheduled → closed.  |
| `R/group-sessions.tsx`, `C/groups/GroupJoinRequestsQueue.tsx` | Cancelled/Moved → closed; Attendance taken/Notes complete → done; Attendance not taken/notes owed → owner yourturn, others team. Join pending → approver’s yourturn, others team; approved → done; declined → closed. Delivery sent → done; failed/missing configuration → yourturn. Billing tags unchanged. |
| `C/consent/ConsentFormsPanel.tsx` | Sent/Viewed → team (patient signature outstanding); Signed → done; Declined → closed; Expired → sending staff yourturn, others team.  |
| `C/ReferralTimelineDrawer.tsx`, `C/admin/ReferralTrackerCard.tsx` | Submitted → intake owner’s yourturn, others team; Contacted → team; Enrolled → done; Declined → closed. Call needed/stale → owner yourturn, others team. Open task → existing task owner’s yourturn, others team; Task closed → done.  |
| `C/chart/BriefTab.tsx`, `C/clinical/CareEpisodesPanel.tsx`, `R/clinical-referrals.tsx` | HLOC drafted → author’s yourturn, others team; sent/accepted → team with owner; admitted → done; declined/closed → closed. Active episode → done; Discharged → closed. Readmission remains a modifier. Urgency unconfirmed. |
| `C/inbox/InboxActionQueue.tsx`, `C/inbox/AdvocateReviewQueue.tsx`, `C/inbox/CommunityInquiryQueue.tsx` | Unclaimed/Pending review/New → eligible viewer’s yourturn, others team; claimed/Owner →  yourturn/team; Contacted → team; Done/Resolved/Task made → done. Metadata unchanged. Existing crisis-marked inquiry remains urgent. |
| `C/tasks/TaskWorkRow.tsx`, `R/worklist.tsx` | Pending/In progress → actual owner or role yourturn, others team; Completed → done; Cancelled → closed; Missed → yourturn; Upcoming/snoozed → upnext. Priority ≠ safety.  |
| `R/admin-coordination.tsx`, `R/case-manager.tsx` | Active → done; Frozen/Unassigned → responsible coordinator’s yourturn, others team. Coverage Active → done; Suspended/Assistance → yourturn; Other needs table confirmation. Attended → done; Missed/contact overdue → owner yourturn. Crisis → urgent; counts unchanged. |
| `C/careplan/CarePlanEditor.tsx` | Goal met → done; closed → closed; active → owner-relative yourturn/team. Plan review due/pathway changed/flag review → reviewer’s yourturn, others team; future review → upnext. Auto-added remains provenance. |
| `C/clinical/CrisisPanel.tsx`, `C/escalations/CrisisQueueDetails.tsx`, `R/escalations.tsx` | Active crisis/Open and crisis critical/urgent severity → urgent; Resolved → done. Noncrisis new/acknowledged → owner-relative yourturn/team; handed_off → team; overdue → yourturn, not red unless still safety-urgent.  Counts/Draft unchanged. |
| `C/chart/ChartHeader.tsx`, `C/chart/CoverageExtras.tsx`, `C/chart/SeverityFlagsPanel.tsx`, `C/clinical/ClinicalRecordTabs.tsx` | Medi-Cal active/eligible → done; needs check/missing custody time → yourturn; possible duplicate — in review → reviewer’s yourturn, others team. Worsening/Severity change → yourturn; Improving → done. Problem Active → done; Resolved → closed. Safety exceptions unchanged. |
| `C/hie/OutsideRecords.tsx` | Accepted follow-up/medication → done; dismissed/ignored → closed; awaiting review → reviewer’s yourturn, others team; withheld for consent/role → restricted. Banners/counts unchanged. |
| `C/clinical/refusal/RefusalRiskTextRecord.tsx` | Reviewed → done; clinical-role restriction → restricted. Metadata/Draft unchanged. |

### Items not safely table-certified

- Refill review variants and “Other” coverage; HLOC urgent/emergent priority; C-SSRS risk bands (`C/screeners/CssrsStaffControl.tsx`); historical severity flags; pre-release continuity/MAT statuses in shared `CarePlanCard`.
- `C/clinical/ProtocolsTab.tsx`: active/completed/stopped and round states exist; dormant facility UI excluded from outpatient build pending direction.
- Episode summary/pathway/provenance/Readmission/clinical-decision/request-type labels are not necessarily workflow states.
- `C/consent/ConsentRecordsPanel.tsx`: combined prose heading, not badge; `R/consent-audit.tsx`: event categories, not status. Unchanged.

## 2. Batch 2b-2 — Operations File List and Counts

Counts: render positions; conditional variants count once; prose excluded.

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

**27 sites.** Excludes taxonomy, provenance, KPIs, numeric counts, Simulated/Prototype/Not built yet and Draft-policy labels. Risk-text Draft untouched; Approved included.

## 3. Test Contracts

Safe with exact words/selectors retained:
- `e2e/consentWorkflow.spec.ts:41,60,61,125,135`: Sent/Signed/Declined, `form-status-*`.
- `e2e/adminContent.spec.ts:39–41`: Verified and verifier provenance. Line 29 is a filter, not a badge.
- `e2e/cfProxyMode.spec.ts:81–83,98–99`: proxy text/visibility/count; context badges unchanged.
- `src/components/__tests__/groupBillingStatus.test.tsx:14–22,42–46`: billing words/data-billable; unchanged.
- `src/components/clinical/refusal/__tests__/RefusalRiskTextRecord.test.tsx:46–47,64,89`: version/Draft/Reviewed/restriction words.
- `src/lib/__tests__/badgeInline.test.tsx:8`: single-span Badge markup; primitive unchanged.

Shared hazard: `e2e/group2Pathways.spec.ts:127,134–135` and `e2e/advocateOnboardingActive.spec.ts:76,88,126` pin advocate words and domain `data-status=waiting/signed`. Direct conversion breaks attributes: StatusChip writes its semantic state. Keep paragraph unchanged.

Amber input border in `MedicationDoseSection.test.tsx:55` and billability in `SupervisionBanner.test.tsx` are not badge contracts; unchanged.

## 4. Shared Boundaries

CarePlanCard: staff audience/helpers only. LateCancelBadge: staff default only. RecoveryStagePanel: actor/member isolation. AdvocateConsentStatus: preserve domain attributes. Staff previews and all patient/advocate chips unchanged; no global primitive/theme edits.

## 5. Recommendations / Validation

Get missing tables; preserve words and actual owners. Avoid prose/taxonomy conversions and Part 2 teasers. Wait captions need real dates.

Later: units then all browsers/axe to completion; all failures reported. Settled light contrast, transitions off; long-label checks; every file reported. No assertions/permissions/workflow edits.
