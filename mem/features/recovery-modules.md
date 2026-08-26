---
name: Recovery Module System (Adelante Journey Phase 5b)
description: 8-module/10-step recovery schema, the single shared ModuleTemplate renderer, structured tool-flow steps, and the unresolved "Living Recovery" question
type: feature
---
**One renderer, no parallel component.** `src/components/library/ModuleTemplate.tsx`
is the ONLY lesson renderer. Library (`LibraryLesson.tsx`, 8 steps) and Recovery
(`src/components/recovery/RecoveryLessonView.tsx`, 10 steps) are thin ADAPTERS that
map their content model onto `ModuleStep[]`. New step needs = new step KIND on
ModuleTemplate, never a second component.

**Schema** in `src/lib/recovery.ts` (pure, no store/React): `RecoveryModule`
(id/order/name/mission/subtitle/icon) → `RecoveryLesson` 10 steps: Problem →
Check-In → Learn → Activity (reuses Library's `LibraryActivity` union) →
Reflection → Insight → **Warning signs (max 3)** → **Support people (max 3)** →
**One action today (single)** → Toolkit. Steps 7–9 are the real skill-building
TOOL FLOW: closed option sets, structured data, never free text. Limits live in
`TOOL_FLOW_LIMITS` and are enforced in the store, not only in the UI.

**Progress is engagement data**, same discipline as Phase 5: it lives in
`src/lib/engagement.ts` (`completedRecoveryLessons`, `recoveryToolFlows`), keyed
by patientId as a foreign reference — never a field on `Patient`. Facade wrappers
on `AdelanteEHR`; audit action `recovery_lesson_completed` flows through the one
engagement audit sink. Completion is idempotent; re-completing refreshes the
selections and saves the lesson's `toolkitLabel` to the shared toolkit.

**Population gating**: recovery content is SUD-population-general by default
(like craving/slip/check-in). Only Module 1 "My First Days Out" carries a gate —
its copy is explicitly post-release — using Phase 2 tracks via the SAME predicate
`isLibraryItemVisible`. The gate lives on the MODULE and is re-checked for
`?lesson=` deep links.

**Content state**: Module 1 has 10 lessons — 5 transcribed in `recovery.ts`
plus lessons 6–10 authored in `src/lib/recovery.firstDaysOut.authored.ts` as
PUBLISHED entries in the content lifecycle store (Cathy, 2026-08-18), seeded
via `seedPublishedContent` and pulled in by a side-effect import in
`contentCatalog.ts`. Every lesson written from now on is authored that way —
managed content with revision history, never a new hardcoded array entry.
Modules 2–9 carry the ported Journey lessons (`recovery.ported.ts`), which had
an editorial pass removing generator artifacts (duplicated `learnBody`
sentences, one shared `learnTitle`/`insight`, templated decision feedback).
`src/lib/__tests__/recoveryModuleOneAuthoring.test.ts` guards both: 10 ordered
lessons in Module 1, and no repeated sentence / reused feedback anywhere.

**Module 9 "Living Recovery"** is a REAL 9th module (`living-recovery`,
order 9), authored in Batch 9 via
`src/lib/recovery.livingRecovery.authored.ts` (Cathy, 2026-08-26). The catalog
is now 9 modules / 90 lessons, all 90 passing `originalityErrors` with 90/90
distinct warning-sign, support-people, today-action and activity-choice sets
(`recoveryCatalogFinalSweep.test.ts`).

**Progress display** reads the same engagement data, nothing new: module list
shows "N of M lessons complete" + a bar for modules WITH lessons; modules with
no transcribed lessons show their real count ("No lessons yet — content
pending"), never a 0-of-0 fraction. A lesson page shows a completion banner and,
because completion is idempotent and stores the tool-flow selections, revisiting
RESTORES the prior selections into the same controls (label: "Update my plan").

**Spanish** goes through the ONE dictionary in `src/lib/i18n.tsx`; the entries
live in `src/lib/i18n.recovery.ts` only to keep that file readable. Two tiers:
short UI strings + module names/missions/subtitles are in both languages and
directly usable; Module 1 lesson bodies are ES-ONLY overrides keyed
`rec.<lessonId>.<field>` read through `useRecoveryText().rt(key, englishSource)`,
so English stays single-sourced. That prose is FIRST-PASS, flagged in-app and by
`RECOVERY_ES_REVIEW.reviewed === false` — pending a native/professional pass.
Tool-flow SELECTIONS always store the canonical English option; translation is
display-only (`labelFor` on the shared ModuleTemplate select step).
