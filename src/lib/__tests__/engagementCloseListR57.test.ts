// R57 follow-up 3, option B (Mitch 2 Nov 12:52 CT). Draft — pending clinical sign-off
// (Christi confirms LVN scope and the close list on Tue 3 Nov).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { AdelanteEHR } from '../ehr';
import { runAction } from '../actions/runAction';
import { chartAction } from '../chartActions';
import { STAFF_ROSTER, addStaffMember, canAccess, type StaffRole } from '../roles';
import { chartEntryFor } from '../chartAccess';
import { saveAdditionalTeamAssignment } from '../chartRelationships';
import { ENGAGEMENT_CLOSE_ROLES, ENGAGEMENT_OUTCOMES, ENGAGEMENT_TASK_TITLE } from '../engagementRisk';

const clock = Date.parse('2026-11-02T15:00:00Z');
afterEach(() => vi.useRealTimers());
const CLOSE_LIST: StaffRole[] = ['ecm_provider', 'cf_care_manager', 'community_health_worker', 'clinical_coordinator', 'therapist', 'sud_counselor', 'pmhnp', 'physician', 'nurse_rn', 'lvn'];
const admin = () => STAFF_ROSTER.find(a => a.role === 'sys_admin' && a.active !== false)!;
const coord = () => STAFF_ROSTER.find(c => c.role === 'clinical_coordinator' && c.active !== false)!;
function staffFor(role: StaffRole) {
  if (role !== 'nurse_rn' && role !== 'lvn') { const s = STAFF_ROSTER.find(s => s.role === role && s.active !== false); if (s) return s; }
  // Fictional staff through the real roster store when the demo roster has none.
  return STAFF_ROSTER.find(x => x.id === `s-close-${role}`) ?? addStaffMember({ role: 'sys_admin', staffId: admin().id }, { id: `s-close-${role}`, name: `Fictional close ${role}`, role, credential: role === 'lvn' ? 'LVN' : role === 'nurse_rn' ? 'RN' : 'Fictional' });
}
function memberWithTeam(staffId: string) {
  vi.useFakeTimers(); vi.setSystemTime(clock);
  const p = AdelanteEHR.createPatient({ firstName: 'Fictional', lastName: `Close${AdelanteEHR.listPatients().length}`, dob: '1990-01-01' });
  saveAdditionalTeamAssignment({ role: 'clinical_coordinator', staffId: coord().id }, { staffId, patientId: p.id, start: new Date(clock - 86400000).toISOString() });
  return p;
}
function engagementTask(patientId: string, assignedTo: string, allowedRoles: StaffRole[]) {
  return AdelanteEHR.createCaseTask({ patientId, assignedTo, allowedRoles, title: ENGAGEMENT_TASK_TITLE, detail: ENGAGEMENT_TASK_TITLE, dueDate: new Date().toISOString(), origin: 'screener_flag', source: 'engagement_risk_automation', sourceAutomationId: 'engagement_risk_automation', taskType: 'engagement_checkin', dedupeKey: `engagement:${patientId}` });
}
const close = (role: StaffRole, staffId: string, p: { id: string }, taskId: string) =>
  runAction('engagement_task_close', { role, staffId }, p as never, { args: [{ taskId, actor: { role, staffId }, outcome: ENGAGEMENT_OUTCOMES[0] }] });

describe('R57 follow-up 3: final close list and worklist write', () => {
  it('close list matches the approved final list exactly', () => {
    expect([...ENGAGEMENT_CLOSE_ROLES].sort()).toEqual([...CLOSE_LIST].sort());
  });

  it.each(CLOSE_LIST.filter(r => r !== 'clinical_coordinator'))('%s closes a real engagement task end to end', role => {
    const s = staffFor(role); const p = memberWithTeam(s.id);
    expect(chartEntryFor(role, s.id, p.id).ok).toBe(true);
    const t = engagementTask(p.id, s.id, [role]);
    const r = close(role, s.id, p, t.id);
    expect(r.ok).toBe(true);
    const after = AdelanteEHR.listCaseTasks().find(x => x.id === t.id)!;
    expect(after.status).toBe('done');
    expect(after.engagementClosure).toMatchObject({ outcome: ENGAGEMENT_OUTCOMES[0], actorId: s.id, actorRole: role });
  });

  it('clinical coordinator closes a coordinator-queue task', () => {
    const s = coord(); const p = memberWithTeam(s.id);
    const t = engagementTask(p.id, '', ['clinical_coordinator']);
    expect(close('clinical_coordinator', s.id, p, t.id).ok).toBe(true);
    expect(AdelanteEHR.listCaseTasks().find(x => x.id === t.id)!.status).toBe('done');
  });

  it.each([['peer_specialist'], ['clinical_trainee']] as const)('%s is refused neutrally', role => {
    const s = STAFF_ROSTER.find(x => x.role === role && x.active !== false)!;
    const p = memberWithTeam(s.id);
    const t = engagementTask(p.id, s.id, [role]);
    const res = chartAction('engagement_task_close').allowed({ role, staffId: s.id }, p);
    expect(res.state).toBe('hidden');
    expect(JSON.stringify(res)).not.toMatch(/peer|trainee|SUD|substance|declin|unable/i);
    expect(close(role, s.id, p, t.id).ok).toBe(false);
    expect(AdelanteEHR.listCaseTasks().find(x => x.id === t.id)!.status).toBe('open');
  });

  it.each(['nurse_rn', 'lvn', 'clinical_coordinator'] as const)('%s holds worklist write and can claim and update an ordinary row', role => {
    expect(canAccess(role, 'worklist').level).toBe('write');
    const s = role === 'clinical_coordinator' ? coord() : staffFor(role); const p = memberWithTeam(s.id);
    const t = AdelanteEHR.createCaseTask({ patientId: p.id, assignedTo: '', title: 'Fictional follow-up call', detail: 'Fictional', dueDate: new Date().toISOString() } as never);
    expect(AdelanteEHR.claimWorklistTask(t.id, s.name, role)).toBe(true);
    expect(AdelanteEHR.setWorklistStatus(t.id, 'completed', s.name, role)).toBe(true);
  });

  it('peer specialist still holds worklist read only', () => {
    expect(canAccess('peer_specialist', 'worklist').level).toBe('read');
  });
});
