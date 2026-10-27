import {it,expect} from 'vitest';
import {AdelanteEHR} from '../ehr';
import {PART2_ELEMENT_KEYS} from '../consentRecordModel';
import {CONSENT_COVERAGE_VECTORS} from '../persistence/consentVectors';
for(const v of CONSENT_COVERAGE_VECTORS) it(`SQL shared consent vector: ${v.code}`,()=>{
 const base=AdelanteEHR.listPatients()[0]; if(!base) throw new Error('Synthetic fixture required');
 const patient=AdelanteEHR.createPatient({firstName:'Fictional',lastName:`Vector ${v.code}`,dob:'1980-01-01',matchSource:'seed'});
 const row=AdelanteEHR.createConsentRecord({patientId:patient.id,formType:'AB133',source:'Synthetic contract fixture',signedByName:'Fictional signer',attested:true,effectiveDate:'2026-10-26',capturedBy:{staffName:'Fictional staff',role:'sys_admin'},sections:[],extension:{consentType:'part2_tpo_single',purposeCode:'tpo',recipients:[{kind:'org',name:'Adelante',directoryRef:'adelante-program'}],items:['treatment'],part2Elements:Object.fromEntries(PART2_ELEMENT_KEYS.map(k=>[k,true])),signature:{method:'e_sign',signer:'Fictional signer',relationship:'patient',signedAt:'2026-10-26T12:00:00Z',recordedAt:'2026-10-26T12:00:00Z',recordedBy:{staffName:'Fictional staff',role:'sys_admin'}}}});
 // Store fixture uses real create function; holds/status are contract inputs, never production mutations.
 const saved=row;
 saved.status=v.status??'active';saved.legacyUnverified=v.legacy;saved.needsReviewAfterMerge=v.merge?{mergeId:'fixture',fromPatientId:patient.id}:undefined;saved.expiryEventOccurredAt=v.expiryEvent?'2026-10-27T00:00:00Z':undefined;saved.effectiveDate=v.future?'2026-10-28':'2026-10-26';
 expect(AdelanteEHR.consentCovers(patient.id,{type:v.type,recipient:v.recipient,purpose:v.purpose,item:v.item,at:new Date('2026-10-27T12:00:00Z')})).toBe(v.expected);
});