revoke insert,update,delete,truncate on all tables in schema public from service_role;
-- Only app security-definer functions (owned by the database owner) perform writes.
-- Generated seed is migration-only; it cannot be called through the runtime service key.
revoke execute on all functions in schema app from service_role;
grant execute on function app.account_id(),app.org_id(),app.current_role(),app.owns_patient(uuid),app.can_access(text,uuid) to service_role;
create function app.require_beta_attestation() returns void language plpgsql stable security definer set search_path='' as $$ begin if not exists(select 1 from public.accounts a join public.tester_attestations t on t.account_id=a.id and t.org_id=a.org_id where a.id=app.account_id() and a.active and a.synthetic and t.statement_version='fictional-only-v1') then raise exception 'beta_attestation_required'; end if; end $$;
revoke all on function app.require_beta_attestation() from public,anon,authenticated,service_role;
create function public.foundation_consent_lifecycle(p_user uuid,p_record uuid,p_status text,p_reason_code text) returns uuid language plpgsql security definer set search_path='' as $$ declare r public.consent_records; begin
perform set_config('request.jwt.claim.sub',p_user::text,true); perform set_config('request.jwt.claims',jsonb_build_object('sub',p_user,'role','authenticated')::text,true);
perform app.require_beta_attestation();
if p_status not in ('revoked','expired') or p_reason_code !~ '^[a-z][a-z0-9_]{0,63}$' then raise exception 'consent_lifecycle_input'; end if;
select * into r from public.consent_records where id=p_record and org_id=app.org_id() for update;
if r.id is null then raise exception 'consent_unavailable'; end if;
if not app.owns_patient(r.patient_id) and not exists(select 1 from app.can_access('consent_ledger',r.patient_id) where level='write') then raise exception 'consent_action_denied'; end if;
if app.owns_patient(r.patient_id) and p_status<>'revoked' then raise exception 'patient_revoke_only'; end if;
update public.consent_records set status=p_status where id=p_record;
perform app.append_audit('consent.'||p_status,p_record,r.patient_id,'simulated',jsonb_build_object('reason_code',p_reason_code),true,'phase1'); return p_record;
end $$;
revoke all on function public.foundation_consent_lifecycle(uuid,uuid,text,text) from public,anon,authenticated; grant execute on function public.foundation_consent_lifecycle(uuid,uuid,text,text) to service_role;
-- Closed consent deletion even for owner-level mistakes; supersession remains a terminal status.
create trigger consent_no_delete before delete on public.consent_records for each row execute function app.immutable_row();
-- Immutable tables still have timestamp triggers, followed by immutable rejection.
do $$ declare t text; begin foreach t in array array['audit_events','consent_versions','consent_signed_copies','disclosure_events','tester_attestations'] loop execute format('create trigger touch_updated_at before update on public.%I for each row execute function app.touch_updated_at()',t); end loop; end $$;
-- Server command authorization remains inside the SQL function.
create or replace function public.foundation_command(p_user uuid,p_command text,p_value text) returns jsonb language plpgsql security definer set search_path='' as $$ declare result jsonb; begin
if not exists(select 1 from public.accounts where auth_user_id=p_user and active and synthetic) then raise exception 'beta_account_required'; end if;
perform set_config('request.jwt.claim.sub',p_user::text,true); perform set_config('request.jwt.claims',jsonb_build_object('sub',p_user,'role','authenticated')::text,true);
if p_command='attest' then result:=jsonb_build_object('id',app.attest_beta(p_value));
elsif p_command='set_role' then perform app.require_beta_attestation(); result:=jsonb_build_object('role',app.set_acting_role(p_value));
else raise exception 'unknown_foundation_command'; end if; return result; end $$;
notify pgrst,'reload schema';