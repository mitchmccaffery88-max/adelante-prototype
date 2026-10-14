# Content audiences and Part 2 for authors

Two approved changes, built together: (A) everyone who authors content sees Part 2 content in /admin-content; (B) one "Who it's for" audience field that shows an item when any of its audiences matches the person, with no before/after-release split in patient content.

---

## Part A: Part 2 content visible to content authors

- In `src/lib/contentStaff.ts`, add `contentPart2VisibleToStaff(role) = canAuthorContent(role) || roleSeesAsamSection(role)` and use it inside `contentVisibleToStaff`. It is labelled "Draft — pending compliance review".
- **What changes automatically** (each already goes through `contentVisibleToStaff`): the Manage inventory, the review queue and its counts, History, and Browse for authors. The backup export and restore check change too, so Cathy's file now includes recovery content with `partTwoIncluded: true`.
- **What stays the same:** Browse for non-authors (e.g. `medical_assistant` read), the Part 2 badges, the "protected-content" text in the audit, the patient-matching Part 2 check in `contentTags.ts`, and every patient-record check (`roleSeesAsamSection`, `SUD_MED_WITHHELD_ROLES`, ASAM, SUD meds, screeners, `disclose()`, care plans, audit text).
- **Approved line change**, `staffContentCenter.test.ts:14`:
  - From: `expect(contentVisibleToStaff("peer_specialist", "recovery_lesson", { title: "Recovery" })).toBe(false);`
  - To: `expect(contentVisibleToStaff("peer_specialist", "recovery_lesson", { title: "Recovery" })).toBe(true);`
  - The `pmhnp` line stays.

---

## Part B: "Who it's for" (`audiences`), any-match

### Rule
- **Values:** an item's `audiences` field takes any of `justice_involved`, `sud`, `advocate`. Leaving it empty means everyone.
- **Who sees it:** a person sees an item when it has no audiences, or when any one of its audiences matches them.
- **Part 2:** still applies on top. SUD content also needs the existing consent rule and `recoveryJourneyVisible`.
- **Release timing:** no patient content branches on before vs. after release.

### Person side: one function
`personAudiences(patientId, viewer)` goes in `src/lib/population.ts`:
- **`justice_involved`:** the person's resolved track is `pre_release_ji` or `post_release_ji` and is not provisional. That track already includes every `isJusticeInvolved` signal: custody, Z65.2, the reentry flag, missed coordination, a front-door "yes", a justice referral source, or a pre-release episode. A "not sure" answer stays unconfirmed.
- **`sud`:** the existing `detectFlags` SUD signal (`flagJourneys.ts`), plus the new care-plan trigger below.
- **`advocate`:** returned only for the advocate viewer, and that viewer gets no patient audiences.
- **Where it's used:**
  - `curriculumVisible` (`curriculumProgress.ts`), which replaces the literal `coverage.justiceInvolvement === "yes"` check and the `populations` check.
  - `isLibraryItemVisible` (`library.ts`).
  - Module and lesson visibility (`recovery.ts`).
  - Patient-facing `PopulationGate` checks.

### PopulationGate today
- **Four places use it.** None separates pre-release from post-release; each allows both tracks.
  - Patient screens: `PoDisclosureCard.tsx:83`, `ReentryDayZeroModule.tsx:65` and `ObligationsCard.tsx:81`.
  - Staff panel: `AdvocatePoAwarenessPanel.tsx:74`.
  - The patient menu entry for obligations (`navSections.ts:993`) uses the same pair.
- **Change:** I add an `audience="justice_involved"` form to `PopulationGate` and use it on these screens. Patients see exactly what they see today.
- **Day-0 module:** it also checks whether release has been confirmed. That is a release-date check, not content targeting, so it stays.
- **Staff workflows:** `PopulationTrack` and the pre-release episode logic stay as they are.

### Migration table (through real store functions)

| Item | Today | Becomes |
|---|---|---|
| Library `understanding-psychosis` | populations pre_release_ji, post_release_ji | audiences justice_involved |
| Library `back-on-feet-work` | same | justice_involved |
| Library `back-on-feet-legal-responsibilities` | same | justice_involved |
| Library `success-plan-goals-that-matter` | same | justice_involved |
| Journey `starting-strong-curriculum` | justiceInvolved true | justice_involved |
| Journey `back-on-feet-curriculum` | justiceInvolved true | justice_involved |
| The 31 items with label-only `meta.populations` | label only | no audiences (still visible to everyone) |
| Modules, exercises, other journeys | no gate | no audiences |

- **Shipped items:** the shipped seeds are edited in place (`library.ported.ts`, `curriculumTypes.ts`).
- **Stored entries:** any stored entry that still has `populations` or `justiceInvolved` is converted when read, by one function in `contentTypes.ts`. The old fields are then dropped from the editor and from validation.
- **`meta.populations`:** removed from the What-this-addresses panel and from the backfill in `contentTags.ts`. The values left on stored entries are ignored.
- **Effect for patients:** one visible difference. A justice-involved patient whose front-door answer wasn't a literal "yes" can now browse Starting Strong and Back on My Feet. This is the gap fix. They could already get these journeys when auto-added.

### No release split in content
- **Stage options:** I remove `pre_release` from the content stage options. That covers `COVERAGE_STAGES` and the `d < 0` stage branch in `contentTags.ts`, the journey "Reentry stage" select in `curriculumTypes.ts:34`, and `STAGE_LABELS` and the chip row in `ContentAdminWorkspace.tsx`.
- **Before release:** for a release date in the future, the stage reads `first_30`.
- **Pathways:** `pathwayFromFlags` and `journeysForPathway` read only the justice and SUD flags. Neither branches on release timing; confirmed.

