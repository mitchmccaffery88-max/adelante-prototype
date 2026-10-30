# EHR and Admin surface inventory — three-bucket model

Report only. Decided by Mitch 27 Oct; scope extended 30 Oct. Draft — for Mitch's walkthrough before anything moves. Nothing in this batch changed code, UI, permissions or Supabase. Nothing published. No tests were run.

**Status of this document:** written in one pass from source tracing (file:line references below). Parts marked **needs check** were not traced to the end and should be verified before a cleanup batch touches them. Section 1 is a broad route inventory, not a complete transitive audit: every delegated form's action IDs and every dead-end row still need a second pass (see "Where this stopped" at the end).

Related inventories, used rather than re-derived:
- Referral lifecycle: `docs/referral-lifecycle-inventory.md`, `docs/referral-lifecycle-report.md`
- Permission matrix: `docs/access-rules-permission-matrix.md`, `docs/access-rules-report.md`
- Reporting/privacy: `docs/privacy-p3-report.md` (sys_admin reporting table, lines 51–56), `docs/phase9a2-report.md`. There is no document named "reporting audit"; these are the closest.
- Content: `docs/content-management-audit.md`
- Scheduling: `docs/patient-scheduling-report.md`

Bucket keys: **B1** Clinical (EHR) · **B2** Care coordination · **B3** Practice management/operations. Bridge keys: **S** Scheduling↔EHR · **Bi** Billing↔EHR · **I** Intake→EHR · **Cr** Credentialing→scheduling/billing · **R** Reporting · **X** Crisis.

---

## How navigation and gates work today

- Staff nav is registry-driven: `StaffShell` → `useStaffNavGroups` → `src/lib/navSections.ts`. Sections today: Care, Queues, Population health, Facility & Custody, Revenue & billing, Administration, Consent, My account. None of them map to the three buckets.
- Registry enforcement `navSections.ts:829-865`: Intake sees only intake and identity-review entries; the intake workspace is hidden from everyone else; facility entries sit behind the in-facility flag; otherwise record-class ranking from `roles.ts:188-827`.
- Deep links (`src/lib/navGuard.ts:35-65`): registered paths reuse registry gates; **unregistered paths rely on their own guard** (record, print, agentic, disclosure log, provider reference, pre-release import).
- Action permissions: `CHART_ACTIONS.allowed` evaluated by role in `src/lib/actions/permissionMatrix.ts:1-35`; patient-specific consent/chart checks happen later in stores.
- There is no standalone Today route. "Today" is the strip in `WorkspaceDashboard.tsx:70-99` on `/clinician`, plus separate nurse, admin and billing strips.

---

## 1. Surface inventory

Data column: **D** = imports `ehr.ts` chart stores directly · **X** = `ehr-ext` · **P** = reads through a named projection · **UI** = delegated component. "Roles" names the gate; the role list behind each record class is in `docs/access-rules-permission-matrix.md`.

### 1a. Care section

| Surface · path | Nav now | Roles (gate) | Actions | Data | Bridge | Bucket | Duplicates | Dead ends | Recommended home |
|---|---|---|---|---|---|---|---|---|---|
| Intake workspace `/intake-workspace` | Care N188 | intake_coordinator only | `intake_outreach_record`, Phase A booking/group/completion/assignment, Phase B form sends | D + `intakeWorkspace`, `intakePhaseA`, `intakePhaseB`, `referralOutreach` | I, S | B3 | Referral queue (same referrals) | "Mark intake complete" doesn't count as patient intake (10j) | Keep; move to an Operations › Front door section |
| Referral queue `/referral-queue` | Care N193 | care_coordination ≥ read | Track, outreach, submit, enroll | D + `referralOutreach`, ReferralTracker, IntakePhaseB | I | B3 (track) / B2 (outreach) | Intake workspace, Admin referral cards | needs check | Merge into Front door; B2 roles keep an outreach-only view |
| Case manager `/case-manager` | Care N205 | case_notes / peer_notes | Case work, tasks, chart launch | D (needs check) | — | B2 | `/clinician` caseload, `/caseload-review` | needs check | Keep as the B2 home; read through a care-slice projection |
| Assisted sign-up `/assisted-signup` | Care N214 | assisted_signup W | Assisted enroll, claim code | `signupStore`, `signupMatch` | I | B3 | Website sign-up (same flow) | — | Move to Front door |
| Nurse `/nurse` | Care N225 | nurse_rn, lvn | `metabolic`, `specimen_collect`, `triage_call` | D + `nursing` | — | B1 | — | Both summary numbers are plain non-clickable boxes (`nurse.tsx:64-70`) | Keep; make numbers open their lists |
| Clinician workspace `/clinician` | Care N234 (+ view-as N243) | therapy_notes / psych_eval | Schedule, notes, requests, caseload, chart | D + `clinicianWorkspace` | S, X | B1 | My work, inbox, notes queue, cosign inbox | needs check | Keep as the B1 Today |
| Shift count `/shift-count` | Care N254 | controlled_substance_custody (write local `:79,160`) | Count, reconcile | D + `mar` | — | B1 (in-facility) | — | — | Keep behind in-facility flag |
| Group sessions `/group-sessions` | Care N266 | group_sessions; group_notes `:1090` | Schedule, roster, attendance, group notes | D + X + `groupFunding` | S | B1 for notes; B3 for scheduling | Groups tab on `/schedule` (patient) | — | Split: scheduling to B3 calendars, notes stay B1 |
| Group audit `/group-audit` | Care N275 | group_sessions | Filter | D + `groupJoinView`, `auditRedaction` | — | B3 | `/admin-audit` | — | Merge into Admin audit |
| Caseload review `/caseload-review` | Care N589 | canOpenCaseloadReview | Weekly contact review | needs check | — | B2 | `/case-manager` | needs check | Merge into the B2 home as a tab |

### 1b. Queues section

