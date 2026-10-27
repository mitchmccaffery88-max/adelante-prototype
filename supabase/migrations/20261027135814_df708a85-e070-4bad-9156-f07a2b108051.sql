begin;
create temp table tpo_vector_results(code text, expected text, actual text) on commit drop;
do $$ declare o uuid:='10000000-0000-4000-8000-000000000001'; p uuid; v jsonb; got text; els jsonb:='{"patientName":true,"recipients":true,"amountAndKind":true,"purpose":true,"rightToRevoke":true,"expiration":true,"signatureAndDate":true,"redisclosureNotice":true}';
begin
insert into public.patients(org_id,source_key,first_name,last_name,synthetic) values(o,'phase2b-tpo-vector','Fictional','Vector',true) returning id into p;
for v in select * from jsonb_array_elements('[{"code": "tpo_no_end", "purpose": "tpo", "expiresOn": null, "event": null, "expected": null}, {"code": "tpo_until_revoked", "purpose": "tpo", "expiresOn": null, "event": "No expiry — until revoked", "expected": null}, {"code": "tpo_end_of_treatment", "purpose": "tpo", "expiresOn": null, "event": "End of treatment", "expected": null}, {"code": "tpo_end_of_treatment_spacing", "purpose": "tpo", "expiresOn": null, "event": " end of treatment ", "expected": null}, {"code": "tpo_patient_revokes", "purpose": "tpo", "expiresOn": null, "event": "Patient revokes this consent", "expected": null}, {"code": "tpo_date_rejected", "purpose": "tpo", "expiresOn": "2027-10-27", "event": null, "expected": "standard_tpo_no_expiry"}, {"code": "treatment_purpose_unchanged", "purpose": "treatment", "expiresOn": "2027-10-27", "event": null, "expected": null}, {"code": "tpo_other_event_rejected", "purpose": "tpo", "expiresOn": null, "event": "When probation ends", "expected": "standard_tpo_end_event"}]'::jsonb) loop
 got:=null;
 begin
  insert into public.consent_records(org_id,patient_id,consent_type,recipients,purpose_code,items,status,effective_at,expires_at,expires_on_event,signed_at,signed_by_kind,signature_method,part2_elements,synthetic)
  values(o,p,'part2_tpo_single','[{"kind":"org","name":"Adelante","directoryRef":"adelante-program"}]',v->>'purpose',array['treatment'],'active','2026-10-26T00:00:00Z',(v->>'expiresOn')::timestamptz,v->>'event','2026-10-26T00:00:00Z','staff_capture','e_sign',els,true);
 exception when raise_exception then got:=sqlerrm; end;
 insert into tpo_vector_results values(v->>'code',v->>'expected',got);
 if got is distinct from (v->>'expected') then raise exception 'tpo_vector_failed % expected % got %',v->>'code',v->>'expected',got; end if;
end loop; end $$;
select count(*) checks, count(*) filter (where actual is not distinct from expected) passed from tpo_vector_results;
rollback;