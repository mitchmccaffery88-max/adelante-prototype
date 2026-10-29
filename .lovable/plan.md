# Approve chart read-policy group — Draft

## What this approval opens
Only these three existing staff read policies, in one migration:
- `staff_chart_identity` on `patients`: same-org identity reads only after the existing chart-entry and demographics-class gate.
- `staff_chart_contacts` on `patient_contacts`: same-org contact reads through that same gate.
- `team_context` on `care_team_assignments`: same-org team context through that same gate.

No writes, no Part 2 class grants, no patient/advocate policy edits, and no command execution grants. Restricted records retain the stricter existing gate. Persistence stays OFF; nothing is published. Part 2 internal-use basis remains pending counsel confirmation.

## Cases that proved this group
Connected-main rollback acceptance passed 112 checks across all 18 roles: team/off-team/reason/expired reason; dated on-call and coverage; supervisee-only; group context without full chart; restricted reason denial versus team entry; Part 2 direct matrix and reasoned class-specific consent; MOUD self-only team lifecycle; patient/advocate isolation.

A separate rollback tested actual candidate-policy row reads for all-role off-team/team, contacts, team rows and reason-open identity. All public-table/auth counts matched before/after. Every candidate policy is still closed after rollback.

## Exact migration
```sql
alter policy staff_chart_identity on public.patients
  using (org_id=app.org_id() and app.phase2_chart_read(id,'demographics'));
alter policy staff_chart_contacts on public.patient_contacts
  using (org_id=app.org_id() and app.phase2_chart_read(patient_id,'demographics'));
alter policy team_context on public.care_team_assignments
  using (org_id=app.org_id() and app.phase2_chart_read(patient_id,'demographics'));
```

## Next separate approvals
After chart approval and readback, show the general packet/checklist/needs migration, then the handoff migration individually. Tagged Part 2 packet-document policies remain closed; the candidate general-only policy explicitly excludes them. After approved openings, run full units then the public browser suite and finalize evidence/matrix/roadmap.