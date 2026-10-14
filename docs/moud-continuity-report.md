# Phase 3 Part B — MOUD continuity (13 Oct 2026)

Record: `MoudContinuityRecord` per patient per pre-release episode (release cycle); planInPlace / confirmed {type, at, byStaffId}. No reason required (Mitch). Audit: `continuity_plan_recorded` / `continuity_confirmed` with actor, time, episodeId, before/after; plus the standard runAction event. Neutral audit text.

Writers: assigned reentry guide (episode cfCareManagerStaffId), assigned care coordinator (caseManagerId via isAssignedTo), prescriber roles (isPrescriberRole) — after part2_sud disclosure access and chart site/restricted entry. Others read-only; no-Part-2 viewers see no panel.

Display (staff only; "Default per published guidance; pending clinical review (Dr. Bagga)"): Confirmed > released 0–14 facility days "Reach out today" > >14 "Confirm MOUD continuity" > pre-release no plan "Set MOUD plan" > "Plan in place". Released without a runnable date: no chip. Out of supply from refillRunway daysLeft <= 0: MOUD "Out of MAT — reach out", other "Ask for a refill"; shown alongside, never suppressed by confirmation. Four-day medContinuity thresholds unchanged. isMatOrder unchanged (naltrexone flagged in a comment).

Notes: implemented as a sibling store module (like outpatientCare.ts) using AdelanteEHR._recordAudit rather than inside the AdelanteEHR object, to avoid a circular import with ab133. The pre-release screen is in-facility (off by default), so screenshots enabled it for the session only. No permanent demo seed; states were demonstrated in-session with real store functions on Luis Camacho. Permissions snapshot gained two entries (both hidden at role level), nothing else changed. Current demo MOUD order has no days-supply, so no out-of-supply chip can be shown honestly.
