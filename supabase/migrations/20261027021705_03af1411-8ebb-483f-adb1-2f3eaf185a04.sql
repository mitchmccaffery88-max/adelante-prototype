begin;
create temporary table phase1_results(code text primary key,passed boolean) on commit drop;
do $$ declare o uuid:='10000000-0000-4000-8000-000000000001'; a uuid:=gen_random_uuid(); m uuid:=gen_random_uuid(); r text; t record; op text; n integer; denied boolean; g record; l text; begin
insert into public.accounts(id,org_id,kind) values(a,o,'staff');
insert into public.staff_members(id,org_id,account_id,source_key,name) values(m,o,a,'rollback_staff','Fictional Rollback Staff');
for r in select distinct role from app.record_class_grants loop insert into public.staff_role_assignments(org_id,staff_member_id,role) values(o,m,r); end loop;
execute format('create or replace function app.account_id() returns uuid language sql stable security definer set search_path='''' as %L','select '||quote_literal(a::text)||'::uuid');
for r in select distinct role from app.record_class_grants loop
perform app.set_acting_role(r); if app.current_role()<>r then raise exception 'switch_failed'; end if; insert into phase1_results values('switch_'||r,true);
for t in select schemaname,tablename from pg_tables where (schemaname='public' and tablename in ('orgs','sites','locations','programs','county_programs','accounts','staff_members','staff_role_assignments','acting_role_sessions','feature_flags','audit_events','record_access_log','disclosure_events','patients','patient_contacts','consent_versions','consent_records','consent_signed_copies','tester_attestations')) or (schemaname='app' and tablename='record_class_grants') loop
foreach op in array array['insert','update','delete'] loop denied:=false; begin execute 'set local role authenticated'; if op='insert' then execute format('insert into %I.%I default values',t.schemaname,t.tablename); elsif op='update' then execute format('update %I.%I set updated_at=now() where false',t.schemaname,t.tablename); else execute format('delete from %I.%I where false',t.schemaname,t.tablename); end if; exception when insufficient_privilege then denied:=true; end; execute 'reset role'; if not denied then raise exception 'direct_write_not_denied % % %',r,t.tablename,op; end if; insert into phase1_results values(r||'_'||t.tablename||'_'||op,true); end loop;
execute 'set local role authenticated'; execute format('select count(*) from %I.%I',t.schemaname,t.tablename) into n; execute 'reset role';
if t.tablename='accounts' and n<>1 then raise exception 'account_scope'; end if;
if t.tablename='record_class_grants' and n<>792 then raise exception 'grants_missing'; end if;
if t.tablename='audit_events' and r<>'sys_admin' and n<>0 then raise exception 'audit_leak'; end if;
if t.tablename='feature_flags' and r<>'sys_admin' and n<>0 then raise exception 'flags_leak'; end if;
insert into phase1_results values(r||'_'||t.tablename||'_select',true);
end loop;
end loop;
for g in select * from app.record_class_grants loop perform app.set_acting_role(g.role); select level into l from app.can_access(g.record_class,null); if l<>(case when g.level='consent_gated' then 'none' else g.level end) then raise exception 'matrix_mismatch % %',g.role,g.record_class; end if; insert into phase1_results values('matrix_'||g.role||'_'||g.record_class,true); end loop;
perform app.set_acting_role('intake_coordinator'); if exists(select 1 from app.can_access('demographics') where level<>'none') then raise exception 'union_grant'; end if; insert into phase1_results values('no_union',true);
if (select count(*) from public.acting_role_sessions where account_id=a and ended_at is null)<>1 then raise exception 'multiple_sessions'; end if; insert into phase1_results values('one_session',true);
denied:=false; begin perform app.set_acting_role('unknown_role'); exception when raise_exception then denied:=true; end; if not denied then raise exception 'unknown_role_allowed'; end if; insert into phase1_results values('unheld_role_denied',true);
end $$;
do $$ declare o uuid:='10000000-0000-4000-8000-000000000001'; a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); p uuid:=gen_random_uuid(); other uuid:=gen_random_uuid(); n integer; denied boolean; begin
insert into public.accounts(id,org_id,kind) values(a,o,'patient'),(b,o,'patient');
insert into public.patients(id,org_id,account_id,source_key,first_name,last_name,synthetic) values(p,o,a,'rollback_patient_a','Fictional','Alpha',true),(other,o,b,'rollback_patient_b','Fictional','Beta',true);
insert into public.patient_contacts(org_id,patient_id,kind,value,synthetic) values(o,p,'email','alpha@example.invalid',true),(o,other,'email','beta@example.invalid',true);
execute format('create or replace function app.account_id() returns uuid language sql stable security definer set search_path='''' as %L','select '||quote_literal(a::text)||'::uuid');
execute 'set local role authenticated'; select count(*) into n from public.patients; execute 'reset role'; if n<>1 then raise exception 'patient_isolation'; end if; insert into phase1_results values('patient_own_rows',true);
execute 'set local role authenticated'; select count(*) into n from public.patient_contacts; execute 'reset role'; if n<>1 then raise exception 'contact_isolation'; end if; insert into phase1_results values('patient_own_contacts',true);
denied:=false; begin insert into public.patients(org_id,source_key,first_name,last_name) values(o,'rejected_real','Fictional','Rejected'); exception when raise_exception then denied:=true; end; if not denied then raise exception 'synthetic_guard'; end if; insert into phase1_results values('synthetic_insert_rejected',true);
denied:=false; begin update public.audit_events set outcome='blocked'; exception when raise_exception then denied:=true; end; if not denied then raise exception 'audit_update'; end if; insert into phase1_results values('audit_update_rejected',true);
denied:=false; begin delete from public.audit_events where action_code='foundation.seeded'; exception when raise_exception then denied:=true; end; if not denied then raise exception 'audit_delete'; end if; insert into phase1_results values('audit_delete_rejected',true);
denied:=false; begin perform app.append_audit('test.audit',null,null,'simulated','{"email_code":"person@example.com"}'); exception when raise_exception then denied:=true; end; if not denied then raise exception 'pii_guard'; end if; insert into phase1_results values('audit_pii_rejected',true);
perform app.attest_beta('en'); perform app.attest_beta('en'); if (select count(*) from public.tester_attestations where account_id=a)<>1 or (select count(*) from public.audit_events where actor_account_id=a and action_code='beta.attested')<>1 then raise exception 'attestation_duplicate'; end if; insert into phase1_results values('attestation_once',true);
perform app.record_view(p,'demographics'); perform app.record_view(p,'demographics'); if (select count(*) from public.record_access_log where patient_id=p)<>1 or (select view_count from public.record_access_log where patient_id=p)<>2 then raise exception 'collapse_failed'; end if; insert into phase1_results values('access_collapse',true);
end $$;
select count(*) checks,count(*) filter(where passed) passed from phase1_results;
rollback;