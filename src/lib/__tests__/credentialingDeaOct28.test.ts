import { describe, expect, it } from 'vitest';
import { AdelanteEHR, bookingCredentialingBlock } from '../ehr';
import { AdelanteEHRExt } from '../ehr-ext';
import { credentialedForService, credentialingRecordForStaff, evaluateCredentialing, type ClinicianCredentialing } from '../credentialing';
const at = (days: number) => new Date(Date.now() + days * 86400000).toISOString();
function fixture(staffId: string): ClinicianCredentialing {
  return { staffId, license: { licenseType:'MD',number:'DEMO',state:'CA',verifiedAt:at(-30),expiresAt:at(400),method:'manual' }, dea: {number:'DEMO-DEA',verifiedAt:at(-30),expiresAt:at(60)}, exclusionChecks: (['oig','sam_gov','medi_cal_suspended'] as const).map(list => ({list,checkedAt:at(-8),nextDueAt:at(22),result:'clear'})),enrollments:[{payer:'Medi-Cal FFS',serviceType:'*',status:'active'}],documentStatus:'simulated_unavailable' };
}
const input = (days: number, controlledSubstance = true) => ({payer:'Medi-Cal FFS',serviceType:'med_management',dateOfService:at(days),asOf:at(0),controlledSubstance});
describe('DEA on the service date — controlled-substance prescriber services only', () => {
  for (const staffId of ['s-np1','s-th3']) {
    it(`${staffId}: verified DEA works before expiry and blocks only later DOS`, () => {
      expect(evaluateCredentialing(fixture(staffId),input(45))).toEqual({ok:true});
      expect(evaluateCredentialing(fixture(staffId),input(90))).toEqual({ok:false,reasons:['dea_expired']});
    });
    it(`${staffId}: missing, unverified and post-DOS verification block`, () => {
      const r=fixture(staffId);r.dea=undefined;
      expect(evaluateCredentialing(r,input(1))).toEqual({ok:false,reasons:['dea_not_verified','dea_expired']});
      r.dea={number:'DEMO',expiresAt:at(90)};
      expect(evaluateCredentialing(r,input(1))).toEqual({ok:false,reasons:['dea_not_verified']});
      r.dea.verifiedAt=at(2);
      expect(evaluateCredentialing(r,input(1))).toEqual({ok:false,reasons:['dea_not_verified']});
    });
    it(`${staffId}: non-controlled medication service does not require DEA`, () => {
      const r=fixture(staffId);r.dea=undefined;
      expect(evaluateCredentialing(r,input(45,false))).toEqual({ok:true});
    });
  }
  it('non-prescribers do not inherit DEA checks', () => {
    const r=fixture('s-th1');r.dea=undefined;
    expect(evaluateCredentialing(r,{...input(45),serviceType:'therapy_individual'})).toEqual({ok:true});
  });
  it('sole credential authority retains actual DEA verification and booking checks it', () => {
    const r=credentialingRecordForStaff('s-th3');if(!r?.dea) throw new Error('Prescriber fixture missing');
    expect(r.dea.verifiedAt).toBeTruthy();
    const doc=AdelanteEHRExt.credentialsForClinician('c3').find(c=>c.kind==='dea');if(!doc) throw new Error('DEA fixture missing');
    const before=doc.verifiedAt;doc.verifiedAt=undefined;
    try {
      expect(credentialedForService('s-th3','Medi-Cal FFS','med_management',at(5),{controlledSubstance:true})).toEqual({ok:false,reasons:['dea_not_verified']});
      const p=AdelanteEHR.createPatient({firstName:'DEA',lastName:'Fixture',dob:'1990-01-01'} as Parameters<typeof AdelanteEHR.createPatient>[0]);
      AdelanteEHR.addCoveragePlan(p.id,{payer:'Medi-Cal FFS',from:at(-30)} as Parameters<typeof AdelanteEHR.addCoveragePlan>[1]);
      expect(bookingCredentialingBlock('c3','med_management',p.id,at(5),true)).toBe("This clinician can't be booked for this service right now.");
      expect(bookingCredentialingBlock('c3','med_management',p.id,at(5),false)).toBeUndefined();
    } finally {doc.verifiedAt=before;}
  });
});
