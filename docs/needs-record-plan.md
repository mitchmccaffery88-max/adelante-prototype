# R56.0 — One needs record with closed-loop tracking (plan and inventory)

Draft — pending clinical sign-off. Planning step only: no source, test, registry, permission, snapshot or Supabase changes were made. Persistence OFF. Not published. Mitch approved R56 as next build at 07:48 CT, 2 Nov.

Line numbers are from the tree as of 2 Nov 2026 (20:30 UTC).

## 1. Inventory

### 1.1 Where a need is created or stored today

The one need store is `Patient.sdohPlan.items: SdohPlanItem[]` (`src/lib/ehr.ts:1893`, type at `:794–850`). Every path below either writes there or keeps its own parallel state.

| Path | Writer (file:line) | Lands in `sdohPlan`? | Notes |
|---|---|---|---|
| HRSN domain results (scored AHC-HRSN) | `materializeHrsnNeeds` `ehr.ts:14388`; `unmaterializedHrsnDomains` `:14417`; read in `RecordTabs.tsx:718` | Yes, staff action, `source: "pre_release_hrsn"` | Safety domain stamps `safetySensitive: true` (`ehr.ts:14407`). Positive domains without a click stay only on the screener result. |
| Pre-release imported HRSN | `recordImportedHrsnDomains` `ehr.ts:15832`; caller `routes/pre-release-import.tsx:185`; seed `ehr.ts:26628` | Domains on screener; needs only after materialize | Second representation of the same domain until materialized. |
| Intake self-report | `applyIntakeNeeds` `ehr.ts:14448` (sources `:14456`, `:14514`); planner `intakeNeedsReconcile.ts:85` (`buildIntakeNeedsPlan`), match `:74` | Yes, `source: "intake_self_report"` or reuse `existingItemId` | Intake route stamps safety for `d.key === "safety"` (`routes/intake.tsx:900`). Employment has no HRSN domain (`sdohMapping.ts:80`). |
| Intake packet needs (Phase B) | `intakePacketNeeds` `intakePacket.ts:63`; `logIntakePacketNeed` `:71`; registry `intake_sdoh_log` `chartActions.ts:214` | **No** — referral-scoped checklist state | Pre-patient; separate `NeedState`, not an `SdohPlanItem`. |
| `sdohPlan` staff-entered | `addSdohItem` `ehr.ts:14329` (default `source: "staff_assessed"`, safety flag `:14355`) | Yes | Status `setSdohStatus` `:14785`, visibility `:14821`, urgent `flagSdohItemUrgent` `:14926`, remove `:14955`, log `appendSdohNeedLog` `:14980`. |
| What Would Help topics | `whatWouldHelp.ts:48` (`OPTIONAL_TOPICS`), `:62` domain→category, `:101` `outsideKnownNeeds`, `:113` `patientSafeNeedLabel` | Yes, via intake/patient flow into `addSdohItem`/`applyIntakeNeeds` | Urgency (`today/this_week/later`, `:24`) is captured with the topic; no field for it on the need besides note/log. |
| Need-connect requests (patient) | `requestNeedConnect` `ehr.ts:14539`; fields `connectRequestedAt` `:844` (+ closed/task id); UI `components/patient/NeedConnect.tsx` | Stamps the existing need + a `sdoh_connect_request` task (`:14557`) | A **request**, never a connection. |
| Need urgency tasks | `raiseNeedUrgencyTasks` `ehr.ts:14588` (tasks `:14607`, `:14635`) | Tasks only | |
| R57 event HRSN prompt | `createEngagementHrsnPrompt` `ehr.ts:17116`; caller `engagementRiskAutomation.ts:76`; gate `engagementRisk.ts:85` | **No** — creates a re-screen task on `p.tasks` | Results come back through the HRSN path above. |
| Advocate-raised need | `advocateAddCoordinationNeed` `ehr.ts:19545` | Yes, `source: "advocate_reported"` | SUD text refused bidirectionally. |
| Referral-originated need | `SdohItemSource` `"referral"` `ehr.ts:686`; `"partner_import"` `:685` | Yes | |

Source union: `ehr.ts:680–686`; labels `:688`. Need status union: `ehr.ts:661–667` (`identified, sent, accepted, scheduled, completed, not_completed`).

### 1.2 Referrals

