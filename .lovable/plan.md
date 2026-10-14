# Phase 6 follow-up checks (report only, nothing changed)

## 1. Unit total: 2,614 vs 2,603

Method: copied the commit before Phase 6 (`6a4ed4c4^`) into a temporary folder and ran `vitest list --json` there and on the current code. Then compared every test by file and name.

| | Tests |
|---|---|
| Before Phase 6 | 2,594 |
| After Phase 6 | 2,603 |

- Tests removed: **none**. Every test name from before is still present.
- Tests skipped: **none**. No `.skip`, `.todo` or `xit` in the code.
- Tests added (+9): `emotionCheckIn.test.ts` +6 and `sudTriggers.test.ts` +3 (the 4 earlier ones are still there).
- Static test counts are flat at 2,449 `it(` calls across every commit from the audiences build ("Added audience logic") up to Phase 6. No test file was deleted in that range.

The 2,614 figure in the audiences-build report does not match the code. The first audiences report said 2,590 of 2,594, which matches this baseline. The most likely explanation is a reporting error, or a run that briefly included temporary probe files that were not committed. Nothing needs restoring. Proposal: future reports quote the `vitest list` total next to the pass count.

## 2. Substance-use goals that skip addStructuredGoal

The trigger (`structuredCarePlan.ts:734`) counts only active goals with `sud: true` and `origin === "clinician"`. Only `addStructuredGoal` sets `origin: "clinician"`.

| Path | Where | SUD goal? | origin today | Counted? | Should it be "clinician"? |
|---|---|---|---|---|---|
| Accept an ASAM care-plan suggestion | `asamCarePlan.ts` `acceptAsamSuggestion` (pushes the goal directly, line 274) | Yes, always `sud: true` | not set | **No** | **Yes.** A clinician accepts it, can edit it, and it is audited `plan_rule_suggestion_accepted`. This is the biggest gap. |
| Accept the older "asam_signed" suggested goal | `ehr.ts` `acceptSuggestedGoal` → `addGoal`, then picked up by the legacy migration in `getStructuredPlan` (line 229–244) | Yes, when the reason is `asam_signed` | not set | **No** | **Yes** for `asam_signed` acceptances (decided by a named clinician). Free-text legacy goals are never SUD, so they are not affected. |
| Free-text goal on the old chart goals list | `RecordTabs.tsx:2374` → `addGoal` → migration | No (migration marks only `asam_signed` as SUD) | not set | n/a | No change needed. |
| NTP referral goal | `ntpReferral.ts:57` uses `addStructuredGoal` | **No**: no problem ids are passed, so `sud` comes out false even though it is medication treatment | "clinician" | No (because `sud` is false) | Already "clinician". Separate question for Mitch / Dr. Bagga: should this goal link to the active SUD problem so it counts? |
| Automatic journey goal | `structuredCarePlan.ts:689` | Yes | "system" | No | Correct as is (this was the loop fixed in Phase 6). |
| Signing / cosigning a plan | `signPlan` (line 555) | Creates no goals | — | — | n/a |
| Intake or treatment-plan import | none found | Seeded demo goals (`ehr.ts:4684`) are plain legacy goals, not SUD | — | — | n/a |
| Demo seeds (Luis, Rosa) | `addStructuredGoal` | Not SUD | "clinician" | — | n/a |

Older goals saved before `origin` existed have no value and count as not clinician. Today that applies only to in-memory demo data, so nothing persistent is affected.

## Proposed follow-up (needs Mitch's approval, Draft — pending clinical sign-off)
- Set `origin: "clinician"` in `acceptAsamSuggestion`.
- Set `origin: "clinician"` in the legacy migration when the goal came from an accepted `asam_signed` suggestion.
- Ask Mitch / Dr. Bagga whether the NTP referral goal should link to the active SUD problem.
- Add one test per path. No existing assertions would change.
