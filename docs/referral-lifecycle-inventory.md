# Referral lifecycle inventory — 27 Oct 2026

Draft — pending EHR/Admin audit. Inventory completed before any UI changes. No Supabase, TEST secrets or persistence changes.

## Surfaces and work sources

| Surface | Audience / boundary | Existing source and numbers | Available actions / home | Duplication or dead end |
|---|---|---|---|---|
| Care → Referrals (`referral-queue.tsx`) | care_coordination non-none; submit separately gated by canSubmitReferral; Intake currently excluded by nav | listReferrals; manual outreach count is referrals.filter(hasOpenOutreachTask).length; tracker counts are filtered/list lengths | Send; chase; Open referral drawer; clinical coordinator staging import | Mixes pre-enrollment referrals with enrolled rows and a second setup list; not stages 1–4 only |
| Shared referral tracker (`admin/ReferralTrackerCard.tsx`) | Caller-owned audience; contact/enroll role checks inside drawer | Referral status, outreach attempts, patient episodes/assignments; filtered/list ratio | Filters; Open referral; optional View all → queue | Embedded in referral queue, Admin dashboard and case-manager dashboard; independent status/progress/staleness display |
| Referral timeline drawer (`ReferralTimelineDrawer.tsx`) | Host audience; canPerformReferralAction and canWorkReferralOutreach | Referral history, linked patient, matching results, outreach | Contact, enroll, decline, outreach, referrer update and advocate prompt | Enroll/contact/decline/outreach call EHR directly rather than registered actions; one mayDispose combines enroll/decline, incompatible with reason-limited Intake close |
| Intake workspace (`intake-workspace.tsx`) | Intake-only; identity/Phase A/B actor checks; packet and restricted-patient lock | intakeReferrals; intakeLane; intakeState; coverage/form/packet status; lane lengths from filtered rows | Staff send, identity review, outreach registry, packet/coverage requests, first visit/group requests, initial team assignment, completion, safety escalation | Handed off lane can mean referral enrolled while Phase A overrides it to Ready to schedule; separate lane semantics; no general chart access |
| Clinical Coordination (`admin-coordination.tsx`) | View: coordinator/admin/therapist/PMHNP/ECM; mutations coordinator/admin only | EHR patients/clinicians/appointments, coordination profiles/audit, unassigned/lost assignment and frozen future-visit projections | Profile/freeze/reassignment/rebook and decision audit; full setup list | Clinical roster/affected-appointment work is clinical and must remain; post-enrollment setup duplicates queue; no eight-stage/owner overview |
| Post-enrollment setup (`PostEnrollmentSetupCard.tsx`) | Host audience; name/chart links use staffPatientLabel/viewerCanOpenChart | patientsNeedingSetup, postEnrollmentGaps/staleness; list length | Assign clinician/case manager; chart link only when allowed | Four independent setup labels; limited queue list points to Coordination; assigned patients missing intake/attendance can lack a usable next action; case-manager Save calls store directly |
| Client Journey (`ReferralStatusTimeline.tsx`, hosted in referral/chart drawers) | Existing chart/drawer audience | Referral, patient.enrolledAt, caseManagerId, primaryClinicianId, intakeCompletedAt and actual attended appointment | Existing hosts open person record/drawer | Separate milestone display and dates; not a new curriculum store; avoid confusing patient /journeys with staff enrollment |
| Chart header / Care team (`record.$patientId.tsx`, ChartHeader, AssignedCareTeam) | chartEntryFor and section matrix/Part 2 gates | chartBrief and existing care-team assignment projection | Existing chart launchers and care team actions | No shared lifecycle/readiness label; must not enable Intake chart access |
| Escalations (`escalations.tsx`, `escalations.ts`) | Acting-owner scope; elevated all view; crisis/Part 2 rules | Unified crisis/social need/score-change/handoff sources; filtered row counts | Acknowledge, discuss, chart section, handoff/reassign via registry | Canonical safety work home; not removable as duplicate referral work; Intake sees triage receipts only |
| Today / My work (`clinicianWorkspace.ts`, StaffShell) | Acting identity and owned-row gates | Real tasks, chaseRowsFor, assigned crises, work due dates | Claim/open referral, task and escalation launchers | Alternate launchers, not independent state; chase rows must retain host privacy and handlers |
| Admin / case-manager dashboard referral tiles | Existing dashboard role/owner gates | listReferrals and shared tracker; intakeVelocityMedian for velocity KPI | Tracker drawer/View all and existing KPI drill-down | Repeated work-list entry points; preserve metric provenance and existing StatTile drill-down contract |
| Population health / reporting (`reporting.tsx`, PopulationHealthSection, referralFunnel.ts) | Existing reporting access; cohort guard 11 | referralsInWindow; reached-only contact; enrolled link; scheduled/attended appointments; medians; justice sources folded | Overall referral report link to queue; existing report interactions | Five-stage funnel does not mean billable active; per-stage/source/track metrics are reporting-only without stage-specific work destinations |
| Identity review (`admin-identity-review.tsx`, identityReview.ts) | Intake/sys_admin decide; coordinator view only; candidates role/Part 2 gated | identity-only review items and real dates/status/assignee | Registry link/merge/not-same/need-info/confirm | Separate legitimate decision lane; account support/website Inbox must not be mixed into it |
| Billing workspace / record billing | Existing billingProjection and billing actor checks | Claim/session financial projections; coverageProjection and Billing-owned determinations | Existing claims, coverage manual checks/requests | No single readiness checklist. Clinical note/credential payload cannot be passed into Billing to derive it |

