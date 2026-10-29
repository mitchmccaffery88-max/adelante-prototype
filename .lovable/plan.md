# Approve general packet read-policy group — Draft

## What this approval opens
Only these three existing read policies, in a separate migration:
- `packet_general_only` on `packet_documents`: same-org general, non-Part-2 documents through the existing packet-access gate.
- `packet_needs` on `intake_packet_needs`: same-org needs through the existing packet-access gate.
- `intake_scoped` on `intake_checklists`: same-org checklist through that same gate.

Intake keeps read-only access through day60 after handoff (handoff date is day1); day61 is denied. Existing coordinator and assigned care-team packet rules remain unchanged. No edits or document uploads, no matrix changes, no patient/advocate policy changes. Tagged Part 2 documents remain hidden; no new Part 2 policy is proposed. Persistence stays OFF; nothing is published.

## Cases that proved this group
Main rollback rule acceptance passed 112 checks, including Intake day60 general/consented Part2 evaluator access, no-consent denial, and day61 denial.

Separate candidate-policy rollback tested actual authenticated reads across all18 roles: off-team packet role boundaries, tagged Part2 documents hidden for every role, Intake day60 one general document/need/checklist visible, and day61 no document/need/checklist visible. All47 public tables plus auth.users matched before/after; no fixtures remained. These three policies remain closed pending this approval.

## Exact migration
```sql
alter policy packet_general_only on public.packet_documents
  using (org_id=app.org_id() and classification='general' and not part2_tagged
    and app.phase2_packet_access(referral_id,false));
alter policy packet_needs on public.intake_packet_needs
  using (org_id=app.org_id() and app.phase2_packet_access(referral_id,false));
alter policy intake_scoped on public.intake_checklists
  using (org_id=app.org_id() and app.phase2_packet_access(referral_id,false));
```

## Remaining approval and validation
Chart group has been approved, applied and read back. After packet approval/readback, show the handoff migration separately. Reason/coverage commands remain revoked until2d; Part2 internal-use basis remains pending counsel confirmation. Run full units then the public browser suite after the approved openings, then finalize reports/matrix/roadmap.