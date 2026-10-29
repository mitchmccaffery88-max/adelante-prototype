alter policy staff_chart_identity on public.patients
  using (org_id=app.org_id() and app.phase2_chart_read(id,'demographics'));
alter policy staff_chart_contacts on public.patient_contacts
  using (org_id=app.org_id() and app.phase2_chart_read(patient_id,'demographics'));
alter policy team_context on public.care_team_assignments
  using (org_id=app.org_id() and app.phase2_chart_read(patient_id,'demographics'));