alter table public.tester_attestations alter column statement_sha256 set default '67c9c9178dec1bcbf606d5e263db6259467b4d9411fb400ee0f96be0e59baa6d';
create function app.attestation_hash_guard() returns trigger language plpgsql set search_path='' as $$ begin if new.statement_sha256<>'67c9c9178dec1bcbf606d5e263db6259467b4d9411fb400ee0f96be0e59baa6d' then raise exception 'attestation_statement_hash_mismatch'; end if; return new; end $$;
create trigger attestation_hash before insert on public.tester_attestations for each row execute function app.attestation_hash_guard();
revoke all on function app.attestation_hash_guard() from public,anon,authenticated,service_role;
notify pgrst,'reload schema';