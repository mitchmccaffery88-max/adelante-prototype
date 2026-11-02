// R57 follow-up 2 (Mitch 2 Nov 09:28 CT) — Draft. Care Coordination "My tasks"
// includes tasks assigned directly to the signed-in staff ID, de-duplicated,
// chart-gated; caseload-matched rows unchanged.
import { describe, it, expect } from 'vitest';
import { AdelanteEHR } from '../ehr';
import { getStaffMember } from '../roles';
import { ENGAGEMENT_TASK_TITLE } from '../engagementRisk';
import { outpatientQueueTasks } from '@/components/tasks/TaskQueueCard';

const lupita = getStaffMember('s-cm2')!;
const viewer = { staffId: lupita.id, role: lupita.role };
const ids = (src: Parameters<typeof outpatientQueueTasks>[0]) => outpatientQueueTasks(src).map(t => t.id);
const task = (patientId: string, assignedTo: string) =>
  AdelanteEHR.createCaseTask({ patientId, assignedTo, title: ENGAGEMENT_TASK_TITLE, detail: ENGAGEMENT_TASK_TITLE, dueDate: new Date().toISOString(), origin: 'screener_flag', source: 'engagement_risk_automation', allowedRoles: [lupita.role] });

describe('My tasks: caseload ID or direct staff ID', () => {
  it('Lupita is linked to caseload cm1', () => expect(lupita.caseManagerId).toBe('cm1'));

  it('an engagement task assigned to s-cm2 appears in her My tasks', () => {
    const t = task('p1', 's-cm2');
    expect(ids({ kind: 'case_manager', cmId: 'cm1', staff: viewer })).toContain(t.id);
  });

  it('appears once when both caseload ID and staff ID match', () => {
    const t = task('p1', 's-cm2');
    const list = ids({ kind: 'case_manager', cmId: 'cm1', staff: viewer });
    expect(list.filter(x => x === t.id)).toHaveLength(1);
    expect(new Set(list).size).toBe(list.length);
  });

  it('is hidden from staff without chart access', () => {
    const p = AdelanteEHR.createPatient({ firstName: 'Fictional', lastName: 'NoTeam', dob: '1990-01-01' });
    const t = task(p.id, 's-cm2');
    expect(ids({ kind: 'case_manager', cmId: 'cm1', staff: viewer })).not.toContain(t.id);
  });

  it('caseload-matched tasks are unchanged', () => {
    const caseload = AdelanteEHR.caseTasksForCM('cm1').map(t => t.id);
    const withStaff = ids({ kind: 'case_manager', cmId: 'cm1', staff: viewer });
    expect(withStaff.slice(0, caseload.length)).toEqual(caseload);
    expect(ids({ kind: 'case_manager', cmId: 'cm1' })).toEqual(AdelanteEHR.caseTasksForCM('cm1').map(t => t.id));
  });
});
