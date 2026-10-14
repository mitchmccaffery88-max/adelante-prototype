# Phase 6 — One private emotion check-in

## Scope and approval

Implement only after Mitch approves this plan. Leave `contentBackup.test.ts:87–88` and `group1Profile.test.ts:162` unchanged. No existing assertion, retry or threshold changes without separate approval of the exact changes below.

One patient-only pattern: select one or more emotions → **Next** → optional why, always offering **Skip this part** → reflection and explicit next-step choices. **Not now** hides the prompt across both hosts until tomorrow; it creates no completed check-in, penalty, streak, staff task or alert. Keep **Only you see this.**

## Verified current state

- `PatientHome.tsx:239–248` already mounts `AdelGreetingCheckIn`, not `DailyCheckInCard`. Preserve that single Home entry; do not remove the separate clinical `QuickCheckCard` (PHQ-2/GAD-2).
- The greeting currently saves one emotion immediately (`AdelGreetingCheckIn.tsx:124`); `/checkin` uses the multi-step card. Its summary already uses links rather than automatic navigation (`DailyCheckInCard.tsx:125–183`). Replace the duplicated implementations with one flow and extend the explicit choices.
- The store defines nine emotions with typed emoji characters (`selfTracking.ts:47–75`). Its optional why identifiers and saved entry shape can stay compatible.
- All eleven supplied Microsoft SVG URLs and the repository MIT license returned HTTP 200 during this planning check. No download blocker found; download only during the approved build.

## Experience

### Home and /checkin

- Home asks once, in Adel's greeting: **How are you doing today?** and **What can I help you with?** Keep Ask Adel available even after postponing the check-in.
- Read the greeting aloud only when the existing opt-in voice setting is enabled, using `useAdelVoice`; never enable voice automatically. Keep voice Simulated, cancellable, and text-first; do not send emotions to chat or an external service.
- Shared chips use the existing Button primitive: minimum 48px height, 28px decorative SVG (`alt=""`), 16px wrapping label, neutral surface, 1.5px line-strong border, radius-md. Selected: path-soft, 2px path border, Lucide Check, `aria-pressed`. No per-emotion colors or truncation.
- **Next** requires at least one selection. Selecting an optional reason saves and shows the summary; **Skip this part** saves without a reason. **Not now** is available before completion, clears unfinished selections and hides the shared prompt. Existing saved check-ins remain editable on `/checkin`.
- One patient/day dismissal source, shared subscriptions, hydration-safe browser storage access, and rollover checks on date change/focus. Preserve the existing patient's local-calendar day convention and existing skip-key values; do not change clinical/facility-date reporting windows.
- No repeated Spanish notice: use the existing member-shell Draft notice. Keep new text at least 14px; check labels at 390px in Spanish.

### What's happening

Add one short, deterministic, patient-only projection, `patientCheckInContext(patientId, now)`, with no invented records or clinical inference. Use **Here's what's happening for you today** when there are real today items; otherwise **Here's what's happening for you this week** for real items in the next seven calendar days. Omit the section if both lists are empty. Undated open needs/pending refill requests can be described as currently open, never given an invented due date.

| Item | Real source and eligibility |
| --- | --- |
| Next appointment | `AdelanteEHR.appointmentsForPatient(patientId)`; scheduled, valid upcoming start, chronological order; include an ongoing visit where its real end has not passed. Open the existing appointment surface only on pick. |
| Refill status | `AdelanteEHR.listRefillRequests({ patientId })`; latest request per medication from real timestamps/statuses. Pending requests or updates dated today/this week; no supply estimate or fabricated request. Pick opens `/medications`. |
| Upcoming group | `AdelanteEHR.groupsForPatient` and `nextOccurrenceForGroup` / `nextGroupOccurrenceForPatient` in `groupMetrics.ts`; active enrollment and a real future occurrence. No roster, notes, attendance or automatic join. |
| Open needs | `AdelanteEHR.getPatient(patientId)?.sdohPlan?.items` and visible `resourceReferrals`; existing status and `visibleToPatient !== false`, excluding completed/closed items. Show the person's recorded need, not staff-only logs/notes. Respect safety-sensitive visibility. |
| Existing plan activity | `todaysActivity(patientId)` in `structuredCarePlan.ts` may retain its current greeting line; do not manufacture an assignment. |

Subscribe through existing EHR/content/resource subscriptions; do not create a second record store. Deduplicate linked need/referral rows. The context projection is not sent to a model.

### Summary and choices

Thank the person, retain the reflection, and ask **What would you like to do next?** Show only eligible real choices: upcoming appointment, existing refill request, enrolled group, open need, a fitting live lesson, a verified resource, and **Ask Adel**. No navigation, drawer opening, voice submission, booking or messaging until a choice is explicitly picked.

