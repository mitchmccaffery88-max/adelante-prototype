begin;
create temporary table phase1_final_results(code text primary key) on commit drop;
do $$ declare o uuid:='10000000-0000-4000-8000-000000000001'; a uuid:=gen_random_uuid(); m uuid:=gen_random_uuid(); r text; t record; op text; n integer; denied boolean; g record; l text; begin
insert into public.accounts(id,org_id,kind) values(a,o,'staff');
insert into public.staff_members(id,org_id,account_id,source_key,name) values(m,o,a,'rollback_final_staff','Fictional Final Staff');
for r in select distinct role from app.record_class_grants loop insert into public.staff_role_assignments(org_id,staff_member_id,role) values(o,m,r); end loop;
execute format('create or replace function app.account_id() returns uuid language sql stable security definer set search_path='''' as %L','select '||quote_literal(a::text)||'::uuid');
for r in select distinct role from app.record_class_grants loop
perform app.set_acting_role(r); if app.current_role()<>r then raise exception 'switch_failed'; end if; insert into phase1_final_results values('switch_'||r);
for t in select schemaname,tablename from pg_tables where schemaname in ('public','app') loop
foreach op in array array['insert','update','delete'] loop denied:=false; begin execute 'set local role authenticated'; if op='insert' then execute format('insert into %I.%I default values',t.schemaname,t.tablename); elsif op='update' then execute format('update %I.%I set updated_at=now() where false',t.schemaname,t.tablename); else execute format('delete from %I.%I where false',t.schemaname,t.tablename); end if; exception when insufficient_privilege then denied:=true; end; execute 'reset role'; if not denied then raise exception 'direct_write_not_denied % % %',r,t.tablename,op; end if; insert into phase1_final_results values(r||'_'||t.tablename||'_'||op); end loop;
execute 'set local role authenticated'; execute format('select count(*) from %I.%I',t.schemaname,t.tablename) into n; execute 'reset role';
if t.tablename='accounts' and n<>1 then raise exception 'account_scope'; end if;
if t.tablename='record_class_grants' and n<>792 then raise exception 'grants_missing'; end if;
if t.tablename in ('audit_events','feature_flags') and r<>'sys_admin' and n<>0 then raise exception 'protected_data_leak'; end if;
insert into phase1_final_results values(r||'_'||t.tablename||'_select');
end loop; end loop;
for g in select * from app.record_class_grants loop perform app.set_acting_role(g.role); select level into l from app.can_access(g.record_class,null); if l<>(case when g.level='consent_gated' then 'none' else g.level end) then raise exception 'matrix_mismatch'; end if; insert into phase1_final_results values('matrix_'||g.role||'_'||g.record_class); end loop;
perform app.set_acting_role('intake_coordinator'); if exists(select 1 from app.can_access('demographics') where level<>'none') then raise exception 'union_grant'; end if; insert into phase1_final_results values('no_union');
if (select count(*) from public.acting_role_sessions where account_id=a and ended_at is null)<>1 then raise exception 'multiple_sessions'; end if; insert into phase1_final_results values('one_session');
denied:=false; begin perform app.set_acting_role('unknown_role'); exception when raise_exception then denied:=true; end; if not denied then raise exception 'unknown_role_allowed'; end if; insert into phase1_final_results values('unheld_role_denied');
end $$;
select count(*) checks from phase1_final_results;
rollback;