| Surface · path | Nav now | Roles (gate) | Actions | Data | Bridge | Bucket | Duplicates | Dead ends | Recommended home |
|---|---|---|---|---|---|---|---|---|---|
| My work `/my-work` | Q N286 | therapy_notes / worklist / crisis_queue | Visits, getting started, missed visits, results, plan reviews, cosigns, refills, crises, contacts, ASAM, re-screens (`my-work.tsx:266-780`) | D, **notes** | S, X | Mixed B1/B2 | Clinician Today strip — nearly every section | needs check | Merge into each bucket's Today; retire as a separate page |
| Worklist `/worklist` | Q N297; F N475 | worklist; custody_tracking | Tasks, protocol rounds | D | — | B1/B2 by task kind | Facility entry is the same path | — | Keep one entry; filter by bucket |
| Inbox `/inbox` | Q N307 | provider_requests / therapy_notes / billing | Unsigned notes, provider requests, document verify, advocate review, inquiries, billing queues | UI, `inboxActions` | Bi | Mixed | Notes queue, cosign inbox, billing | Old "no Results tab" comment (`inbox.tsx:9-12`) | Split per bucket; each bucket's inbox shows only its queues |
| Notes queue `/notes-queue` | Q N317 | therapy_notes | Sign | D, **notes**, `noteSignFlow` | — | B1 | Inbox, clinician, My work | — | Merge into B1 Today "Needs closing" |
| Refusal queue `/refusal-queue` | Q N326 | meds_erx (local `:30`) | Refusal follow-up | `inFacility` | — | B1 (in-facility) | — | — | Keep behind flag |
| Cosign inbox `/cosign-inbox` | Q N335 | therapy_notes / staff_supervision | Cosign | needs check | — | B1 | Clinician, My work | — | Merge into B1 Today "Cosign" |
| Clinical referrals `/clinical-referrals` | Q N344 | helper | Clinical referral work | needs check | — | B1 | — | needs check | Keep |
| Escalations `/escalations` | Q N354 | canUseEscalations | Claim, resolve, escalate | D + `escalations`, `staffThreads` | X | B1 owner; pointers to all | Crisis queue, clinician crisis tile | — | Keep as the one crisis home |
| Team messages `/team-messages` | Q N363 | canMessageStaff | Threads | — | — | All | — | — | Keep (cross-bucket utility) |
| Crisis queue `/crisis-queue` | Q N372/381/394 (three lanes) | clinical / SDOH / self-flagged | Shared crisis | UI | X | B1 + B2 lanes | Escalations | — | Merge into Escalations with lane filter; non-clinical lane gets neutral pointers only |
| Message queue `/message-queue` | Q N404 | patient_messaging | Reply | D + `careMessageMasking` | — | B2 | — | — | Keep in B2 |

### 1c. Population health, Facility, Revenue, Consent

| Surface · path | Nav now | Roles (gate) | Actions | Data | Bridge | Bucket | Duplicates | Dead ends | Recommended home |
|---|---|---|---|---|---|---|---|---|---|
| Reporting `/reporting` | P N419 | population_health / billing | Period, detail, export | D + X, CalOMS, SDOH, referral, lifecycle projections | R | B3 | Dashboards, county reporting, DMC-ODS readiness | needs check | Merge with Dashboards into one Reporting |
| Dashboards `/dashboards` | P N428 | population_health | KPI drilldown | D + `dashboardMetrics` | R | B3 | Reporting | — | Merge into Reporting |
| Coverage at release `/coverage-release` | P N455 | pre_release | UI panel | UI | — | B3 | Eligibility, pre-release | — | Remove page; the panel stays embedded |
| DMC-ODS readiness `/dmc-ods-readiness` | P N546 | screeners_sud or reporting capability (`N857-858`) | Readiness | D + `dmcOdsReadiness` | R | B3 | Reporting | — | Merge into Reporting |
| Pre-release `/pre-release` | F N440 | pre_release | Reentry, screeners, MOUD assign `moud_care_manager_assign` (`:244`) | D, **screeners** | I | B2 (reentry) | — | — | Keep in B2; read screeners through a projection |
| Released search `/released-search` | F N466 | custody_tracking (write `:64-73`) | Search | D | — | B2 | — | — | Keep |
| Facilities `/admin-facilities` | F N488 | custody_tracking (`:96`) | Configure | D | — | B3 | — | — | Move to System settings |
| Billing `/billing` | R N499 | billing | Workspace, claim/eligibility follow-up | P `billingProjection` + D | Bi | B3 | Admin claims, OpsWorkspace tiles | needs check | Keep as Billing Today |
| Claims `/admin-claims` | R N508 | billing (write `:223`) | Review, edit, export | P `billingProjection` + **D + X** | Bi | B3 | Billing | — | Keep; drop direct imports |
| Eligibility `/eligibility-worklist` | R N517 | eligibility | Verify coverage | D + `coverageWorklist` | — | B3 | Coverage panel | — | Keep |
| CalAIM codes `/billing-calaim-codes` | R N530 | class threshold N530-545 | Reference | — | — | B3 | — | — | Keep |
| Consent audit `/consent-audit` | Consent N564 | consent_ledger | Audit | needs check | — | B3 | Disclosure log | — | Merge with disclosure log into one Privacy page |
| `/consent` | Consent N555 | — | Patient-classified in AppShell despite staff nav | — | — | Not staff | — | Staff nav entry points into the patient shell | Remove the staff nav entry |

### 1d. Administration and My account

