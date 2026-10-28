begin;
grant execute on function app.resolve_crisis_owner(uuid,uuid,text,timestamptz) to authenticated;
alter policy own_work_sites on public.staff_site_assignments using(org_id=app.org_id() and staff_member_id=app.phase2_staff_id());
do $$ declare o uuid:='10000000-0000-4000-8000-000000000001'; site uuid:='10000000-0000-4000-8000-000000000002'; u uuid; a uuid; m uuid; rr text; n int; t record; denied boolean; checks int:=0; begin
for rr in select distinct role from app.record_class_grants order by role loop
u:=gen_random_uuid();a:=gen_random_uuid();m:=gen_random_uuid();
insert into auth.users(id,aud,role,email) values(u,'authenticated','authenticated','phase2c-sites-'||rr||'@example.test');
insert into public.accounts(id,org_id,auth_user_id,kind,synthetic) values(a,o,u,'staff',true);
insert into public.staff_members(id,org_id,account_id,source_key,name,synthetic) values(m,o,a,'phase2c-sites-'||rr,'Fictional Site Tester',true);
insert into public.staff_role_assignments(org_id,staff_member_id,role,is_primary) values(o,m,rr,true);
insert into public.staff_site_assignments(org_id,staff_member_id,site_id,starts_at,synthetic) values(o,m,site,now()-interval '1 day',true);
perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);perform app.attest_beta('en');perform app.set_acting_role(rr);
set local role authenticated;
select count(*) into n from public.staff_site_assignments; if n<>1 then raise exception 'own_site_positive_negative %',rr; end if;
if exists(select 1 from public.staff_site_assignments where staff_member_id<>m) then raise exception 'sibling_site_leak %',rr; end if;
checks:=checks+2; reset role;
end loop;
perform set_config('request.jwt.claims','{"role":"anon"}',true);
for t in select c.relname from pg_class c join pg_namespace ns on ns.oid=c.relnamespace where ns.nspname='public' and c.relkind='r' loop
set local role anon; denied:=false;
begin execute format('select count(*) from public.%I',t.relname) into n; exception when insufficient_privilege then denied:=true; end;
if not denied and n<>0 then raise exception 'anon_rows %',t.relname; end if;
checks:=checks+1;reset role;
end loop;
if checks<>81 then raise exception 'own_sites_anon_count %',checks; end if;
end $$;
do $$
declare o uuid:='10000000-0000-4000-8000-000000000001'; site uuid:='10000000-0000-4000-8000-000000000002'; u uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); p uuid; cm uuid:=md5('phase2b:staff:s-cm2')::uuid; cl uuid:=md5('phase2b:staff:s-th2')::uuid; v jsonb; j jsonb; expected uuid; ts timestamptz:='2026-10-27T12:00:00Z'; vectors jsonb:='[{"id":"sdoh_assigned","category":"sdoh","assigned":"care_manager","shift":"in_range","expected":"care_manager","source":"assigned","fallback":false},{"id":"clinical_assigned","category":"clinical","assigned":"clinician","shift":"in_range","expected":"clinician","source":"assigned","fallback":false},{"id":"on_call_in_range","category":"clinical","assigned":null,"shift":"in_range","expected":"clinician","source":"on_call","fallback":false},{"id":"on_call_out_of_range","category":"clinical","assigned":null,"shift":"out_of_range","expected":null,"source":"clinical_coordinator","fallback":true},{"id":"coordinator_fallback","category":"clinical","assigned":null,"shift":null,"expected":null,"source":"clinical_coordinator","fallback":true},{"id":"sdoh_skips_on_call","category":"sdoh","assigned":null,"shift":"in_range","expected":null,"source":"clinical_coordinator","fallback":true}]'; begin
insert into auth.users(id,aud,role,email) values(u,'authenticated','authenticated','phase2c-crisis@example.test');insert into public.accounts(id,org_id,auth_user_id,kind,synthetic) values(a,o,u,'patient',true);
perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);perform app.attest_beta('en');
for v in select value from jsonb_array_elements(vectors) loop
insert into public.patients(org_id,source_key,first_name,last_name,synthetic) values(o,'phase2c-'||(v->>'id'),'Fictional','Crisis Vector',true) returning id into p;
if v->>'assigned' is not null then insert into public.care_team_assignments(org_id,patient_id,staff_member_id,role,assignment_kind,site_id,starts_at,synthetic) values(o,p,case when v->>'assigned'='clinician' then cl else cm end,case when v->>'assigned'='clinician' then 'therapist' else 'ecm_provider' end,v->>'assigned',site,ts-interval '1 hour',true);end if;
-- Each vector's shifts are rolled back in a subtransaction after its assertions.
begin
if v->>'shift' is not null then insert into public.on_call_shifts(org_id,clinician_id,site_id,starts_at,ends_at,synthetic) values(o,cl,site,ts-interval '1 hour',case when v->>'shift'='in_range' then ts+interval '1 hour' else ts end,true);end if;
set local role authenticated;j:=app.resolve_crisis_owner(p,site,v->>'category',ts);reset role;
expected:=case when v->>'expected'='clinician' then cl when v->>'expected'='care_manager' then cm else null end;
if (j->>'staff_id')::uuid is distinct from expected or j->>'source'<>v->>'source' or (j->>'fallback_visible')::boolean<>(v->>'fallback')::boolean then raise exception 'crisis_parity % %',v->>'id',j;end if;
if (v->>'fallback')::boolean and j->>'notice'<>'No on-call clinician set — sent to the clinical coordinator' then raise exception 'fallback_notice';end if;
raise exception using errcode='ZX001',message='vector_rollback';
exception when sqlstate 'ZX001' then null;
end;
end loop;
end $$;
rollback;