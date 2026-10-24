# Friday cleanup closeout — Oct 24, 2026

## 1. Result and scope

- Rollback recorded before work: `9ddf890f292d97976fa34c042169eea200de99d1`.
- Accepted full units from the preceding continuation: **3,003/3,003**. This is the user's accepted result; the old temporary unit log did not survive the sandbox replacement.
- This continuation initially found neither `/tmp/fri-browser.log` nor a surviving Playwright process. Relaunched with `setsid`, alone against the running app, `E2E_BASE_URL=http://localhost:8080 bunx playwright test --workers=1`, with `echo "EXIT $?"` appended. Polled in nine-minute intervals without ending the turn.
- **224 passed (44.5m), literal `EXIT 0`.** No named-flake exception, retry, or standalone rerun was needed. Full preserved log: `docs/friday-cleanup-evidence/full-browser-summary.txt`.
- **17 regenerated screenshots restored; all 265 rollback images byte-identical.** Restoration manifest: `docs/friday-cleanup-evidence/screenshot-restoration.json`.
- Current app diagnostic signal: `build OK`. Existing inputValidator deprecation warnings are unrelated; no runtime behavior was changed for them.
- No publishing, Supabase, database, connector, rate, claim-state, consent-policy, or emergency-code changes. `src/lib/ehr.ts`, `playwright.config.ts`, and `e2e/staffNewAudit8a2.spec.ts` are byte-identical to this rollback.
- Final managed revision is returned in chat after recording this report and roadmap; the report does not embed a self-referential future commit hash.

## 2. Patient-name sweep

Existing `staffPatientLabel` returns the full name only when the acting viewer can open that chart; otherwise the existing program ID. No chart-access rule was widened. Operational surfaces can be reached for records for which chart access is not available, so their labels now use that rule. Full-name blocks and chart-dependent drawer content retain explicit access gates. References below are current source lines.

| Surface | File:line | Reachable without this patient's chart access? | Verdict |
|---|---|---|---|
| admin-audit | `src/routes/admin-audit.tsx:226` | Yes, audit inventory | Label helper; program ID without access |
| admin-documents-audit | `src/routes/admin-documents-audit.tsx:149` | Yes, document inventory | Full name gated with `viewerCanOpenChart` |
| group-audit | `src/routes/group-audit.tsx:136` | Yes, session audit | Full name gated; program ID remains |
| disclosure-log | `src/routes/disclosure-log.tsx:77,99` | Yes, log and patient selector | Helper in display and selector; no name initials workaround |
| cosign-inbox | `src/routes/cosign-inbox.tsx:190,279,477,524,545` | Yes, routing/ownership queues | Helper in five label/accessible-label paths |
| caseload-review | `src/routes/caseload-review.tsx:122` | Yes, operational review | Helper |
| case-manager | `src/routes/case-manager.tsx:414,507,590` | Yes, management lists | Display helpers; existing internal search/filter binding unchanged |
| clinician | `src/routes/clinician.tsx:576,678,682,894,984,1129,1186` | Yes, shared staff variants; not exclusively an own-caseload view | Helper in header, missed-visit, rescreen, switch, refill/history labels |
| CrisisQueueDetails | `src/components/escalations/CrisisQueueDetails.tsx:152,193` | Yes, scoped crisis queue | Name gate/helper in both rows |
| GroupJoinRequestsQueue | `src/components/groups/GroupJoinRequestsQueue.tsx:66–69` | Yes, group request queue | Helper |
| clinical-referrals | `src/routes/clinical-referrals.tsx:42–47` | Yes, referral list | Name gated/helper fallback |
| PostEnrollmentSetupCard | `src/components/PostEnrollmentSetupCard.tsx:104,118–124` | Yes, enrollment operations | Name gates in table/card, safe label sorting |
| ClientRecordDrawer | `src/components/ClientRecordDrawer.tsx:22,53,98` | Invocation may be reachable; body must not be | Entire record body wrapped in existing `RestrictedChartGate` |
| AfbiContactForm | `src/components/afbi/AfbiContactForm.tsx:75,156` | Yes, contact workflow/picker | Helper in person label and options |
| PatientMatchingQueue | `src/components/identity/PatientMatchingQueue.tsx:30–55`; `src/lib/patientMatching.ts:411–414` | Intentional identity-comparison exception | **Gated, no change:** only `clinical_coordinator`, `sys_admin` review matches; names needed for merge decisions. Host `/data-exchange` has the same role gate |
| ExistingPersonStep | `src/components/identity/ExistingPersonStep.tsx:29–47`; `src/components/frontdoor/SignupFlow.tsx:617–627` | Intentional assisted-signup identity exception | **Gated, no change:** comparison rendered only with an operator. Host `src/routes/assisted-signup.tsx:45,79–80` uses `canRunAssistedSignup`; `src/lib/roles.ts:797–802` permits `ecm_provider`, `cf_care_manager`, `peer_specialist`, **sys_admin**. Create-anyway action has the same gate (`chartActions.ts:1129–1136`) |
| WorkspaceDashboard | `src/components/clinician/WorkspaceDashboard.tsx:69,116,147` | Yes, shared staff dashboard | Helper in next visit, schedule, caseload labels |
| DashboardActionLauncher | `src/components/clinician/DashboardActionLauncher.tsx:141,147,153` | Yes, existing role-gated launchers | Helper in drawer/picker/task labels; handlers unchanged |
| Agentic list | `src/routes/agentic.index.tsx:68` | Yes, prototype list | Helper |
| Agentic review | `src/routes/agentic.chart-review.$patientId.tsx:70,127` | Yes, permitted prototype facts can precede chart access | Helper for heading; illustrative narrative gets first name only with chart access, otherwise program ID |
| Agentic scribe | `src/routes/agentic.scribe.$patientId.tsx:47` | Yes, permitted scribe host | Helper |
| Agentic dictation | `src/routes/agentic.dictation.$patientId.tsx:25–40` | Route resolves an ID | **No change:** no rendered patient name; generic retired-screen notice and links only |

