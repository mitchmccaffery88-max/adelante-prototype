# Phase 6 — One private emotion check-in

## Scope
Build only after Mitch approves. Leave `contentBackup.test.ts:87–88` and `group1Profile.test.ts:162` alone. No existing assertions, retries or thresholds change without approval of the exact additions below.

One patient-only pattern: multi-select emotions → **Next** → optional why with **Skip this part** → short reflection and explicit next-step choices. **Not now** hides the prompt everywhere until tomorrow, without a check-in entry, penalty or streak. **Only you see this.**

## Verified findings
- Home already mounts only `AdelGreetingCheckIn` (`PatientHome.tsx:239–248`), not `DailyCheckInCard`. Preserve that placement and the separate clinical `QuickCheckCard` (PHQ-2/GAD-2).
- The greeting saves one emotion immediately (`AdelGreetingCheckIn.tsx:124`); `/checkin` has the multi-step implementation. Replace duplication with one component.
- The existing card summary already waits for link clicks (`DailyCheckInCard.tsx:125–183`); preserve that and extend its choices.
- `selfTracking.ts:47–75` defines nine emotions and typed emoji. All eleven supplied Microsoft SVG URLs and the MIT license returned HTTP 200 in this planning check. Downloads are not blocked; save them during the build.

## Experience
- Adel opens with **How are you doing today?** and **What can I help you with?** in text and opt-in voice using `useAdelVoice`. Never enable voice automatically, store audio, or send emotions to chat/model services. Preserve Simulated voice labeling and cancellation.
- Both hosts use the same multi-select/why/summary implementation. Next requires a selection; choosing a reason or skipping it saves. Not now clears unfinished selections and hides the prompt; saved entries remain editable on `/checkin`. Ask Adel remains available after postponement.
- Chips use Button: at least 48px tall, 28px SVG with `alt=""`, 16px wrapping label, neutral surface, 1.5px line-strong border, radius-md. Selected: path-soft, 2px path border, Lucide Check, `aria-pressed`. No emotion-specific colors or truncation. Use member-comfortable rules and test 390px Spanish.
- One patient/day deferred state and subscription shared by both hosts; hydrate browser storage safely, preserve the existing skip key, and recheck on day rollover/focus. Use the current local-calendar check-in convention; do not change clinical/facility-date reporting windows. Skip survives browser reload, not across devices.
- One bilingual `checkInCopy.ts` object owns every check-in string, including labels, reasons, reflections, resource reasons, greeting, voice, context, summary and **no feelings picked**. Spanish uses tú and Draft; reuse the one member-shell review notice. The emotion list stays in one place with a comment requiring Christi, an SME and Dr. Bagga's clinical decision for changes.
- Remove `emoji` fields/characters from all three check-in hosts and their outputs. Retain existing saved emotion/reason IDs; add `calm` (**Tranquilo/a**) and `okay` (**Bien**).

## Real-record context and explicit choices
New patient-only `patientCheckInContext(patientId, now)` projects records without creating records or calling a model. Show **Here's what's happening for you today** for real today items; otherwise **…this week** for the next seven calendar days. Omit the section if empty. Undated needs/pending requests are described as open, never assigned a fabricated date.

| Item | Source functions / inclusion |
| --- | --- |
| Appointment | `AdelanteEHR.appointmentsForPatient`: scheduled, valid upcoming start or ongoing visit with real end not passed; chronological order. |
| Refill status | `AdelanteEHR.listRefillRequests({ patientId })`: latest per medication by actual timestamp; pending requests or real updates today/this week. No invented request/supply estimate. |
| Upcoming group | `AdelanteEHR.groupsForPatient` + `nextOccurrenceForGroup` / `nextGroupOccurrenceForPatient` (`groupMetrics.ts`): active enrollment, real future occurrence; no roster/notes/automatic join. |
| Open housing/food/other need | `AdelanteEHR.getPatient()?.sdohPlan.items` and `resourceReferrals`: patient-visible, existing open status; exclude completed/closed and hidden safety-sensitive items. Never read staff-only need logs. Deduplicate linked rows. |
| Current plan activity | Retain the real `todaysActivity` (`structuredCarePlan.ts`) line if present; no new assignment. |

Use existing EHR/content/resource subscriptions, not a second record store. Choices open existing appointment, medication, group and need surfaces only when picked; those flows keep all booking/refill/group rules.

