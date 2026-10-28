begin;
create temporary table access_before(relation text primary key,n bigint);
do $$ declare t record; v bigint; begin for t in select tablename from pg_tables where schemaname='public' loop execute format('select count(*) from public.%I',t.tablename) into v; insert into access_before values(t.tablename,v); end loop; insert into access_before values('auth.users',(select count(*) from auth.users)); end $$;
do $$ declare o uuid:='10000000-0000-4000-8000-000000000001'; site uuid:='10000000-0000-4000-8000-000000000002'; u uuid; a uuid; m uuid; p uuid; rr text; eligible boolean; oversight boolean; n integer:=0; t record; v bigint; begin
begin
insert into public.patients(org_id,source_key,first_name,last_name,synthetic) values(o,'access-oct28-rollback','Fictional','Access Fixture',true) returning id into p;
insert into public.patient_site_enrollments(org_id,patient_id,site_id,starts_at,synthetic) values(o,p,site,now()-interval '1 day',true);
for rr in select distinct role from app.record_class_grants order by role loop
u:=gen_random_uuid(); a:=gen_random_uuid(); m:=gen_random_uuid();
insert into auth.users(id,aud,role,email) values(u,'authenticated','authenticated','access-'||rr||'@example.test');
insert into public.accounts(id,org_id,auth_user_id,kind,synthetic) values(a,o,u,'staff',true);
insert into public.staff_members(id,org_id,account_id,source_key,name,synthetic) values(m,o,a,'access-'||rr,'Fictional Access Tester',true);
insert into public.staff_role_assignments(org_id,staff_member_id,role,is_primary) values(o,m,rr,true);
perform set_config('request.jwt.claim.sub','',true); perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
perform app.attest_beta('en'); perform app.set_acting_role(rr);
insert into public.care_team_assignments(org_id,patient_id,staff_member_id,role,assignment_kind,site_id,starts_at,synthetic) values(o,p,m,rr,'clinician',site,now()-interval '1 day',true);
set local role authenticated;
if auth.uid()<>u or app.account_id()<>a then raise exception 'claims_failed %',rr; end if;
eligible:=app.chart_role_eligible(rr); oversight:=rr in ('clinical_coordinator','sys_admin');
if coalesce((app.chart_entry(p)->>'ok')::boolean,false)<>eligible then raise exception 'team_failed %',rr; end if;
if rr in ('physician','pmhnp','therapist','sud_counselor') and not app.phase2_chart_read(p,'screeners_sud') then raise exception 'treating_matrix_failed %',rr; end if;
reset role;
update public.care_team_assignments set ends_at=now() where patient_id=p and staff_member_id=m;
set local role authenticated;
if coalesce((app.chart_entry(p)->>'ok')::boolean,false)<>oversight then raise exception 'off_team_failed %',rr; end if;
reset role;
if eligible then
insert into public.chart_reason_grants(org_id,patient_id,account_id,acting_role,reason_code,opened_at,expires_at,synthetic) values(o,p,a,rr,'crisis_safety',now()-interval '1 minute',now()+interval '1 hour',true);
set local role authenticated;
if not (app.chart_entry(p)->>'ok')::boolean then raise exception 'reason_failed %',rr; end if;
if rr not in ('clinical_coordinator','sys_admin') and app.phase2_chart_read(p,'screeners_sud') then raise exception 'reason_part2_leak %',rr; end if;
reset role;
update public.chart_reason_grants set opened_at=now()-interval '2 hours',expires_at=now()-interval '1 hour' where account_id=a;
set local role authenticated;
if coalesce((app.chart_entry(p)->>'ok')::boolean,false)<>oversight then raise exception 'expiry_failed %',rr; end if;
reset role;
end if;
n:=n+1;
end loop;
if n<>18 then raise exception 'role_count_failed %',n; end if;
raise exception using errcode='ZX001',message='fixture_rollback';
exception when sqlstate 'ZX001' then null;
end;
for t in select * from access_before loop if t.relation='auth.users' then select count(*) into v from auth.users; else execute format('select count(*) from public.%I',t.relation) into v; end if; if v<>t.n then raise exception 'retained_fixture %',t.relation; end if; end loop;
end $$;
rollback;