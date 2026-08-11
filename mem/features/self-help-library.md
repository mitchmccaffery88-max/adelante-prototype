---
name: Self-help Library & Exercises (Adelante Journey Phase 5)
description: Library/Exercise content model, store-backed progress on the Patient record, population gating and the advocate read-floor visibility rule
type: feature
---
**Content model** lives in `src/lib/library.ts`: `LibraryCategory` →
`LibraryItem` (the fixed 8-step instructional sequence: Problem → Check-In →
Learn → Activity → Reflection → Insight → Action → Toolkit) and `Exercise`
(content is a discriminated union on `type`: timer/breathing/checklist/
worksheet/mapper/calculator/scale). Every seeded lesson currently carries
`placeholder: true` — real Adelante text replaces it; a test asserts the flag
so nothing ships silently as final.

**Progress is real patient data**, never localStorage: `completedLibraryItems`,
`completedExercises`, `savedToolkitItems` are flat append-only arrays on
`Patient`, matching the `refusalForms` / `kopIssuances` convention. Completion
is idempotent and audited once; finishing a lesson auto-saves its
`toolkitLabel`. Removing a toolkit entry does NOT un-complete the lesson.

**Population gating reuses Phase 2** — items carry `populations`, filtered
through `resolvePopulation` / `isPopulationAllowed`. Most of the library is
population-neutral; only reentry-specific content (e.g. Finding My Footing) is
gated, and a provisional "not sure" track does not open it. Progress
denominators follow the VISIBLE set, not the full catalog.

**Advocate visibility reuses Phase 4 tiers.** `library_progress_view` is
granted at `hipaa_only` and above — it is a read at the floor, adding no write
and no clinical content. `advocateLibraryProgress` returns counts plus lesson
titles only; patient-authored text (reflections, worksheet answers, toolkit
labels) is never in the DTO, and `part2Sensitive` items are masked without
explicit Part 2 disclosure. Allowed reads and denials are both audited.
