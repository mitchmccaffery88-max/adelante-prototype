# Privacy P2 — stopped, not complete

## Oct 20 continuation — current status (supersedes earlier stop below)
- Approved snapshot update applied: exactly 17 new `coordinator_emergency_unlock` keys, all `hidden`. Removing only those added lines reproduces the prior snapshot byte for byte. Coordinator is hidden because the real gate requires a patient and actor/site eligibility; the matrix supplies no patient. No other snapshot entry changed.
- Two NEW group assumptions corrected with baseline grant equality plus explicit group-note denial; no reduction in assertions. Combined focused validation **28/28**; NEW surface tests **7/7**.
- Full unit suite **2,773 passed / 2,774 total**, **343 passed / 344 files**, 53.66s, EXIT 1. Log `/tmp/privacy-p2-units.log`.
- STOP: existing `privacyP1.test.ts:109` asserts no `PRIVATE-P1-PLAN` anywhere in coordinator draft output. Its preceding test inserted a standard SUD note with that same marker; the counseling test then enables TPO consent. P2 lawfully includes the standard note, so this marker cannot distinguish the forbidden counseling note. NEW isolated tests prove the unique unreleased counseling marker absent. No existing test source/assertion changed.
- Proposed delegated approval: give only the counseling fixture a unique plan marker and assert that marker absent, leaving the standard fixture and all other assertions unchanged. Not applied.
- Current source checkpoint before this report update: `088271d8bd423f3a6262bca6472304d390531c80`; no final SHA or completion claim.
- Browser suite **not started**, as required by the existing-assertion stop rule. Tracked screenshots/images **0 differences** vs `c5c3da6a`. No publish or 9a; neither flake exception used.
- Latest observed preview compilation **build OK**, 2026-10-20T03:13:11Z.

### Surface changes and remaining verification
- `patientSearch.ts` / StaffPatientSearch: coordinator lookup results contain identifier fields only, no clinical bodies, regardless of consent/release. No note-body search exists; none added.
- `notePdf.ts`: authorization precedes disclose(), actor propagated to model, coordinator SOAP-only output omits template item answers; authorized exports audited.
- `printRecord.ts`: coordinator output contains authorized signed note bodies and identity only, hides counseling/group entries entirely when blocked, calls disclose() for included notes; print route supplies staff ID. Coordinator medication/MAR print sections not added.
- `agenticPrototype.ts`, `adelDrafts.ts`, `askAdel.ts`: coordinator patient answers/drafts consume bounded record summaries, not raw charts, screener answers, task/alert/referral or private-check-in data; counseling only with its separate release.
- `adelBrief.ts`: coordinator bullets use projected medications, attendance, SUD goals and labs; actor/consent/release/emergency-state cache partition and synchronous coordinator reads prevent old grant-key reuse. `adelBriefCheck.ts` checks current authorized source content.
- `part2Disclosure.ts`: emergency channel independently validates coordinator exception/detail/reference.
- NEW tests cover identifier search, note preview, PDF/print disclosure, standard/counseling summary inclusion and exact four-hour expiry.
- Remaining: live emergency dialog/banner/compliance flow, comprehensive read-audit/expiry review including note preview and print state, populated tests for every B record type, full green units then full background browsers polled to EXIT. P2 remains incomplete; preceding inventory table records the unchanged per-role scope.

## Versions and scope
- Approved rollback: `c5c3da6af29fc6ed3a3064d84f7b9b9654c7fe28`.
- Recorded starting HEAD: `14fe8a744a3cb730390e39447f84b78fd3d5f054` (different from supplied rollback; both retained).
- Source/test checkpoint at stop: `1597b66a1071db97f4e14e1bb4d472fb0e3b634d`. No final SHA: P2 incomplete.
- No publication, Phase 9a or unrelated role grant. Existing test files and snapshots untouched.

## Stop decision required
`src/lib/__tests__/runAction.test.ts:15` fails its existing permission snapshot after registering `coordinator_emergency_unlock`.
Proposed exact snapshot addition: one `"coordinator_emergency_unlock": "hidden"` key in each of the 17 existing role maps in `src/lib/__tests__/__snapshots__/runAction.test.ts.snap` (billing, billing_coordinator, cf_care_manager, clinical_coordinator, clinical_trainee, community_health_worker, credentialing_coordinator, ecm_provider, lvn, medical_assistant, nurse_rn, peer_specialist, physician, pmhnp, sud_counselor, sys_admin, therapist). All existing keys/values stay unchanged. The matrix evaluates without a patient, so even coordinator is hidden there; the patient-specific NEW test proves an eligible coordinator unlock succeeds.

