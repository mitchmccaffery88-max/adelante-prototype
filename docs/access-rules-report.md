# Care-team / reasoned-open access batch — partial resumed implementation

**Draft — pending go-live permissions audit. Partial, not accepted.** 28 Oct 2026. Nothing published; persistence OFF; no TEST project/secrets, Cloud or GitHub changes.

**Part 2 internal-use basis: pending counsel confirmation.**

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

Then complete all-role rolled-back SQL acceptance and comprehensive before/after counts; open each passing read-policy group separately; run full units followed by public browser and real preview UI readback. Phase 2d repositories, server write transport, signup parity, storage and persistence switches remain outside scope.