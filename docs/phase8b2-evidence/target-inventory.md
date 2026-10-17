# Phase 8b-2 pre-edit inventory
Rollback: `064533e3ba01fd425d1a66959495ef49a7f27406`. Comparisons use git-show source copies under /tmp/phase8b2/rollback only. Export fingerprints recorded before edits.

| File / table | Row source and filters | Hidden rule |
| --- | --- | --- |
| ContentInventoryTable.tsx | caller staffContentInventory role/type/title projection; status/flag/audience filters lines 34–42 | caller contentVisibleToStaff; shipped selection disabled; author/pending-review edit gates |
| admin-staff.tsx | STAFF_ROSTER line 33 | sys_admin only line 37 |
| admin-credentialing.tsx credentials / enrollments | listAllCredentials/listAllEnrollments 461–462 | existing staff_supervision route gate; no table row filter |
| clinician-credentials.tsx | credentialsForClinician(targetId) 75 | own clinician or explicit authorized assist, access.canView 158; delete owner only |
| message-queue.tsx | listUnreadMessageThreads 44 | patient_messaging lock 63; visible body masked by existing Part 2 function 93 |
| cosign-inbox.tsx mine / pool / ASAM / routing | listNotesAwaitingCosign 80; mine ownership 87; other pool-only 90; ASAM pool/owner 170; metadata routing 477–496 | therapy_notes gates 96–121; supervisor-owned/needs-supervisor excluded from other clinicians; ASAM_SIGN_ROLES 169; routing never note body |
| escalations.tsx | listEscalations(viewer) 66, filterEscalations view/type/owner/overdue 68 | viewer projection, canUseEscalations 73, allowedAll; masked rows stay generic |
| InboxActionQueue.tsx non-billing | listInboxRows(actor,billingOnly:false) 46, open/done 48 | existing recipient/role/protected generic projection; billing instance unchanged |
| UnsignedNotesQueue.tsx | listUnsignedWork(authorId) 31 | own clinician/staff; inbox therapy_notes none/summary denied |
| ProviderRequestQueue.tsx | listProviderRequests 42, mine/open/last five done 54–63,175 | other claimed rows absent; inbox provider_requests view gate |
| CommunityInquiryQueue.tsx | includeResolved true 23, unresolved default/crisis-first sort 27–32 | inbox view gate; write disposition flag |
| AdvocateReviewQueue.tsx two streams | contribution/attestation pending default 38–43 | ADVOCATE_REVIEW_ROLES 37,45 and unchanged store projection |
| VoidRequestQueue.tsx | listPendingNoteVoids(actor) 18 | approver metadata + existing author reason only; no body; empty section absent |
| DocumentVerifyQueue.tsx | documentVerifyQueue owner role / all 37–39 | unchanged store projection, owner role and Part 2 rules |
| ReferralTrackerCard.tsx queue opt-in | supplied referrals; status/outreach/program/clinician/care-need 77–107; first 100 109 | route care_coordination; patient-dependent filters exclude no patient; dashboards unchanged |
| ReferralChasePanel.tsx | open tasks 36, first 12 with existing referral 48–50 | canFillChase 39, orphan rows absent; drawer gates unchanged |
| PostEnrollmentSetupCard.tsx queue opt-in | patientsNeedingSetup gaps/staleness, first five 80–83 | no blanket source gate today; assignment controls individually gated; excluded hosts unchanged |
| NursingSection.tsx NurseQueueList opt-in | caller nurseQueue role/staff | RN/LVN route, underlying outpatient/discipline rules; chart host unchanged |
| CrisisQueueDetails.tsx anonymous/open/own flags | lane-filtered open 38–44, anonymous lane 46–48, own flags 232 | locked branch own flags only; canWorkRow; SLA sweep unchanged |

Excluded: dormant refusal queue; matching/data-exchange admin review, reference/audit tables (8b-3); dashboards/stat tiles/charts; patient/advocate screens; printed records.
Existing frozen selectors: continuity.spec.ts:39 requires direct Deactivate James Okafor button. escalationsMessaging.spec.ts:35 requires More escalation actions and :43 a direct Discuss button after handoff. Keep equivalent labels and choose primary accordingly; do not edit tests.
Potential existing privacy gaps to record, NOT change: broad document-all queue; full credential roster depends on route gate; referral/setup broad source; routing metadata/void authored reason; cross-patient crisis detail scope.
