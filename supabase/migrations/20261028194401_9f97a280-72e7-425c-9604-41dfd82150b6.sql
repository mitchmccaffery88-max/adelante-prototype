create or replace function public.moud_care_manager_assign(p_patient uuid, p_staff uuid, p_episode_ref text)
returns uuid language plpgsql security definer set search_path to '' as $function$
declare o uuid:=app.org_id(); a uuid:=app.account_id(); r text:=app.current_role(); v uuid; s uuid; src text; kept boolean:=false; begin
if r not in ('clinical_coordinator','cf_care_manager','ecm_provider') or a is null or not exists(select 1 from public.tester_attestations where account_id=a and org_id=o and statement_version='fictional-only-v1') then raise exception 'assigner_required'; end if;
if p_episode_ref is null or p_episode_ref !~ '^[a-z][a-z0-9_]{0,63}$' then raise exception 'episode_required'; end if;
src:='moud:'||p_episode_ref;
if not exists(select 1 from public.staff_members m join public.staff_role_assignments ra on ra.staff_member_id=m.id and ra.org_id=m.org_id where m.org_id=o and m.id=p_staff and m.active and ra.active and ra.role in ('cf_care_manager','ecm_provider')) then raise exception 'active_care_manager_required'; end if;
select site_id into s from public.patient_site_enrollments where org_id=o and patient_id=p_patient order by created_at limit 1;
if s is null then raise exception 'patient_site_required'; end if;
update public.care_team_assignments set source_refs=array_remove(source_refs,src), ends_at=case when array_length(array_remove(source_refs,src),1) is null and ends_at is null then now() else ends_at end
  where org_id=o and patient_id=p_patient and staff_member_id<>p_staff and src=any(source_refs);
select id into v from public.care_team_assignments where org_id=o and patient_id=p_patient and staff_member_id=p_staff and starts_at<=now() and (ends_at is null or ends_at>now()) limit 1;
if v is not null then kept:=true; update public.care_team_assignments set source_refs=(select array_agg(distinct x) from unnest(source_refs||src) x) where id=v;
else insert into public.care_team_assignments(org_id,patient_id,staff_member_id,role,assignment_kind,site_id,starts_at,synthetic,source_refs) values(o,p_patient,p_staff,'care_manager','care_manager',s,now(),true,array[src]) returning id into v; end if;
insert into public.audit_events(org_id,actor_account_id,actor_role,action_code,entity_id,patient_id,outcome,metadata,simulated,registry_version) values(o,a,r,'moud_care_manager_assign',v,p_patient,'succeeded',jsonb_build_object('episode_code',p_episode_ref,'result_code',case when kept then 'kept' else 'added' end,'staff_member_id',p_staff::text),false,'2026-10-28.access-rules');
return v; end $function$;

create or replace function public.moud_care_manager_end(p_patient uuid, p_episode_ref text)
returns integer language plpgsql security definer set search_path to '' as $function$
declare o uuid:=app.org_id(); a uuid:=app.account_id(); r text:=app.current_role(); src text; n integer; begin
if r not in ('clinical_coordinator','cf_care_manager','ecm_provider') or a is null or not exists(select 1 from public.tester_attestations where account_id=a and org_id=o and statement_version='fictional-only-v1') then raise exception 'assigner_required'; end if;
if p_episode_ref is null or p_episode_ref !~ '^[a-z][a-z0-9_]{0,63}$' then raise exception 'episode_required'; end if;
src:='moud:'||p_episode_ref;
with u as (update public.care_team_assignments set source_refs=array_remove(source_refs,src), ends_at=case when array_length(array_remove(source_refs,src),1) is null and ends_at is null then now() else ends_at end
  where org_id=o and patient_id=p_patient and src=any(source_refs) returning (array_length(source_refs,1) is null) ended) select count(*) filter (where ended) into n from u;
insert into public.audit_events(org_id,actor_account_id,actor_role,action_code,patient_id,outcome,metadata,simulated,registry_version) values(o,a,r,'moud_care_manager_end',p_patient,'succeeded',jsonb_build_object('episode_code',p_episode_ref,'result_code',case when n>0 then 'ended' else 'kept' end),false,'2026-10-28.access-rules');
return n; end $function$;

revoke all on function public.moud_care_manager_assign(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.moud_care_manager_end(uuid,text) from public, anon, authenticated;