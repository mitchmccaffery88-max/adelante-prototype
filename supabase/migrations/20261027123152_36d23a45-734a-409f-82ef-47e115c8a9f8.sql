create function app.phase2_template_hash() returns text language sql immutable set search_path='' as $$ select 'a847ce4fc781a2d72f8bf5d0b387517e41285a6eb34046b5b7629e3c6e9ded30'::text $$;
create function app.phase2_run_action(p_action text,p_entity uuid,p_input jsonb,p_reason_code text) returns jsonb language plpgsql security definer set search_path='' as $$ declare o uuid:=app.org_id(); a uuid:=app.account_id(); r text:=app.current_role(); e uuid; ref public.referrals; p uuid; s uuid; v uuid; template jsonb; begin
perform app.require_beta_attestation(); if a is null or o is null or app.phase2_staff_id() is null or p_reason_code !~ '^[a-z][a-z0-9_]{2,63}$' or jsonb_typeof(p_input)<>'object' then raise exception 'phase2_action_input'; end if;
if p_action='intake_staging_import' then
if r not in ('intake_coordinator','sys_admin','clinical_coordinator') then raise exception 'intake_action_denied'; end if;
if p_input->>'template_sha256' is distinct from app.phase2_template_hash() or p_input->>'source' not in ('pre_release_packet','partner_referral') or p_input->>'first_name' is distinct from 'Morgan' or p_input->>'last_name' is distinct from 'Beta Packet' or p_input->>'dob' is distinct from '1990-04-12' or p_input->>'source_ref' is distinct from 'fictional-beta-packet-v1' or exists(select 1 from jsonb_object_keys(p_input) k where k not in ('template_sha256','source','source_ref','first_name','last_name','dob')) then raise exception 'fictional_template_only'; end if;
insert into public.staging_imports(org_id,source,source_ref,template_sha256,status,synthetic) values(o,p_input->>'source',p_input->>'source_ref',app.phase2_template_hash(),'staged',true) returning id into e;
insert into public.referrals(org_id,source_key,first_name,last_name,dob,referrer_type,identity_confidence,status,source,synthetic) values(o,'packet:'||e,p_input->>'first_name',p_input->>'last_name',(p_input->>'dob')::date,'partner','verified_source','submitted',p_input->>'source',true) returning id into v;
insert into public.staging_rows(org_id,import_id,referral_id,identity_fields,synthetic) values(o,e,v,jsonb_build_object('first_name',p_input->>'first_name','last_name',p_input->>'last_name','dob',p_input->>'dob'),true);
insert into public.intake_checklists(org_id,referral_id,packet_received,synthetic) values(o,v,true,true);
insert into public.intake_packet_needs(org_id,referral_id,source,source_ref,need_kind,state,synthetic) values(o,v,p_input->>'source',p_input->>'source_ref','housing','unknown',true),(o,v,p_input->>'source',p_input->>'source_ref','food','unknown',true);
perform app.append_audit(p_action,e,null,'simulated',jsonb_build_object('reason_code',p_reason_code),true,'phase2'); return jsonb_build_object('id',e,'referral_id',v,'simulated',true);
elsif p_action in ('intake_packet_attach','phase2_referral_link','intake_team_assign') then
if not app.phase2_intake(p_entity,true) then raise exception 'intake_action_denied'; end if;
select * into ref from public.referrals where id=p_entity and org_id=o for update;
if p_action='intake_packet_attach' then
if exists(select 1 from jsonb_object_keys(p_input) k where k not in ('type','source','source_ref','classification','file_name')) then raise exception 'packet_input_invalid'; end if;
insert into public.packet_documents(org_id,referral_id,document_type,source,source_ref,classification,part2_tagged,file_name,synthetic) values(o,ref.id,p_input->>'type',p_input->>'source',p_input->>'source_ref',p_input->>'classification',p_input->>'classification'<>'general',p_input->>'file_name',true) returning id into e;
elsif p_action='phase2_referral_link' then
if ref.identity_confidence<>'verified_source' or ref.status not in ('submitted','contacted') or ref.linked_patient_id is not null or exists(select 1 from jsonb_object_keys(p_input) k where k<>'site_id') then raise exception 'verified_unlinked_referral_required'; end if;
s:=(p_input->>'site_id')::uuid; if not exists(select 1 from public.sites where id=s and org_id=o) then raise exception 'site_unavailable'; end if;
if exists(select 1 from public.patients where org_id=o and lower(first_name)=lower(ref.first_name) and lower(last_name)=lower(ref.last_name) and dob=ref.dob) then raise exception 'identity_review_required'; end if;
insert into public.patients(org_id,source_key,first_name,last_name,dob,synthetic) values(o,ref.source_key,ref.first_name,ref.last_name,ref.dob,true) returning id into e;
update public.referrals set linked_patient_id=e,status='enrolled' where id=ref.id and org_id=o;
insert into public.patient_site_enrollments(org_id,patient_id,site_id,starts_at,synthetic) values(o,e,s,now(),true);
insert into public.first_visit_handoffs(org_id,referral_id,patient_id,status,synthetic) values(o,ref.id,e,'pending',true);
else
if ref.linked_patient_id is null or exists(select 1 from jsonb_object_keys(p_input) k where k not in ('staff_member_id','assignment_kind')) or p_input->>'assignment_kind' not in ('clinician','care_manager') then raise exception 'assignment_input_invalid'; end if;
s:=(p_input->>'staff_member_id')::uuid;
if not exists(select 1 from public.staff_members sm join public.staff_role_assignments sr on sr.staff_member_id=sm.id and sr.org_id=sm.org_id where sm.id=s and sm.org_id=o and sm.active and sr.active and sr.is_primary and case when p_input->>'assignment_kind'='clinician' then sr.role in ('therapist','pmhnp','physician') else sr.role in ('ecm_provider','cf_care_manager') end) then raise exception 'active_assignment_required'; end if;
insert into public.care_team_assignments(org_id,patient_id,staff_member_id,role,assignment_kind,site_id,starts_at,synthetic) select o,ref.linked_patient_id,s,sr.role,p_input->>'assignment_kind',pe.site_id,now(),true from public.staff_role_assignments sr join public.patient_site_enrollments pe on pe.patient_id=ref.linked_patient_id and pe.org_id=o where sr.staff_member_id=s and sr.org_id=o and sr.is_primary and sr.active and pe.starts_at<=now() and (pe.ends_at is null or now()<pe.ends_at) order by pe.starts_at desc limit 1 returning id into e;
if e is null then raise exception 'enrolled_site_required'; end if;
update public.first_visit_handoffs set clinician_id=case when p_input->>'assignment_kind'='clinician' then s else clinician_id end,care_manager_id=case when p_input->>'assignment_kind'='care_manager' then s else care_manager_id end where referral_id=ref.id and org_id=o;
end if;
perform app.append_audit(p_action,e,ref.linked_patient_id,'simulated',jsonb_build_object('reason_code',p_reason_code),true,'phase2'); return jsonb_build_object('id',e,'simulated',true);
elsif p_action='on_call_shift_create' then
if r not in ('clinical_coordinator','sys_admin') or exists(select 1 from jsonb_object_keys(p_input) k where k not in ('clinician_id','site_id','starts_at','ends_at')) then raise exception 'on_call_denied'; end if;
insert into public.on_call_shifts(org_id,clinician_id,site_id,starts_at,ends_at,synthetic) values(o,(p_input->>'clinician_id')::uuid,(p_input->>'site_id')::uuid,(p_input->>'starts_at')::timestamptz,(p_input->>'ends_at')::timestamptz,true) returning id into e;
perform app.append_audit(p_action,e,null,'simulated',jsonb_build_object('reason_code',p_reason_code),true,'phase2'); return jsonb_build_object('id',e,'simulated',true);
else raise exception 'phase2_action_unported'; end if;
end $$;
create function public.phase2_command(p_action text,p_entity uuid,p_input jsonb,p_reason_code text) returns jsonb language sql security invoker set search_path='' as $$ select app.phase2_run_action(p_action,p_entity,p_input,p_reason_code) $$;
revoke all on function public.phase2_command(text,uuid,jsonb,text) from public,anon,service_role; grant execute on function public.phase2_command(text,uuid,jsonb,text) to authenticated;
revoke all on function app.phase2_run_action(text,uuid,jsonb,text),app.phase2_template_hash() from public,anon,service_role; grant execute on function app.phase2_run_action(text,uuid,jsonb,text),app.phase2_template_hash() to authenticated;