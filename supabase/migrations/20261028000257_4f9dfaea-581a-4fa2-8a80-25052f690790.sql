alter policy own_work_sites on public.staff_site_assignments using(org_id=app.org_id() and staff_member_id=app.phase2_staff_id());
notify pgrst,'reload schema';