- Keep `checkInSummaryPlan` heaviest-first. Extend its order with `calm`, then `okay`, after `hopeful`. This ranking selects the reflection and fitting lesson/resource; it does not score the person or determine urgency for record items.
- Calm: live lesson from `success-plan` (My Success Plan), no resource choice.
- Okay: prefer live `ss-stability-plan` (Building My Stability Plan) in `starting-strong`, no resource choice. If that item is unavailable, use another eligible live Starting Strong lesson; never resurrect retired/unpublished content.
- Other fitting lessons: `livePatientLibraryItems()` plus `isLibraryItemVisible`, current audience and applicable Part 2/recovery visibility rules; resolve published English/Spanish through existing display helpers. Omit unavailable results.
- Resources: `patientVisibleResources(categoryId)` and existing Part 2 caution-category display. No placeholder resource or invented location; preserve category-only wording for sensitive categories.
- Any selection containing `craving` puts **Urge Surfing Timer** first, then the fitting lesson; retain other real choices afterwards. Picking Craving alone never starts a timer, navigates, creates a staff alert/task, changes SUD flags, or sends the emotion to Adel chat.

**Timer approach:** after an explicit pick, open the existing `ExerciseTimer` using `liveExercise("urge-surfing-timer")` in a patient-only member-overlay sheet. This works for a patient without an SUD pathway without changing `/craving`'s `recoveryJourneyVisible` gate, catalog visibility or staff/advocate permissions. Only the explicit timer choice opens it; starting the timer remains a separate user action. Completion uses the existing patient exercise action and protected-content audit redaction. No exercise name, craving selection or reason enters audit text. Omit a timer that is no longer live; report that content limitation rather than fabricate it.

## Technical design

```ts
type EmotionCheckInProps = {
  patientId: string;
  presentation: "greeting" | "card";
  onComplete?: () => void; // notification only; never navigation
};

// Both hosts render the same component. It owns steps, editing,
// shared dismissal, bilingual copy, summary, and explicit choices.
<EmotionCheckIn patientId={patientId} presentation="greeting" />
<EmotionCheckIn patientId={patientId} presentation="card" />
```

- One vocabulary in `selfTracking.ts`: eleven stable IDs and image paths, no `emoji` field; a comment states emotion-list changes require Christi, an SME and Dr. Bagga's clinical decision. The list resolves its words from one `checkInCopy.ts` bilingual object, including emotions, reasons, reflections, resource reasons, acknowledgments, **no feelings picked**, voice labels and summary/context copy. Calm Spanish: **Tranquilo/a**; Okay: **Bien**. Spanish is tú and Draft.
- `checkInSummaryPlan` stays pure; reference copy keys and make resource selection optional for Calm/Okay. Keep existing emotion/reason IDs and saved entries intact.
- Shared deferred-day getters/writer stay in `selfTracking.ts`, with no EHR import or audit sink. Retain browser reload survival for dismissal only; no new database or storage of emotions.
- To honor the standing registry rule without exposing private answers, use one patient-self-only `CHART_ACTIONS` entry, **patient_private_update**, through `runAction`, for saving/postponing. A narrow `privateSelfTrackingActions.ts` adapter dispatches the private writer and checks acting patient identity. Standard audit metadata is generic only: actor, time, outcome and neutral action/store names; never answers, reason, selected emotion, tool name or skipped-day payload. No store audit sink, clinical-record field, staff read permission, notification or task. UI selection/step changes remain ephemeral.
- The existing source-only Spanish exporter already supports bilingual objects reached from member routes. Use its supported shape and stable keys; regenerate its outputs, and verify all eleven labels and reflections are included. Do not translate authored lessons/exercise scripts as part of this screen-copy phase.

## Privacy audit — results and retained boundaries

**No current emotion disclosure found.** This is a source audit, not a claim of production security certification.

All direct runtime importers of `selfTracking.ts`:

1. Patient emotion hosts: `AdelGreetingCheckIn`, `DailyCheckInCard`, `DailyCheckInSummaryCard`.
2. Patient-only tracking: `HomeDashboard`, `CravingFlow`, `SlipSupportFlow`, `RecoveryDateCard`.
3. Patient recap: `WeeklyRecap` reads day keys only; `weeklyRecap.ts` and `/api/adel-recap` receive numeric facts, not emotions/reasons/craving content.
4. Resource bookmarks only: `CommunityResourceCenter`, `ResourceCard`, `ResourceDetail`, `SavedResources`.
5. `checkInSummary.ts` imports `EmotionId` as a type only; it maps patient-provided selections, not staff reads.
6. `moodCheckInCount.ts` reads dates and returns a number. Its indirect staff consumers are `caseloadReview`, `adelBrief`, and `adelBriefCheck`.
7. `engagementReporting.ts` uses only `selfTrackingAggregate` / minimum-cohort guard 11, with no per-patient rows or emotion labels.

Test-only direct consumers: `selfTracking.test.ts`, `recoveryStartDate.test.ts`, `section4part2.test.ts`, `engagementReporting.test.ts`, and `components/dashboards/__tests__/engagementSection.test.tsx`. `cohortGuard.test.ts` reuses the minimum-cohort export, not private answers. `ehr.ts` contains a comment, not a store import.

No raw emotion/reason reader was found in EHR, admin/advocate views, record exports/print/PDF, staff Adel brief, or audit sinks. Keep monthly patient totals and the already-approved staff participation-count/cohort-only projections unchanged; **no check-in entries, selected emotions or why answers appear there**. This preserves existing count exceptions rather than silently removing staff reporting in a UI phase. Add negative tests for indirect consumers as well as direct imports.

