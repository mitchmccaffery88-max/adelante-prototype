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

## 3. Phase 3 — Safety-Only Red + MOUD Continuity (Review Only)

No application/test changes made. Detailed, counted file:line inventory: [Phase 3 red inventory](./phase3-red-inventory.md). Earlier phase-2 mappings remain unchanged.

### Part A — Batches and treatments

Inventory: **305 unique source lines / 138 files**. Overlapping pattern counts: destructive variants **55**, destructive text **201**, fills **110**, borders/rings **62**, raw red/rose **1**, crisis tokens **13**, richColors **1**. Each location in the inventory is marked KEEP safety, CHANGE non-safety, conditional MIXED, or an explicit exception/definition. Indirect variants, urgent tokens and CSS aliases are listed separately. Counts are source locations, not rendered instances.

1. **Shared presentation:** neutral Sonner toasts; richColors off at the root; attention CircleAlert for errors/problems. Validation uses attention text + CircleAlert and a thicker neutral field border, never a red border; preserve ARIA, focus and existing error wording. Do not globally recolor destructive/urgent tokens or Badge/Button primitives: safety and denied claims still need them. Update Form presentation only where shared error styling owns the red.
2. **Operations and actions:** overdue/Unassigned → owner-relative yourturn/team with existing words; Waiting N days only from an existing authoritative date, never from an aggregate or invented timestamp. Neutral count styling; values unchanged. Delete/revoke/write-off/deactivate/dismiss/deny → outline secondary treatment with explicit verbs; existing dialogs and reason gates untouched.
3. **Restrictions, AI and simulation:** Part 2/access labels → restricted chips, without changing visibility; AI draft → existing modifier. Simulated/Prototype/Not built yet → simulated treatment; Coming later only where nothing is built. Calm simulated banner for whole screens; retain guardrail detail and literal Simulated for external sync and tested phrases.
4. **Safety boundaries:** raspberry stays for Get help now/988, crisis escalations and safety banners, severe allergy, C-SSRS high, and the specified MOUD urgency. Generic stat priority, broad score/BP/BMI/lab bands, missing allergies, signing blocks, historical alerts and a metadata value “critical” alone do not establish safety. Mixed shared mappings must use existing safety predicates without altering data. Denied claims keep their current look; Draft-policy and KPI Met/Close/Below remain unchanged. Dormant facility ProtocolsTab is inventoried but excluded from implementation; outpatient-only remains enforced.

**No separate confirmation today:** direct frequency deletion, obligation/toolkit removal and AI-sentence deletion; refill denial and ASAM dismissal have inline reason controls but no separate dialog. Allergy override is a safety action with a reason gate, no separate dialog. Exact references are in the inventory. Do not add confirmations in this presentation-only batch.

**Test impacts:** no direct red/destructive/richColors assertions found. MedicationDoseSection asserts an amber border, which stays. Preserve “Read aloud (Simulated voice)” and “Shared from Adel (summary, Simulated)”, simulation audits/confirmation words, Verified, form-status-* hooks, cfProxyMode, groupBillingStatus and RefusalRiskTextRecord contracts. Changing all simulation words to Coming later would break tests and standing rules. No test assertion/retry/threshold changes.

### Part B — Existing data and proposed staff controls

