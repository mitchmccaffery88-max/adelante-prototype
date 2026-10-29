alter policy intake_scoped on public.first_visit_handoffs
  using (org_id=app.org_id() and app.phase2_packet_access(referral_id,false));