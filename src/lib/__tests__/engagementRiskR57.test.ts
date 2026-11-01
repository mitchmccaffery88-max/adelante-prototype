import { describe, it, expect } from 'vitest';
import { AdelanteEHR, type Patient } from '../ehr';
import { evaluateEngagement, engagementEvents, engagementNeedsData, engagementOwner, eventHrsnAllowed, ENGAGEMENT_DRAFT, type EngagementFacts } from '../engagementRisk';
const DAY = 86400000, now = Date.parse('2026-11-01T23:00:00Z');
const at = (days: number) => new Date(now - days * DAY).toISOString();
function facts(patch: Partial<Patient> = {}): EngagementFacts {
  const original = AdelanteEHR.listPatients()[0];
  if (!original) throw new Error('Member fixture missing');
  return { patient: { ...original, releaseDate: '', screeners: {}, screenerHistory: [], tasks: [], sdohPlan: { items: [] }, demographicsHistory: [], coverage: undefined, intakeCompletedAt: at(40), ...patch }, appointments: [], outreach: [] };
}
const hrsn = (responses: number[], domains: { key: string; positive: boolean }[]) => ({ key: 'ahc-hrsn', score: 1, severity: '', completedAt: at(20), responses, domains: domains.map(d => ({ ...d, label: d.key })) });
const need = (name: string, status: 'completed' | 'identified' | 'not_completed' = 'identified') => ({ id: name, need: name, status, source: 'pre_release_hrsn' as const, createdAt: at(20), updatedAt: at(1) });
describe('R57 Draft pure signal rules', () => {
  it('two missed visits in 30 days are High; one and old visits do not flag', () => {
    const f = facts(); f.appointments = [{ id: '1', start: at(2), status: 'no_show' }, { id: '2', start: at(29), status: 'late_cancel' }];
    expect(evaluateEngagement(f, now)?.signals).toEqual([{ key: 'missed', weight: 'High', reason: '2 missed visits' }]);
    expect(evaluateEngagement({ ...f, appointments: f.appointments.slice(0,1) }, now)).toBeUndefined();
    expect(evaluateEngagement({ ...f, appointments: [{ id: '1', start: at(31), status: 'no_show' }] }, now)).toBeUndefined();
  });
  it('three structured attempts/staff messages in seven days without contact are High', () => {
    const f = facts(); f.outreach = [1,2,3].map((d,i) => ({ id: String(i), at: at(d), kind: i === 0 ? 'staff_message' : 'attempt' }));
    expect(evaluateEngagement(f,now)?.signals[0].key).toBe('outreach');
    expect(evaluateEngagement({ ...f, outreach: f.outreach.slice(0,2) },now)).toBeUndefined();
    for (const kind of ['member_reply','contact'] as const) expect(evaluateEngagement({ ...f, outreach: [...f.outreach, { id: kind, at: at(0), kind }] },now)).toBeUndefined();
    expect(evaluateEngagement({ ...f, outreach: f.outreach.map(r => ({ ...r, at: at(8) })) },now)).toBeUndefined();
  });
  it('phone changed within fourteen days is High, older change is not', () => {
    const change = { id: 'phone', at: at(13), byName: 'staff', role: 'ecm_provider', changes: [{ field: 'phone' as const, before: 'old', after: 'new' }] };
    expect(evaluateEngagement(facts({ demographicsHistory: [change] }),now)?.signals[0].key).toBe('contact');
    expect(evaluateEngagement(facts({ demographicsHistory: [{ ...change, at: at(15) }] }),now)).toBeUndefined();
  });
  it('housing requires instability item, not quality; resolution clears it', () => {
    expect(evaluateEngagement(facts({ screeners: { 'ahc-hrsn': hrsn([0,1], [{ key: 'housing', positive: true }]) } }),now)).toBeUndefined();
    const p = { screeners: { 'ahc-hrsn': hrsn([1,0], [{ key: 'housing', positive: true }]) } };
    expect(evaluateEngagement(facts(p),now)?.level).toBe('Watch');
    expect(evaluateEngagement(facts({ ...p, sdohPlan: { items: [need('Housing instability & quality','completed')] } }),now)).toBeUndefined();
  });
  it.each([['transportation','Transportation','Medium'],['food','Food insecurity','Low']])('%s unresolved positive counts with its weight', (key,label,weight) => {
    const p = { screeners: { 'ahc-hrsn': hrsn([0,0], [{ key, positive: true }]) } };
    expect(evaluateEngagement(facts(p),now)?.signals[0].weight).toBe(weight);
    expect(evaluateEngagement(facts({ ...p, sdohPlan: { items: [need(label,'completed')] } }),now)).toBeUndefined();
    expect(evaluateEngagement(facts({ ...p, sdohPlan: { items: [need(label,'not_completed')] } }),now)?.level).toBe('Watch');
  });
  it('phone/data requires actual self-reported Phone or internet selection', () => {
    const item = { ...need('Phone or internet'), source: 'intake_self_report' as const };
    expect(evaluateEngagement(facts({ sdohPlan: { items: [item] } }),now)?.level).toBe('Elevated');
    expect(evaluateEngagement(facts({ sdohPlan: { items: [{ ...item, source: 'staff_assessed' }] } }),now)).toBeUndefined();
    expect(evaluateEngagement(facts({ sdohPlan: { items: [{ ...item, status: 'completed' }] } }),now)).toBeUndefined();
  });
  it('recorded coverage inactive/pending counts, absent and active private coverage do not', () => {
    for (const coverage of [{ status: 'suspended' as const, verified: 'verified' as const }, { status: 'active' as const, verified: 'pending' as const, coverageType: 'medi_cal' as const }, { status: 'uninsured' as const, verified: 'self_reported' as const }]) expect(evaluateEngagement(facts({ coverage }),now)?.signals[0].key).toBe('coverage');
    expect(evaluateEngagement(facts(),now)).toBeUndefined();
    expect(evaluateEngagement(facts({ coverage: { status: 'other', verified: 'pending', coverageType: 'private' } }),now)).toBeUndefined();
  });
  it('day ten outstanding rescreen is Low; completed/younger are excluded', () => {
    const task = { id:'r', kind:'rescreen' as const, label:'', screenerKey:'phq9', createdAt:at(10) };
    expect(evaluateEngagement(facts({ tasks:[task] }),now)?.signals[0].weight).toBe('Low');
    expect(evaluateEngagement(facts({ tasks:[{ ...task, createdAt:at(9) }] }),now)).toBeUndefined();
    expect(evaluateEngagement(facts({ tasks:[{ ...task, completedAt:at(1) }] }),now)).toBeUndefined();
  });
  it('one Low is Watch, two signals Elevated; early release steps up but never alone', () => {
    const food = { screeners:{ 'ahc-hrsn':hrsn([0,0],[{key:'food',positive:true}]) } };
    expect(evaluateEngagement(facts(food),now)?.level).toBe('Watch');
    expect(evaluateEngagement(facts({ ...food, releaseDate:at(13) }),now)?.level).toBe('Elevated');
    expect(evaluateEngagement(facts({ ...food, releaseDate:at(15) }),now)?.level).toBe('Watch');
    expect(evaluateEngagement(facts({ releaseDate:at(1) }),now)).toBeUndefined();
    expect(evaluateEngagement(facts({ screeners:{ 'ahc-hrsn':hrsn([1,0],[{key:'food',positive:true}]) } }),now)?.level).toBe('Elevated');
  });
  it('safety never counted or returned or triggers a needs event', () => {
    const f = facts({ screeners:{ 'ahc-hrsn':hrsn([0,0,0,0,0,0,5,5,5,5],[{key:'safety',positive:true}]) }, sdohPlan:{items:[{ ...need('Interpersonal safety'), safetySensitive:true,source:'intake_self_report' }]} });
    expect(evaluateEngagement(f,now)).toBeUndefined(); expect(engagementEvents(f,now)).toEqual([]);
  });
  it('missing signals explicitly say needs data, no disconnected/SMS/packet signals exist', () => {
    const missing = engagementNeedsData(facts().patient);
    expect(missing.map(m => m.signal)).toEqual(['Phone disconnected','SMS undeliverable','Packet confirmations as needs-change events','No phone or data','Coverage gap','Early reentry window']);
    expect(missing.every(m=>m.status==='needs data' && m.label===ENGAGEMENT_DRAFT)).toBe(true);
  });
  it.each(['phone','address'] as const)('%s history is an event', field => expect(engagementEvents(facts({demographicsHistory:[{id:field,at:at(1),byName:'',role:'',changes:[{field,before:'old',after:'new'}]}]}),now)).toEqual([`${field}:${field}:${at(1)}`]));
  it('actual self-reported need creates event; staff source does not', () => {
    expect(engagementEvents(facts({sdohPlan:{items:[{...need('Phone or internet'),source:'intake_self_report'}]}}),now)).toEqual([`needs:Phone or internet:${at(20)}`]);
    expect(engagementEvents(facts({sdohPlan:{items:[{...need('Phone or internet'),source:'staff_assessed'}]}}),now)).toEqual([]);
  });
  it('two missed visits trigger HRSN, one does not', () => {
    const f=facts(); f.appointments=[{id:'1',start:at(1),status:'no_show'},{id:'2',start:at(2),status:'late_cancel'}];
    expect(engagementEvents(f,now)).toEqual(['missed:1,2']); expect(engagementEvents({...f,appointments:f.appointments.slice(0,1)},now)).toEqual([]);
  });
  it('HRSN respects seven-day automatic cap and fourteen-day completion skip', () => {
    expect(eventHrsnAllowed(facts().patient,now)).toBe(true);
    for (const age of [0,6]) expect(eventHrsnAllowed(facts({tasks:[{id:'r',kind:'rescreen',label:'',createdAt:at(age),automaticRescreen:true}]}).patient,now)).toBe(false);
    expect(eventHrsnAllowed(facts({tasks:[{id:'r',kind:'rescreen',label:'',createdAt:at(7),automaticRescreen:true}]}).patient,now)).toBe(true);
    expect(eventHrsnAllowed(facts({screeners:{'ahc-hrsn':{...hrsn([],[]),completedAt:at(13)}}}).patient,now)).toBe(false);
    expect(eventHrsnAllowed(facts({screeners:{'ahc-hrsn':{...hrsn([],[]),completedAt:at(14)}}}).patient,now)).toBe(true);
  });
  it('owner chain primary care manager then ECM then clinician then coordinator', () => {
    const cm={id:'cm',role:'cf_care_manager' as const},ecm={id:'ecm',role:'ecm_provider' as const},clinician={id:'c',role:'therapist' as const};
    expect(engagementOwner(cm,ecm,clinician).assignedTo).toBe('cm');expect(engagementOwner(undefined,ecm,clinician).assignedTo).toBe('ecm');expect(engagementOwner(undefined,undefined,clinician).assignedTo).toBe('c');expect(engagementOwner()).toEqual({assignedTo:'',allowedRoles:['clinical_coordinator']});
  });
});
