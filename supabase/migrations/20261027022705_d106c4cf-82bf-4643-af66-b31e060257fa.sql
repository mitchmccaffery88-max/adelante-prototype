begin;
create temporary table phase1_boundary_results(code text) on commit drop;
do $$ declare o uuid:='10000000-0000-4000-8000-000000000001'; a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); p uuid:=gen_random_uuid(); q uuid:=gen_random_uuid(); n integer; denied boolean; begin
insert into public.accounts(id,org_id,kind) values(a,o,'patient'),(b,o,'patient');
insert into public.patients(id,org_id,account_id,source_key,first_name,last_name,synthetic) values(p,o,a,'rollback_final_patient_a','Fictional','Alpha',true),(q,o,b,'rollback_final_patient_b','Fictional','Beta',true);
insert into public.patient_contacts(org_id,patient_id,kind,value,synthetic) values(o,p,'email','alpha@example.invalid',true),(o,q,'email','beta@example.invalid',true);
execute format('create or replace function app.account_id() returns uuid language sql stable security definer set search_path='''' as %L','select '||quote_literal(a::text)||'::uuid');
execute 'set local role authenticated'; select count(*) into n from public.patients; execute 'reset role'; if n<>1 then raise exception 'patient_isolation'; end if; insert into phase1_boundary_results values('patient_own_rows');
execute 'set local role authenticated'; select count(*) into n from public.patient_contacts; execute 'reset role'; if n<>1 then raise exception 'contact_isolation'; end if; insert into phase1_boundary_results values('patient_own_contacts');
denied:=false; begin insert into public.patients(org_id,source_key,first_name,last_name) values(o,'rejected_real','Fictional','Rejected'); exception when raise_exception then denied:=true; end; if not denied then raise exception 'synthetic_guard'; end if; insert into phase1_boundary_results values('synthetic_insert_rejected');
denied:=false; begin update public.audit_events set outcome='blocked'; exception when raise_exception then denied:=true; end; if not denied then raise exception 'audit_update'; end if; insert into phase1_boundary_results values('audit_update_rejected');
denied:=false; begin delete from public.audit_events where action_code='foundation.seeded'; exception when raise_exception then denied:=true; end; if not denied then raise exception 'audit_delete'; end if; insert into phase1_boundary_results values('audit_delete_rejected');
denied:=false; begin perform app.append_audit('test.audit',null,null,'simulated','{"email_code":"person@example.com"}'); exception when raise_exception then denied:=true; end; if not denied then raise exception 'pii_guard'; end if; insert into phase1_boundary_results values('audit_pii_rejected');
perform app.attest_beta('en'); perform app.attest_beta('en'); if (select count(*) from public.tester_attestations where account_id=a)<>1 or (select count(*) from public.audit_events where actor_account_id=a and action_code='beta.attested')<>1 then raise exception 'attestation_duplicate'; end if; insert into phase1_boundary_results values('attestation_once');
perform app.record_view(p,'demographics'); perform app.record_view(p,'demographics'); if (select count(*) from public.record_access_log where patient_id=p)<>1 or (select view_count from public.record_access_log where patient_id=p)<>2 then raise exception 'collapse_failed'; end if; insert into phase1_boundary_results values('access_collapse');
end $$;
select count(*) checks from phase1_boundary_results;
rollback;