NEW `src/lib/__tests__/privacyP3NameSweep.test.ts` pins helper/gate source paths, the drawer gate, identity exceptions, and concrete sys_admin program-ID versus care-team name behavior. Source pins are not a claim that every role/screen combination was rendered in a separate new browser test. Existing full browser suite exercised RBAC, queue projections, billing lifecycle, and desktop/mobile accessibility.

## 3. Billing service date

Reproduced source cause: standalone claims without an appointment used the first claim history timestamp rather than stored `serviceDate`. Bare ISO calendar dates also parsed as UTC, risking the previous day west of UTC.

- `src/routes/billing.tsx:148`: `date: c.history[0]?.at ?? c.updatedAt,` → `date: c.serviceDate ?? c.history[0]?.at ?? c.updatedAt,`.
- `src/routes/billing.tsx:436`: calendar-date strings use local midnight (`${date}T00:00:00`) before formatting; actual timestamps preserve their prior parsing.
- NEW `src/lib/__tests__/billingServiceDate.test.ts`: stored-date selection pin, calendar-day assertion for **2026-09-01 → day 1**, and real store claim preserving **2026-09-01**.
- No rates, units, lifecycle state, ownership, privacy payload, exports, or store behavior changed. Accepted units and passing full browser billing parity/lifecycle tests cover the surrounding flow.

## 4. staffNewAudit8a2 timing — investigation only

Prior continuation reported five timing runs on current and five on a `git archive` copy of `0089ca4f` at :8091: current **15.9–22.0s**, rollback ordinary runs **15.0–17.1s**, with one cold outlier around **50s**. That evidence and the unchanged timeout were accepted by Mitchell in the continuation. **The temporary per-step timing logs did not survive this sandbox replacement; these are historical reported ranges, not newly verified raw samples.** No per-step values have been invented or reconstructed. The source archive timings were not rerun during the full suite.

Fresh full-suite evidence: `e2e/staffNewAudit8a2.spec.ts:29` passed for clinical_coordinator in **17.1s** and therapist in **26.6s**, out of the unchanged inherited **30s**. The therapist case used about 89% of the budget. This supports the timing-edge concern, not a causal regression claim; historic cold behavior also existed in the rollback. A **60s proposal** remains with Mitch, not implemented. Spec, assertions, waits, retries, and timeout remain byte-identical to the Friday rollback.

## 5. Demo-only inventory completion (docs only)

Overview: `docs/demo-only-inventory.md`. This is a source-based inventory of controls included by the app, **not verification of the currently hosted published deployment**. DemoControlsBar is mounted in the common AppShell/WebsiteLayout without a dev-only gate. Destination screens retain role/session gates. StaffRoleSwitcher and AppShell picker change the acting identity in local storage; this prototype impersonation is not production authorization. The non-staff migration actor is neither selectable nor assignable.

