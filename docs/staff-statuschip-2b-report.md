# Staff StatusChip — Batch 2b-1 report

## Scope and implementation

Care-work presentation only. Existing StatusChip uses the record word as `label` and English; semantic states derive from existing status/actor fields. No data, permission, route, workflow, test assertion, retry, threshold, Badge/Button primitive or patient-theme changes. Shared CarePlanCard patient branches, member LateCancelBadge, advocate-consent domain paragraph, counts, simulation/prototype, Draft-policy and KPI badges remain unchanged. Operations batch 2b-2 files remain unchanged. The accepted care-work list explicitly includes `admin/ReferralTrackerCard`, `/admin-coordination` and `/case-manager`; those are not operations-batch migrations.

Clinical defaults carry “Default per published guidance; pending clinical review (Dr. Bagga)” comments. C-SSRS High/Moderate use the approved action words; Low keeps its existing word. Severe allergy displays the approved warning; summary allergy counts remain visible. Worsening and positive PHQ-9 item 9 retain existing criteria and use the approved review words. Crisis remains urgent; noncrisis missed/overdue uses attention, not red. Staff refills and coverage use the approved visible labels where those records are available.

## Validation

- Automatic harness typecheck/build: **build OK**, including final source at 22:04:47 UTC. No manual project build/typecheck was run.
- Final full units: **306 files, 2,561/2,561 passed**, 67.33s (`/tmp/care-units-complete.log`).
- Final all browsers: **79/79 passed**, 6.5m (`/tmp/care-browsers-complete.log`). Includes existing axe and Back-to-top tests for Home/About/Team. No test changes.
- Prior complete browser rerun also passed **79/79**, 6.1m.
- One authorized warm staff-navigation rerun: **22/22 passed**, 2.0m. No staff routing/permission changes.
- First browser run completed **71/79** during implementation. Every failure: advocateSelfSeparation:55, cfProxyMode:75 and :95 — execution context destroyed during navigation; continuity:55 — expected intake median/cohort guard text not found; crossRoleJourneys:53 — newly created referral surname not found; staffNav.rbac:116 — billing, clinical_coordinator and sys_admin redirect URL timeouts. All passed in the final full run. The redirect failures are consistent with the previously observed load/hydration race, not a permission-rule change.
- Intermediate harness compilation caught invalid/duplicate ownership references; all corrected before final build OK.

## Settled light contrast and 1280px review

Measured real visible chips after light theme settled, with transitions disabled only in the diagnostic browser. Browser canvas resolved computed CSS Lab colors to sRGB, then WCAG relative luminance calculated text/background contrast. Physician Dr. Bagga (`s-np1`) and coordinator Priya Raman (`s-cc1`) used existing roster identities. No new seed records or mocked counts.

| State sampled | Minimum text contrast |
|---|---:|
| done | 6.03:1 |
| team | 5.43:1 |
| urgent | 5.51:1 |
| yourturn | 8.90:1 |

Minimum **5.43:1**, above 4.5:1 for 14px text. Real sampled states: done, yourturn, team, urgent. No claim of live-screen measurement for absent closed/upnext/restricted states. Screens checked: worklist, escalations, chart tracking, orders, care episodes and coordination. Cosign inbox screenshot shows its real empty state (zero requests); no fabricated cosign rows. Layout screenshots reviewed at 1280×1800: readable table words, unchanged counts, no clipped chip words in reviewed visible rows. No page errors captured in the final diagnostic run.

Evidence (sandbox-only): `/tmp/browser/care-work/{cosign,worklist,escalations,chart,orders,episodes,coordination}.png`; raw color samples and URLs in `/tmp/browser/care-work/results.json`. Screenshots are viewport captures, not full-page captures.

## Defaults not fully applied / limitations

