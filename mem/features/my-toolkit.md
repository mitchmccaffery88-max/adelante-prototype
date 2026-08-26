---
name: My toolkit page
description: /toolkit is a read-only aggregation of Part B recovery picks and saved takeaways; no new store, organised by tool type
type: feature
---
`/toolkit` (`src/lib/toolkit.ts` + `src/components/patient/ToolkitPage.tsx`) is a
READ-ONLY aggregation. It creates no store: it reads `recoveryToolFlows` (Part B
warning signs / support people / one action for today, written by
`completeRecoveryLesson`) and `savedToolkitItems` through the `AdelanteEHR` facade.

- Organised BY TOOL TYPE, not by lesson — the picks come from shared vocabularies
  and a patient wants "my warning signs" as one list. Every row keeps lesson
  attribution and links back to `/recovery-journey?lesson=<id>`.
- Saved community resources stay on `/resources/saved` — a directory bookmark
  list, not something built inside a lesson.
- Access: same engagement rule as everything else — patient-scoped, not in the
  advocate DTO, cohort read or clinical export. No new access rule was invented.
- Navigation: no nav entry. One entry point, the "My toolkit" button in the
  Recovery Journey header (same precedent as /checkin, /craving, /slip).
