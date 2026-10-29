# Care-team / reasoned-open access batch — partial resumed implementation

**Draft — pending go-live permissions audit. Partial, not accepted.** 28 Oct 2026. Nothing published; persistence OFF; no TEST project/secrets, Cloud or GitHub changes.

**Part 2 internal-use basis: pending counsel confirmation.**


## Final browser acceptance (29 Oct)

**Cause of `websiteDianaPass1.spec.ts:5` (390, en).** In `CoreServices`, the service card opens on `mouseenter` when the pointer reports `(hover: hover)` (true for Playwright's desktop Chromium at 390px and for touch laptops/hybrid phones with a mouse). A click therefore fired `mouseenter` (open) and then the button's `onClick`, which toggled from the rendered `expanded` value. When React had already re-rendered between the two events, the click read `expanded=true` and closed the card again; whether it did depended on timing under load, which is why it failed only in the full run. No overlay was involved.

**Fix (component, not test).** The card records when it was opened by hover; the next click on that same card keeps it open (and consumes the marker) instead of toggling, and plain clicks toggle with a functional state update. A first tap/click always opens, `aria-expanded` follows the same state, and mouse-leave/blur still close. No retries, timeouts or assertions changed.

**Acceptance.** Full units 3,670/3,670 (415 files). Nine public/website specs, one worker against :8080, after units and not overlapping, twice in a row: run 1 **53/53** (15.3 min), run 2 **53/53** (13.0 min). Logs `/tmp/moud/public-run1.txt`, `/tmp/moud/public-run2.txt`. Build OK.

**Access-rules batch closed (Draft).** Chart, packet and handoff read groups opened by separate approvals; reason/coverage commands stay browser-revoked until phase 2d; Part 2 internal-use basis pending counsel; persistence OFF; nothing published.

## 29 Oct Step 5 — rollback proofs complete, three approved groups opened

Connected-main rollback acceptance passed **112 checks** covering the requested all-role/dated/group/Intake/member/MOUD/Part 2/restricted vectors. Candidate chart identity/contact/team and general packet/checklist/needs/handoff policies were also tested with actual authenticated reads inside a transaction that rolled back all policy changes. Detailed vectors, fixture corrections, migration IDs and all-table count evidence are in `docs/rls-evidence/access-rules-rollback.md`.

Every public base-table count plus auth.users remained equal before/after. Independent final users/accounts/patients/team/reasons/coverage: **0/0/18/22/0/0**. No helper overrides, matrix changes or grants to browser commands. Handoff date is day1; local date difference59 is allowed day60, difference60 denied day61. All candidate policies remain closed after proof.

The individually approved **chart group** is applied (`20261029023403_e5ccfe2c-a977-4686-9fac-d179ac50ee01`): staff_chart_identity, staff_chart_contacts and team_context through same-org existing demographics gate. The separately approved **general packet group** is applied (`20261029125738_b4616f5f-a372-4098-b59b-17f72be21815`): packet_general_only, packet_needs and intake_scoped checklist through the existing packet gate. The separately approved **handoff group** is applied (`20261029134441_74e60da0-8e1a-4351-bdef-f16205a416ec`): intake_scoped on first_visit_handoffs through that gate. All seven installed predicates read back correctly; full47-public/auth.users count map equals the rollback baseline; matrix remains792 rows (read checksum87fb6d48742a73f6c6a68a2f23f140cc). Patient own-row policy unchanged; tagged Part2 documents excluded; both browser commands remain revoked. No failing group opened. Nothing published, persistence OFF.

Post-opening full units: **3,662/3,662**, **414/414 files**, 285.64s (13:45:08 UTC start), `/tmp/access-step5/units-final.txt`. Public suite ran afterward, one worker :8080: **52 passed /1 failed,19.9m** (`/tmp/access-step5/public-final.txt`). Sole failure `websiteDianaPass1.spec.ts:5` mobile390en: group-session accordion aria-expanded stayed false after click (15s assertion). Unchanged standalone passed1/1,11.0s test/27.8s run (`/tmp/access-step5/diana-standalone.txt`); this is NOT a named-flake exception, so the full suite remains failed and work stops under the standing rule. No assertions/retries/permissions changed. Final green browser acceptance and separate final preview closeout remain blocked. Build OK14:05:46UTC. The checksum helper refused this read-tool role, so the readback used a direct read-only aggregate rather than changing its permissions.

## 29 Oct shared-gate and catalog checkpoint

Step 4 app checkpoint complete. Today visit click, Inbox request link, bell cancellation link and case-manager quick peek all reached the shared reason gate for an off-team therapist. Quick peek now defers the patient lookup and section hooks to the gated child; the clinician selected-patient lookup checks entry first and keeps the reason gate visible for the selected ID. Actual Covering/consult open loaded the record only after the gate and read back the persistent reason banner. Search/deep-link/print/embedded picker and canonical patient access-log reason proofs from the preceding checkpoint remain applicable. No matrix values changed.

- Full units after gate changes: **3,660/3,660**, **414/414 files**, exit 0, 133.43s. Saved `e2e/accessClickThroughOct29.spec.ts`: **1/1**, exit 0, one worker :8080 after units.
- Full units after catalog DEA refactor: **3,662/3,662**, **414/414 files**, exit 0, 196.51s. Focused DEA/as-of/Billing projection **29/29**. First catalog full run had one test using a nonexistent exported catalog variable (3,661 passed/1 failed); corrected to existing listServiceTypes accessor, not by changing any product assertion.
- Approved exact-once SHA-256 source adapters retain prior-source hashes and verify replacement output; Billing codes/dates/provider/units and note-text exclusions remain unchanged. Accepted 73 snapshot rows and sys_admin go-live reversals below are untouched.
- DEA classification is now solely the matching existing Draft catalog entry `med_management`, pending Mitch confirmation; booking and Billing receive no controlled flag. Live registry credential edit → existing Billing Credentialing view produced the DEA review result. See credentialing report.

**Step 5 remains unstarted at this completed green app checkpoint:** all-role temporal/group/Intake/patient/advocate rolled-back SQL vectors, before/after counts and actual candidate-policy reads are still required. No SQL fixture, new count proof, migration or policy opening occurred here. Chart, packet and handoff groups stay closed. Each passing group still needs its own shown migration and approval. Persistence OFF; no publication; reason/coverage command transport revoked until 2d.

Full public browser suite: **53/53**, 12.6m, all nine public/website specs, one worker :8080, started after green units with no overlapping browser suite. Includes the unchanged on-team HLOC required-element/disclosure test. Post-suite actual registry credential edit → Billing DEA readback passed again, no page errors; shared click-through browser regression **1/1**, 25.5s including setup. Logs `/tmp/access-oct29/{units-dea-final,public-final,clickthrough-final}.txt`, `/tmp/browser/dea-catalog/final-out.txt`. Build OK. Stopped at the completed app/catalog checkpoint rather than claiming unproved SQL acceptance.

## 28 Oct step 4 green-unit checkpoint — partial, no policy opening

The patient and compliance access-log hosts now display only validated canonical reason labels; active reason grants attach the reason code to subsequent content-free record/print access events. Typed opening notes never enter those log rows. No matrix or access-log audience expanded.

Full units: **3,658/3,658**, **413/413 files**, exit 0 (176.97s). Focused DEA + access-log tests: **10/10**, exit 0. On-team HLOC browser fixture: **1/1**, exit 0, after units, one worker :8080; required-element/disclosure assertions unchanged. Full public suite not run.

Live fictional acting-role preview readback proved global search `Reason needed` → gate; direct chart deep link → gate; print/PDF route → gate without print document; actual Other + note → chart and non-dismissible reason banner; sys_admin patient access-log readback → `Reason: Other`, typed note absent. Inline picker → clinician embedded chart gate also passed. Screenshot evidence `/tmp/browser/access-step4/{search-gate,deep-link,print-PDF,banner,reason-log}.png` and `/tmp/browser/access-launchers/picker-embedded-gate.png`; no page errors on successful runs. Initial cold dependency load and duplicate fictional matching failures were corrected only in the temporary verification script; no product matching rule or timeout changed.

**Step 4 remains incomplete:** Today, inbox, bell and quick-peek drawer click-throughs are traced but not browser-proved in this checkpoint; no full-route acceptance claim. DEA evaluator/booking/readiness checks pass, but Billing projections intentionally strip the controlled-service fact and UI capture is not yet present. Stopped rather than expanding those approved privacy allowlists; details in the credentialing report. The accepted 73 snapshot rows and sys_admin go-live reversals below remain unchanged.

**Step 5 not started:** no new SQL vectors, database counts, migration or chart/packet/handoff read-policy opening. All three unproved groups stay closed, and browser execution of reason/coverage commands stays revoked until 2d. No persistence switch or publication. Remaining: privacy-safe DEA end-to-end integration, remaining launcher browser proofs; all-role temporal/Intake/patient/advocate rollback vectors and counts; then separately approved passing policy groups; full public suite and final readback/report/matrix.

## 28 Oct 16:32 approved resume — stopped on an assertion outside named scope

Applied only the approved assertion updates and fixture corrections. The new source adapter validates SHA-256 of the entire previously approved text, then applies exactly one approved re-pin for each of `chartAccess.ts`, `roles.ts` and `navGuard.ts`. Other pinned files are unchanged. No matrix values or application permission logic changed in this resume.

Access tests now explicitly cover cross-site assigned-clinician entry, off-team reason gate, minimal search identifiers and prototype sys_admin oversight. The coverage fixture opens with a registry reason instead of assuming same-site entry. The MOUD fixture adds the assigned manager through the normal registry team action and uses Darnell's actual outpatient ECM role; his historical CF assignment is in-facility-only and remains unavailable. **This is a fixture correction, not completion of the requested episode-assignment/team-write lifecycle.**

Focused fixture/access tests: **45/45 passed**. Registry tests after approved snapshot regeneration: **7/7 passed**. Full units: **3,583 passed / 2 failed**, 407 files, exit 1, 115.99 seconds. Both remaining failures are `billingProjectionB3b.test.ts` therapist/sys_admin source equality against **`src/routes/clinician.tsx`**, not any of the three approved re-pin files. The existing embedded `ChartAccessGate` import/wrapper and its selected-patient guard cause the mismatch. No assertion changed or gate removed to conceal it. Per Mitch's instruction to stop on other failures, further work stopped here; a green full-suite result cannot honestly be claimed within the named pin scope.

Public browser suite and preview readback were not run because units are not green. No migrations, rollback acceptance, or read-policy opening occurred in this resume. Independent database readback: auth.users **0**, accounts **0**, patients **18**, reason grants **0**, coverage **0**. Both command functions remain non-executable by anon, authenticated and service_role. Build OK; nothing published; persistence remains OFF.

### Exact remaining scope

1. Resolve the protected clinician-screen pin conflict without weakening embedded gating or unrelated assertions; rerun full units green.
2. Implement episode-assignment → normal active `care_manager` team membership in the same registry write with one audit, preserve independent memberships when ending, and prove matching SQL behavior. Existing episode opening is not a named registry assignment action; no second episode-ownership chart path was added.
3. Finish coordinator care-team-request, coverage and weekly reasoned-open hosts; Intake logged read-only packet/checklist window; access-log reason readback; complete search/deep-link/print/PDF/embedded gate verification.
4. Prove dated on-call/coverage/supervision, group-context limits, Intake day 60/61, patient/advocate composition and policy-level reads in all-role main rollback acceptance with before/after counts. Open each passing group separately; all unproved groups remain closed.
5. Run public browser suite only after full units pass, then gate/banner/coordinator/Intake preview readback; complete final reports and Draft matrix.

Registry snapshot: **73 changed rows** — 72 additive rows for the four approved chart actions (most hidden for the snapshot's unspecified actor), plus sys_admin `chart_restricted_open` hidden → allowed under prototype chart entry. Clinical-note-content rows and all other existing action outcomes are byte-identical. The complete row ledger follows at the end of this report; snapshot is not proof of patient/identity-specific button/store parity.

## 28 Oct 16:12 revised decision — current state

Reapplied access-rules `app.chart_entry`, active-team helper and 60-day packet helper; did not restore the previous site-only rule. Commands `chart_reason_open` and `clinician_coverage_set` remain revoked for public, anon, authenticated and service_role (privileged rollback setup only; no browser execution or 2d transport).

App: shared reason gate reapplied to record/print routes, quick-peek drawer and clinician embedded chart; minimal reason-needed search remains. Added cycle-free relationship boundary into `canAccess` without editing matrix values. Reason-only clinical Part 2 requires class-specific written evidence and a matrix grant; standard TPO alone cannot satisfy this reason-only check. Consent send/sign-in-person/e-sign permissions remain separate from new sys_admin chart entry.

SQL: `phase2_chart_read` applies the same class-specific consent intersection for reason-only entry; direct paths retain `app.can_access`. Existing coordinator and packet consent checks remain separate. **No read policy opened.** The revised full policy acceptance is not complete.

### Case results this retry

- App physician: reason-only crisis open locks `screeners_sud`; adding an active team assignment preserves the existing read grant; non-granted psychotherapy class stays denied — passed.
- App entry/search/restricted baseline updated for superseded site-only assumptions: 14/14 passed.
- SQL all 18 roles: real claim identity; eligible team entry; off-team denial except oversight; unexpired reason entry; expiry; direct treating SUD-screener grants and reason-only no-consent lock — passed in rollback migration `20261028162346_5c7d2fa1-e0e1-4c44-b4db-8d4e73347bfb`. Every public-table count and auth-user count compared after nested fixture rollback.
- SQL physician consent scope: reason-only locks without consent; specific written `screeners_sud` consent unlocks that class only; `sud_treatment` and psychotherapy remain denied; revoke re-locks — passed in `20261028162530_4a25c373-bd61-4dbf-9f97-0826089ad0e9`.
- Initial consent fixture used invalid `wet_signature`; corrected to existing `wet_sign_upload`, not a schema change. Failed fixture rolled back.
- Unproved this retry: dated on-call/coverage/supervision SQL vectors; group-context limits; Intake authenticated day-60/day-61 rows; complete patient/advocate composition; actual chart/packet/handoff policy reads; full app consent/revoke parity and UI readback. These groups remain closed.

### Current validation and remaining work

Full units ran before browsers: **3,571 passed / 13 failed**, 407 files, exit 1, 230.60 seconds (`/tmp/access-revised-units.log`). Subsequent focused gates/consent tests: **41 passed / 2 failed**; the remaining focused failures are MOUD continuity's assigned CF actor, whose episode ownership is not currently part of the chart-team model. The temporary episode-team workaround was removed because app/SQL must not disagree.

Other full-suite failures include old byte-for-byte chartAccess/roles/navGuard pins, old sys_admin program-ID presentation expectations, coverage test assuming any same-site ECM actor immediately opens a chart, and the registry permission snapshot. Consent test expectations and nonexistent route-test identity were narrowly corrected; full suite has not been rerun afterward. No unrelated matrix assertion was changed.

Public browser suite **not run this retry**, because full units are not green. Previously restored-browser 51/51 below is historical, not validation of this implementation. Coordinator review/request/coverage host, Intake logged checklist host, source-pin adapters, assignment-fixture corrections and remaining policy proofs are unfinished. Build currently OK. No acceptance or complete UI readback claimed.

The sections below retain the historical stop evidence; their restoration status is superseded by this retry.

## What happened

Inventoried `chartAccess.ts`, `chartEntryFor`, `searchablePatientsFor`, `navGuard`, `RouteAccessGuard`, record/print routes, staff search, Intake packet/completion stores, existing supervision/on-call/group sources, and live SQL helpers/policies. The old mandatory-site entry rule is superseded by Mitch's approved plan; it is not itself the blocker.

Built a candidate shared pre-data gate and pure entry/day-window rules, and installed Draft SQL scaffolds through migration tooling. Rolled-back fictional-login tests then exposed a **real existing Part 2 matrix conflict**. All candidate app changes were restored to the pre-batch source boundary, and active SQL entry/team/packet helpers were restored to match the app. No partially implemented access gate is live.

## Part 2 decision resolved

The request says both:
- Keep the existing record-class matrix unchanged.
- Part 2 records must remain locked without consent, even for direct/reasoned chart entry.

The existing `roles.ts` matrix intentionally permits treating therapist/PMHNP/SUD-counselor SUD screener reads without separate consent; physician inherits PMHNP. PMHNP/physician/SUD-counselor have direct SUD treatment grants too. SQL's generated matrix mirrors those rules. The rollback failed with **`part2_no_consent_failed physician`**.

Mitch chose **Keep existing exceptions** on 28 Oct. No-consent negative cases apply only to already consent-gated classes/roles. Existing treating-clinician grants, physician inheritance and counseling-note restrictions remain unchanged. No universal Part 2 prerequisite is authorized.

The next compatibility boundary is the old access assertions: `accessBatch.test.ts` explicitly requires sys_admin denial, same-site direct entry for every chart-capable role, cross-site denial and search containing only immediately enterable patients. Those assertions contradict the approved new entry/search behavior. Source-parity suites also require the old chartAccess/navGuard files byte-for-byte. The candidate would replace these expectations; that replacement has not been retained. Approval is needed for narrowly updating superseded access assertions and exact-once source-pin adapters, leaving unrelated permissions and tests intact.

## Retained database work

Empty, closed `chart_reason_grants` and `clinician_coverage_assignments` scaffolds; additional supervision/group/handoff/log fields; revoked candidate command/window/group helper execution. No patient/advocate policies changed. Existing own-site and identity-review read policies stay as before. No new chart/packet/handoff policy opened.

All fixture transactions rolled back. Independent counts: auth users 0→0, accounts 0→0, patients 18→18, reason grants 0→0, coverage rows 0→0. Successful schema/ledger changes remain; there are no retained test users or fixture rows. Full evidence: `docs/rls-evidence/access-rules-rollback.md`.

## Validation

- Candidate full unit suite: 3,585 passed, 11 failed; recorded, not accepted.
- Restored app: **3,583/3,583 units**, 406 files, exit 0; 130.53 seconds.
- Full public browser suite: **51/51 passed**, exit 0, 10.1 minutes, eight specs, one worker on :8080; started only after restored units completed. No test/config/timeout changes.
- Preview build OK; Supabase linter reports no issues. Generated schema types are the only remaining source change.
- Candidate gate/credential/Intake UI readback: not claimed; candidate implementation removed at the stop boundary.

## Resume scope

With the Part 2 decision resolved, confirm the narrow superseded-test updates, then reapply the coordinated app/SQL gate; preserve consent actions independently from sys_admin chart entry; use actual assigned care-team fixtures rather than old site-only test assumptions; add exact approved source-pin deltas without replacing unrelated assertions. Finish shared search/deep-link/print/PDF/embedded chart gating, grant expiry and minimal projections, coordinator request/coverage/review hosts, access-log reason display, and Intake's logged read-only 60-day packet/checklist window.

Then complete all-role rolled-back SQL acceptance and comprehensive before/after counts; open each passing read-policy group separately; run full units followed by public browser and real preview UI readback. Phase 2d repositories, server write transport, signup parity, storage and persistence switches remain outside scope.| Role | Action | Before | After |
|---|---|---|---|
| billing | chart_coverage_set | absent | hidden |
| billing | chart_reason_open | absent | hidden |
| billing | chart_team_assignment | absent | hidden |
| billing | chart_team_request | absent | hidden |
| billing_coordinator | chart_coverage_set | absent | hidden |
| billing_coordinator | chart_reason_open | absent | hidden |
| billing_coordinator | chart_team_assignment | absent | hidden |
| billing_coordinator | chart_team_request | absent | hidden |
| cf_care_manager | chart_coverage_set | absent | hidden |
| cf_care_manager | chart_reason_open | absent | hidden |
| cf_care_manager | chart_team_assignment | absent | hidden |
| cf_care_manager | chart_team_request | absent | hidden |
| clinical_coordinator | chart_coverage_set | absent | allowed |
| clinical_coordinator | chart_reason_open | absent | hidden |
| clinical_coordinator | chart_team_assignment | absent | allowed |
| clinical_coordinator | chart_team_request | absent | hidden |
| clinical_trainee | chart_coverage_set | absent | hidden |
| clinical_trainee | chart_reason_open | absent | hidden |
| clinical_trainee | chart_team_assignment | absent | hidden |
| clinical_trainee | chart_team_request | absent | hidden |
| community_health_worker | chart_coverage_set | absent | hidden |
| community_health_worker | chart_reason_open | absent | hidden |
| community_health_worker | chart_team_assignment | absent | hidden |
| community_health_worker | chart_team_request | absent | hidden |
| credentialing_coordinator | chart_coverage_set | absent | hidden |
| credentialing_coordinator | chart_reason_open | absent | hidden |
| credentialing_coordinator | chart_team_assignment | absent | hidden |
| credentialing_coordinator | chart_team_request | absent | hidden |
| ecm_provider | chart_coverage_set | absent | hidden |
| ecm_provider | chart_reason_open | absent | hidden |
| ecm_provider | chart_team_assignment | absent | hidden |
| ecm_provider | chart_team_request | absent | hidden |
| intake_coordinator | chart_coverage_set | absent | hidden |
| intake_coordinator | chart_reason_open | absent | hidden |
| intake_coordinator | chart_team_assignment | absent | hidden |
| intake_coordinator | chart_team_request | absent | hidden |
| lvn | chart_coverage_set | absent | hidden |
| lvn | chart_reason_open | absent | hidden |
| lvn | chart_team_assignment | absent | hidden |
| lvn | chart_team_request | absent | hidden |
| medical_assistant | chart_coverage_set | absent | hidden |
| medical_assistant | chart_reason_open | absent | hidden |
| medical_assistant | chart_team_assignment | absent | hidden |
| medical_assistant | chart_team_request | absent | hidden |
| nurse_rn | chart_coverage_set | absent | hidden |
| nurse_rn | chart_reason_open | absent | hidden |
| nurse_rn | chart_team_assignment | absent | hidden |
| nurse_rn | chart_team_request | absent | hidden |
| peer_specialist | chart_coverage_set | absent | hidden |
| peer_specialist | chart_reason_open | absent | hidden |
| peer_specialist | chart_team_assignment | absent | hidden |
| peer_specialist | chart_team_request | absent | hidden |
| physician | chart_coverage_set | absent | hidden |
| physician | chart_reason_open | absent | hidden |
| physician | chart_team_assignment | absent | hidden |
| physician | chart_team_request | absent | hidden |
| pmhnp | chart_coverage_set | absent | hidden |
| pmhnp | chart_reason_open | absent | hidden |
| pmhnp | chart_team_assignment | absent | hidden |
| pmhnp | chart_team_request | absent | hidden |
| sud_counselor | chart_coverage_set | absent | hidden |
| sud_counselor | chart_reason_open | absent | hidden |
| sud_counselor | chart_team_assignment | absent | hidden |
| sud_counselor | chart_team_request | absent | hidden |
| sys_admin | chart_coverage_set | absent | hidden |
| sys_admin | chart_reason_open | absent | hidden |
| sys_admin | chart_restricted_open | hidden | allowed |
| sys_admin | chart_team_assignment | absent | hidden |
| sys_admin | chart_team_request | absent | hidden |
| therapist | chart_coverage_set | absent | hidden |
| therapist | chart_reason_open | absent | hidden |
| therapist | chart_team_assignment | absent | hidden |
| therapist | chart_team_request | absent | hidden |

## 28 Oct 17:20 resume (Draft)
Part 2 internal-use basis: pending counsel confirmation.

### Re-pins (approved)
- `src/routes/clinician.tsx` — exact-once SHA-256 adapter in `src/test/accessRulesOct28Approved.ts` (before `a4dfd995…`, after `9ab8c68e…`). Covers the embedded ChartAccessGate wrapper and selected-patient guard. The billing projection assertions (allowlisted keys only; no note text) are unchanged.

### Accepted snapshot rows
- 73 rows: 72 additive rows for the four new chart actions, plus sys_admin `chart_restricted_open` hidden → allowed.

### Go-live reversals
- sys_admin `chart_restricted_open` allowed (prototype only) → reasoned open at go-live.
- sys_admin direct chart entry (oversight) → reasoned open at go-live.
- sys_admin name labels on chart surfaces → revisit at go-live.

### Validation
- Full units: 3,585 / 3,585 passed, 407 files.

### Not done in this pass (left for next run)
1. ~~MOUD episode → care_manager team write~~ — DONE 28 Oct part B (see "Part B step 1").
2. ~~Coordinator hosts (care-team requests, coverage, weekly reasoned-open review)~~ — DONE 28 Oct 20:23 continuation below.
3. ~~Intake logged read-only 60-day window host~~ — DONE 28 Oct 21:05 continuation below.
4. Access-log reason readback UI; full gate verification.
5. All-role rolled-back SQL vectors (on-call, coverage, supervisor, group, Intake day 60/61, patient/advocate); opening each passing policy group separately. Every read policy is still closed.
6. Public browser suite, preview readback, final evidence doc.


## Part B step 1 — MOUD episode → care team (28 Oct, Draft)
- Registry actions `moud_care_manager_assign` / `moud_care_manager_end` (store `chartRelationships.ts`). Assign sets the episode care manager and adds or keeps an active `care_manager` team row in the same write; runAction writes the single audit row. End removes only the episode reason; a membership held for other reasons (e.g. coordinator `chart_team_assignment`) stays. Replacing the episode care manager drops the previous person's episode reason.
- Assigners: clinical_coordinator, cf_care_manager, ecm_provider (the roles that already open episodes). Assignee must actively hold cf_care_manager or ecm_provider. Chart access then follows the normal care-team rule; Part 2 unchanged (matrix + consent only).
- The pre-release episode screen (in-facility, off by default) runs the action after opening an episode.
- Snapshot: 36 additive rows (18 roles × 2 new actions), zero removed or changed rows.
- SQL mirror: `public.moud_care_manager_assign` / `moud_care_manager_end`, `care_team_assignments.source_refs`; ids/codes-only audit; execute revoked from anon/authenticated (2d transport).
- Rolled-back proof (main): off-team ECM denied before assign; non-care-manager target refused; exactly one audit row; care_manager row active; assigned ECM enters chart; screeners_sud stays locked without consent; ending an episode-only row ends it; a pre-existing membership is kept, not duplicated, and still enters. Before/after: auth.users 0/0, accounts 0/0, patients 18/18, care_team_assignments 22/22, moud audits 0/0.
- Failed attempts first (kept on record): `audit_ids_only` (metadata not ids/codes) → fixed metadata; `active_dates_invalid` (same-transaction end = start) → end time is now strictly after start.
- Units: 409 files, 3,604/3,604.
- Source pins re-pinned this step: none needed.

## 28 Oct 20:23 continuation — tightenings and step 2 (Draft)
Part 2 internal-use basis: pending counsel confirmation.

### Accepted step-1 tightenings
- App and SQL assign checks: cf_care_manager/ecm_provider can assign only themselves, and cannot replace another episode care manager by self-assigning; clinical_coordinator can assign/replace others. Negative tests verify refused writes leave the team unchanged. No matrix or registry permission-row changes.
- SQL migration `20261028202524_ddc385f1-3680-4bfa-8b5d-78f509eda61b`: episode-only end/replacement closes membership at transaction `now()`. For a row created in that same transaction, its start is bounded to one millisecond earlier only on closure, satisfying the existing strict end-after-start validator without leaving access alive against transaction-stable `now()`. Other-source dates and memberships stay unchanged.
- Rollback acceptance `20261028202621_734e42cb-8d71-4798-b270-a4318667475e`: self assignment positive; other-target and self-replacement negatives; coordinator replacement positive; replaced member immediately loses entry; episode-only member immediately loses entry after end; independent-source member retains entry; ECM SUD-screeners remain locked; one assign audit; no duplicate independent membership. Every public base-table count and auth.users compared after sentinel rollback; outer rollback also completed. Before/after independent readback: users 0/0, accounts 0/0, patients 18/18, care-team rows 22/22, MOUD audits 0/0.
- Full units after tightenings: 409 files, **3,607/3,607**, exit 0.

### Step 2 — coordinator hosts complete
- Existing `/admin-coordination` now hosts care-team requests, dated formal coverage and last-seven-days reasoned-open review through `ChartAccessCoordination`. Host mounts only for an active acting clinical_coordinator; other roles get no new reads or actions. Uses existing registry actions, relationship stores and read projections; no SQL/browser transport added.
- Requests show requester, minimal patient identity and date; Add to care team runs `chart_team_assignment` once and changes to On care team. Coverage requires two distinct active clinicians, valid dates and a reason; Save coverage uses `chart_coverage_set` once. Weekly review shows person, actor, reason code's existing label, opened time and expiry, never opening-note text.
- New tests cover all 18 acting roles, non-coordinator read denial/store-action refusal, request readback plus single-audit team assignment, and seven-day review exclusion/no-note disclosure.
- Full units after step 2: 410 files, **3,627/3,627**, exit 0. Build signal: OK. Source re-pins: **none required**; all existing source/privacy pins passed unchanged.
- Preview readback: created a fictional off-team ECM patient through the real store; requested membership through the gate, opened with covering/consult, observed banner, switched to coordinator, approved request, recorded coverage and read back both team access and weekly review. Exactly one Simulated audit per team assignment and coverage save. Desktop 1280 and phone 390 checked; new host width/scrollWidth 358/358; no page errors. Screenshots `/tmp/browser/access-step2/coordinator-desktop.png` and `coordinator-mobile.png`; script/log in the same directory. First attempt timed out while Vite initialized dependencies; fresh retry passed, not counted as a suite result.

### Clean stop after completed step 2
- Steps 3–6 remain: Intake logged read-only 60-day host; access-log reason UI/all-route gate acceptance; remaining all-role SQL vectors and separately passing chart/packet/handoff read policy groups; full public browser then preview acceptance and final reports/Draft matrix.
- Carry-overs remain: HLOC browser fixture with an on-team therapist; DEA checks for prescribers on controlled-substance service types and credentialing report update.
- No full public browser suite run in this continuation. All read-policy groups remain closed. Persistence OFF; nothing published; chart_reason_open and clinician_coverage_set remain browser-revoked (authenticated execution false on independent readback). No matrix change, permission widening or weakened privacy assertion was needed.

## 28 Oct 21:05 continuation — step 3 (Draft)
Part 2 internal-use basis: pending counsel confirmation.

- Completed Intake now mounts `IntakeFollowupPanel` instead of the active packet editor in the existing Intake workspace. Explicit Open intake checklist logs one existing access event; each permitted document open logs one existing event. Read-only handoff checklist, forms status, source-bound needs and packet documents reuse the existing stores. No general chart entry or edit permission added.
- The shared `canReadIntakePacket` window applies to forms and packet-needs projections as well as documents. Handoff day is day 1, day 60 is readable, and day 61 denies all packet projections/content. A mounted host rechecks time and removes visible content/document dialogs when access expires, showing “This person's intake window has closed”. Restricted records and Part 2 consent remain on top.
- New `intakeFollowupOct28.test.ts`: 21 passing checks, including day-60 reads, Pacific-midnight day-61 denial across all packet projections, explicit-open audit counts/content-free metadata, completed-intake write refusals, Part 2/restricted negatives, and all 17 other staff-role denials for the dedicated Intake follow-up path. Matrix values and privacy assertions unchanged.
- Full units after step 3: **411 files, 3,648/3,648**, exit 0. Log `/tmp/access-step3-full-units.txt`. No source re-pins required; existing pins passed unchanged. Build signal OK.
- Real preview: fictional referral created/enrolled, packet attached and initial assignments/completion run through registry; switched explicitly to the held Intake role. Opened checklist and document through UI and read back exactly one access event each; Send form absent; document content rendered. Width 358/358 at 390; desktop 1280 also checked. Explicit future clock moved past day 61; closed note appeared and checklist/document controls disappeared without navigation. No page errors on successful run. Script/log/screenshots: `/tmp/browser/intake-step3/` (`check_window.py`, `out.txt`, `panel-desktop.png`, `panel-mobile.png`, `document.png`, `closed.png`). Initial attempts hit cold-load timing, a wrongly selected held role, then browser-clock setup; not counted as suite results or product failures.
- No Supabase change or new rollback acceptance this continuation. Read-policy groups remain closed; no browser command transport, persistence change or publishing.

### Clean stop after step 3
- Step 4 remains: patient access-log reason display and every-route gate acceptance (search/picker, deep link, Today, inbox, bell, print/PDF, embedded chart).
- Step 5 remains: all-role main rollback vectors/counts and separate proven chart/packet/handoff policy openings. No group opened here.
- Step 6 remains: full units then full public browser suite, final gate/coordinator/Intake preview acceptance and final reports/Draft matrix.
- Carry-overs remain: on-team HLOC therapist browser fixture and controlled-substance prescriber DEA verification/expiry checks plus credentialing report. No matrix widening or weaker privacy assertion needed; remaining work is not blocked.