### Every selectable QA scenario

All below are selectable through `src/components/DemoStateSwitcher.tsx:42–167`; `apply` behavior is at :298–401. Class **(a)** is the selector tool, **(c)** the fictional records/states, with simulated billing behavior **(b)** in billing_lifecycle. Selecting a state frequently selects existing records rather than recreating them. Reachability of the destination still depends on its existing gates.

| ID / label source | What selection does | Class |
|---|---|---|
| billing_lifecycle :61–65 | Loads real-store demo lifecycle, switches acting role to billing, opens billing | a/b/c |
| no_record :67–70 | Clears member/advocate session and current patient, opens start | a/c |
| mh_only :72–75 | Selects Elena demo scenario, opens home | a/c |
| medication :77–80 | Selects Paloma medication demo, opens home | a/c |
| sud_consented :82–85 | Selects Luis demo, opens home; real consent gates still decide | a/c |
| combination :87–90 | Selects Jasmine demo, opens home | a/c |
| ji_self_report :92–95 | Selects Victor demo, opens home | a/c |
| sud_no_consent :97–100 | Selects Jordan demo, opens home; label is not authority to grant consent | a/c |
| pre_release :102–105 | Selects existing Tomás demo referral, opens intake; no in-facility enablement | a/c |
| public_referral :107–110 | Selects Carmen demo, switches cf_care_manager, opens referral queue | a/c |
| advocate :112–115 | Clears patient session, ensures Rosa advocate link to p1, opens advocate | a/c |
| advocate_and_patient :117–120 | Ensures Alicia advocate link to a different patient p1, restores own p4, opens advocate | a/c |
| ji_post_release :122–125 | Selects p1, opens home | a/c |
| general_population :127–130 | Selects p4, opens home | a/c |
| rosa :132–135 | Selects p2, opens intake | a/c |
| marcus :137–140 | Selects p3, opens home | a/c |
| kayla :142–145 | Clears advocate state and opens cosign inbox; does not independently grant a role | a/c |

### Individual registry/label evidence

There are **16 flags but 15 simulated integrations**. `in_facility` is explicitly `simulated: false`, off by default; no app code was changed to make it match the inventory's earlier inaccurate blanket claim. Registry labels (`features.ts:225–253`) are not proof of rendering. Missing label evidence is recorded, not silently repaired in this docs-only item. Class **(b)** below unless noted.

| Flag / features.ts lines | Reachability and visible-label evidence |
|---|---|
| in_facility :41–46 | Off by default; hidden actions filtered by `roles.ts:1117`. Testing gate (a), not simulated; no Simulated label |
| hie_simulated :49–54 | Data exchange host limited to clinical_coordinator/sys_admin (`data-exchange.tsx:52–55`); linked action `chartActions.ts:1120`; no dedicated rendered label established |
| voice_intake :57–62 | Voice hosts; `src/components/voice/AdelVoice.tsx:59` voice-simulated label |
| adel_drafts :65–70 | Existing chart-draft hosts/access; `src/components/chart/AdelDrafts.tsx:51` adel-draft-simulated |
| placeholder_lab :73–78 | Existing lab action role gate (`chartActions.ts:405`); dedicated visible label not established |
| cures_placeholder :81–86 | Existing prescribing gates (`chartActions.ts:262,275`); dedicated visible label not established |
| eligibility_simulated :89–94 | Existing eligibility gates (`chartActions.ts:914`); dedicated visible label not established |
| erx_simulated :97–102 | Existing prescribing gates (`chartActions.ts:253,262`); dedicated visible label not established |
| telehealth_simulated :105–110 | Member appointment host; `src/components/patient/AppointmentsSummary.tsx:145` non-live join copy |
| caloms_export_simulated :113–118 | Existing export gates (`chartActions.ts:929,1267,1298`); `county-reporting.tsx:117` has separate county simulated copy; a flag-specific rendered link not established |
| notifications_simulated :121–126 | Existing notification actions (`chartActions.ts:745,983,1155`); dedicated label not established |
| payments_simulated :129–134 | Existing billing actions (`chartActions.ts:867–902`); dedicated flag label not established |
| scribe_simulated :137–142 | Scribe host gates retained; `agentic.scribe.$patientId.tsx:53`, `ScribeWorkspace.tsx:94,175`, `admin-vendors.tsx:25` |
| llm_simulated :145–150 | Existing brief audience/access/feature gates; `src/components/chart/AdelBriefSections.tsx:67` |
| calendar_sync_simulated :153–158 | Existing calendar host gates; `src/components/calendar/CalendarSyncCard.tsx:20` |
| consent_upload_simulated :161–166 | Consent-write gate (`chartActions.ts:158`); upload-specific `UPLOAD_SIMULATED_LABEL` (`consentCapture.ts:25`) rendered at `ConsentCapturePanel.tsx:147,232`, not proof of universal registry-label rendering |