### SUD triggers (Draft — pending clinical sign-off)
- **Care plan:** a substance-use goal is a `StructuredGoal` with `sud: true` (`structuredCarePlan.ts`). A goal gets that mark when it is linked to a problem with `sud: true`, through `addStructuredGoal` and the `care_plan_goal` action.
  - **Problems:** a substance-use problem is `Patient.problems[]` with `category: "sud"` or an F10–F19 code. `detectFlags` already reads these.
  - **What I add:** `detectFlags` also sets SUD for any open `StructuredGoal` with `sud: true`, with the source "substance-use goal on the care plan".
  - **What follows:** `sweepFlagJourneys` then adds the Recovery Journey automatically. Journeys are still never removed, and "Pathway changed — review" still applies.
- **Screener:** in the screener-result path in `ehr.ts`, a completed AUDIT with a score of 8 or more, or a DAST-10 with 3 or more, creates one staff task per result through a new registered store function, `requestRecoveryJourneyReview`.
  - **Wording:** "Consider the Recovery Journey". The text never names the instrument or the score, and it uses the existing Part 2 task privacy.
  - **Who gets it:** the assigned care team, through the same assignment routing the ASAM task uses.
  - **No duplicates:** the dedupe key is the screener result id. Nothing is created below the cutoff.
  - **The SUD flag:** not set.
  - **Existing ASAM task:** it still runs on the existing "positive" result, unchanged.

### Content center
- **Editor:** one "Who it's for" checkbox group (Justice-involved / Substance use / Advocate; none checked means Everyone). It replaces the "Population gates" list, the "Justice-involved only" toggle and the population chip row. Checkboxes are neutral, 48px on touch, with text at least 14px.
- **Inventory:** gains a "Who it's for" column and filter (`ContentInventoryTable.tsx`).
- **Inventory export:** `scripts/export-content-inventory.ts` gains an `audiences` column, drops `population_gate` and `meta_populations`, and the vocabulary gains the audience values with `pre_release` removed. I re-run it.

### New tests
- **`contentAudiences.test.ts`:**
  - A JI + SUD person sees both sets.
  - JI only sees no SUD content.
  - SUD only sees no JI-only content.
  - A general person sees only everyone-items.
  - An advocate viewer sees advocate items and no patient audiences.
  - A Z65.2-only person can browse Starting Strong.
  - A "not sure" person sees no JI content.
  - Migration: each of the 4 lessons and 2 journeys keeps the same visibility for a confirmed JI patient and a general patient.
- **`sudTriggers.test.ts`:**
  - A SUD care-plan goal sets the flag and the Recovery Journey is added automatically.
  - Removing the goal doesn't remove the journey.
  - Screener tasks: AUDIT 8 or more creates one task, re-recording the same result doesn't duplicate it, AUDIT 7 and DAST 2 create none, and task text has no score or instrument.
- **`contentStages.test.ts`:** no `pre_release` in stage options or `COVERAGE_STAGES`.
- **Part A:** the new `contentPart2Authoring.test.ts` as planned.

### Existing test lines that would change (approval needed, each line only)
1. **`contentContainers.test.ts:167`:**
   - From: `populations: ["post_release_ji"],`
   - To: `audiences: ["justice_involved"],` (the fixture's expected visibility stays the same).
2. **`contentCenterFinish.test.ts:109`:** `expect(curriculumVisible(p, j)).toBe(true);`. No change expected. I'll check whether its fixture depends on the literal "yes"; if it does, I'll stop and send the exact line.
3. **Population-track tests:** these test staff and episode logic and stay unchanged: `populationTrack.test.ts`, `preReleaseRelease.test.ts`, `populationNavGating.test.ts`, `preReleaseCapacityIntake.test.ts`, `justiceInvolvementGate.test.ts`, `selfHelpLibrary.test.ts:199`.
4. **No browser test** asserts these rules.

If the build turns up any other existing assertion, I stop and list it rather than edit it.

### Files
- **Part A:** `contentStaff.ts`.
- **Logic:** `population.ts`, `curriculumProgress.ts`, `library.ts`, `library.ported.ts`, `recovery.ts`, `curriculumTypes.ts`, `contentTypes.ts`, `contentTags.ts`, `flagJourneys.ts`, `ehr.ts` (screener path + new task function), `chartActions.ts` (only if the task function needs registry entry; system-triggered, so likely not).
- **Screens and tools:** `PopulationGate.tsx`, the four gate users, `navSections.ts`, `ContentAdminWorkspace.tsx`, `ContentInventoryTable.tsx`, `ContentForm.tsx`, `scripts/export-content-inventory.ts` plus the three docs outputs.
- **Docs and tests:** `AGENTS.md`/`src/lib/AGENTS.md` (one rule each), `roadmap.md`, new tests, `staffContentCenter.test.ts:14`.

### What I'd do differently
- **Keep `advocate` off patient content.** Advocate items stay in their own library (`audience: "advocate"`). Checking `advocate` on a patient lesson would hide it from every patient, so the editor will warn about that.
- **Use the existing positive result.** The screener cutoffs (AUDIT 8, DAST 3) are written separately from the existing positive result the ASAM task uses. If those match, I'd reuse the existing positive result to avoid having two cutoffs.
- **Which justice check counts.** Using the confirmed track for `justice_involved`, not `isJusticeInvolved` alone, also counts justice referral sources and the reentry flag. That matches "any confirmed justice signal".

### Validation
Build, then the full unit suite, then every browser spec including axe, all run to completion. Every failure is reported together. The permissions snapshot is left untouched.
