alter table public.tester_attestations add column statement_sha256 text not null default '92a57a15d8b095c4af6a5c0c5f662ec5a2d0d1f8952b552de7f1b0e8f8f06f04';
create function public.foundation_log(p_user uuid,p_kind text,p_action text,p_patient uuid default null,p_entity uuid default null,p_metadata jsonb default '{}',p_registry text default 'phase1') returns uuid language plpgsql security definer set search_path='' as $$ begin
perform set_config('request.jwt.claim.sub',p_user::text,true); perform set_config('request.jwt.claims',jsonb_build_object('sub',p_user,'role','authenticated')::text,true);
perform app.require_beta_attestation();
if p_kind='view' then return app.record_view(p_patient,p_action);
elsif p_kind='audit' then return app.append_audit(p_action,p_entity,p_patient,'simulated',p_metadata,true,p_registry);
else raise exception 'unknown_log_kind'; end if;
end $$;
revoke all on function public.foundation_log(uuid,text,text,uuid,uuid,jsonb,text) from public,anon,authenticated; grant execute on function public.foundation_log(uuid,text,text,uuid,uuid,jsonb,text) to service_role;
notify pgrst,'reload schema';