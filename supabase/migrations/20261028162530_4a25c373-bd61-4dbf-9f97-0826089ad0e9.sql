begin;
do $$ declare o uuid:='10000000-0000-4000-8000-000000000001'; site uuid:='10000000-0000-4000-8000-000000000002'; u uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); m uuid:=gen_random_uuid(); p uuid; c uuid; before_users bigint; before_accounts bigint; before_patients bigint; begin
select count(*) into before_users from auth.users; select count(*) into before_accounts from public.accounts; select count(*) into before_patients from public.patients;
begin
insert into public.patients(org_id,source_key,first_name,last_name,synthetic) values(o,'access-consent-rollback','Fictional','Consent Fixture',true) returning id into p;
insert into public.patient_site_enrollments(org_id,patient_id,site_id,starts_at,synthetic) values(o,p,site,now()-interval '1 day',true);
insert into auth.users(id,aud,role,email) values(u,'authenticated','authenticated','access-consent@example.test');
insert into public.accounts(id,org_id,auth_user_id,kind,synthetic) values(a,o,u,'staff',true);
insert into public.staff_members(id,org_id,account_id,source_key,name,synthetic) values(m,o,a,'access-consent-physician','Fictional Physician',true);
insert into public.staff_role_assignments(org_id,staff_member_id,role,is_primary) values(o,m,'physician',true);
perform set_config('request.jwt.claim.sub','',true); perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true); perform app.attest_beta('en'); perform app.set_acting_role('physician');
insert into public.chart_reason_grants(org_id,patient_id,account_id,acting_role,reason_code,opened_at,expires_at,synthetic) values(o,p,a,'physician','crisis_safety',now()-interval '1 minute',now()+interval '1 hour',true);
set local role authenticated;
if not (app.chart_entry(p)->>'ok')::boolean or app.phase2_chart_read(p,'screeners_sud') then raise exception 'reason_without_consent_failed'; end if;
reset role;
insert into public.consent_records(org_id,patient_id,consent_type,recipients,purpose_code,items,status,effective_at,expires_at,signed_by_kind,signature_method,signed_at,part2_elements,synthetic) values(o,p,'part2_specific_written','[{"directoryRef":"adelante-program","name":"Adelante"}]','treatment',array['screeners_sud'],'active',now()-interval '1 minute',now()+interval '1 day','patient','wet_sign_upload',now(),'{"patientName":true,"recipients":true,"amountAndKind":true,"purpose":true,"rightToRevoke":true,"expiration":true,"signatureAndDate":true,"redisclosureNotice":true}',true) returning id into c;
set local role authenticated;
if not app.phase2_chart_read(p,'screeners_sud') then raise exception 'specific_consent_failed'; end if;
if app.phase2_chart_read(p,'sud_treatment') or app.phase2_chart_read(p,'psychotherapy_notes') then raise exception 'consent_scope_leak'; end if;
reset role;
update public.consent_records set status='revoked' where id=c;
set local role authenticated;
if app.phase2_chart_read(p,'screeners_sud') then raise exception 'revoke_failed'; end if;
reset role;
raise exception using errcode='ZX001',message='fixture_rollback';
exception when sqlstate 'ZX001' then null; end;
if (select count(*) from auth.users)<>before_users or (select count(*) from public.accounts)<>before_accounts or (select count(*) from public.patients)<>before_patients then raise exception 'fixture_retained'; end if;
end $$;
rollback;