create or replace function app.standard_tpo_end_events() returns text[] language sql immutable set search_path='' as $$ select array['no expiry — until revoked','until revoked','patient revokes','patient revokes this consent','end of treatment']::text[] $$;
revoke all on function app.standard_tpo_end_events() from public, anon, authenticated;

CREATE OR REPLACE FUNCTION app.synthetic_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare j jsonb:=to_jsonb(new); oldj jsonb; k text;
begin
 if new.synthetic is distinct from true then raise exception 'beta_synthetic_only'; end if;
 if tg_table_name='orgs' then if new.org_id<>new.id then raise exception 'org_self_required'; end if; end if;
 if tg_table_name='patients' then
  if new.dob>=current_date then raise exception 'dob_must_be_past'; end if;
  if new.account_id is not null and not exists(select 1 from public.accounts where id=new.account_id and org_id=new.org_id and kind='patient') then raise exception 'patient_account_required'; end if;
 end if;
 if tg_table_name='staff_members' then if new.account_id is not null and not exists(select 1 from public.accounts where id=new.account_id and org_id=new.org_id and kind='staff') then raise exception 'staff_account_required'; end if; end if;
 if tg_table_name='consent_records' then
  if jsonb_typeof(new.recipients)<>'array' or jsonb_array_length(new.recipients)=0 then raise exception 'consent_recipients_required'; end if;
  if new.purpose_code not in ('treatment','tpo','care_coordination','status_updates','enrolled_update','referral_for_treatment','reentry_coordination','telehealth','group_confidentiality','ai_recording') then raise exception 'unknown_purpose_code'; end if;
  if new.signature_method='verbal_assent' and not (new.consent_type in ('sms_reminder','portal_reminder') or (new.consent_type='referrer_authorization' and new.purpose_code='enrolled_update')) then raise exception 'verbal_assent_not_allowed'; end if;
  if new.consent_type in ('part2_tpo_single','part2_specific_written','counseling_notes_release','legal_part2_disclosure','advocate_release') then
   foreach k in array array['patientName','recipients','amountAndKind','purpose','rightToRevoke','expiration','signatureAndDate','redisclosureNotice'] loop if new.part2_elements->>k is distinct from 'true' then raise exception 'part2_elements_required'; end if; end loop;
  end if;
  if new.expires_at is not null and new.expires_at<=new.effective_at then raise exception 'consent_expiry_after_effective'; end if;
  if new.consent_type='part2_specific_written' and coalesce(array_length(new.items,1),0)=0 then raise exception 'specific_items_required'; end if;
  if new.consent_type='part2_tpo_single' and new.purpose_code='tpo' then
   if new.expires_at is not null then raise exception 'standard_tpo_no_expiry'; end if;
   if new.expires_on_event is not null and not (lower(btrim(new.expires_on_event)) = any(app.standard_tpo_end_events())) then raise exception 'standard_tpo_end_event'; end if;
   if new.items && array['counseling_notes','legal_proceedings','criminal_justice','advocate_roi','named_recipient','probation_parole'] then raise exception 'separate_consent_required'; end if;
   if exists(select 1 from jsonb_array_elements(new.recipients) r where coalesce(r->>'directoryRef','') not in ('adelante-program','treating-providers','payers','hie','program-operations') or coalesce(r->>'kind','') not in ('org','class')) then raise exception 'standard_tpo_class_recipients_required'; end if;
  end if;
  if tg_op='UPDATE' then
   oldj:=to_jsonb(old);
   if (j-array['status','updated_at','expiry_event_occurred_at'])<>(oldj-array['status','updated_at','expiry_event_occurred_at']) then raise exception 'signed_consent_content_immutable'; end if;
   if old.status<>'active' or new.status='active' then raise exception 'consent_terminal_state'; end if;
  end if;
  if new.supersedes_id is not null then
   if new.supersedes_id=new.id or not exists(select 1 from public.consent_records r where r.id=new.supersedes_id and r.org_id=new.org_id and r.patient_id=new.patient_id and r.consent_type=new.consent_type and r.recipients=new.recipients) then raise exception 'consent_supersession_scope'; end if;
   if tg_op='INSERT' then update public.consent_records set status='superseded' where id=new.supersedes_id and org_id=new.org_id and status='active'; end if;
  end if;
 end if;
 if tg_table_name='consent_signed_copies' then if new.storage_pointer not like 'consent-signed/'||new.org_id::text||'/'||new.consent_record_id::text||'/%' then raise exception 'private_consent_pointer_required'; end if; end if;
 if tg_table_name='tester_attestations' then if new.statement_version<>'fictional-only-v1' then raise exception 'unknown_attestation'; end if; end if;
 return new;
end $function$;