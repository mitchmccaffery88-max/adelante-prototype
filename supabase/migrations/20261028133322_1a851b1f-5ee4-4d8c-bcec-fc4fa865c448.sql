create table public.chart_reason_grants (
id uuid primary key default gen_random_uuid(), org_id uuid not null references public.orgs(id), patient_id uuid not null, account_id uuid not null, acting_role text not null, reason_code text not null, opened_at timestamptz not null default now(), expires_at timestamptz not null, synthetic boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
foreign key(org_id,patient_id) references public.patients(org_id,id), foreign key(org_id,account_id) references public.accounts(org_id,id));
grant select on public.chart_reason_grants to authenticated; grant all on public.chart_reason_grants to service_role;
alter table public.chart_reason_grants enable row level security;
create policy reason_grants_closed on public.chart_reason_grants for select to authenticated using(false);
create table public.clinician_coverage_assignments (
id uuid primary key default gen_random_uuid(), org_id uuid not null references public.orgs(id), covering_staff_id uuid not null, covered_staff_id uuid not null, starts_at timestamptz not null, ends_at timestamptz not null, created_by_account uuid not null, synthetic boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
foreign key(org_id,covering_staff_id) references public.staff_members(org_id,id), foreign key(org_id,covered_staff_id) references public.staff_members(org_id,id), foreign key(org_id,created_by_account) references public.accounts(org_id,id));
grant select on public.clinician_coverage_assignments to authenticated; grant all on public.clinician_coverage_assignments to service_role;
alter table public.clinician_coverage_assignments enable row level security;
create policy coverage_closed on public.clinician_coverage_assignments for select to authenticated using(false);
alter table public.staff_members add column supervised_by uuid;
alter table public.staff_members add constraint staff_supervisor_same_org foreign key(org_id,supervised_by) references public.staff_members(org_id,id);
alter table public.care_team_assignments add column group_context_id text;
alter table public.record_access_log add column reason_code text;
alter table public.first_visit_handoffs add column handed_off_at timestamptz;
create function app.access_record_guard() returns trigger language plpgsql set search_path='' as $$ begin
if not new.synthetic then raise exception 'fictional_only'; end if;
if tg_table_name='chart_reason_grants' then
if new.reason_code not in ('covering_consult','scheduling_admin','clinical_supervision','crisis_safety','other') or new.expires_at<=new.opened_at then raise exception 'reason_or_expiry_invalid'; end if;
else
if new.covering_staff_id=new.covered_staff_id or new.ends_at<=new.starts_at then raise exception 'coverage_dates_invalid'; end if;
end if; return new; end $$;
create trigger access_validate before insert or update on public.chart_reason_grants for each row execute function app.access_record_guard();
create trigger access_validate before insert or update on public.clinician_coverage_assignments for each row execute function app.access_record_guard();
create trigger touch_updated_at before update on public.chart_reason_grants for each row execute function app.touch_updated_at();
create trigger touch_updated_at before update on public.clinician_coverage_assignments for each row execute function app.touch_updated_at();
create function app.chart_role_eligible(p_role text) returns boolean language sql immutable set search_path='' as $$ select p_role in ('physician','pmhnp','nurse_rn','lvn','therapist','sud_counselor','clinical_trainee','medical_assistant','ecm_provider','cf_care_manager','peer_specialist','community_health_worker','clinical_coordinator','sys_admin') $$;
create function app.patient_site_timezone(p_patient uuid) returns text language sql stable security definer set search_path='' as $$ select coalesce((select s.timezone from public.patient_site_enrollments e join public.sites s on s.id=e.site_id and s.org_id=e.org_id where e.org_id=app.org_id() and e.patient_id=p_patient and e.starts_at<=now() and (e.ends_at is null or now()<e.ends_at) order by e.starts_at desc,e.id limit 1),'America/Los_Angeles') $$;
create function app.access_setting(p_key text) returns integer language sql immutable set search_path='' as $$ select case p_key when 'intake_days' then 60 else null end $$;
create or replace function app.phase2_is_team(p_patient uuid,p_kind text default null) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.care_team_assignments c join public.staff_members s on s.id=c.staff_member_id and s.org_id=c.org_id where c.org_id=app.org_id() and c.patient_id=p_patient and c.staff_member_id=app.phase2_staff_id() and s.active and c.assignment_kind<>'group_facilitator' and c.starts_at<=now() and (c.ends_at is null or now()<c.ends_at) and (p_kind is null or c.assignment_kind=p_kind)) $$;
create or replace function app.chart_entry(p_patient uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r text:=app.current_role(); s uuid:=app.phase2_staff_id(); site uuid; team boolean; restricted boolean; restricted_open boolean; direct boolean; reason_open boolean; begin
if s is null or not coalesce(app.chart_role_eligible(r),false) then return jsonb_build_object('ok',false,'entryEligible',false,'reason','role'); end if;
if not exists(select 1 from public.patients where id=p_patient and org_id=app.org_id()) then return jsonb_build_object('ok',false,'entryEligible',false,'reason','missing'); end if;
select site_id into site from public.patient_site_enrollments where org_id=app.org_id() and patient_id=p_patient and starts_at<=now() and (ends_at is null or now()<ends_at) order by starts_at desc,id limit 1;
team:=app.phase2_is_team(p_patient); restricted:=app.phase2_restricted(p_patient);
restricted_open:=exists(select 1 from public.restricted_record_opens o join public.acting_role_sessions rs on rs.id=o.acting_session_id and rs.org_id=o.org_id where o.patient_id=p_patient and o.account_id=app.account_id() and o.org_id=app.org_id() and rs.ended_at is null and rs.role=r);
direct:=team or r in ('clinical_coordinator','sys_admin') or
(r in ('physician','pmhnp','therapist') and exists(select 1 from public.on_call_shifts o where o.org_id=app.org_id() and o.clinician_id=s and o.site_id=site and o.starts_at<=now() and now()<o.ends_at)) or
exists(select 1 from public.clinician_coverage_assignments v join public.care_team_assignments c on c.staff_member_id=v.covered_staff_id and c.org_id=v.org_id join public.staff_members m on m.id=c.staff_member_id and m.org_id=c.org_id where v.org_id=app.org_id() and v.covering_staff_id=s and v.starts_at<=now() and now()<v.ends_at and c.patient_id=p_patient and m.active and c.assignment_kind<>'group_facilitator' and c.starts_at<=now() and (c.ends_at is null or now()<c.ends_at)) or
(r in ('physician','pmhnp','therapist') and exists(select 1 from public.staff_members m join public.staff_role_assignments a on a.staff_member_id=m.id and a.org_id=m.org_id join public.care_team_assignments c on c.staff_member_id=m.id and c.org_id=m.org_id where m.org_id=app.org_id() and m.supervised_by=s and m.active and a.role='clinical_trainee' and a.active and c.patient_id=p_patient and c.assignment_kind<>'group_facilitator' and c.starts_at<=now() and (c.ends_at is null or now()<c.ends_at)));
reason_open:=exists(select 1 from public.chart_reason_grants g where g.org_id=app.org_id() and g.patient_id=p_patient and g.account_id=app.account_id() and g.acting_role=r and g.opened_at<=now() and now()<g.expires_at);
return jsonb_build_object('ok',(direct or reason_open) and (not restricted or team or restricted_open),'entryEligible',true,'direct',direct,'restricted',restricted,'careTeam',team,'outsideCaseload',not team,'searchable',not restricted or team,'reason',case when restricted and not team and not restricted_open then 'restricted' when not direct and not reason_open then 'reason' else null end);
end $$;
create function app.group_context_allowed(p_patient uuid,p_group text) returns boolean language sql stable security definer set search_path='' as $$ select app.chart_role_eligible(app.current_role()) and exists(select 1 from public.care_team_assignments c where c.org_id=app.org_id() and c.patient_id=p_patient and c.staff_member_id=app.phase2_staff_id() and c.assignment_kind='group_facilitator' and c.group_context_id=p_group and c.starts_at<=now() and (c.ends_at is null or now()<c.ends_at)) $$;
create function app.intake_packet_window(p_referral uuid) returns boolean language plpgsql stable security definer set search_path='' as $$ declare p uuid; completed timestamptz; handed timestamptz; tz text; begin
if app.current_role()<>'intake_coordinator' or app.phase2_staff_id() is null then return false; end if;
select r.linked_patient_id,c.completed_at,h.handed_off_at into p,completed,handed from public.referrals r join public.intake_checklists c on c.referral_id=r.id and c.org_id=r.org_id join public.first_visit_handoffs h on h.referral_id=r.id and h.org_id=r.org_id and h.patient_id=r.linked_patient_id where r.id=p_referral and r.org_id=app.org_id() and h.handed_off_at is not null order by h.handed_off_at desc limit 1;
if p is null or completed is null or handed is null or now()<handed or app.phase2_restricted(p) then return false; end if;
tz:=app.patient_site_timezone(p); return (now() at time zone tz)::date-(handed at time zone tz)::date < app.access_setting('intake_days'); end $$;
create or replace function app.phase2_packet_access(p_referral uuid,p_part2 boolean) returns boolean language plpgsql stable security definer set search_path='' as $$ declare p uuid; begin
select linked_patient_id into p from public.referrals where id=p_referral and org_id=app.org_id();
if app.owns_patient(p) then return true; end if;
if app.phase2_intake(p_referral,true) or app.intake_packet_window(p_referral) then return not p_part2 or app.phase2_treatment_consent(p); end if;
return p is not null and exists(select 1 from public.intake_checklists where org_id=app.org_id() and referral_id=p_referral and completed_at is not null) and (app.phase2_is_team(p,'care_manager') or app.phase2_is_team(p,'clinician')) and app.phase2_chart_read(p,'documents') and (not p_part2 or exists(select 1 from app.can_access('sud_treatment',p) where level<>'none')); end $$;
create function public.chart_reason_open(p_patient uuid,p_reason text,p_note text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare r text:=app.current_role(); a uuid:=app.account_id(); o uuid:=app.org_id(); g uuid; tz text; expiry timestamptz; begin
if a is null or app.phase2_staff_id() is null or not coalesce(app.chart_role_eligible(r),false) or not exists(select 1 from public.tester_attestations where account_id=a and org_id=o and statement_version='fictional-only-v1') then raise exception 'chart_role_required'; end if;
if p_reason not in ('covering_consult','scheduling_admin','clinical_supervision','crisis_safety','other') or (p_reason='other' and length(trim(coalesce(p_note,'')))=0) then raise exception 'reason_required'; end if;
if not coalesce((app.chart_entry(p_patient)->>'entryEligible')::boolean,false) or app.chart_entry(p_patient)->>'reason'='restricted' then raise exception 'restricted_or_missing'; end if;
tz:=app.patient_site_timezone(p_patient); expiry:=(((now() at time zone tz)::date+1)::timestamp at time zone tz);
insert into public.chart_reason_grants(org_id,patient_id,account_id,acting_role,reason_code,expires_at,synthetic) values(o,p_patient,a,r,p_reason,expiry,true) returning id into g;
insert into public.record_access_log(org_id,actor_account_id,actor_role,patient_id,record_class,kind,reason_code,simulated) values(o,a,r,p_patient,'chart_entry','reason_open',p_reason,true);
insert into public.audit_events(org_id,actor_account_id,actor_role,action_code,entity_id,patient_id,outcome,metadata,simulated,registry_version) values(o,a,r,'chart_reason_open',g,p_patient,'simulated',jsonb_build_object('reason_code',p_reason),'true','2026-10-28.access-rules');
return g; end $$;
create function public.clinician_coverage_set(p_covering uuid,p_covered uuid,p_start timestamptz,p_end timestamptz) returns uuid language plpgsql security definer set search_path='' as $$ declare o uuid:=app.org_id(); a uuid:=app.account_id(); v uuid; begin
if app.current_role()<>'clinical_coordinator' or a is null or not exists(select 1 from public.tester_attestations where account_id=a and org_id=o and statement_version='fictional-only-v1') then raise exception 'clinical_coordinator_required'; end if;
if p_covering=p_covered or p_end<=p_start or p_start is null or p_end is null then raise exception 'coverage_dates_invalid'; end if;
if (select count(distinct s.id) from public.staff_members s join public.staff_role_assignments r on r.staff_member_id=s.id and r.org_id=s.org_id where s.org_id=o and s.id in (p_covering,p_covered) and s.active and r.active and r.role in ('physician','pmhnp','therapist','sud_counselor','clinical_trainee'))<>2 then raise exception 'active_clinicians_required'; end if;
insert into public.clinician_coverage_assignments(org_id,covering_staff_id,covered_staff_id,starts_at,ends_at,created_by_account,synthetic) values(o,p_covering,p_covered,p_start,p_end,a,true) returning id into v;
insert into public.audit_events(org_id,actor_account_id,actor_role,action_code,entity_id,outcome,metadata,simulated,registry_version) values(o,a,'clinical_coordinator','clinician_coverage_set',v,'simulated',jsonb_build_object('covering_staff_id',p_covering,'covered_staff_id',p_covered),true,'2026-10-28.access-rules'); return v; end $$;
revoke all on function public.chart_reason_open(uuid,text,text),public.clinician_coverage_set(uuid,uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.chart_reason_open(uuid,text,text),public.clinician_coverage_set(uuid,uuid,timestamptz,timestamptz) to authenticated;
revoke all on function app.access_record_guard(),app.chart_role_eligible(text),app.patient_site_timezone(uuid),app.access_setting(text),app.group_context_allowed(uuid,text),app.intake_packet_window(uuid) from public,anon;
grant execute on function app.chart_role_eligible(text),app.patient_site_timezone(uuid),app.access_setting(text),app.group_context_allowed(uuid,text),app.intake_packet_window(uuid) to authenticated;
comment on function app.chart_entry(uuid) is 'Draft — pending go-live permissions audit; 27 Oct care-team/reasoned-open entry only, no matrix or Part 2 bypass';
notify pgrst,'reload schema';