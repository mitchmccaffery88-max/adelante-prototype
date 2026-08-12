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

**Content state**: Module 1 is real, complete (5 lessons). Modules 2–8 are real
names/missions with `contentPending: true` and zero lessons — nothing fabricated,
and the UI says so plainly.

**OPEN**: "Living Recovery" / "Protect My Recovery for Life" is modelled as
`LIVING_RECOVERY_WRAPPER` (`unconfirmed: true`), a closing section over the eight
— NOT a 9th module. Needs a human decision before lessons are written for it.
