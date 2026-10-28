create or replace function app.phase2_chart_read(p_patient uuid,p_class text) returns boolean language plpgsql stable security definer set search_path='' as $$ declare e jsonb:=app.chart_entry(p_patient); r text:=app.current_role(); l text; begin
if not coalesce((e->>'ok')::boolean,false) then return false; end if;
if p_class in ('screeners_sud','sud_treatment','group_notes') and r not in ('clinical_coordinator','sys_admin') and not coalesce((e->>'direct')::boolean,false) then
select g.level into l from app.record_class_grants g where g.role=r and g.record_class=p_class;
if l is null or l='none' then return false; end if;
return app.consent_covers(p_patient,'part2_specific_written','adelante-program','treatment',p_class) or app.consent_covers(p_patient,'part2_specific_written','adelante-program','tpo',p_class) or app.consent_covers(p_patient,'part2_specific_written','Adelante','treatment',p_class) or app.consent_covers(p_patient,'part2_specific_written','Adelante','tpo',p_class);
end if;
return exists(select 1 from app.can_access(p_class,p_patient) where level<>'none'); end $$;
comment on function app.phase2_chart_read(uuid,text) is 'Draft — Part 2 internal-use basis: pending counsel confirmation; matrix unchanged; reason-only class-specific consent intersection; policy acceptance pending';
notify pgrst,'reload schema';