- `src/lib/ehr.ts`: Patient (`:1634`, assignment IDs and releaseDate; releaseDateMeta holds provenance); MedOrder (`:1055`, startDate/daysSupply/prescriberStaffId/preReleaseEpisodeId); PreReleaseEpisode (`:4001`, anticipatedReleaseDate, actualReleaseDate, cfCareManagerStaffId, receivingEcmStaffId); ReentryCarePlan (`:4119`). Store arrays and getters already own episode/care-plan data. `markPreReleaseEpisodeReleased` persists actual release and the confirmed patient projection; `saveReentryCarePlan` audits section saves.
- `src/lib/medAdherence.ts:116`: isMatOrder uses medication-name/ingredient regex plus isSuboxoneOrder. `:142`: refillRunway derives daysLeft from startDate + daysSupply; missing/invalid supply yields undefined. It estimates supply from the order, not pharmacy dispensing. `src/lib/medContinuity.ts` derives continuity alerts, assigns prescriberFor and currently uses a separate runway-critical draft threshold; those workflows/thresholds are not silently changed.
- Add one **per-patient MOUD continuity record**, tied to the relevant release episode/date so a later release cannot inherit an old confirmation. Save through new AdelanteEHR store functions and registered runAction actions, with appendAudit in the existing stream. Require an audit reason; record actor, timestamp and before/after event metadata using existing Part 2-safe conventions.
- Writers: existing assigned reentry guide (`cfCareManagerStaffId`) or assigned care coordinator via assignmentIdentityFor/isAssignedTo, plus isPrescriberRole (physician/pmhnp). Narrow with existing role, chart/site/restricted-record and Part 2 gates; assignment is not an access grant. No permission-matrix widening, proxy shortcut or role-name guessing. Other authorized staff read-only; staff lacking Part 2 access see no MOUD-specific record/title. AB133 coordination exemption does not authorize SUD access.
- Put a compact status/control with a reasoned side drawer in the existing **pre-release episode detail** and **chart ReentryHandoffTab**, reading one shared record. No new route; no patient/advocate continuity UI. Demo examples only when needed, visibly Demo, seeded via real store functions.

#### Technical shape and display defaults

```ts
interface MoudContinuityRecord {
  patientId: string;
  episodeId?: string; // release-cycle linkage, not a new route
  releaseDate?: string; // confirmed release basis, when available
  planInPlace?: {
    type: "bridge_prescription" | "moud_appointment";
    at: string;
    byStaffId: string;
  };
  confirmed?: {
    type: "first_community_dose" | "moud_visit_kept";
    at: string;
    byStaffId: string;
  };
}
```

Staff-only, with MOUD on record and existing disclosure access; use lang="en" and the requested visible/accessibility labels. Add **“Default per published guidance; pending clinical review (Dr. Bagga)”** at each clinical branch; existing Draft-policy wording stays.

| Condition (confirmed takes precedence) | State / label |
|---|---|
| Confirmed for this release cycle | done · Confirmed |
| Released 0–14 calendar days ago, not confirmed | urgent · Reach out today |
| Released >14 days ago, not confirmed | yourturn · Confirm MOUD continuity |
| Before release, no recorded plan | yourturn · Set MOUD plan |
| Before release, plan recorded | upnext · Plan in place |
| Existing runway daysLeft <=0, MOUD medication | urgent · Out of MAT — reach out |
| Existing runway daysLeft <=0, other medication | yourturn · Ask for a refill |

Use facility-timezone calendar dates for release-window comparison; do not infer actual release from an anticipated date. No runnable date/supply → no invented urgency or numbers. Continuity confirmation does not suppress a separate out-of-supply medication warning. Patient medication/runway rendering stays unchanged; staff slices must carry real order IDs/supply, not infer it from a plan summary.

### Recommendations / differences

- Link continuity to a release cycle; otherwise a second release would falsely appear Confirmed.
- Keep simulated wording when a capability exists but its integration is simulated; Coming later must not imply the working demo is absent.
- Keep existing isMatOrder for this batch, but flag that its naltrexone/MAT classification is broader than strictly OUD-specific MOUD; do not invent indication data or change identification without clinical review.
- Identify uncertain release dates and order-estimated supply explicitly. Missing data must not become “no plan”, “released” or “out of supply” by inference.
- Do not merge existing four-day continuity-alert workflow thresholds into this new 14-day display rule; any routing/alert-policy change needs separate authorization.

### Later build validation / reporting

No permission widening, routes, workflow changes (outside the authorized new continuity recording), or test assertion/retry/threshold changes. Full unit suite first; then **every browser spec to completion**, including axe and Back to top. Collect all failures together; no stop-at-first-failure or opportunistic fixes. Measure light-mode contrast after colors settle, review mixed safety branches and report every changed file. No validation claims are made for this review-only turn.