After saving, Adel thanks the person, keeps the reflection, and asks **What would you like to do next?** Offer eligible real appointment/refill/group/need choices, a fitting live lesson, a verified resource and **Ask Adel**. Nothing navigates or opens automatically, for any emotion.

- Keep pure `checkInSummaryPlan` heaviest-first, adding Calm then Okay after Hopeful. Ranking chooses reflection/lesson/resource, not clinical urgency or record-item priority.
- Calm: My Success Plan (`success-plan`), no resource. Okay: Starting Strong, prefer `ss-stability-plan` (Building My Stability Plan); if unavailable, another eligible live Starting Strong lesson, never retired/unpublished content. No resource.
- Resolve lessons through `livePatientLibraryItems`, `isLibraryItemVisible`, existing audience and applicable Part 2/recovery rules, and existing language display helpers. Resolve resources through `patientVisibleResources` and current caution-category handling; sensitive resources remain category-only. Omit unavailable results.
- Any Craving selection puts **Urge Surfing Timer** first, then the fitting lesson, then other real choices. Selecting Craving creates no alert/task, SUD flag, chat entry or emotion-bearing audit.
- **Timer:** explicitly choosing it opens a patient-only member-overlay sheet using `liveExercise("urge-surfing-timer")` and existing `ExerciseTimer`; starting is a further user action. This works without an SUD pathway and leaves `/craving`'s `recoveryJourneyVisible` gate and staff/advocate permissions unchanged. Use the existing patient exercise-completion action and protected-content audit redaction. If no longer live, omit it and report the content limitation.

## Component and action API
```ts
type EmotionCheckInProps = {
  patientId: string;
  presentation: "greeting" | "card";
  onComplete?: () => void; // notification only, never navigation
};
```
`EmotionCheckIn` owns steps, editing, shared deferred state, reflection, choices and timer sheet; `AdelGreetingCheckIn` and `DailyCheckInCard` are hosts. Keep the monthly patient total, never display a streak.

Private deferred-state getters/writer stay in `selfTracking.ts`; no EHR import, audit sink or storage of emotions is added. To honor the standing registry rule, add one self-only **patient_private_update** action through `runAction`, with a narrow `privateSelfTrackingActions.ts` adapter for save/postpone. Verify acting patient identity. Standard audit metadata is generic actor/time/outcome/action/store names only, never selected emotions, why, tool names or dismissal payload. No clinical field, staff permission, notification or task; ephemeral selection/step state is not audited.

The source-only Spanish exporter already recognizes bilingual objects reachable from member routes. Use that supported shape/stable keys and regenerate outputs; verify all eleven labels/reflections are included. No authored lesson/exercise-script translation in this screen-copy phase.

## Privacy audit results
**No current raw emotion/reason disclosure found.** This is a source audit, not production-security certification.

Direct runtime importers of `selfTracking.ts`:
- Emotion hosts: `AdelGreetingCheckIn`, `DailyCheckInCard`, `DailyCheckInSummaryCard`.
- Patient-only tracking: `HomeDashboard`, `CravingFlow`, `SlipSupportFlow`, `RecoveryDateCard`.
- `WeeklyRecap`: dates only; `weeklyRecap.ts` and `/api/adel-recap` receive numeric facts, not emotions/reasons/cravings.
- Bookmark readers only: `CommunityResourceCenter`, `ResourceCard`, `ResourceDetail`, `SavedResources`.
- `checkInSummary.ts`: type-only `EmotionId` import; pure mapping of current patient picks.
- `moodCheckInCount.ts`: dates → number only. Indirect staff consumers: `caseloadReview`, `adelBrief`, `adelBriefCheck`.
- `engagementReporting.ts`: deaggregated `selfTrackingAggregate` with cohort guard 11; no patient rows or emotion labels.

Test consumers: `selfTracking.test.ts`, `recoveryStartDate.test.ts`, `section4part2.test.ts`, `engagementReporting.test.ts`, `components/dashboards/__tests__/engagementSection.test.tsx`; `cohortGuard.test.ts` uses only the minimum-cohort export. `ehr.ts` has a comment, not a store read.

No raw check-in entry/emotion/why reader was found in EHR, admin/advocate screens, record/print/PDF exports, staff Adel brief or audit sinks. Retain the already-approved **participation-count-only** staff projections and cohort-only reporting unchanged; this does not add emotion access. The patient's monthly total stays. Add direct/indirect negative tests, including recap/model facts and generic action audit payloads.