Dev/e2e-only inspection (`VITE_E2E`, devJourneys, adelBriefCheck) and feature override details remain in the overview. Fictional seeds live in ehr/identityDemoSeed/advocateDemo and scenario stores (c). Agentic PrototypeBanner/SampleBadge and handwritten narrative at `agentic.chart-review.$patientId.tsx:85,124–132` are placeholder copy (d); the retired dictation notice at `agentic.dictation.$patientId.tsx:34` explicitly mentions the removed sample screen. Draft notices are policy-review markers, not vendor simulation proof. No code changed for this inventory.

## 6. Adapter ledger — immutable baseline, exact-once only

No existing assertion was removed, skipped, loosened, or regenerated. No fixture, retry, timeout, emergency assertion, or baseline change. New tests are separate files. Adapters use literal pairs and throw when an anchor does not occur exactly once.

### withApprovedConsentB2 per-path change

`src/lib/__tests__/billingProjectionB3b.test.ts:12,95–97` actually composes **withApprovedConsentB2**, not billingWorkspaceB3bApproved. It compares clinician/ehr/etc against `b1d3c414`. The accepted FRI block is at `src/test/consentB2Approved.ts:218–269`; :274 now selects `B2` **only for src/lib/ehr.ts**, otherwise `FRI[path] ?? []`. Unmapped paths remain exact passthrough; the old B2 substitutions themselves are unchanged and ehr.ts behavior/source are unchanged versus Friday rollback. Every other byte remains pinned.

The **11 literal clinician pairs**, in block order:

| Adapter lines | Before → after |
|---|---|
| 225–226 | roles import → same import plus staffPatientLabel import |
| 229–230 | header returns Card → same block with headerActor = useActingStaff() |
| 233–234 | patient.firstName + lastName → staffPatientLabel(headerActor, patient.id) |
| 237–238 | p.firstName + lastName → staffPatientLabel(noShowActor, p.id) |
| 241–242 | optional p first/last → guarded helper, fallback Patient |
| 245–246 | component/t prelude → same plus rescreenActor |
| 249–250 | rescreen first/last → staffPatientLabel(rescreenActor, r.patient.id), retaining the exact current one-space indentation difference in the span anchor |
| 253–254 | clinicians/outgoing prelude → same plus switchActor |
| 257–258 | outgoing patient full name → helper(switchActor), same ID fallback |
| 261–262 | refill name + medication → helper(role, actor.staffId), same medication text |
| 265–266 | history patient full name → helper(role, actor.staffId), same ID fallback |

### Other approved adapters

- `src/test/privacyP3Approved.ts:27–36`: four clinician pairs (headerActor, rescreenActor, switchActor declarations and refill label). :37–41: two WorkspaceDashboard pairs (next-visit name → helper and CaseloadTile name → helper with local actor). Existing substitutions remain untouched; exact-once enforcement retained.
- `src/test/billingB3bApproved.ts:3–5`: one billing date pair, old history-first expression → stored serviceDate-first expression. Existing three ingestion substitutions unchanged. Date cell's local-calendar guard is app presentation, not a clinical or financial rule.
- `src/test/billingWorkspaceB3bApproved.ts`: **no Friday change**; existing coverage-input substitutions retained. No clinician substitutions were incorrectly added there.

## 7. Follow-ups and closure

Friday cleanup is complete with direct browser `EXIT 0` and restored image baselines. B2 remains complete. Outside this batch: backend-phase typed-writer conversion; **advocate_release has no gate reader — decide in backend phase**. staffNewAudit8a2 timeout proposal remains with Mitch. The missing simulation-label evidence and lost historic raw timing detail are disclosed above, not treated as newly verified results or authorization for further code changes.