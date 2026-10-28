# Care-team / reasoned-open access batch — clean stop

**Draft — pending go-live permissions audit. Not implemented.** 28 Oct 2026. Nothing published; persistence OFF; no TEST project/secrets, Cloud or GitHub changes.

## What happened

Inventoried `chartAccess.ts`, `chartEntryFor`, `searchablePatientsFor`, `navGuard`, `RouteAccessGuard`, record/print routes, staff search, Intake packet/completion stores, existing supervision/on-call/group sources, and live SQL helpers/policies. The old mandatory-site entry rule is superseded by Mitch's approved plan; it is not itself the blocker.

Built a candidate shared pre-data gate and pure entry/day-window rules, and installed Draft SQL scaffolds through migration tooling. Rolled-back fictional-login tests then exposed a **real existing Part 2 matrix conflict**. All candidate app changes were restored to the pre-batch source boundary, and active SQL entry/team/packet helpers were restored to match the app. No partially implemented access gate is live.

## Decision needed

The request says both:
- Keep the existing record-class matrix unchanged.
- Part 2 records must remain locked without consent, even for direct/reasoned chart entry.

The existing `roles.ts` matrix intentionally permits treating therapist/PMHNP/SUD-counselor SUD screener reads without separate consent; physician inherits PMHNP. PMHNP/physician/SUD-counselor have direct SUD treatment grants too. SQL's generated matrix mirrors those rules. The rollback failed with **`part2_no_consent_failed physician`**.

Mitch must decide whether the no-consent negative applies only to **already consent-gated classes/roles**, preserving treating-clinician grants, or whether **all Part 2 classes/roles need a new consent prerequisite**. The latter changes clinical access policy and existing assertions, not just chart entry. Neither interpretation has been silently chosen.

## Retained database work

Empty, closed `chart_reason_grants` and `clinician_coverage_assignments` scaffolds; additional supervision/group/handoff/log fields; revoked candidate command/window/group helper execution. No patient/advocate policies changed. Existing own-site and identity-review read policies stay as before. No new chart/packet/handoff policy opened.

All fixture transactions rolled back. Independent counts: auth users 0→0, accounts 0→0, patients 18→18, reason grants 0→0, coverage rows 0→0. Successful schema/ledger changes remain; there are no retained test users or fixture rows. Full evidence: `docs/rls-evidence/access-rules-rollback.md`.

## Validation

- Candidate full unit suite: 3,585 passed, 11 failed; recorded, not accepted.
- Restored app: **3,583/3,583 units**, 406 files, exit 0; 130.53 seconds.
- Full public browser suite: started after restored units, one worker on :8080; completion result pending below.
- Candidate gate/credential/Intake UI readback: not claimed; candidate implementation removed at the stop boundary.

## Resume scope

After the Part 2 decision: reapply the coordinated app/SQL gate; preserve consent actions independently from sys_admin chart entry; use actual assigned care-team fixtures rather than old site-only test assumptions; add exact approved source-pin deltas without replacing unrelated assertions. Finish shared search/deep-link/print/PDF/embedded chart gating, grant expiry and minimal projections, coordinator request/coverage/review hosts, access-log reason display, and Intake's logged read-only 60-day packet/checklist window.

Then complete all-role rolled-back SQL acceptance and comprehensive before/after counts; open each passing read-policy group separately; run full units followed by public browser and real preview UI readback. Phase 2d repositories, server write transport, signup parity, storage and persistence switches remain outside scope.