No snapshot update has been applied. No attempts to hide the registry entry from the snapshot or weaken the assertion.

## Validation actually run
- Focused: `privacyP2.test.ts` + existing `runAction.test.ts`: **14 passed / 17 total**, 2 files, 5.21s, EXIT 1.
- NEW P2 tests: **8/10**. Two failures at `privacyP2.test.ts:24` are an incorrect NEW fixture expectation: existing `group_notes` already grants clinical_coordinator consent-gated read, and the copied fixture has consent. Source group matrix is unchanged. Fix the new assertion to test that P2 does not change the baseline group grant, while the item projection still excludes group content; do not change the existing production group policy without separate approval.
- Existing registry tests: **6/7**; sole failure `runAction.test.ts:15` above. Exactly-one standard-event stub assertion passes; real emergency unlock NEW test confirms exactly one disclosure/access-domain audit rather than duplicate success events.
- Latest observed preview compilation: **build OK**, 2026-10-20T01:59:18Z.
- Full unit suite **not run**; full browser suite **not started**, per stop rule. No P1 totals reused as P2 totals.
- Tracked images compared by Git object hash against rollback: **0 differences**; no browser screenshots generated this turn.
- No use of either timing-flake exception.

## Exact role capability boundaries (before → current source)
The broad `screeners_sud` matrix stays unchanged for every role. All other-role medication, ASAM, group, write and disclosure rules also remain unchanged. Counseling matrix previously default-denied every role.

| Role | Existing SUD screener capability | P2 B-item policy before → current | Counseling before → current | State reporting before → current |
|---|---|---|---|---|
| ecm_provider | consent-gated | no new P2 grant → unchanged | none → none | none → none |
| cf_care_manager | none (stored-result author exception unchanged) | unchanged | none → none | none → none |
| sud_counselor | read | unchanged | none → none | no P1 grant → unchanged |
| clinical_trainee | consent-gated | unchanged | none → none | none → none |
| medical_assistant | none | unchanged | none → none | none → none |
| peer_specialist | consent-gated | unchanged | none → none | none → none |
| community_health_worker | none | unchanged | none → none | none → none |
| therapist | read | unchanged | none → none | no P1 grant → unchanged |
| physician | read (PMHNP inheritance) | unchanged | none → none | no P1 grant → unchanged |
| pmhnp | read | unchanged | none → none | no P1 grant → unchanged |
| nurse_rn | read | unchanged | none → none | none → none |
| lvn | read | unchanged | none → none | none → none |
| billing | none | unchanged; no P2 data | none → none | none → none |
| clinical_coordinator | none → none | none → allowlisted projection with tpo/specific_written or actor+patient-specific active emergency | none → read only with separate release | CalOMS/TPS owner → unchanged |
| credentialing_coordinator | none | unchanged | none → none | none → none |
| billing_coordinator | none | unchanged; no P2 data | none → none | none → none |
| sys_admin | none | unchanged | none → none | no P1 grant → unchanged |

This is a source-level capability inventory, **not a completed surface-by-surface or full-suite parity verification**. Other roles' pre-existing ASAM/DMC-ODS rights continue independently of the P1 reporting grant column.

