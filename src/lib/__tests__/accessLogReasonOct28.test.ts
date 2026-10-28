import { describe,expect,it } from 'vitest';
import { AdelanteEHR } from '../ehr';
import { runAction } from '../actions/runAction';
import { accessEventsFor,recordView } from '../accessLog';
import { resolveChartRouteAccess } from '../navGuard';
import { chartEntryFor,searchablePatientsFor } from '../chartAccess';
describe('reasoned entry and patient access log',()=>{
 it('grant and subsequent read/print rows carry only the reason code, never the note',()=>{
  const p=AdelanteEHR.createPatient({firstName:'Reason',lastName:'Fixture',dob:'1990-01-01'} as Parameters<typeof AdelanteEHR.createPatient>[0]);
  const actor={role:'therapist' as const,staffId:'s-th1'};
  expect(runAction('chart_reason_open',actor,p,{args:[{actor,patientId:p.id,reasonCode:'other',note:'private typed opening narrative'}]}).ok).toBe(true);
  for(const kind of ['open','print'] as const) expect(recordView({actorId:actor.staffId,actorName:'Therapist',role:actor.role,patientId:p.id,sectionId:kind,kind})).toBe(true);
  const rows=accessEventsFor(p.id);
  expect(rows).toHaveLength(3);expect(rows.every(r=>r.reasonCode==='other')).toBe(true);
  expect(JSON.stringify(rows)).not.toContain('private typed opening narrative');
 });
 it('search and every record/print destination require the same gate until a reason exists',()=>{
  const p=AdelanteEHR.createPatient({firstName:'Route',lastName:'Gate',dob:'1990-01-01'} as Parameters<typeof AdelanteEHR.createPatient>[0]);
  const actor={role:'therapist' as const,staffId:'s-th1'};
  const row=searchablePatientsFor(actor.role,actor.staffId).find(r=>r.id===p.id);
  expect(row).toBeDefined();expect(Object.keys(row??{}).sort()).toEqual(['dob','enrolledSiteId','firstName','id','lastName']);
  expect(chartEntryFor(actor.role,actor.staffId,p.id)).toMatchObject({ok:false,reason:'reason'});
  for(const path of [`/record/${p.id}`,`/print/patient-records/${p.id}`]) expect(resolveChartRouteAccess(actor.role,actor.staffId,path)).toMatchObject({status:'gate',patientId:p.id});
  expect(runAction('chart_reason_open',actor,p,{args:[{actor,patientId:p.id,reasonCode:'covering_consult'}]}).ok).toBe(true);
  for(const path of [`/record/${p.id}`,`/print/patient-records/${p.id}`]) expect(resolveChartRouteAccess(actor.role,actor.staffId,path)).toMatchObject({status:'allowed'});
 });
});