`engagement.ts:580–584` already redacts sensitive exercise completion to **protected-content / Protected content**; verify timer completion never names it. Do not pass check-in picks to chat history, staff recap, exports or audit.

## Files
- New: `src/components/patient/EmotionCheckIn.tsx`, `src/lib/checkInCopy.ts`, `src/lib/patientCheckInContext.ts`, `src/lib/privateSelfTrackingActions.ts`.
- Existing: `src/lib/selfTracking.ts`, `src/lib/checkInSummary.ts`, `src/lib/chartActions.ts`; patient `AdelGreetingCheckIn.tsx`, `DailyCheckInCard.tsx`, `DailyCheckInSummaryCard.tsx`, `CheckInPage.tsx`.
- `PatientHome.tsx` only if stale placement comments need cleanup; no broad HomeDashboard restyle or clinical QuickCheck change.
- `src/routes/checkin.tsx` (nine-feelings metadata); `src/routes/home.tsx` (complete Home social metadata). Public routes unchanged.
- Eleven `public/emotions/<id>.svg` plus `public/emotions/LICENSE.txt`.
- New `src/lib/__tests__/emotionCheckIn.test.ts`, patient component tests and `e2e/emotionCheckIn.spec.ts`; existing allowlist/snapshot only with approval below.
- Regenerated `docs/spanish-review.csv`, `docs/spanish-gaps.md`; new `docs/phase6-emotion-check-in-report.md`; `AGENTS.md`, `src/lib/AGENTS.md`, `roadmap.md`. Save durable requirements to memory during approved build, not now.
- No changes to patient Part 2 checks, `roles.ts`, `disclose()`, content audiences or staff pre-release workflows.

## Existing test lines needing approval
**No tests found** naming `adel-mood-*`, requiring `DailyCheckInCard` on Home, nine emotions or automatic summary navigation. Keep existing data/privacy assertions.

Two structural additions require approval; do not edit yet:
1. `src/lib/__tests__/selfTracking.test.ts:154`, before the allowlist closes, add:
   ```ts
   "src/components/patient/EmotionCheckIn.tsx",
   "src/lib/privateSelfTrackingActions.ts",
   "src/lib/__tests__/emotionCheckIn.test.ts",
   ```
   Line 174 stays `expect(offenders).toEqual([]);`; no staff exception.
2. `runAction.test.ts:15` stays unchanged. In `src/lib/__tests__/__snapshots__/runAction.test.ts.snap`, add only `"patient_private_update": "hidden",` before `patient_reschedule` in all 17 staff blocks. Current insertion anchors: **129, 303, 477, 651, 825, 999, 1173, 1347, 1521, 1695, 1869, 2043, 2217, 2391, 2565, 2739, 2913**. No existing value changes; self authorization gets new tests.

## Tests and validation
New tests: all eleven images/English/Spanish Draft labels; clinical ownership comment; Calm/Okay last and correct lesson/no-resource rules; mixed-emotion Craving timer-first without an SUD pathway; Next before save; optional why; explicit-choice-only navigation; shared Not now across hosts/reload/day rollover; no completed entry on skip; emoji-free output; real-only context (empty/cancelled/hidden/completed/absent-refill/un-enrolled-group cases); cross-patient write denial; no emotion in staff/admin/advocate/import/export/recap/model/audit; no alert/task/flag/chat; protected timer audit and unchanged count/cohort boundaries.

Browser: full greeting and /checkin flows, shared skip, deliberate choices, non-SUD timer pick, all loaded images, 48px chip heights, axe Home and /checkin EN/ES, Spanish 390px scrollWidth/screenshots, opt-in read-aloud without recording private audio.

Check automatic build, run full units then every browser spec including axe to completion, regenerate Spanish exports, and report failures together. Leave the two separately pending failures visible. No assertion/retry/threshold fixes without approval.

## Alternatives / differences
- Home already has the required single greeting: preserve it, not remove an absent card.
- Prefer the existing timer in a patient-only sheet after a pick over changing `/craving` gates or exploiting a deep-link bypass.
- Deterministic context/reflection avoids invented events and additional model disclosure.
- Authored clinical timer scripts/lessons remain on the CMS review path; only check-in screen copy/reflections get Spanish drafts here.