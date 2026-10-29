# Approve handoff read-policy group — Draft

## What this approval opens
One existing read policy in its own third migration:
- `intake_scoped` on `first_visit_handoffs`: same-org handoff rows through the existing packet-access gate.

Intake reads remain read-only: day60 allowed, day61 denied, with handoff date counted as day1. Existing coordinator and assigned care-team conditions remain authoritative. No new writes, record-class permissions, consent rules, or patient/advocate policy changes.

## Cases that proved it
Connected-main 112-check rollback acceptance passed Intake day60/day61, dated chart relationships, members, MOUD, Part2 and restricted-record boundaries.

The separate candidate-policy rollback tested actual authenticated handoff rows across all18 roles: off-team roles denied except the existing coordinator/Intake paths; Intake day60 one handoff row visible and day61 none visible. All47 public-table and auth.users counts matched before/after. All candidate changes rolled back before approvals.

## Exact migration
```sql
alter policy intake_scoped on public.first_visit_handoffs
  using (org_id=app.org_id() and app.phase2_packet_access(referral_id,false));
```

## Current state and final validation
Chart and general packet/checklist/needs groups were separately approved, applied and their exact predicates read back. This handoff policy remains closed pending this approval. Tagged Part2 documents stay closed; reason/coverage commands stay revoked until2d. Persistence stays OFF; nothing is published. Part2 internal-use basis remains pending counsel confirmation.

After this approval: apply handoff, read back all three groups and unchanged counts, run full units then the public browser suite without overlap, and finalize access report, rollback evidence, Draft matrix and roadmap.