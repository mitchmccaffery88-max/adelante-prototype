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

**Progress is engagement data, NOT clinical documentation.** It lives in its
own store, `src/lib/engagement.ts`, keyed by `patientId` as a foreign
reference — `completedLibraryItems`, `completedExercises`,
`savedToolkitItems` must never be fields on `Patient`, so the designated
clinical record does not carry, export or disclose them. Separate but
joinable: `engagementRecords(ids)` / `engagementSummary(id)` exist so
population-health and outcomes reporting can join engagement to clinical data
by patient id. `AdelanteEHR.*` keeps thin facade wrappers (state-free) so UI
has one entry point, writes re-broadcast to EHR subscribers, and audit still
lands in the single audit stream via an injected sink. Completion
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

**Category eyebrow is authored, not derived.** `LibraryCategory.eyebrow` is an
optional short patient-facing phrase (admin-editable). `categoryEyebrow()` in
`src/lib/contentDisplay.ts` prefers it and only falls back to the
`shortClinicalTarget()` trim, which can silently produce plausible-but-wrong
text. Starting Strong is authored as "Grounding · Nervous system regulation".