- `ResourceReferral` `ehr.ts:2651–2698`: `provider` (free-text truth), optional `resourceId` (`:2667`), `source`, `sdohItemId` (`:2677`, the only link; no back-pointer on the need — `:800–802`), `status: ResourceReferralOutcome`, `outcomeReason`, `followUpDate`, staff-only `log`, `visibleToPatient`, `sudDisclosureConsent` stamped from live consent, attribution.
- Outcomes `ehr.ts:2613–2620` (`pending, connected, waitlisted, not_eligible, declined_by_client, unreachable, closed`); closed set `:2639–2644`.
- Writer: `addResourceReferral` `ehr.ts:11728` (Part 2 consent refusal `:11736`, audit meta `:11772–11774`); status `setResourceReferralStatus` `:15136`; visibility `:15178`; log `appendReferralLog` `:15018`.
- Registry: `sdoh_referral` `chartActions.ts:644–649` (sdoh write). Dialog `components/clinical/ReferForNeedDialog.tsx:93`.
- Lookup: `referralsForNeed` `ehr.ts:14967`.
- `referralLinks.ts:25` `ResourceLinkState`, `:42` `resourceLinkState`, `:54` `isResourceLinkActive`, `:63` `referralProviderLabel` (historical listing references, never rewritten).
- Follow-ups: `createSdohFollowUpTask` `ehr.ts:15094` (neutral title, no category/org; requires a CM `:15110`); aging `sdohAging.ts:30` (`SDOH_AGING_DRAFT`), `:81`, `:92`; activity log UI `components/clinical/SdohActivityLog.tsx:113`.

### 1.3 Who reads needs today

- Staff chart: `components/clinical/RecordTabs.tsx:718, 969, 982, 1093, 1143`; `recordSections.tsx`; `NoteAutofillCard.tsx`.
- Care plans: `structuredCarePlan.ts`, `asamCarePlan.ts`, `components/careplan/AsamSuggestions.tsx`.
- Briefs/work: `adelBrief.ts:281`, `chartBrief.ts`, `myWork.ts:216`, `patientOpenItems.ts:60`, `agenticPrototype.ts`, `askAdel.ts:380`, `case-manager.tsx`, `DashboardActionLauncher.tsx`.
- Patient: `patientNeedThread.ts:98` (threads), `:105`, `:133` resolved window 14 d (`:29`); `PatientHome.tsx`, `HomeDashboard.tsx`, `MyCareTiles.tsx`, `PostIntakeResources.tsx`, `NeedConnect.tsx`, `patientCheckInContext.ts`.
- R57: `engagementRisk.ts:39` (phone/data), `:50–59` (housing/transport/food from latest HRSN + open `pre_release_hrsn` needs, safety excluded `:51`), `:81` (intake need events).
- Advocate: `advocateCoordination` `ehr.ts:19435` (items/referrals `:19470–19490`, Part 2 restricted `:19488`, staff-only referral filter `:19486`); UI `components/advocate/AdvocateWorkspace.tsx` (raise need ~`:41`, list ~`:186`).
- Reports/exports: `sdohReporting.ts:3–4, 108–112, 245–246`; `contentTags.ts`; `demoInboxSeed.ts`.

### 1.4 Safety and Part 2 boundaries

- `safetySensitive` on the need (`ehr.ts:808–815`): staff-only by default on every patient/advocate surface; staff may share after warning. Set by HRSN safety domain (`:14407`), intake safety (`intake.tsx:900`), explicit staff input (`:14355`). R57 excludes it (`engagementRisk.ts:39, 51, 81`). Referrals don't carry it; they inherit by `visibleToPatient === false` (advocate filter `ehr.ts:19486`).
- Part 2: `PART2_SENSITIVE_REFERRAL_CATEGORIES` `ehr.ts:2710` (`recovery_meetings`, `support_groups`), `isPart2SensitiveCategory` `:2715`; creation refused without consent `:11736`; staff chart masking `RecordTabs.tsx:1143`; advocate `Restricted` `ehr.ts:19488`; follow-up task text neutral `ehr.ts:15094` comment.

### 1.5 Duplicates and conflicts

1. Same domain twice: HRSN screener domain + imported domain + materialized need + intake need. Reconcile prevents intake duplicates (`intakeNeedsReconcile.ts:74`) but a staff-entered need with different wording is not matched.
2. Intake packet need state (`intakePacket.ts:71`) is never reconciled into `sdohPlan` at handoff.
3. Status disagreement: need `status` (`sent/accepted/scheduled/completed`) is set by hand (`setSdohStatus`) and can say `completed` while every referral is `unreachable`, or `identified` while a referral is `connected`.
4. `connectRequestedAt` can look like progress with no referral.
5. Need text match by label in R57 (`engagementRisk.ts:39, 53`) breaks if a need is reworded.
6. `sdohReporting.ts` re-joins referrals itself (`:112`) instead of `referralsForNeed`.
7. Registry coverage: only `sdoh_referral` and `intake_sdoh_log` are registry entries in this search; `addSdohItem`, `setSdohStatus`, `setResourceReferralStatus`, `requestNeedConnect` are direct store calls with their own audits. To confirm in R56.1; any new writes must go through the registry.

