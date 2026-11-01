import { describe,it,expect,vi,afterEach } from 'vitest';
import { AdelanteEHR } from '../ehr';
import { runAction } from '../actions/runAction';
import { chartAction } from '../chartActions';
import { STAFF_ROLES, STAFF_ROSTER, type StaffRole } from '../roles';
import { screenerFollowupActor } from '../screenerFollowup';
import { engagementFlagFor, engagementFacts } from '../engagementRiskAutomation';
import { ENGAGEMENT_OUTCOMES, ENGAGEMENT_CLOSE_ROLES, ENGAGEMENT_TASK_TITLE } from '../engagementRisk';
const clock = Date.parse('2026-11-01T23:00:00Z');
afterEach(()=>vi.useRealTimers());
function member() {
 vi.useFakeTimers();vi.setSystemTime(clock);
 const p=AdelanteEHR.createPatient({firstName:'Fictional',lastName:`Engagement${AdelanteEHR.listPatients().length}`,dob:'1990-01-01'});
 p.intakeCompletedAt=new Date(clock-40*86400000).toISOString(); p.screeners={};p.screenerHistory=[];p.tasks=[];p.releaseDate='';p.coverage=undefined;p.sdohPlan={items:[]};p.demographicsHistory=[];
 const s=STAFF_ROSTER.find(s=>s.role==='therapist' && s.active!==false && s.clinicianId);
 if(!s)throw new Error('Clinician fixture missing');p.primaryClinicianId=s.clinicianId;
 return {p,s};
}
function sweep(p: ReturnType<typeof member>['p']) {return runAction('engagement_risk_automation',screenerFollowupActor,p,{args:[p.id,new Date().toISOString(),screenerFollowupActor]});}
function elevate(p: ReturnType<typeof member>['p']) { AdelanteEHR.applyIntakeNeeds(p.id,{confirmed:[],selfReported:[{need:'Phone or internet'}]}); }
function task(p: ReturnType<typeof member>['p']) { const t=AdelanteEHR.caseTasksForPatient(p.id).find(t=>t.sourceAutomationId==='engagement_risk_automation');if(!t)throw new Error('Engagement task missing');return t; }
describe('R57 registry automation and engagement-only close',()=>{
 it.each(STAFF_ROLES)('$key cannot automate even with system ID',({key:role})=>{
  const p=AdelanteEHR.listPatients()[0];if(!p)throw new Error('Member missing');
  expect(chartAction('engagement_risk_automation').allowed({role,staffId:screenerFollowupActor.staffId},p).state).toBe('hidden');
  expect(runAction('engagement_risk_automation',{role,staffId:screenerFollowupActor.staffId},p).ok).toBe(false);
 });
 it.each(['patient','advocate'])('%s cannot see flag or either action',(role)=>{
  const {p}=member(); elevate(p);expect(sweep(p).ok).toBe(true);
  const a={role:role as StaffRole,staffId:p.id};expect(engagementFlagFor(a,p.id)).toBeUndefined();
  for(const id of ['engagement_risk_automation','engagement_task_close']) {expect(chartAction(id).allowed(a,p).state).toBe('hidden');expect(runAction(id,a,p).ok).toBe(false);}
 });
 it('only approved close roles are allowed in the role snapshot; actual store gates remain narrow',()=>{
  for(const {key:role} of STAFF_ROLES)expect(chartAction('engagement_task_close').allowed({role},undefined).state).toBe(ENGAGEMENT_CLOSE_ROLES.includes(role)?'allowed':'hidden');
 });
 it('Elevated gets one open task and one standard automation audit per sweep',()=>{
  const {p,s}=member();elevate(p);const before=AdelanteEHR.listAuditEvents({category:'action'}).length;
  expect(sweep(p).ok).toBe(true);expect(sweep(p).ok).toBe(true);
  const tasks=AdelanteEHR.caseTasksForPatient(p.id).filter(t=>t.sourceAutomationId==='engagement_risk_automation' && t.status!=='done');
  expect(tasks).toHaveLength(1);expect(tasks[0].assignedTo).toBe(s.id);expect(tasks[0].title).toBe(ENGAGEMENT_TASK_TITLE);
  expect(AdelanteEHR.listAuditEvents({category:'action'}).length-before).toBe(2);
  expect(engagementFlagFor({role:s.role,staffId:s.id},p.id)?.level).toBe('Elevated');
 });
 it('Watch has no task; clearing audited and does not close Elevated task',()=>{
  const {p,s}=member();p.screeners={'ahc-hrsn':{key:'ahc-hrsn',score:1,severity:'',completedAt:new Date(clock-20*86400000).toISOString(),responses:[0,0],domains:[{key:'food',label:'Food insecurity',positive:true}]}};
  expect(sweep(p).ok).toBe(true);expect(engagementFlagFor({role:s.role,staffId:s.id},p.id)?.level).toBe('Watch');expect(AdelanteEHR.caseTasksForPatient(p.id).filter(t=>t.sourceAutomationId==='engagement_risk_automation')).toHaveLength(0);
  elevate(p);expect(sweep(p).ok).toBe(true);const t=task(p);
  p.screeners={};p.sdohPlan={items:[]};const result=sweep(p);
  expect(result.ok).toBe(true);expect(result.event.detail?.transition).toBe('cleared');expect(t.status).toBe('open');expect(engagementFlagFor({role:s.role,staffId:s.id},p.id)).toBeUndefined();
 });
 it.each(ENGAGEMENT_OUTCOMES)('close records actor and exact outcome %s',(outcome)=>{
  const {p,s}=member();elevate(p);expect(sweep(p).ok).toBe(true);const t=task(p);
  const result=runAction('engagement_task_close',{role:s.role,staffId:s.id},p,{args:[{taskId:t.id,actor:{role:s.role,staffId:s.id},outcome,note:'Short outreach note'}]});
  expect(result.ok).toBe(true);expect(t.engagementClosure).toEqual({outcome,actorId:s.id,actorRole:s.role,at:new Date().toISOString(),note:'Short outreach note'});expect(t.status).toBe('done');expect(result.event.detail?.engagementOutcome).toBe(outcome);expect(result.event.actorId).toBe(s.id);expect(JSON.stringify(result.event)).not.toContain('Short outreach note');
 });
 it.each(['','Unknown'])('close rejects invalid outcome %s',(outcome)=>{
  const {p,s}=member();elevate(p);sweep(p);const t=task(p);
  const result=runAction('engagement_task_close',{role:s.role,staffId:s.id},p,{args:[{taskId:t.id,actor:{role:s.role,staffId:s.id},outcome}]});expect(result.ok).toBe(false);expect(t.status).toBe('open');
 });
 it('refuses non-engagement tasks without touching existing completion',()=>{
  const {p,s}=member();const t=AdelanteEHR.createCaseTask({patientId:p.id,assignedTo:s.id,title:'Other task',dueDate:new Date().toISOString()});if(!t)throw new Error('Task missing');
  expect(runAction('engagement_task_close',{role:s.role,staffId:s.id},p,{args:[{taskId:t.id,actor:{role:s.role,staffId:s.id},outcome:ENGAGEMENT_OUTCOMES[0]}]}).ok).toBe(false);expect(t.status).toBe('open');
  AdelanteEHR.completeCaseTask(t.id);expect(t.status).toBe('done');
 });
 it('refuses an actor without chart access and an actor owning another task',()=>{
  const {p,s}=member();elevate(p);sweep(p);const t=task(p);const other=STAFF_ROSTER.find(x=>x.role==='therapist' && x.id!==s.id);if(!other)throw new Error('Other clinician missing');
  expect(runAction('engagement_task_close',{role:other.role,staffId:other.id},p,{args:[{taskId:t.id,actor:{role:other.role,staffId:other.id},outcome:ENGAGEMENT_OUTCOMES[0]}]}).ok).toBe(false);expect(t.status).toBe('open');
  t.claimedBy=other.name;expect(runAction('engagement_task_close',{role:s.role,staffId:s.id},p,{args:[{taskId:t.id,actor:{role:s.role,staffId:s.id},outcome:ENGAGEMENT_OUTCOMES[0]}]}).ok).toBe(false);
 });
 it('actual self-reported need prompts HRSN once and respects the shared cap',()=>{
  const {p}=member();elevate(p);expect(sweep(p).ok).toBe(true);expect(p.tasks?.filter(t=>t.screenerKey==='ahc-hrsn')).toHaveLength(1);expect(sweep(p).ok).toBe(true);expect(p.tasks?.filter(t=>t.screenerKey==='ahc-hrsn')).toHaveLength(1);
 });
 it('message bodies are never read by the metadata projector',()=>{
  const {p}=member();p.careMessages=[{id:'m',threadPatientId:p.id,authorType:'staff',authorName:'Staff',createdAt:new Date().toISOString(),get body(): string {throw new Error('Content read forbidden');}}];
  expect(engagementFacts(p).outreach).toEqual([{id:'m',at:new Date().toISOString(),kind:'staff_message'}]);
 });
});