| Surface · path | Nav now | Roles (gate) | Actions | Data | Bridge | Bucket | Duplicates | Dead ends | Recommended home |
|---|---|---|---|---|---|---|---|---|---|
| Admin home `/admin` | A N577 | population_health W; strip sys_admin `:184` | Summaries, config links | D + X, referral/group projections | R | B3 | Reporting, billing cards | needs check | Keep as Operations Today |
| Coordination `/admin-coordination` | A N598 | canViewCoordination; coverage + 7-day opens clinical_coordinator only | Assignments, voids, `chart_coverage_set`, reasoned-open list | D + X | — | B1 oversight | — | Reasoned-open list has no "reviewed" control | Keep; move to Clinical oversight |
| On-call `/admin-on-call` | A N607 | coordination | `on_call_shift_add/remove` | D + `onCall` | X | B1 oversight | — | — | Keep under Clinical oversight |
| Permissions `/admin-permissions` | A N616 | coordination | Matrix, features, events, export | `permissionMatrix`, `features` | — | B3 | — | — | Move to System settings, sys_admin only |
| Care partners `/care-partners` | A N625 | helper | Directory | — | — | B3 | — | — | Keep |
| County reporting `/county-reporting` | A N634 | helper | Reports | needs check | R | B3 | Reporting | — | Merge into Reporting |
| Data exchange `/data-exchange` | A N643 | DATA_EXCHANGE_ROLES | HIE, matching | D + `hie`, `dataExchange` | — | B3 | Identity review (matching) | — | Keep; matching queue reads a projection |
| KPI targets `/admin-kpi-targets` | A N652 | population_health W | Edit targets | D + `dashboardMetrics` | R | B3 | — | — | Move into Reporting settings |
| Note templates `/admin-note-templates` | A N661 | note_templates | Author | D, `templateScope` | — | B1 config | — | — | Keep under Clinical oversight |
| Scheduling rules `/admin-scheduling-rules` | A N670 | scheduling_rules | Rules | D + `frequencies` | S | B3 | Catalog governance | — | Merge with catalog governance |
| Content center `/admin-content` | A N679 | content_authoring | Author, review, publish, resource verify | UI | — | B3 | — | — | Keep |
| Catalog governance `/admin-catalog-governance` | A N690 | catalog_governance | Configure | D + `frequencies` | Cr | B3 | Scheduling rules | — | Merge into Scheduling settings |
| Audit `/admin-audit` | A N699 | platform_administration | Filter, content review panels | D + `accessLog` | — | B3 | Documents audit, group audit | — | Keep; absorb other audits as filters |
| Documents audit `/admin-documents-audit` | A N712 | documents | Filter | D | — | B3 | Audit | — | Merge into Audit |
| Quality/compliance `/quality-compliance` | A N723 | COMPLIANCE_ROLES | `compliance_restricted_review`, `chart_restrict` | D | — | B1 oversight | — | — | Keep under Clinical oversight |
| Credentialing `/admin-credentialing` | A N733 | staff_supervision W | Credential records | D + X + `credentialFile`, `credentialRoster` | Cr | B3 | `/clinician-credentials` | — | Keep; drop direct EHR import |
| Supervision `/admin-supervision` | A N747 | staff_supervision | Supervisor config | roles | — | B1 oversight | — | — | Keep |
| Staff `/admin-staff` | A N758 | sys_admin | `staff_add/update`, lifecycle | D + `staffLifecycle` | — | B3 | — | — | Keep |
| Vendors `/admin-vendors` | A N768 | platform_administration | Status | D + scribe | — | B3 | — | — | Move to System settings |
| Identity review `/admin-identity-review` | A N189 | helper | `identity_review_*` (`:57-62`) | D + `identityReview` | I | B3 | Data exchange matching | — | Keep under Front door |
| Account support `/admin-account-support` | A N190 | helper (`:11`) | Account support | `accountSupport` | — | B3 | — | — | Keep under Front door |
| Team calendar `/team-calendar` | A N801 | calendar helper | Team scheduling | D + X | S | B3 | Location calendars | — | Merge with location calendars |
| Location calendars `/location-calendars` | A N810 | site helper (`:38`) | Site calendars | X | S | B3 | Team calendar | — | Merge |
| Profile, My calendar, My credentials | M N783/792/819 | everyone | Own records | X | — | All | — | — | Keep under My account |

### 1e. Unregistered staff surfaces (own guards only)

| Surface | Guard | Bucket | Note |
|---|---|---|---|
| Chart `/record/$patientId` (`record.$patientId.tsx:42,152-164`) | Shared chart gate + per-section gates | B1 (B2 sees a care slice) | No nav entry; reached from rows |
| Pre-release import `/pre-release-import` | `canImportPreReleaseRoster` | B3 | Overlaps staging import (10m) |
| Provider reference `/provider-reference` | `canReadProviderRef` | B1 | — |
| Disclosure log `/disclosure-log` | `DISCLOSURE_LOG_ROLES` | B3 privacy | Not in nav — dead end unless linked |
| Print records `/print/patient-records/$patientId` | needs check | B1 | Export |
| Agentic prototypes `/agentic/*` | AppShell staff classification | B1 | Prototype, Simulated; guard chain needs check |

### 1f. Today strips today

| Who | Tiles now |
|---|---|
| ECM, CF care manager, peer, CHW | Needs my action → Scheduling → My caseload |
| Clinical coordinator, sys_admin | Coordinator queue → Scheduling → Needs my action |
| Other clinicians | Schedule → Needs my action → My caseload → Requests & booking, plus strip: next visit, visits left, needs closing, unsigned, cosign, crisis (+ refills for prescribers, contacts for care roles) — `clinicianWorkspace.ts:49-58`, `WorkspaceDashboard.tsx:70-99` |
| RN/LVN | Waiting on you, doses today (non-clickable), action queue, New vitals/specimen/triage |
| Billing, admin | OpsWorkspace tiles (`OpsWorkspace.tsx:52-132`) |
| Intake | Intake workspace only |

---

## 2. Bleed-through list

Places where a B3 or B2 surface reads chart stores directly or shows detail beyond its bucket. "Should use" names the projection; where none exists it is marked **new**.

