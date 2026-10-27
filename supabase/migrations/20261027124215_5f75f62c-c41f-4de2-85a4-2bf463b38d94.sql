create function app.phase2_signup_guard() returns trigger language plpgsql set search_path='' as $$ declare j jsonb:=to_jsonb(new); begin
case tg_table_name
when 'signup_sessions' then
if new.expires_at<=new.created_at or new.otp_tries<0 or new.otp_tries>5 or (new.otp_hash is not null and (new.otp_issued_at is null or new.otp_issued_at>now())) then raise exception 'signup_limits_invalid'; end if;
when 'signup_attempts' then
if new.attempt_kind not in ('code','otp','resend') then raise exception 'attempt_kind_invalid'; end if;
perform pg_advisory_xact_lock(hashtextextended(new.org_id::text||new.identity_hash||new.attempt_kind,0));
if new.attempt_kind='code' and (select count(*) from public.signup_attempts where org_id=new.org_id and identity_hash=new.identity_hash and attempt_kind='code' and attempted_at>new.attempted_at-interval '15 minutes')>=5 then raise exception 'code_limit_5_in_15_minutes'; end if;
if new.attempt_kind='otp' then
if (select count(*) from public.signup_attempts where org_id=new.org_id and session_id=new.session_id and attempt_kind='otp')>=5 or not exists(select 1 from public.signup_sessions s where s.id=new.session_id and s.org_id=new.org_id and not s.otp_used and s.otp_issued_at is not null and new.attempted_at<s.otp_issued_at+interval '10 minutes') then raise exception 'otp_limit_5_or_10_minutes'; end if;
end if;
if new.attempt_kind='resend' and exists(select 1 from public.signup_attempts where org_id=new.org_id and session_id=new.session_id and attempt_kind='resend' and attempted_at>new.attempted_at-interval '30 seconds') then raise exception 'resend_limit_30_seconds'; end if;
when 'website_inbox_items' then
if new.channel not in ('contact','careers') or new.resume_size<0 or length(new.resume_name)>255 then raise exception 'inbox_metadata_invalid'; end if;
else null; end case;
return new; end $$;
create trigger signup_limit_validate before insert or update on public.signup_sessions for each row execute function app.phase2_signup_guard();
create trigger signup_attempt_validate before insert on public.signup_attempts for each row execute function app.phase2_signup_guard();
create trigger inbox_metadata_validate before insert or update on public.website_inbox_items for each row execute function app.phase2_signup_guard();
create trigger safety_no_update before update or delete on public.signup_safety_scans for each row execute function app.immutable_row();
create trigger signup_attempt_no_update before update or delete on public.signup_attempts for each row execute function app.immutable_row();
revoke all on function app.phase2_signup_guard() from public,anon,authenticated,service_role;