## Existing evidence, clocks and intentional exclusions

- `referralFunnel.contactedAtOf` counts a reached attempt or real contactedAt, never no-answer effort. `firstAttendedAppointment` counts attended only, not scheduled/cancelled/no-show.
- Referral aging is Draft 3/7 days since contactedAt or createdAt. Post-enrollment clocks remain case manager 3/7, clinician 5/10, intake 7/14 and first attendance 14/30, measured from enrolledAt. No 90-day starting rule changed; care-plan review cadence and report windows are not enrollment-clock evidence.
- `intakePacketFor` offers standard Part 2 consent to everyone with required:false. Signed forms require active version/signature evidence; sent/built/declined forms cannot imply consent.
- Coverage path/status/date must come from coverageProjection, not financial/member details. Credential text alone does not prove current credentialing; signed note must be linked to an attended service and finally signed, including required cosign.
- `/clinical-referrals` is outpatient HLOC work, not inbound intake; `/intake` is patient self-service; `/journeys` is patient curricula. Keep these unchanged. Dormant in-facility work stays disabled.

## Section 5 implementation map

- Convert queue to pre-enrollment work with shared neutral lifecycle display; keep submitted referral readback and existing drawer handlers after registry conversion.
- Replace Intake lane labels with shared stage/gap display while retaining Phase A/B stores and restrictions.
- Replace Coordination's setup duplication with linked oversight counts; retain clinical roster/affected-visit decisions and reassignment in their established home.
- Place enrolled stage display and safe readiness in record/Client Journey, respecting chart-entry masking. Dashboard launchers continue to the existing home, not a second mutation list.
- Extend existing reporting module, retaining justice fold, association-only note, median sample guards and cohort 11. Suppressed aggregates must not drill through to identifying rows.

## Confirmed clean-boundary conflict (RESOLVED 27 Oct by Mitch)

Resolved: Stage 2 is administrative fact gathering only; clinical plan drafting happens after enrollment through a Today task for an already-authorized clinician. Intake stays in its own workspace — no Care → Referrals navigation exception. Peer contact approved; the test was updated. The text below is kept as the original record.


Stage 2 requires a first care plan drafted **before stage 4 creates a patient record**, owned by Intake. Existing `addStructuredGoal` accepts only patientId, calls patientOf, and refuses Intake via canEditPlan. `care_plan_goal` registry repeats that refusal. `PLAN_EDIT_ROLES` intentionally excludes Intake and clinical coordinator (coordinator may reassign owners only).

Root/lib AGENTS and the approved Intake memory require referral-only staging, no clinical care-plan/chart grants and no parallel stores. Satisfying this exit condition now would need a forbidden pre-enrollment patient, parallel referral plan, or changed clinical authority. Recording a packet checklist as a drafted care plan would invent clinical evidence. Stop before lifecycle/UI/permission changes; document the decision needed in the report.

Also confirmed: navSections explicitly confines Intake to Intake workspace/identity review, while section 5 asks to open Care → Referrals to Intake; the peer-contact decision supersedes an existing concrete denial assertion in websiteReferralActionsConsistency.test.ts. These need explicit architecture/test reconciliation, not silent bypasses.