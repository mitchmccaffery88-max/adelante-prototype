begin;
alter policy identity_lane on public.identity_review_items using(org_id=app.org_id() and app.current_role() in ('intake_coordinator','sys_admin','clinical_coordinator') and (patient_id is null or not app.phase2_restricted(patient_id)) and not exists(select 1 from unnest(candidate_patient_ids) p where app.phase2_restricted(p)));
do $$ declare o uuid:='10000000-0000-4000-8000-000000000001'; p uuid:=md5('phase2b:patient:d4bzjiw8')::uuid; u uuid; a uuid; m uuid; rr text; item uuid; n int; begin
insert into public.identity_review_items(org_id,item_type,candidate_patient_ids,status,synthetic) values(o,'possible_duplicate',array[p],'open',true) returning id into item;
for rr in select distinct role from app.record_class_grants order by role loop
u:=gen_random_uuid();a:=gen_random_uuid();m:=gen_random_uuid();
insert into auth.users(id,aud,role,email) values(u,'authenticated','authenticated','phase2c-review-'||rr||'@example.test');
insert into public.accounts(id,org_id,auth_user_id,kind,synthetic) values(a,o,u,'staff',true);
insert into public.staff_members(id,org_id,account_id,source_key,name,synthetic) values(m,o,a,'phase2c-review-'||rr,'Fictional Review Tester',true);
insert into public.staff_role_assignments(org_id,staff_member_id,role,is_primary) values(o,m,rr,true);
perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);perform app.attest_beta('en');perform app.set_acting_role(rr);
set local role authenticated;
select count(*) into n from public.identity_review_items where id=item; if n<>(case when rr in ('intake_coordinator','sys_admin','clinical_coordinator') then 1 else 0 end) then raise exception 'identity_read_role %',rr;end if;
if has_table_privilege('authenticated','public.identity_review_items','UPDATE') then raise exception 'identity_direct_write_open';end if;
reset role;
insert into public.restricted_record_flags(org_id,patient_id,reason_code,synthetic) values(o,p,'fictional_review_restriction',true);
set local role authenticated;select count(*) into n from public.identity_review_items where id=item;if n<>0 then raise exception 'restricted_candidate_leak %',rr;end if;reset role;
update public.restricted_record_flags set active=false where patient_id=p and reason_code='fictional_review_restriction';
end loop;
end $$;
rollback;