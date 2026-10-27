begin;
do $$ declare o uuid:='10000000-0000-4000-8000-000000000001'; a uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); i integer; denied boolean; hash text:=repeat('a',64); begin
insert into public.accounts(id,org_id,kind,synthetic) values(a,o,'patient',true);
insert into public.signup_sessions(id,org_id,account_id,status,expires_at,identity_hash,otp_hash,otp_issued_at,synthetic) values(s,o,a,'started',now()+interval '1 day',hash,repeat('b',64),now(),true);
for i in 1..5 loop insert into public.signup_attempts(org_id,session_id,identity_hash,attempt_kind,outcome_code,synthetic) values(o,s,hash,'code','mismatch',true); end loop;
denied:=false; begin insert into public.signup_attempts(org_id,session_id,identity_hash,attempt_kind,outcome_code,synthetic) values(o,s,hash,'code','mismatch',true); exception when raise_exception then denied:=true; end; if not denied then raise exception 'sixth_code_allowed'; end if;
for i in 1..5 loop insert into public.signup_attempts(org_id,session_id,identity_hash,attempt_kind,outcome_code,synthetic) values(o,s,hash,'otp','mismatch',true); end loop;
denied:=false; begin insert into public.signup_attempts(org_id,session_id,identity_hash,attempt_kind,outcome_code,synthetic) values(o,s,hash,'otp','mismatch',true); exception when raise_exception then denied:=true; end; if not denied then raise exception 'sixth_otp_allowed'; end if;
insert into public.signup_attempts(org_id,session_id,identity_hash,attempt_kind,outcome_code,synthetic) values(o,s,hash,'resend','sent',true);
denied:=false; begin insert into public.signup_attempts(org_id,session_id,identity_hash,attempt_kind,outcome_code,synthetic) values(o,s,hash,'resend','sent',true); exception when raise_exception then denied:=true; end; if not denied then raise exception 'fast_resend_allowed'; end if;
s:=gen_random_uuid(); insert into public.signup_sessions(id,org_id,account_id,status,expires_at,identity_hash,otp_hash,otp_issued_at,synthetic) values(s,o,a,'started',now()+interval '1 day',hash,repeat('b',64),now()-interval '10 minutes',true);
denied:=false; begin insert into public.signup_attempts(org_id,session_id,identity_hash,attempt_kind,outcome_code,synthetic) values(o,s,hash,'otp','mismatch',true); exception when raise_exception then denied:=true; end; if not denied then raise exception 'expired_otp_allowed'; end if;
end $$; rollback;