`engagement.ts:580–584` already redacts sensitive exercise completion to **protected-content / Protected content**. Assert this remains true for the timer and that no check-in selection becomes chat history or an audit payload.

## Files to touch

- New: `src/components/patient/EmotionCheckIn.tsx`, `src/lib/checkInCopy.ts`, `src/lib/patientCheckInContext.ts`, `src/lib/privateSelfTrackingActions.ts`.
- Existing: `src/lib/selfTracking.ts`, `src/lib/checkInSummary.ts`, `src/lib/chartActions.ts`; `AdelGreetingCheckIn.tsx`, `DailyCheckInCard.tsx`, `DailyCheckInSummaryCard.tsx`, `CheckInPage.tsx` under `src/components/patient/`.
- `src/components/PatientHome.tsx` only if necessary to clean stale Home-flow comments/placement; no broad HomeDashboard restyle or changes to clinical QuickCheck.
- `src/routes/checkin.tsx` (replace nine-feelings metadata); `src/routes/home.tsx` (complete app-specific social metadata while touching the Home experience). Public routes stay unchanged.
- Eleven `public/emotions/<id>.svg` files plus `public/emotions/LICENSE.txt`.
- New unit/component tests and `e2e/emotionCheckIn.spec.ts`; existing test allowlist/snapshot only after the specific approval below.
- Regenerated `docs/spanish-review.csv`, `docs/spanish-gaps.md`; new `docs/phase6-emotion-check-in-report.md`; `AGENTS.md`, `src/lib/AGENTS.md`, `roadmap.md`. Save Mitch's durable emotion decisions to project memory during the approved build, not during plan-only work.
- No changes to `roles.ts`, patient Part 2 checks, `disclose()`, staff pre-release workflows, content audiences, or the two separately pending failing-test locations.

## Existing test changes requiring Mitch's approval

**None found** that name `adel-mood-*`, expect `DailyCheckInCard` on Home, assert nine emotions, or require automatic summary navigation. Existing data/privacy assertions can stay unchanged.

Two structural additions are needed for the proposed implementation; list them for approval, do not edit them now:

1. `src/lib/__tests__/selfTracking.test.ts:154` — immediately before the allowlist closes, insert:
   ```ts
   "src/components/patient/EmotionCheckIn.tsx",
   "src/lib/privateSelfTrackingActions.ts",
   "src/lib/__tests__/emotionCheckIn.test.ts",
   ```
   The assertion at line 174 remains `expect(offenders).toEqual([]);`. No broader allowlist or staff exception.
2. `src/lib/__tests__/runAction.test.ts:15` stays unchanged. Its snapshot needs only `"patient_private_update": "hidden",` inserted before `patient_reschedule` for all 17 staff-role blocks in `src/lib/__tests__/__snapshots__/runAction.test.ts.snap`. Current insertion anchors: **129, 303, 477, 651, 825, 999, 1173, 1347, 1521, 1695, 1869, 2043, 2217, 2391, 2565, 2739, 2913**. No staff permission is widened and no existing value changes. Patient self-only authorization is covered in new tests.

## Validation

New tests cover all eleven assets/English/Spanish Draft labels, clinical ownership comment, Calm/Okay last priority, their lesson/no-resource rules, Craving timer-first including mixed emotions and no SUD pathway, optional why, Next before save, explicit-pick-only navigation, shared dismissal across hosts/reload/day rollover, no completion on postponement, emoji-free output, and context lists sourced exclusively from valid visible records. Include empty, cancelled, hidden safety need, completed need, absent refill and un-enrolled group cases.

Privacy tests cover direct and indirect staff/admin/advocate readers, recap/model facts, exports, generic action metadata, protected timer audit text, no SUD flag/task/alert/chat creation, denied cross-patient writes, and unchanged cohort/count boundaries.

Browser checks: full greeting multi-select → why/skip → summary → deliberate choice; the same /checkin flow; shared Not now; eleven loaded images; chip heights at least 48px; axe on Home and /checkin in EN/ES; 390px Spanish scrollWidth and screenshots; non-SUD patient explicitly opening the timer. Verify opt-in read-aloud without capturing or storing private voice content.

After implementation, check the automatic build result, run full units then every browser spec including axe to completion, regenerate Spanish review files, and report all failures together. Do not alter assertions/retries/thresholds to make tests pass. Keep the separately pending failures visible in the report.

## What I would do differently, and why

- Reuse the current Home placement rather than remove a card that is not mounted there.
- Open the actual timer in a patient-only sheet after a pick rather than remove `/craving`'s gate or rely on a catalog deep link. This satisfies the any-patient decision without broadening unrelated privacy gates.
- Keep deterministic real-record choices and reflections, not a new AI request. No invented events, no additional disclosure, and no network dependency for check-in.
- Keep authored clinical timer scripts and lessons on their existing CMS review path; only the new check-in screen copy/reflections receive Spanish drafts here.