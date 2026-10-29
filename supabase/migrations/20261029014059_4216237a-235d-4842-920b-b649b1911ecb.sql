begin;
alter policy staff_chart_identity on public.patients using (org_id=app.org_id() and app.phase2_chart_read(id,'demographics'));
alter policy staff_chart_contacts on public.patient_contacts using (org_id=app.org_id() and app.phase2_chart_read(patient_id,'demographics'));
alter policy team_context on public.care_team_assignments using (org_id=app.org_id() and app.phase2_chart_read(patient_id,'demographics'));
alter policy packet_general_only on public.packet_documents using (org_id=app.org_id() and classification='general' and not part2_tagged and app.phase2_packet_access(referral_id,false));
alter policy packet_needs on public.intake_packet_needs using (org_id=app.org_id() and app.phase2_packet_access(referral_id,false));
alter policy intake_scoped on public.intake_checklists using (org_id=app.org_id() and app.phase2_packet_access(referral_id,false));
alter policy intake_scoped on public.first_visit_handoffs using (org_id=app.org_id() and app.phase2_packet_access(referral_id,false));
do $$ declare o uuid:='10000000-0000-4000-8000-000000000001'; site uuid:='10000000-0000-4000-8000-000000000002'; u uuid; a uuid; m uuid; p uuid; ref uuid; h uuid; team_id uuid; r text; expected boolean; t record; c bigint; counts jsonb:='{}'; after_counts jsonb:='{}'; n int; begin
for t in select schemaname,tablename from pg_tables where schemaname='public' union all select 'auth','users' loop execute format('select count(*) from %I.%I',t.schemaname,t.tablename) into c;counts:=counts||jsonb_build_object(t.schemaname||'.'||t.tablename,c);end loop;
begin
insert into public.patients(org_id,source_key,first_name,last_name,synthetic) values(o,'step5-policy','Fictional','Policy',true) returning id into p;
insert into public.patient_site_enrollments(org_id,patient_id,site_id,starts_at,synthetic) values(o,p,site,now()-interval '100 days',true);
insert into public.patient_contacts(org_id,patient_id,kind,value,synthetic) values(o,p,'phone','5550100000',true);
insert into public.referrals(org_id,source_key,first_name,last_name,referrer_type,identity_confidence,status,source,linked_patient_id,synthetic) values(o,'step5-policy-ref','Fictional','Policy','self','verified_source','enrolled','referral_form',p,true) returning id into ref;
insert into public.intake_checklists(org_id,referral_id,identity_link_checked,contact_checked,packet_received,handoff_ready,completed_at,synthetic) values(o,ref,true,true,true,true,now()-interval '61 days',true);
insert into public.first_visit_handoffs(org_id,referral_id,patient_id,status,handed_off_at,synthetic) values(o,ref,p,'ready',(((now() at time zone 'America/Los_Angeles')::date-59)+time '12:00') at time zone 'America/Los_Angeles',true) returning id into h;
insert into public.packet_documents(org_id,referral_id,document_type,source,source_ref,classification,part2_tagged,file_name,synthetic) values(o,ref,'hra','referral_form','referral:'||ref,'general',false,'fictional.txt',true),(o,ref,'roi','referral_form','referral:'||ref,'part2',true,'fictional-part2.txt',true);
insert into public.intake_packet_needs(org_id,referral_id,need_kind,state,source,source_ref,synthetic) values(o,ref,'housing','confirmed_still_needed','referral_form','referral:'||ref,true);
for r in select distinct role from app.record_class_grants order by role loop
u:=gen_random_uuid();a:=gen_random_uuid();m:=gen_random_uuid();insert into auth.users(id,aud,role,email) values(u,'authenticated','authenticated','step5-policy-'||r||'@example.test');insert into public.accounts(id,org_id,auth_user_id,kind,synthetic) values(a,o,u,'staff',true);insert into public.staff_members(id,org_id,account_id,source_key,name,synthetic) values(m,o,a,'step5-policy-'||r,'Fictional '||r,true);insert into public.staff_role_assignments(org_id,staff_member_id,role,is_primary) values(o,m,r,true);
perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);perform app.attest_beta('en');perform app.set_acting_role(r);
set local role authenticated;
if ((select count(*) from public.patients where id=p)=1)<>(r in ('clinical_coordinator','sys_admin')) then raise exception 'policy_offteam %',r;end if;
if ((select count(*) from public.packet_documents where referral_id=ref)=1)<>(r in ('intake_coordinator','clinical_coordinator')) then raise exception 'packet_offteam %',r;end if;
if ((select count(*) from public.first_visit_handoffs where referral_id=ref)=1)<>(r in ('intake_coordinator','clinical_coordinator')) then raise exception 'handoff_offteam %',r;end if;
reset role;
insert into public.care_team_assignments(org_id,patient_id,staff_member_id,role,assignment_kind,site_id,starts_at,synthetic) values(o,p,m,'clinician','clinician',site,now()-interval '1 hour',true) returning id into team_id;
expected:=r not in ('billing','billing_coordinator','credentialing_coordinator','intake_coordinator');
set local role authenticated;
if ((select count(*) from public.patients where id=p)=1)<>expected then raise exception 'policy_team %',r;end if;
if ((select count(*) from public.patient_contacts where patient_id=p)=1)<>expected then raise exception 'contacts_team %',r;end if;
if ((select count(*) from public.care_team_assignments where id=team_id)=1)<>expected then raise exception 'team_context %',r;end if;
if (select count(*) from public.packet_documents where referral_id=ref and part2_tagged)<>0 then raise exception 'part2_packet_leak %',r;end if;
reset role;update public.care_team_assignments set ends_at=now() where id=team_id;
if expected and r not in ('clinical_coordinator','sys_admin') then
insert into public.chart_reason_grants(org_id,patient_id,account_id,acting_role,reason_code,opened_at,expires_at,synthetic) values(o,p,a,r,'covering_consult',now()-interval '1 minute',now()+interval '1 hour',true);
set local role authenticated;if (select count(*) from public.patients where id=p)<>1 then raise exception 'policy_reason %',r;end if;reset role;update public.chart_reason_grants set expires_at=now() where account_id=a;
end if;
if r='intake_coordinator' then
set local role authenticated;
if (select count(*) from public.packet_documents where referral_id=ref)<>1 or (select count(*) from public.intake_packet_needs where referral_id=ref)<>1 or (select count(*) from public.intake_checklists where referral_id=ref)<>1 or (select count(*) from public.first_visit_handoffs where referral_id=ref)<>1 then raise exception 'intake_day60_policy';end if;reset role;
update public.first_visit_handoffs set handed_off_at=(((now() at time zone 'America/Los_Angeles')::date-60)+time '12:00') at time zone 'America/Los_Angeles' where id=h;
set local role authenticated;
if (select count(*) from public.packet_documents where referral_id=ref)<>0 or (select count(*) from public.intake_packet_needs where referral_id=ref)<>0 or (select count(*) from public.intake_checklists where referral_id=ref)<>0 or (select count(*) from public.first_visit_handoffs where referral_id=ref)<>0 then raise exception 'intake_day61_policy';end if;reset role;
update public.first_visit_handoffs set handed_off_at=(((now() at time zone 'America/Los_Angeles')::date-59)+time '12:00') at time zone 'America/Los_Angeles' where id=h;
end if;
end loop;
raise exception using errcode='ZX001',message='fixture_rollback';exception when sqlstate 'ZX001' then null;end;
for t in select schemaname,tablename from pg_tables where schemaname='public' union all select 'auth','users' loop execute format('select count(*) from %I.%I',t.schemaname,t.tablename) into c;after_counts:=after_counts||jsonb_build_object(t.schemaname||'.'||t.tablename,c);end loop;if counts<>after_counts then raise exception 'policy_fixture_retained';end if;
end $$;
rollback;