## Inventory and source changes so far
| Surface / file | Before | Current / remaining |
|---|---|---|
| `src/lib/ehr.ts:1662-1669` | coordinator consent aggregate-only, no separate counseling release | release field added; absent/false blocked |
| `src/lib/roles.ts:920-944,1700-1727` | generic matrix, summary note body redaction | separate counseling read gate and coordinator note-body filter; generic screeners matrix unmodified |
| `src/lib/coordinatorSudAccess.ts` | absent | eight allowed B item classifications; independent release; actor+patient four-hour live gate; no group notes |
| `src/lib/coordinatorSudView.ts` | absent | allowlisted real-record projections of diagnoses, structured SUD goals, doses/adherence, lab results, attendance, episode discharge summaries, standard notes and separately released counseling notes; no raw patient/screener/ASAM/task payload |
| `src/components/chart/CoordinatorSudPanel.tsx`, `src/routes/record.$patientId.tsx:200-207` | no coordinator SUD detail panel | read-only projected panel, ConfirmDialog/FormField emergency form, active banner and periodic expiry refresh; browser verification pending |
| `src/lib/coordinatorSudEmergency.ts` | absent | role+site chart gate, reason/detail/reference validation, start/end, disclosure-linked review item, medical follow-up marker |
| `src/lib/chartActions.ts`, `src/lib/actions/runAction.ts:189` | no coordinator emergency action; universal standard success audit | new registry action uses domain disclosure event as its sole successful unlock audit; blocked attempts retain existing audits |
| `src/lib/part2Disclosure.ts:177-239` | medical emergency reason retained | coordinator-only exception channel with audit/court reference/detail/start/end, pending review and one audit; external paths do not inherit these new exceptions |
| `src/lib/chartAccess.ts:87-139`, `src/routes/quality-compliance.tsx:64-72` | restricted-record review queue | disclosure-linked emergency reviews reuse queue and medical follow-up marker |
| `src/lib/notePdf.ts:45-96` | coordinator base therapy-note denial | coordinator-specific note gate before generic gate; outbound disclosure pipeline unchanged; additional surface tests required |
| `src/lib/adelDrafts.ts:89` | generic note-class check | coordinator-specific note filter (no broad screeners grant) |
| `src/components/agentic/NotePeekSheet.tsx:12-28` | generic note-class/base check | coordinator-specific read gate; view auditing/expiry refresh coverage incomplete |
| `src/lib/unsignedWork.ts:64-71` | generic note-class gate | coordinator-specific note row filter |
| `src/components/clinical/recordSections.tsx:271-340` | ASAM/CalOMS/orders/notes broad section gates | unchanged; coordinator panel avoids granting these whole sections |
| `src/lib/asamReporting.ts:35-111` | coordinator medication/ASAM withheld; guarded totals | unchanged; no worksheet/aggregate widening |
| `src/lib/structuredCarePlan.ts:591-608` | role-filtered plan | unchanged; new projection selects only SUD goal treatment-plan fields, omits source worksheet metadata |
| `src/lib/chartOrders.ts:61-73,142-148` | role-filtered labs | unchanged; bounded projection uses existing complete lab reader only after P2 gate, returns lab/result fields |
| `src/lib/printRecord.ts:157-190,228,292` | generic base section gates | unchanged; coordinator record-print integration still pending |
| `src/lib/patientSearch.ts:76-99` | identifier search returns original patients to existing callers | unchanged; explicit coordinator note-search surface tests/projection integration pending |
| `src/lib/agenticPrototype.ts:56-197` | existing facts include whole patient/read models | unchanged; coordinator-safe B-only summary input integration still pending |
| `src/lib/adelBrief.ts:118,143,282,391-510`, `src/lib/adelBriefCheck.ts:55,93-98,237,270` | broad filtered helpers and cached output | unchanged; coordinator bounded summary data and grant/release/expiry cache partition integration pending |
| `src/lib/askAdel.ts:145-146`, `src/lib/scribe.ts:174` | existing SUD gates | unchanged; final coordinator input audit required |
| `src/lib/myWork.ts:385-387`, `src/lib/careMessageMasking.ts:17` | existing screeners gates | unchanged; no broad message/screener widening |

## Incomplete / not claimed
- Finish chart/search/export/summary integration parity and audit **every** actual coordinator SUD view; current panel audit alone is insufficient.
- Finish summary/cache expiry handling across Adel Brief, agentic and draft consumers.
- Add NEW populated-record tests for each actual B item and counseling presence/absence in chart/search/export/summary, plus browser emergency dialog/banner/compliance flow.
- Validate court/audit registry paths and rejected attempts, repeat/unlock/expiry read behavior end-to-end.
- Confirm notes tagged psychotherapy tier are segregated on every reader; no automatic tagging of existing clinical notes performed.
- Run full units then full background one-worker browser suite to EXIT, restore screenshots, and finalize totals/SHA only after approved stop resolution.

No P2 completion claim; working changes remain an incomplete prototype.