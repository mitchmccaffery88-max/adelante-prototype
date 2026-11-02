// R57 follow-up (Draft — pending clinical sign-off): trainees can't close engagement check-ins.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { AdelanteEHR } from '../ehr';
import { runAction } from '../actions/runAction';
import { chartAction } from '../chartActions';
import { STAFF_ROSTER, addStaffMember } from '../roles';
import { chartEntryFor } from '../chartAccess';
import { saveAdditionalTeamAssignment } from '../chartRelationships';
import { screenerFollowupActor } from '../screenerFollowup';
import { engagementOwnerFor } from '../engagementRiskAutomation';
import { ENGAGEMENT_CLOSE_ROLES, ENGAGEMENT_TASK_TITLE } from '../engagementRisk';

const clock = Date.parse('2026-11-02T15:00:00Z');
afterEach(() => vi.useRealTimers());
const staff = (id: string) => { const s = STAFF_ROSTER.find(s => s.id === id); if (!s) throw new Error(`missing ${id}`); return s; };
function member(clinicianId?: string) {
  vi.useFakeTimers(); vi.setSystemTime(clock);
  const p = AdelanteEHR.createPatient({ firstName: 'Fictional', lastName: `Trainee${AdelanteEHR.listPatients().length}`, dob: '1990-01-01' });
  p.intakeCompletedAt = new Date(clock - 40 * 86400000).toISOString(); p.screeners = {}; p.screenerHistory = []; p.tasks = []; p.releaseDate = ''; p.coverage = undefined; p.sdohPlan = { items: [] }; p.demographicsHistory = [];
  p.caseManagerId = undefined; p.primaryClinicianId = clinicianId;
  return p;
}
const sweep = (p: ReturnType<typeof member>) => runAction('engagement_risk_automation', screenerFollowupActor, p, { args: [p.id, new Date().toISOString(), screenerFollowupActor] });
const elevate = (p: ReturnType<typeof member>) => AdelanteEHR.applyIntakeNeeds(p.id, { confirmed: [], selfReported: [{ need: 'Phone or internet' }] });
const engagementTask = (p: ReturnType<typeof member>) => AdelanteEHR.caseTasksForPatient(p.id).find(t => t.sourceAutomationId === 'engagement_risk_automation');

describe('R57 follow-up: trainee close and owner routing', () => {
  it('trainee is not a close role and the refusal is neutral', () => {
    expect(ENGAGEMENT_CLOSE_ROLES).not.toContain('clinical_trainee');
    const p = AdelanteEHR.listPatients()[0]!;
    const res = chartAction('engagement_task_close').allowed({ role: 'clinical_trainee', staffId: 's-tr1' }, p);
    expect(res.state).toBe('hidden');
    expect(JSON.stringify(res)).not.toMatch(/trainee|SUD|substance|declin|unable/i);
    expect(runAction('engagement_task_close', { role: 'clinical_trainee', staffId: 's-tr1' }, p).ok).toBe(false);
  });

  it.each(['lvn', 'nurse_rn'] as const)('%s keeps registry close access with chart access', (role) => {
    // The demo roster has no nursing staff; add a fictional one through the real roster store.
    const admin = STAFF_ROSTER.find(a => a.role === 'sys_admin' && a.active !== false)!;
    const s = STAFF_ROSTER.find(x => x.id === `s-test-${role}`) ?? addStaffMember({ role: 'sys_admin', staffId: admin.id }, { id: `s-test-${role}`, name: `Fictional ${role}`, role, credential: role === 'lvn' ? 'LVN' : 'RN' });
    const p = member();
    const coord = STAFF_ROSTER.find(c => c.role === 'clinical_coordinator' && c.active !== false)!;
    saveAdditionalTeamAssignment({ role: 'clinical_coordinator', staffId: coord.id }, { staffId: s.id, patientId: p.id, start: new Date(clock - 86400000).toISOString() });
    expect(chartEntryFor(role, s.id, p.id).ok).toBe(true);
    expect(chartAction('engagement_task_close').allowed({ role, staffId: s.id }, p).state).toBe('allowed');
    // STOP (2 Nov): the store close gate also requires worklist write, which nursing roles
    // hold only as read today, so an actual nurse close is refused. Not widened here; see report.
  });

  it('owner chain skips a supervised trainee to the supervisor when close-allowed with chart entry, else coordinator queue', () => {
    const tr = staff('s-tr1'); const sup = staff(tr.supervisedBy!);
    const p = member(tr.clinicianId);
    const o = engagementOwnerFor(p, new Date());
    if (ENGAGEMENT_CLOSE_ROLES.includes(sup.role) && chartEntryFor(sup.role, sup.id, p.id).ok) {
      expect(o).toMatchObject({ assignedTo: sup.id, allowedRoles: [sup.role], routing: { skippedTraineeId: 's-tr1', branch: 'supervisor' } });
    } else {
      expect(o).toMatchObject({ assignedTo: '', allowedRoles: ['clinical_coordinator'], routing: { skippedTraineeId: 's-tr1', branch: 'coordinator_queue' } });
    }
  });

  it('a trainee without a recorded supervisor goes to the coordinator queue, audited', () => {
    const p = member(staff('s-tr2').clinicianId); elevate(p);
    const r = sweep(p); expect(r.ok).toBe(true);
    const t = engagementTask(p)!;
    expect(t.assignedTo).toBe(''); expect(t.allowedRoles).toEqual(['clinical_coordinator']);
    const audit = AdelanteEHR.listAudit?.().filter(e => e.patientId === p.id).at(-1) as { meta?: Record<string, unknown> } | undefined;
    expect(JSON.stringify(audit ?? r)).toContain('coordinator_queue');
  });

  it('an existing trainee-owned task is reassigned on the next sweep with an audit entry', () => {
    const p = member(staff('s-tr2').clinicianId); elevate(p);
    const t = AdelanteEHR.createCaseTask({ patientId: p.id, assignedTo: 's-tr2', allowedRoles: ['clinical_trainee'], title: ENGAGEMENT_TASK_TITLE, detail: ENGAGEMENT_TASK_TITLE, dueDate: new Date().toISOString(), origin: 'screener_flag', source: 'engagement_risk_automation', sourceAutomationId: 'engagement_risk_automation', taskType: 'engagement_checkin', dedupeKey: `engagement:${p.id}` });
    const r = sweep(p); expect(r.ok).toBe(true);
    const after = AdelanteEHR.caseTasksForPatient(p.id).filter(x => x.sourceAutomationId === 'engagement_risk_automation' && x.status !== 'done');
    expect(after).toHaveLength(1); expect(after[0]!.id).toBe(t.id);
    expect(after[0]!.assignedTo).toBe(''); expect(after[0]!.allowedRoles).toEqual(['clinical_coordinator']);
    expect(JSON.stringify(r)).toMatch(/"reassigned":true/);
    expect(JSON.stringify(r)).toContain('s-tr2');
  });
});
