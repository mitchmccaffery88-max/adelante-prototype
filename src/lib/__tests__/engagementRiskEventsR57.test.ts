import { expect,it,vi,afterEach } from 'vitest';
import { AdelanteEHR } from '../ehr';
import { runAction } from '../actions/runAction';
import { screenerFollowupActor } from '../screenerFollowup';
import '../chartActions';
const DAY=86400000, now=Date.parse('2026-11-01T23:00:00Z');
afterEach(()=>vi.useRealTimers());
it.each(['phone','address','missed','needs'] as const)('real %s event makes one HRSN prompt and survives cap/skip',trigger=>{
 vi.useFakeTimers();vi.setSystemTime(now);
 const p=AdelanteEHR.createPatient({firstName:'Fictional',lastName:`Event${trigger}`,dob:'1990-01-01'});p.intakeCompletedAt=new Date(now-40*DAY).toISOString();p.tasks=[];p.screeners={};p.screenerHistory=[];
 const at=new Date(now).toISOString();
 if(trigger==='phone'||trigger==='address')p.demographicsHistory=[{id:trigger,at,byName:'Staff',role:'ecm_provider',changes:[{field:trigger,before:'old',after:'new'}]}];
 if(trigger==='needs')AdelanteEHR.applyIntakeNeeds(p.id,{confirmed:[],selfReported:[{need:'Phone or internet'}]});
 const run=()=>runAction('engagement_risk_automation',screenerFollowupActor,p,{args:[p.id,new Date().toISOString(),screenerFollowupActor]});
 // Missed events require real recorded appointments; inject only the read seam here, not store rows.
 const original=AdelanteEHR.listAppointments;
 if(trigger==='missed')vi.spyOn(AdelanteEHR,'listAppointments').mockReturnValue([...original(),{id:'event-a',patientId:p.id,clinicianId:'c1',start:at,end:at,modality:'video',status:'no_show'},{id:'event-b',patientId:p.id,clinicianId:'c1',start:at,end:at,modality:'video',status:'late_cancel'}]);
 p.tasks=[{id:'cap',kind:'rescreen',screenerKey:'phq9',label:'',createdAt:at,automaticRescreen:true,completedAt:at}];
 expect(run().ok).toBe(true);expect(p.tasks.filter(t=>t.screenerKey==='ahc-hrsn')).toHaveLength(0);
 vi.setSystemTime(now+7*DAY);p.screeners={'ahc-hrsn':{key:'ahc-hrsn',score:0,severity:'',completedAt:new Date(now).toISOString()}};
 expect(run().ok).toBe(true);expect(p.tasks.filter(t=>t.screenerKey==='ahc-hrsn')).toHaveLength(0);
 vi.setSystemTime(now+14*DAY);expect(run().ok).toBe(true);expect(p.tasks.filter(t=>t.screenerKey==='ahc-hrsn')).toHaveLength(1);
 expect(run().ok).toBe(true);expect(p.tasks.filter(t=>t.screenerKey==='ahc-hrsn')).toHaveLength(1);
 vi.restoreAllMocks();
});
