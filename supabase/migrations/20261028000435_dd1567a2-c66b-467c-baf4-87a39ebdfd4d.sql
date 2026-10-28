begin;
create temporary table phase2c_counts(relation text primary key,n bigint);
do $$ declare t record; rr text; u uuid; a uuid; m uuid; o uuid:='10000000-0000-4000-8000-000000000001'; site uuid:='10000000-0000-4000-8000-000000000002'; n int; denied boolean; op text; checks int:=0; begin
insert into phase2c_counts values('auth.users',(select count(*) from auth.users));
for t in select c.relname from pg_class c join pg_namespace ns on ns.oid=c.relnamespace where ns.nspname='public' and c.relkind='r' loop execute format('insert into phase2c_counts select %L,count(*) from public.%I',t.relname,t.relname);end loop;
begin
for rr in select distinct role from app.record_class_grants order by role loop
u:=gen_random_uuid();a:=gen_random_uuid();m:=gen_random_uuid();
insert into auth.users(id,aud,role,email) values(u,'authenticated','authenticated','phase2c-final-'||rr||'@example.test');
insert into public.accounts(id,org_id,auth_user_id,kind,synthetic) values(a,o,u,'staff',true);
insert into public.staff_members(id,org_id,account_id,source_key,name,synthetic) values(m,o,a,'phase2c-final-'||rr,'Fictional Final Tester',true);
insert into public.staff_role_assignments(org_id,staff_member_id,role,is_primary) values(o,m,rr,true);
insert into public.staff_site_assignments(org_id,staff_member_id,site_id,starts_at,synthetic) values(o,m,site,now()-interval '1 day',true);
perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);perform app.attest_beta('en');perform app.set_acting_role(rr);
for t in select c.relname from pg_class c join pg_namespace ns on ns.oid=c.relnamespace where ns.nspname='public' and c.relname=any(array['care_team_assignments','patient_site_enrollments','staff_site_assignments','restricted_record_flags','restricted_record_opens','advocates','advocate_links','referrals','referral_codes','referral_status_updates','referral_outreach_log','signup_sessions','signup_attempts','signup_safety_scans','identity_review_items','account_support_items','website_inbox_items','intake_checklists','intake_form_status','intake_packet_needs','pre_chart_triage','first_visit_handoffs','staging_imports','staging_rows','packet_documents','on_call_shifts']) loop
set local role authenticated;
execute format('select count(*) from public.%I',t.relname) into n;
if t.relname='staff_site_assignments' then if n<>1 then raise exception 'opened_site_rule %',rr;end if;
elsif n<>0 then raise exception 'unproved_rows_visible % %',rr,t.relname;end if;
checks:=checks+1;
foreach op in array array['INSERT','UPDATE','DELETE'] loop
if has_table_privilege('authenticated','public.'||t.relname,op) then raise exception 'direct_write_grant % %',t.relname,op;end if;checks:=checks+1;end loop;
reset role;
end loop;
end loop;
if checks<>1872 then raise exception 'final_matrix_count %',checks;end if;
raise exception using errcode='ZX002',message='fixtures_rollback';
exception when sqlstate 'ZX002' then null;
end;
if (select count(*) from auth.users)<>(select pc.n from phase2c_counts pc where pc.relation='auth.users') then raise exception 'retained_auth_user';end if;
for t in select * from phase2c_counts where relation<>'auth.users' loop execute format('select count(*) from public.%I',t.relation) into n;if n<>t.n then raise exception 'retained_fixture %',t.relation;end if;end loop;
end $$;
rollback;