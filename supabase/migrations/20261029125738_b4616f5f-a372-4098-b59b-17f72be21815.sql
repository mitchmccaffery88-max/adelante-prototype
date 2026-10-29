alter policy packet_general_only on public.packet_documents
  using (org_id=app.org_id() and classification='general' and not part2_tagged
    and app.phase2_packet_access(referral_id,false));
alter policy packet_needs on public.intake_packet_needs
  using (org_id=app.org_id() and app.phase2_packet_access(referral_id,false));
alter policy intake_scoped on public.intake_checklists
  using (org_id=app.org_id() and app.phase2_packet_access(referral_id,false));