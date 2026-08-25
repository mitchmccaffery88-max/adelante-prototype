---
name: Lesson-player Phase D optional authoring schema
description: The optional per-lesson fields (rating override, learn stages, if/then, 4-part enrichment) that ship EMPTY on all 180 lessons and are authored by Cathy through /admin-content
type: feature
---
`src/lib/lessonAuthoring.ts` defines the OPTIONAL Phase D surface mixed into
both `LibraryItem` and `RecoveryLesson`: `ratingPrimary`, `learnStages`,
`ifThenPractice`, `enrichment`. Every field ships EMPTY on all 180 lessons —
a test (`lessonAuthoringPhaseD.test.ts`) asserts the catalog stays unauthored.
Cathy authors this content lesson-by-lesson through `/admin-content`; do NOT
write lesson text into these fields in code.

Fallback order is fixed in `src/lib/lessonLearn.ts`: `enrichment` (4 parts:
happening / why + approach / canChange / takeaway+reflection) → `learnStages`
→ the single `learnBody` block. Ratings: an authored `ratingPrimary.label`
replaces the Phase C check-in-keyword derivation and the shared confidence +
heaviness pair is always appended. `higherIsHarder` is authored the way a
clinician reads a scale and is inverted into the renderer's `higherIsBetter`.
The if/then step appears only when BOTH option lists have entries; picks are
structured (never free text) and persist in `LessonResponse.ifThen`.