## 2. Proposal (Draft — pending clinical sign-off)

### 2.1 Where the record lives — recommend a materialized projection

Recommend **a read-only `needsRecord` projection** (`src/lib/needsRecord.ts`) computed from `sdohPlan.items` + `resourceReferrals` + tasks, plus a small stored `resourceConnections[]` written **only by the existing referral writer** (`addResourceReferral` / `setResourceReferralStatus`).

Why: the need item and the referral already exist and are audited. A second mutable "needs" store would create a parallel lifecycle and a third copy of status. A projection makes need status derived from referral outcomes (fixes 1.5 #3), and storing the connection snapshot at referral time keeps who the person was connected to even if the listing is retired.

### 2.2 Fields (per need)

- `id` (= `SdohPlanItem.id`), `domain` (HRSN domain key or intake key via `sdohMapping.ts`; `other` if none), `categoryId`, `label` (person's own words lead).
- `source` (`SdohItemSource`) + `provenance`: `{ screenerResultId?, intakeSubmissionId?, advocateLinkId?, packetReferralId?, createdBy, createdByRole, createdAt }`.
- `safetySensitive` (copied, never inferred).
- `owner`: `{ staffId?, queue?: "care_coordination" }` from the same owner chain as R57 (`engagementOwnerFor`), with trainee skip.
- Dates: `createdAt`, `updatedAt`, `plannedAt?`, `referredAt?`, `connectedAt?`, `resolvedAt?`, `followUpDueAt?`.
- `status` (lifecycle below), `statusEvidence`: `{ kind: "member_confirmed" | "staff_evidence" | "referral_outcome", by, at, referralId? }`.
- `resourceConnections[]` (per content-v2-plan §4): `connectionId`, `resourceId` (stable registry ID), `resourceKind` (`community_resource | naloxone_access_point | external`), `resourceType?` (semantic, R50), `savedPublicName`, `contactSnapshot` `{ phone?, address?, hours?, website? }` + `verifiedRevision`, `referralId`, `referralStatus` (read from referral — authority), `updatedAt`. Multiple per need; never overwritten.

### 2.3 Status lifecycle (Draft)

Main: **Identified → Planned → Referred → Connected → Resolved**. Endings: **Declined, Unable to reach, Not eligible, No longer needed**.

| Transition | Requires |
|---|---|
| → Identified | Any source above |
| Identified → Planned | Staff (care-plan step or need-connect request accepted) |
| → Referred | A real referral exists (`addResourceReferral`). A connect **request** stays Identified/Planned. |
| Referred → Connected | Referral outcome `connected` **and** either member confirmation or staff evidence (call note/log entry). "Requested" or "pending" is never Connected. |
| Connected → Resolved | Member confirmation, or staff evidence with reason |
| → Declined | Member's own choice (member or staff-recorded with reason) |
| → Unable to reach | Staff evidence: referral `unreachable` after follow-up attempts |
| → Not eligible | Referral `not_eligible` with `outcomeReason` |
| → No longer needed | Member confirmation, or staff with reason |
| Any ending → Identified (re-open) | Failed connection or member says still needed |

`waitlisted` maps to Referred. Mapping to old need statuses: `identified→Identified`, `sent→Referred`, `accepted/scheduled→Referred`, `completed→Resolved` only with evidence, `not_completed→` re-open candidate.

### 2.4 Closed-loop rules (Draft, for Christi)

- Follow-up check **10 days** after referral (proposed), via existing `createSdohFollowUpTask` (neutral title), asking the member whether the connection happened.
- Member says "didn't happen" or referral moves to a closed outcome without connection → need re-opens to Identified; one neutral task.
- Follow-up task open past **7 days** after due (proposed) → shown as "Due N days ago" and routed to the coordinator queue; no red, not a crisis.
- New writes are registry actions run through `runAction`; automatic tasks use an existing system actor pattern.

### 2.5 How other features read it

- **R57**: replaces label matching (`engagementRisk.ts:39, 50–59, 81`) with `needsRecord(p).filter(domain in housing/transportation/food/phone_data, !safetySensitive, open)`. Same weights and output.
- **R55 HRSN**: results write needs through the existing materialize path (or an approved auto-materialize), keyed by `screenerResultId`, de-duplicated by domain.
- **R58 advocate**: minimal projection — `savedPublicName`, public contact snapshot, status word. Existing consent, `visibleToPatient`, Part 2 `Restricted` and sensitive-provider gates apply to name, contact, ID and status context. Safety-sensitive needs never shared.

### 2.6 Existing data

- Every `SdohPlanItem` becomes a record; status derived from linked referrals; no outcome guessed.
- Referrals with `resourceId`: connection snapshot taken from the current listing, marked `snapshotAt: migration` and `verifiedRevision` only if the listing is currently verified; otherwise `unverified`.
- Referrals with only `provider`: `resourceKind: "external"`, name from `provider`, no contact.
- Referrals with no `sdohItemId`: listed as "Not linked to a need" (`patientNeedThread.ts:118` already does this); never auto-linked.
- `completed` needs with no connected referral: shown as "Resolved (no connection recorded)".
- Intake packet needs: not migrated until handoff rules are decided (question below).

## 3. File and test plan

### 3.1 Files the build would touch

New: `src/lib/needsRecord.ts`, `src/lib/needsLifecycle.ts`, `src/lib/needsClosedLoop.ts`, tests under `src/lib/__tests__/needsRecord*.test.ts`, docs report.
Existing: `src/lib/ehr.ts` (connection snapshot in referral writer; follow-up hook), `src/lib/chartActions.ts` (new actions), `src/lib/engagementRisk.ts`, `src/lib/sdohReporting.ts`, `src/lib/patientNeedThread.ts`, `src/lib/referralLinks.ts`, `src/components/clinical/RecordTabs.tsx`, `src/components/clinical/ReferForNeedDialog.tsx`, `src/components/advocate/AdvocateWorkspace.tsx`, `src/lib/myWork.ts`, `src/lib/patientOpenItems.ts`.

### 3.2 Pinned files

`src/lib/ehr.ts` (pinned in 20 adapters) and `src/lib/chartActions.ts` (1) need approved exact-once re-pins chained after `withApprovedMyTasksNov02`, each with its own regression test. `roles.ts` not touched.

### 3.3 Permission rows

Proposed actions: `need_status_set` (sdoh write), `need_connection_confirm` (sdoh write; member path via self-registration), `need_reopen` (sdoh write), `need_closed_loop_automation` (system-only, hidden for all staff). Each adds 18 rows (one per role) to the `runAction.test.ts` snapshot: ≈72 additive rows. Needs approval before `vitest -u`.

### 3.4 Likely conflicting tests

- `advocateNeedReferrals.test.ts:86–93, 108–116, 132–158` (provider — status / Restricted shape).
- R57: `engagementRiskR57.test.ts`, `engagementRiskEventsR57.test.ts`, `engagementRiskSafetyR57.test.ts`, `engagementRiskAutomationR57.test.ts`, `engagementRecheckR57.test.ts`.
- SDOH: `sdohNeedThread`, `sdohReferralThread`, `sdohActivityLog`, `sdohProvenanceMapping`, `sdohReferralConsentAttribution`, `sdohResourceMatch`, `needsStep2`, `needsStep3`, `intakeNeedsReconcile`, `whatWouldHelp`, `engagementReporting`.
- `runAction.test.ts` snapshot; pin-check tests for `ehr.ts`/`chartActions.ts`.
- Browser: `engagementRiskR57.spec.ts`, advocate specs, `staffTables8b1`.

### 3.5 Batches

1. **R56.1** — read-only projection + lifecycle derivation + tests. No writes, no UI. Zero snapshot rows.
2. **R56.2** — connection snapshot in the referral writer + migration mapping (ehr.ts re-pin).
3. **R56.3** — registry actions (status, confirm, reopen) + snapshot rows + staff chart UI.
4. **R56.4** — closed-loop automation (follow-up, re-open, escalate).
5. **R56.5** — R57 reads from the record (output unchanged, proven by existing tests).
6. **R56.6** — R58 advocate projection; R55 hook after R55 is approved.

## 4. Questions

**For Mitch**
1. Approve the projection (2.1) over a new store?
2. Approve ~72 additive snapshot rows for four actions, or fewer actions?
3. Should intake packet needs move into the record at handoff?
4. Should R55 auto-materialize positive HRSN domains, or keep the staff click?
5. Should R56 add registry entries for today's direct need writes (1.5 #7)?

**For Christi**
1. Follow-up day: 10 days after referral? Escalate at 7 days past due?
2. Is member confirmation required for Connected and Resolved, or is staff evidence enough?
3. Can "No longer needed" be staff-recorded without the member?
4. Should `waitlisted` count as Referred, or its own state?
5. Should a safety-sensitive need ever take part in closed-loop member follow-up (contact may be unsafe)?