| # | Surface | What it reads | Should use |
|---|---|---|---|
| 1 | `/admin-claims` | `billingProjection` **plus** direct `ehr.ts`/`ehr-ext` imports | `billingProjection` only (codes, dates, provider, units from signed note) |
| 2 | `/billing` | Projection plus EHR integration | `billingProjection` |
| 3 | `/reporting`, `/dashboards`, `/dmc-ods-readiness`, `/county-reporting` | Direct EHR + metrics | A reporting projection with cohort guard 11 (**new** single module; today guards are per-metric) |
| 4 | `/admin` home | Direct EHR + X | Referral, group and reporting projections |
| 5 | `/admin-credentialing` | Direct EHR + X | `credentialRoster` only (no patient data) |
| 6 | `/eligibility-worklist` | Direct EHR + `coverageWorklist` | `coverageWorklist` / intake funding view |
| 7 | `/intake-workspace`, `/referral-queue` | Direct EHR | `intakePhaseA`/`intakePhaseB`/`intakePacket` projections (exist; finish the move) |
| 8 | `/team-calendar`, `/admin-scheduling-rules`, `/admin-catalog-governance` | Direct EHR | Scheduling projection: time/type/provider/status (**new** name; data exists in `ehr.ts`) |
| 9 | `/admin-identity-review`, `/data-exchange` | Direct EHR | `identityReview` candidate projection (exists for decisions) |
| 10 | `/admin-audit`, `/admin-documents-audit`, `/group-audit` | Direct EHR + redaction | `auditRedaction` (ids-only) |
| 11 | `/pre-release` (B2) | **Screeners** directly | Care-slice projection (screener status, not answers) — **new** |
| 12 | `/case-manager`, `/caseload-review` (B2) | needs check | Care-slice projection — **new** |
| 13 | `/my-work` used by B2 roles | **notes** module | Care-slice projection |
| 14 | ECM provider grants | Therapy note metadata/summary, psych eval and medication reads (`roles.ts:242-243,270-291`) | Care slice excludes note bodies; decide whether summaries and med list belong (open question) |
| 15 | Crisis queue SDOH lane | Shared crisis surface | Neutral pointer to owner only |
| 16 | `billing` role | SUD treatment / group notes consent-gated read (`billing_coordinator` doesn't have it) | `billingProjection`; drop SUD class grants |

---

## 3. Per-role summary

Recommended Today: 4–6 tiles, each opens a list you can act on.

| Role | Buckets | Today now | Recommended Today | Nav add / remove |
|---|---|---|---|---|
| therapist | B1 | Clinician strip + 4 sections | Next visit · Needs closing · Cosign/return · Requests · Crisis | Remove Notes queue, Cosign inbox, My work (merged) |
| clinical_trainee | B1 | Same | Next visit · Needs closing · Waiting on supervisor · Requests · Crisis | Same |
| sud_counselor | B1 | Same | Next visit · Needs closing · ASAM due · Groups today · Crisis | Same |
| pmhnp | B1 | Same + refills | Next visit · Needs closing · Refills · Results · Crisis | Same |
| physician | B1 | Same as pmhnp | Same as pmhnp | Same |
| nurse_rn | B1 | Nurse strip | Waiting on you · Vitals/specimens due · Triage calls · Results · Crisis | Make both numbers clickable |
| lvn | B1 | Nurse strip | Waiting on you · Vitals due · Waiting on RN cosign · Crisis | Same |
| medical_assistant | B1 (support) | Clinician default | Today's visits · Rooming · Requests · Messages | Remove clinical queues it can't act on |
| clinical_coordinator | B1 oversight | Coordinator queue → Scheduling → Needs my action | Crisis · Care-team requests · Reasoned opens this week · Coverage · Supervision | Add Clinical oversight section; content publishing moves to an add-on |
| ecm_provider | B2 | Needs my action → Scheduling → Caseload | Your turn tasks · Visits today · Needs to confirm · Caseload contacts · Crisis pointers | Remove clinical summaries (see bleed #14) |
| cf_care_manager | B2 | Same | Same + Releases this week | Same |
| peer_specialist | B2 | Same | Your turn · Visits · Messages · Caseload | — |
| community_health_worker | B2 | Same | Your turn · Visits · Needs to confirm · Caseload | — |
| intake_coordinator | B3 | Intake workspace | New referrals · Outreach due · Packets to confirm · First visits to book · Identity review | Add Front door section |
| billing | B3 | Ops tiles | Claims to fix · Eligibility to verify · Change who pays · Denials | Remove SUD grants |
| billing_coordinator | B3 | Ops tiles | Same | — |
| credentialing_coordinator | B3 | needs check | Expiring credentials · Payer enrollments · Exclusion checks · Not bookable | — |
| sys_admin | B3 (prototype: direct chart) | Coordinator-style queue | Account support · Staff changes · Integrations · Audit | Go-live: chart entry becomes reasoned open (rule 5) |

---

## 4. Multi-role cases

How it works today (`roles.ts:1084,1135-1143,1624-1636`; `StaffRoleSwitcher.tsx:29-91`): a person holds a primary role plus `additionalRoles`. The switcher lists one row per held role; picking one sets a single acting role in browser storage. Permissions never combine. The database layer (`staff_role_assignments`, `acting_role_sessions`) supports one open session with an audit on switch, but the demo switcher doesn't call it.

Gaps:
1. **Reload restores the wrong role.** Startup restore accepts the stored identity only if its primary role equals the stored acting role (`roles.ts:1589-1598`). Someone acting in an additional role may come back as someone else after reload — needs check in preview.
2. **Intake + Billing** can be represented, but isn't seeded (only admin + Intake, `roles.ts:1269`) and has no provisioning screen. Recommended: seed one fictional Intake + Billing person and test that each acting role sees only its bucket.
3. Nav doesn't follow buckets yet, so switching changes items, not sections (rule 4).
4. The switcher is a demo control; at go-live it must call the foundation command so the switch is audited.

---

## 5. Gaps — functions with no home

| Function | Today | Proposed home |
|---|---|---|
| Coverage assignment | **Exists** on `/admin-coordination` (`ChartAccessCoordination.tsx:32-62`), action `chart_coverage_set`, Simulated; SQL `clinician_coverage_set` stays revoked | Keep; move to Clinical oversight |
| Weekly reasoned-open review | List only ("Last 7 days"), no reviewed/sign-off control | Add a "Reviewed" registry action with reason, B1 oversight |
| Bucket-scoped Today page | None; one workspace serves all | One Today per bucket |
| Care-slice projection for B2 | None | New module; feeds B2 screens |
| Scheduling projection | None named | New module (time/type/provider/status) |
| Single reporting projection | Per-metric guards | One module with cohort guard 11 |
| Role provisioning for multi-role | None | `/admin-staff` |
| ECM program switch | No flag | `features.ts` entry (section 8) |
| Content author role | None | Section 8 |
| Enrollment step, NOABD, referrer outcome, 14-day coordination | None | Section 10 |

---

## 6. Proposed nav per bucket

```text
Clinical (B1)             Care coordination (B2)     Operations (B3)
  Today (4-6 tiles)         Today (4-6 tiles)          Today (4-6 tiles)
  My patients               My caseload                Front door: referrals, intake,
  Schedule                  Visits                       identity review, account support
  Needs closing             Needs & resources          Scheduling: calendars, rules, catalog
  Groups                    Messages                   Billing: claims, eligibility, codes
  Crisis                    Crisis pointers            Credentialing
  Oversight*                Releases**                 Content center
                                                       Reporting
                                                       Audit & privacy
                                                       System settings***
My account (all)
* clinical coordinator   ** CF care manager   *** sys_admin
```

---

## 7. Cleanup batch order (smallest risk first)

None started.

1. **Nav labels only** — remove the staff `/consent` entry; remove `/coverage-release` page entry (panel stays); link `/disclosure-log`. No permission change.
2. **Dead ends** — make nurse numbers clickable; reasoned-open "Reviewed" control.
3. **Merge duplicate queues into B1 Today** — `/notes-queue`, `/cosign-inbox`, `/my-work` sections into `/clinician`.
4. **Audit merge** — `/group-audit`, `/admin-documents-audit` into `/admin-audit`; consent audit + disclosure log into Privacy.
5. **Reporting merge** — `/reporting`, `/dashboards`, `/dmc-ods-readiness`, `/county-reporting`, KPI targets; one reporting projection.
6. **Calendars merge** — team + location calendars; scheduling rules + catalog governance; scheduling projection.
7. **Bleed-through B3** — claims, billing, eligibility, credentialing, admin home, identity review drop direct EHR imports (bleed 1–10).
8. **Care slice for B2** — new projection; `/case-manager`, `/caseload-review`, `/pre-release`, B2 My work (bleed 11–15). Needs Mitch's call on ECM summaries.
9. **Bucket nav sections + per-bucket Today** (rules 1, 4).
10. **Role consolidation** (section 8) — after Mitch decides.
11. **Go-live** — sys_admin to reasoned open; switcher calls the foundation command.

---

## 8. Role consolidation analysis

### 8a. Facts per current role

Source: `roles.ts:188-827` (matrix), `:834-853` (NURSE_GRANTS), `:856-859` (INTAKE_GRANTS), `:924-940` (permissionRole, prescriber, psychotherapy exception), action registry, nav gates.

| Role | Distinct (only it, vs nearest role) | Nearest role / overlap | Bucket | Better as attribute/add-on? |
|---|---|---|---|---|
| therapist | Therapy note write, clinical coordination write | clinical_trainee (near-identical) | B1 | — |
| clinical_trainee | Supervision read; SUD consent-gated; cosign required | therapist | B1 | **Yes** — trainee/associate status on credential |
| sud_counselor | SUD treatment write; group notes | therapist | B1 | Partly — SUD scope by credential |
| pmhnp | Psych eval, meds/eRx write, SUD write | physician (identical) | B1 | **Yes** — prescriber attribute |
| physician | Nothing: inherits all PMHNP grants (`:924-925`) | pmhnp | B1 | **Yes** — same role, credential differs |
| nurse_rn | Allergies write, provider_requests write, consent_ledger read | lvn | B1 | — |
| lvn | None beyond RN; fewer grants | nurse_rn | B1 | **Yes** — LVN by credential; cosign rule as attribute |
| medical_assistant | Read-only support grants | lvn | B1 support | Keep or fold into Nurse family (open question) |
| clinical_coordinator | Population/config/supervision/crisis writes; coverage, reasoned-open list; content publish/clinical review | sys_admin | B1 oversight | Content review = add-on |
| ecm_provider | Broad coordination, care-plan non-SUD write, screener MH write, therapy summary, psych eval/med reads | cf_care_manager | B2 | ECM = program attribute |
| cf_care_manager | Reentry/custody writes | ecm_provider | B2 | Reentry = attribute/site |
| peer_specialist | Peer notes, signup write | community_health_worker | B2 | — |
| community_health_worker | CHW notes | peer_specialist | B2 | Merge with peer (credential distinguishes) |
| intake_coordinator | Front-door gates; no clinical grants | — | B3 | — |
| billing | Billing/eligibility write + SUD consent-gated reads | billing_coordinator (identical minus SUD) | B3 | **Merge**; drop SUD grants |
| billing_coordinator | — | billing | B3 | Merge |
| credentialing_coordinator | staff_supervision write, compliance helpers | sys_admin | B3 | Could be an add-on duty |
| sys_admin | Platform, account support, staff, prototype chart entry | clinical_coordinator | B3 | Account support = add-on |

Attributes/add-ons flagged: prescriber (pmhnp/physician), supervisor (staff_supervision), LVN cosign, trainee/associate status, account_support, on-call duty (`onCall` shifts already separate from role), site, group facilitator, reporting viewer, credentialing, content review.

### 8b. Proposed set (to test, not decided)

| Family | Proposed role | Absorbs | Scope from |
|---|---|---|---|
| Clinical | Clinician | therapist, clinical_trainee, sud_counselor | Credential: license type, associate/trainee, SUD certification, supervision |
| Clinical | Clinician + prescriber attribute | pmhnp, physician | Prescribing authority on credential |
| Clinical | Nurse | nurse_rn, lvn, (medical_assistant?) | License type RN/LVN; MA open question |
| Clinical | Clinical Coordinator | clinical_coordinator | — |
| Care coordination | Care Manager | ecm_provider, cf_care_manager | Program attribute (ECM, reentry) |
| Care coordination | Peer Support / CHW | peer_specialist, community_health_worker | Credential (peer cert vs CHW) |
| Operations | Intake Coordinator | intake_coordinator | — |
| Operations | Billing | billing, billing_coordinator | — |
| Operations | Credentialing Coordinator | credentialing_coordinator | Or add-on on sys_admin |
| Operations | Content Author | **new** | — |
| Operations | System Admin | sys_admin | Account support as add-on |

Add-ons: on-call, clinical supervisor, group facilitator, account support, reporting viewer, credentialing, content reviewer/publisher.

### 8c. What each merge changes

| Merge | Matrix | Today | Tests | Lost / widened |
|---|---|---|---|---|
| physician → pmhnp-based Clinician+prescriber | None (already inherited) | None | Role-name fixtures | Nothing |
| therapist + trainee + sud_counselor → Clinician | Rows collapse; trainee cosign and SUD write must move to credential checks in stores | Same tiles | Every role-keyed matrix/acceptance test (incl. the 112-check access suite) | **Widening risk**: if credential checks aren't in place first, trainees gain unsupervised signing and therapists gain SUD write |
| rn + lvn → Nurse | Allergies/provider_requests/consent read become credential-gated | Same | Nursing tests | Widening risk for LVN if the credential check is missed |
| billing + billing_coordinator | Use billing_coordinator row | Same | Billing tests | **Loss** (intended): billing's SUD consent-gated reads |
| ecm + cf_care_manager → Care Manager | Union would widen; must take intersection + program attributes | Same tiles + releases | Care-manager, reentry tests | Widening risk: reentry/custody writes for ECM, or psych/med reads for CF |
| peer + CHW | Peer notes vs CHW notes become credential note types | Same | Signup tests (peer has signup write) | Widening: CHW gets signup write |
| content publishing → add-on | Remove publish from clinical_coordinator role, give as add-on | — | Content governance tests | None if Cathy gets the add-on |

### 8d. Content Author (write-and-submit only)

Today `content_authoring` write is spread across many roles (`roles.ts:550-566`); publish requires a configured publisher or clinical reviewer (`contentPublishing.ts:243-255`); clinical/Part 2 content needs a PMHNP, physician or clinical coordinator reviewer who isn't the author (`contentGovernance.ts:165-179`). Cathy is `s-cc2`, clinical_coordinator (`roles.ts:1258-1266`), so she can publish.

A Content Author role would: write content_authoring, submit for review, no publish, no patient data, no chart entry. Effect: Cathy either moves to Content Author (loses publish and clinical oversight) or keeps her role with a publisher add-on. Other roles' authoring could narrow to "suggest" — open question.

### 8e. ECM provider

- Today: see 8a row; weekly caseload review (`caseload-review.tsx:41,66`). No ECM feature flag exists (`features.ts:5-45`).
- An ECM program would add: ECM enrollment/eligibility record, outreach attempt logging against ECM billing rules, HRA/care plan on ECM timelines, ECM claims in `billingProjection`, ECM-specific reporting.
- Single flag: add `ecm_program` to `features.ts` (`simulated`/off by default, like `in_facility`), checked in nav registry entries, the ECM registry actions' `allowed`, the billing projection's ECM service filter, and reporting. The ecm_provider/Care Manager role itself stays; the flag gates the program, not the person.

### 8f. Open questions for Mitch

1. Do ECM care managers keep therapy summaries and med list reads, or does the care slice exclude them?
2. Is medical assistant part of Nurse, or its own support role?
3. Credentialing: role or add-on on System Admin?
4. Should CHWs gain peer's signup write on merge, or should signup become an add-on?
5. Cathy: Content Author or clinical coordinator + publisher add-on?
6. Order: credential-based scope checks must ship before any clinical merge — agree?

---

## 9. Patient scheduling page (`/schedule`)

| Tab | Shows / does |
|---|---|
| Your appointments | Upcoming (excludes cancelled/rescheduled) grouped by in person/video/phone; past incl. cancellations; join video, cancel, reschedule (`AppointmentsSummary.tsx:90-226`) |
| One-to-one | Visit type, book vs "Ask my team", clinician/modality, dates/times, existing-visit warning, fee/coverage note before confirm (`schedule.tsx:322-650`); rules in `patientServiceMenu` (`patientBooking.ts:45-70`) |
| Groups | Enrolled group calendar with links; discover with Join / Ask to join (`PatientGroupScheduling.tsx:92-234`) |

**Proposed single view, "What's next for me"** (patientAccess unchanged):
1. Top: the next visit as one tile (time, type, how to join, Change time).
2. "Coming up": the rest of upcoming visits and enrolled group meetings in one dated list.
3. "Your requests": open "Ask my team" requests with whose turn it is ("With your team").
4. "Book or ask": the menu from `patientServiceMenu`, each item showing Book or Ask my team.
5. "Groups you can join": open groups with Join / Ask to join.
6. Past visits collapsed at the bottom.
One primary button per screen (the next visit's action); Spanish checked at 390px.

---

## 10. Entry, intake, needs and consent

Corrections to the 30 Oct review are marked **Correction**.

### 10a. Entry doors [R—]

| Door | Code path | Record created | Flags / flagSources | Lands at |
|---|---|---|---|---|
| Pre-release facility packet | Staging import `intakePacket.ts:33-53` → source `correctional` | Unlinked **Referral** (not Patient) | None until enrollment | Referral submitted |
| Pre-release episode (staff) | `openPreReleaseEpisodeForNewPatient` `ehr.ts:15126-15267` | Patient + episode | Sets custody `in_custody`, estimated release date | Pre-release |
| Released, no handoff | `generateMissedHandoffCatchUp` `ehr.ts:11518-11578` | Episode on existing Patient | `missedPreReleaseCoordination`; also custody (10f) | Catch-up |
| Partner packet | Staging import, source `community_based_organization` | Unlinked Referral | None | Referral submitted |
| Partner batch upload | Same importer, 1–500 rows | Referrals | None; `consentToContact:false` | Referral submitted |
| Family/court/public form | `ReferralSubmissionForm` → enrollment `ehr.ts:9281-9337` | Referral; Patient on enrollment | Justice if "yes" or source probation/parole/drug_court/correctional; `flagSources.justice_involved`; SUD if `substanceUseNeed` | Enrolled (see 10b) |
| Self sign-up / walk-in | `signupStore.ts:35-49`, `signupMatch` | New Patient, or enrolls a matching Referral, or claims existing | None (**Correction**: not always a new record) | Enrolled |
| Reentry long after release | `justiceInvolvement.ts:9-13` classifier | None | Derived (custody, reentry flag, missed-handoff, Z65.2) | Unchanged |
| School / under-21 | **needs check** — no school-specific path found | — | — | — |
| Advocate arriving | Advocate onboarding — **needs check**; getting-started reads consent-scoped schedule (`gettingStarted.ts:82-88`) | Advocate link | — | — |
| SUD flag added in care | Problem, episode, `needs.substanceUse`, clinician SUD goal (`sudSignal.ts:29-40`) | None | Computed; **no flagSources written** | Unchanged |

Lifecycle is derived, not set by door (`careLifecycle.ts:135-183`). Fix home: B3 Front door; one `entry_door` field on Referral recorded by each path; registry action per door already exists except staging (`intake_staging_import` — needs check).

### 10b. Created vs enrolled [R13]

Confirmed: `createPatient` sets `enrolledAt: now`, `episodeDay: 1` (`ehr.ts:8776-8800`).
Proposal: `createPatient` leaves `enrolledAt` empty; new registry action `patient_enroll` (Intake Coordinator, B3) sets it when the enrollment criteria in the lifecycle are met (intake complete + coverage path), with one audit. `careLifecycle.ts` gets an explicit "Enrolled" stage between referral and first visit. Every reader of `enrolledAt` (GettingStartedCard, lifecycle, reporting) needs review — needs check for the full list.

### 10c. One needs store [R10, R11]

Confirmed: packet needs (`intakePacket.ts:9-75`, states unknown/confirmed_still_needed/resolved) are separate from sdohPlan; `patient_need_confirm` only changes state and creates no task (`intakePacket.ts:145-152`). **Correction:** `/intake` has a "known / still applies" merge path (`intake.tsx:891-928`), so it doesn't re-ask everything; it still doesn't read packet needs.
Proposal (store `sdohPlan`, B2): packet needs write to sdohPlan as `unconfirmed` with source + source reference; `/intake` shows "Still need help with this?" for those; "Yes" runs a registry action that creates or refreshes a task for the assigned care manager or ECM provider (Draft owner rule pending); "No" resolves with source kept. Retire the separate packet-need state after migration.

### 10d. Flags and the SUD rule [R1, R2, R14, R45]

Confirmed: `flagSources` written only at referral enrollment (`ehr.ts:9307,9311`) and HIE match (`dataExchange.ts:137-147`). No writer of `Referral.substanceUseNeed` found in the public referral form or sign-up (narrower than "no form anywhere" — needs check). The two rules disagree: `sudSignal` uses problems/episodes/need/clinician goal, not AUDIT/DAST; `recoveryJourneyVisible` (`seeking.ts:46-61`) uses need unless Part 2 declined, any episode, or CalOMS fields, and ignores problems and goals.

Proposal (Draft, pending counsel; Mitch 30 Oct): one rule in `sudSignal.ts` used by both. Member-facing: the member sees SUD help as soon as they report it or are flagged. Others: only under existing Part 2 checks. New flag source `self_reported` with date and the member's own words (stored in the Part 2 class, never in audit text). A confidential task goes to Part 2-authorized roles only, with neutral title.

Masking status:

| Surface | Masks SUD today? |
|---|---|
| Intake Coordinator packet needs/documents | Yes (`intakePacket.ts:63-104`) |
| Care-team packet | Yes, role + consent |
| Clinician packet facts | Yes |
| Advocate getting started | Yes, consent-scoped |
| HIE population list | Yes, chart masking + Part 2 hold |
| Billing (role `billing` SUD reads) | Consent-gated; recommend removal (bleed 16) |
| Reporting | Cohort 11 aggregates; row drilldowns needs check |
| Partner portal / exports | **needs check** |
| Crisis lanes, notifications, task titles | Neutral by standing rule; needs check per surface |
| `/pre-release` screeners (B2) | needs check |

### 10e. Universal consent [R3, R28, R44]

Confirmed: `part2_standard` is optional, refusal never stops care, wording pending counsel (`consentForms.ts:152`). The intake radio "No — Skip substance-use screening for now" exists (`intake.tsx:1660-1683`); whether it hides AUDIT and DAST depends on the screener selection at `intake.tsx:719-724` — needs check. **Confirmed gap:** the intake Part 2 answer does not write a typed consent-ledger record; `completeIntake` merges legacy `p.consents` booleans (`ehr.ts:8916-8949`), while consent checks read `isConsentCategoryAuthorized` (`ehr.ts:14129-14130`).
Proposal: universal intake packet with Part 2 included for every population; recipient classes in the ASCMI style; probation, court and family as separate opt-ins; screening offered to everyone regardless of consent; explicit `declined` state on the typed record. The intake answer writes through the existing typed consent capture action so the checks read it. Store: consent ledger; B1/B3 boundary at intake.

### 10f. Justice-involved self-sign-up [R4, R22]

**Correction/clarification:** catch-up requires an existing Patient. It opens a pre-release episode with today's date; the shared opener fills an empty release date and sets custody `in_custody` (`ehr.ts:15199-15207`). Fresh episode: 9 form tasks + 1 Medi-Cal follow-up = **10 urgent tasks** (`ehr.ts:3903-3985,15148-15182`). Day-0 availability has no release-date check (`reentryDayZero.ts:251-284`). No "unsure" justice answer in intake (the type allows `prefer_not`; the UI needs check).
Proposal: sign-up/intake asks "When were you released?" with "Not sure"; catch-up never sets custody or release date; catch-up tasks and the Day-0 welcome fire only inside a release window (threshold pending Christi). Store: `ehr.ts` episode opener + `reentryDayZero`; B2.

### 10g. 14-day pre-release coordination [R15, R16, R29–R33]

Confirmed: timeline has T−90→T−60, T−60→T−72h, T−72h handoff (`preReleaseTimeline.ts:25-136`); route-level in-facility gating needs check. ASAM signing opens/updates the DMC-ODS episode (`ehr.ts:10647-10688`); "only ASAM opens it" needs check against seeds/imports. ASAM tasks fall back to `"s-sudc1"` (`ehr.ts:10278-10294`).
Proposal: a `PreReleaseCoordination` record outside in-facility mode — date, attendees, HRA reviewed, Reentry Care Plan reviewed, level of care, intake booked, transport plan — on the B2 reentry surface, with a registry action. Replace the hard-coded fallback with the care-team ASAM owner or a neutral unassigned queue. Receiver role, billability and timing **pending Christi's DMC-ODS doc (due 2 Nov)**.

### 10h. Timeliness and closing the loop [R25, R26]

Referral created/enrolled timestamps exist (`ehr.ts:9330-9331`). No distinct request date, offered-appointment date, outcome-to-referrer notice or NOABD (2 business days) found.
Proposal: add `requestedAt` and `firstOfferedAt` on Referral (set by request and first-offer actions); referrer outcome notice and NOABD as B3 Front door tasks with due dates, notice content Draft pending compliance.

### 10i. Packet reading [R17]

Confirmed: no extraction; structured input only (`intakePacket.ts:41-84`).
Proposal: on Intake workspace (B3), a step labelled **Simulated**: upload packet → extracted fields each with source page → Intake Coordinator confirms or edits each field → written with provenance (source, page, confirmer) through the existing packet actions. `simulated: true` in `features.ts` and audits. Beta scenario: received pre-release packet assigned to a patient record.

### 10j. Getting Started and the waiting room [R12, R27]

GettingStartedCard shows when `enrolledAt` set, care not closed, lifecycle stage < 8 (`gettingStarted.ts:41-58`, `GettingStartedCard.tsx:21-23`). Lifecycle reads `p.intakeCompletedAt`. Confirmed: Intake Coordinator "Mark intake complete" writes its own referral-keyed `completedAt` (`intakePhaseA.ts:143-149`) and doesn't count.
Waiting-room transportation recheck: **not found** in this review — needs check (search `transport` in waiting-room/first-visit code before concluding missing).
Proposal: completion counts from either source through one lifecycle read; B3 store `intakePhaseA` feeds lifecycle.

### 10k. Screeners [R5]

**Correction:** not every path saves unanswered as 0.
- Intake submit: missing numeric answers → 0 (`intake.tsx:775-785`).
- Rescreening: requires `screenerComplete`; only skipped/gated items → 0 (`ehr.ts:14131-14135`).
- C-SSRS: all shown required; gated undefined stored as −1 (`ehr.ts:10778-10794`).
Other screener paths (staff-entered, pre-release `/pre-release` screeners, check-ins) — needs check. Fix in the separate small batch.

### 10l. Front-door leftovers [R19, R20, R21, R23, R24]

| Item | Finding | Home |
|---|---|---|
| /referral upload | No upload in `ReferralSubmissionForm` | Public referral form → packet attachment (B3) |
| "Who referred you?" | Saved to the sign-up session draft only (`signupStore.ts:114`), not the record | Write to Referral/patient source on account creation |
| /start answers | Recorded only with a current patient (`start.index.tsx:30-35`) | Anonymous session store, attached at sign-up |
| /start/other-help, /start/reconnect | Render UI; "placeholder" vs wired needs check | Front door |
| Ages 12+ | Matcher allows 12–110 (`signupMatch.ts:21`); minor-consent path not found | Guardian/minor-consent branch, pending counsel |
| Payers Tulare/Kings | Not verified — needs check | County payer config |

### 10m. Batch referrals and ECM

Today: staging import accepts 1–500 partner/pre-release rows, validates identity/contact/dates/SDOH kinds, updates unlinked referrals or creates staff-channel ones, sets `consentToContact:false`, manual outreach, source provenance, packet needs; never links to a chart (`intakePacket.ts:25-53`). `/pre-release-import` is a separate roster importer.
Gap to Diana's flow: no split into profiles beyond referrals, no auto-assign to provider, no on-hold queue, no supervisor reassignment. Architecture: keep the importer creating Referrals; add an assignment rule step (Draft) that proposes an owner; unassigned or conflicting rows go to an On hold queue on the Front door with a supervisor reassign registry action. ECM-specific routing sits behind the `ecm_program` flag (8e). For Mitch and Diana to decide.

---

## Where this stopped

Complete in outline: sections 1–10. Not complete:
- Section 1: every delegated form's action IDs, full per-role row visibility, and an exhaustive dead-end pass.
- Items marked **needs check** throughout, mainly: school/advocate entry, partner exports masking, intake screener selection under the Part 2 "No", every DMC-ODS episode writer, waiting-room transport recheck, /start sub-pages, payer config, unregistered route guards, the reload role-restore behaviour.
