---
name: 5-stage recovery journey model
description: Five person-set recovery stages with observable signals, held pending Christi/Dr. Bagga review; never auto-derived from data
type: feature
---
Stages (order matters): Stabilizing → Building Strength → Reconnecting → Growing → Thriving.
Each carries real observable "signals" (src/lib/recoveryStages.ts) — reference/self-check content, never scored.

HARD RULE: the stage is SET BY A PERSON (patient on /home, care team in the chart's Care plan tab),
never computed from engagement, screeners or care-plan data. Do not add a derivation/auto-progression
function — that is the clinical judgment awaiting sign-off. Every set is an append-only audited entry
(`recovery_stage_set`, category `care_plan`) and is reversible.

`RECOVERY_STAGE_REVIEW.pending` is true: patient-facing stage surfaces render the pending notice, but
unlike ADVOCATE_MESSAGING_REVIEW the write is NOT blocked (a self-check has no safety gate to enforce).
Clear only with real sign-off.

Milestones (`recoveryMilestones`) are warm cards from real streak/lesson/practice/toolkit counts —
no points, badges, levels or leaderboards, and they never feed the stage.