- **Pre-release MAT/MOUD urgency:** the shared CarePlanCard display slice exposes anticipated release date and summaries, but no MOUD-continuity confirmation or authoritative out-of-supply field. It cannot safely distinguish “Reach out today,” confirmed continuity, or MAT/non-MAT supply exhaustion from that slice. Existing continuity/pre-release display retained; no invented dates, inference, clinical rules or waits. This default remains unapplied there.
- **Out-of-supply medication urgency:** CarePlanMedicationSlice has active/refill_pending/changed, not out-of-supply. No fabricated safety status added. Patient medication cards unchanged.
- **Refill terminal states:** mapping implemented in the staff refill card, but its existing queue selects pending requests; terminal records are not forced into the queue or workflow. Approved/sent → Sent to pharmacy, denied → Not refilled plus recorded reason, needs_appointment → Book a visit first; pending prescriber/others owner-relative. No new clinical logic.
- **Waiting captions:** HLOC uses existing referral.createdAt. Noncrisis overdue escalation display has no request-created date in EscalationRow; the current caption is calculated from its recorded dueAt (elapsed overdue days), not an invented request date. Treat it as overdue-age evidence, not certified total waiting time; a source request date would be needed for exact total wait. No model changes in this pass.
- Allergy model exposes severe/mild/moderate, not an independent high-criticality value; only recorded severe mapped. Existing critical-alert treatment and Draft guidance retained.

## Application files and chip render positions

Counts below are literal `<StatusChip` render positions in the resulting files, not patient counts, not necessarily newly added positions (CarePlanCard includes its pre-existing member goal chip). **40 application files**. Standing-rule comment also updated in `AGENTS.md`; report and roadmap are documentation only.

| File | Resulting chip positions |
|---|---:|
| `src/components/CarePlanCard.tsx` | 3 |
| `src/components/ReferralTimelineDrawer.tsx` | 2 |
| `src/components/admin/ReferralTrackerCard.tsx` | 2 |
| `src/components/careplan/CarePlanEditor.tsx` | 3 |
| `src/components/chart/AdelDrafts.tsx` | 1 |
| `src/components/chart/BriefTab.tsx` | 1 |
| `src/components/chart/ChartDocumentsList.tsx` | 1 |
| `src/components/chart/ChartHeader.tsx` | 2 |
| `src/components/chart/CoverageExtras.tsx` | 2 |
| `src/components/chart/LabsAndMeasures.tsx` | 2 |
| `src/components/chart/SeverityFlagsPanel.tsx` | 1 |
| `src/components/clinical/AsamPanel.tsx` | 1 |
| `src/components/clinical/CareEpisodesPanel.tsx` | 3 |
| `src/components/clinical/ClinicalRecordTabs.tsx` | 2 |
| `src/components/clinical/CrisisPanel.tsx` | 4 |
| `src/components/clinical/MedReconTab.tsx` | 2 |
| `src/components/clinical/NoteRevisionPanel.tsx` | 3 |
| `src/components/clinical/OrdersTab.tsx` | 1 |
| `src/components/clinical/RecordSafetyBadges.tsx` | 2 |
| `src/components/clinical/RecordTabs.tsx` | 5 |
| `src/components/clinical/refusal/RefusalRiskTextRecord.tsx` | 1 |
| `src/components/consent/ConsentFormsPanel.tsx` | 1 |
| `src/components/documents/DocumentVerifyQueue.tsx` | 1 |
| `src/components/escalations/CrisisQueueDetails.tsx` | 2 |
| `src/components/groups/GroupJoinRequestsQueue.tsx` | 3 |
| `src/components/hie/OutsideRecords.tsx` | 3 |
| `src/components/inbox/AdvocateReviewQueue.tsx` | 1 |
| `src/components/inbox/CommunityInquiryQueue.tsx` | 2 |
| `src/components/inbox/InboxActionQueue.tsx` | 4 |
| `src/components/nursing/NursingSection.tsx` | 4 |
| `src/components/scheduling/VisitActions.tsx` | 8 |
| `src/components/screeners/CssrsStaffControl.tsx` | 2 |
| `src/components/tasks/TaskWorkRow.tsx` | 1 |
| `src/routes/admin-coordination.tsx` | 2 |
| `src/routes/case-manager.tsx` | 2 |
| `src/routes/clinical-referrals.tsx` | 2 |
| `src/routes/cosign-inbox.tsx` | 3 |
| `src/routes/escalations.tsx` | 2 |
| `src/routes/group-sessions.tsx` | 8 |
| `src/routes/worklist.tsx` | 1 |
