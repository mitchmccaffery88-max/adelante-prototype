---
name: Pre-release real screening (SUD + SDOH)
description: AUDIT-10/DAST-10 and AHC-HRSN administered inside pre-release episodes, stored through the shared ScreenerResult path with population-health rollups
type: feature
---
- The pre-release `bh_sud_loc` and `dhcs_hra` rows have NO fields. They are satisfied by real `ScreenerResult`s: `satisfiedByScreeners: ["audit","dast-10"]` and `["ahc-hrsn"]`. `savePreReleaseForm` throws for these defs.
- Administration goes through `AdelanteEHR.recordPreReleaseScreener` → `assertCfEntryScope` (CF direct/proxy attribution) → Build-1 capacity gate → shared `scoreScreener` → the ordinary `recordScreener` path (same `patient.screeners`, `screenerHistory`, crisis handling, care-plan recompute). No parallel scoring or storage.
- SDOH instrument = **CMS AHC-HRSN core** (chosen over PRAPARE because DHCS CalAIM/PATH guidance is written against its five domains). Defined as a `DomainScreenerDef` sibling in `src/lib/screeners.ts`; score = count of positive domains; safety domain uses the HITS >10 threshold.
- Population health: `AdelanteEHR.screenerPopulationSummary({keys, patientIds})` derives positive-screen rates (from `ScreenerDef.positiveCutoff`) and SDOH domain prevalence from stored results — no separate analytics table.
