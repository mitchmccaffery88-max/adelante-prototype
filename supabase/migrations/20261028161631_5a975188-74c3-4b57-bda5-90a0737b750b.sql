create or replace function app.phase2_chart_read(p_patient uuid,p_class text) returns boolean language plpgsql stable security definer set search_path='' as $$ declare e jsonb:=app.chart_entry(p_patient); r text:=app.current_role(); treating boolean; begin
if not coalesce((e->>'ok')::boolean,false) then return false; end if;
if not exists(select 1 from app.can_access(p_class,p_patient) where level<>'none') then return false; end if;
if p_class not in ('screeners_sud','sud_treatment','group_notes') or r in ('clinical_coordinator','sys_admin') then return true; end if;
treating:=coalesce((e->>'direct')::boolean,false);
if treating then return true; end if;
return app.consent_covers(p_patient,'part2_specific_written','adelante-program','treatment',p_class) or app.consent_covers(p_patient,'part2_specific_written','adelante-program','tpo',p_class) or app.consent_covers(p_patient,'part2_specific_written','Adelante','treatment',p_class) or app.consent_covers(p_patient,'part2_specific_written','Adelante','tpo',p_class);
end $$;
comment on function app.phase2_chart_read(uuid,text) is 'Draft — Part 2 internal-use basis: pending counsel confirmation; matrix unchanged; reason-only requires class-specific consent; no read policies accepted yet';
revoke execute on function public.chart_reason_open(uuid,text,text),public.clinician_coverage_set(uuid,uuid,timestamptz,timestamptz) from public,anon,authenticated,service_role;
notify pgrst,'reload schema';