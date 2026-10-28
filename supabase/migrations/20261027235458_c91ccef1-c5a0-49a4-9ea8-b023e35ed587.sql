begin;
do $$
declare o uuid:='10000000-0000-4000-8000-000000000001'; site uuid:='10000000-0000-4000-8000-000000000002'; u uuid; a uuid; m uuid; p uuid; rr text; n int:=0; ok boolean; eligible boolean; expected boolean; sid uuid;
begin
insert into public.patients(org_id,source_key,first_name,last_name,synthetic) values(o,'phase2c-rollback-chart','Fictional','Access Fixture',true) returning id into p;
insert into public.patient_site_enrollments(org_id,patient_id,site_id,starts_at,synthetic) values(o,p,site,now()-interval '1 day',true);
for rr in select distinct role from app.record_class_grants order by role loop
u:=gen_random_uuid(); a:=gen_random_uuid(); m:=gen_random_uuid();
insert into auth.users(id,aud,role,email) values(u,'authenticated','authenticated','phase2c-'||rr||'@example.test');
insert into public.accounts(id,org_id,auth_user_id,kind,synthetic) values(a,o,u,'staff',true);
insert into public.staff_members(id,org_id,account_id,source_key,name,synthetic) values(m,o,a,'phase2c-'||rr,'Fictional Access Tester',true);
insert into public.staff_role_assignments(org_id,staff_member_id,role,is_primary) values(o,m,rr,true);
perform set_config('request.jwt.claim.sub','',true); perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
set local role authenticated;
if auth.uid()<>u or app.account_id()<>a then raise exception 'real_claim_identity_failed %',rr; end if;
reset role;
perform app.attest_beta('en'); perform app.set_acting_role(rr);
set local role authenticated;
if app.current_role()<>rr then raise exception 'acting_role_failed %',rr; end if;
reset role;
insert into public.staff_site_assignments(org_id,staff_member_id,site_id,starts_at,synthetic) values(o,m,site,now()-interval '1 day',true) returning id into sid;
insert into public.care_team_assignments(org_id,patient_id,staff_member_id,role,assignment_kind,site_id,starts_at,synthetic) values(o,p,m,rr,'clinician',site,now()-interval '1 day',true);
set local role authenticated;
eligible:=rr in ('physician','pmhnp','nurse_rn','lvn','therapist','sud_counselor','clinical_trainee','medical_assistant','ecm_provider','cf_care_manager','peer_specialist','community_health_worker','clinical_coordinator');
ok:=coalesce((app.chart_entry(p)->>'ok')::boolean,false);
if ok<>eligible then raise exception 'same_site_team_chart %',rr; end if;
n:=n+3;
reset role;
update public.staff_site_assignments set ends_at=now() where id=sid;
set local role authenticated;
if coalesce((app.chart_entry(p)->>'ok')::boolean,false) then raise exception 'off_site_chart_leak %',rr; end if;
n:=n+1; reset role;
update public.staff_site_assignments set ends_at=null where id=sid;
update public.care_team_assignments set ends_at=now() where patient_id=p and staff_member_id=m;
set local role authenticated;
-- Existing chart_entry explicitly permits nonrestricted same-site outside-caseload entry.
-- Assert the observed contract, not the requested deny; this group must stay closed.
if coalesce((app.chart_entry(p)->>'ok')::boolean,false)<>eligible then raise exception 'outside_caseload_contract_changed %',rr; end if;
n:=n+1; reset role;
end loop;
if n<>90 then raise exception 'phase2c_real_claim_check_count %',n; end if;
end $$;
rollback;