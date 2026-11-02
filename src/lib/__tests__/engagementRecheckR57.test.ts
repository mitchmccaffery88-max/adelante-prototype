// R57 Draft — pending clinical sign-off. Immediate re-check after staff writes.
import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from 'vitest';
import { AdelanteEHR, type Patient } from '../ehr';
import '@/lib/demoInboxSeed';
import { runAction } from '../actions/runAction';
import { STAFF_ROSTER } from '../roles';
import { engagementFlagFor } from '../engagementRiskAutomation';
import { ENGAGEMENT_TASK_TITLE } from '../engagementRisk';
import { installEngagementRecheck } from '../engagementRecheck';

const DAY = 86_400_000;
const clock = Date.parse('2026-11-02T18:00:00Z');
const ymd = (t: number) => new Date(t).toISOString().slice(0, 10);
const luz = STAFF_ROSTER.find(s => s.id === 's-cm1')!;
const cm = { id: luz.id, name: luz.name, role: luz.role };
const reyes = { name: 'Marisol Reyes', role: 'therapist' as const, id: 's-th1' };
let off: () => void;
beforeAll(() => { off = installEngagementRecheck(); });
afterAll(() => off());
afterEach(() => vi.useRealTimers());

function member(): { p: Patient; s: (typeof STAFF_ROSTER)[number] } {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(clock);
  const p = AdelanteEHR.createPatient({ firstName: 'Fictional', lastName: `Recheck${AdelanteEHR.listPatients().length}`, dob: '1990-01-01' });
  p.intakeCompletedAt = new Date(clock - 40 * DAY).toISOString(); p.screeners = {}; p.screenerHistory = []; p.tasks = []; p.releaseDate = ''; p.coverage = undefined; p.sdohPlan = { items: [] }; p.demographicsHistory = [];
  const s = STAFF_ROSTER.find(x => x.role === 'therapist' && x.active !== false && x.clinicianId)!;
  p.primaryClinicianId = s.clinicianId;
  return { p, s };
}
const attempt = (p: Patient, daysAgo = 0) => runAction('contact_log', { role: cm.role, staffId: cm.id }, p, { args: [cm, { patientId: p.id, type: 'attempt', date: ymd(clock - daysAgo * DAY) }] });
const engagementTasks = (p: Patient) => AdelanteEHR.caseTasksForPatient(p.id).filter(t => t.sourceAutomationId === 'engagement_risk_automation' && t.title === ENGAGEMENT_TASK_TITLE && t.status !== 'done');
const automationRuns = (p: Patient) => AdelanteEHR.listAuditEvents({ patientId: p.id }).filter(e => e.action === 'action.succeeded' && JSON.stringify(e.detail).includes('engagement_risk_automation')).length;
const flag = (p: Patient, s: (typeof STAFF_ROSTER)[number]) => engagementFlagFor({ role: s.role, staffId: s.id }, p.id);

describe('R57 immediate engagement re-check', () => {
  it('third logged attempt flags Elevated with exactly one task immediately', () => {
    const { p, s } = member();
    expect(attempt(p, 2).ok).toBe(true); expect(attempt(p, 1).ok).toBe(true);
    expect(flag(p, s)).toBeUndefined(); expect(engagementTasks(p)).toHaveLength(0);
    expect(attempt(p, 0).ok).toBe(true);
    expect(flag(p, s)?.level).toBe('Elevated');
    expect(engagementTasks(p)).toHaveLength(1);
    expect(engagementTasks(p)[0]!.ownerId ?? engagementTasks(p)[0]!.assigneeId).toBeTruthy();
  });
  it('a fourth attempt does not create a second task', () => {
    const { p } = member();
    for (const d of [3, 2, 1]) attempt(p, d);
    expect(engagementTasks(p)).toHaveLength(1);
    expect(attempt(p, 0).ok).toBe(true);
    expect(engagementTasks(p)).toHaveLength(1);
  });
  it('a no-show re-evaluates immediately', () => {
    const clin = AdelanteEHR.listClinicians().find(c => AdelanteEHR.canBook(c.id).ok)!;
    const { p } = member();
    const a = AdelanteEHR.bookAppointment({ patientId: p.id, clinicianId: clin.id, start: new Date(clock - 30 * 3600000).toISOString(), durationMin: 30, serviceType: 'therapy_individual', modality: 'video', allowPatientOverlap: true } as never);
    const before = automationRuns(p);
    AdelanteEHR.markAppointmentNoShow(a.id, reyes, clock);
    expect(automationRuns(p)).toBe(before + 1);
  });
  it('a late cancel re-evaluates immediately', () => {
    const clin = AdelanteEHR.listClinicians().find(c => AdelanteEHR.canBook(c.id).ok)!;
    const { p } = member();
    const a = AdelanteEHR.bookAppointment({ patientId: p.id, clinicianId: clin.id, start: new Date(clock + 5 * 3600000).toISOString(), durationMin: 30, serviceType: 'therapy_individual', modality: 'video', allowPatientOverlap: true } as never);
    const before = automationRuns(p);
    AdelanteEHR.staffCancelAppointment(a.id, { reason: 'clinician_unavailable', actor: reyes });
    expect(a.status).toBe('late_cancel');
    expect(automationRuns(p)).toBe(before + 1);
  });
  it('a phone change re-evaluates immediately and respects HRSN cap and skip', () => {
    const { p, s } = member();
    const actor = { role: s.role, staffId: s.id, clinicianId: s.clinicianId };
    const editor = { staffId: s.id, clinicianId: s.clinicianId, name: s.name, role: s.role };
    const at = new Date(clock).toISOString();
    p.tasks = [{ id: 'cap', kind: 'rescreen', screenerKey: 'phq9', label: '', createdAt: at, automaticRescreen: true, completedAt: at }];
    const before = automationRuns(p);
    expect(runAction('demographics_edit', actor, p, { args: [p.id, { phone: '555-0100' }, editor, 'Member gave a new number'] }).ok).toBe(true);
    expect(automationRuns(p)).toBe(before + 1);
    expect(p.tasks.filter(t => t.screenerKey === 'ahc-hrsn')).toHaveLength(0);
    p.tasks = []; p.screeners = { 'ahc-hrsn': { key: 'ahc-hrsn', score: 0, severity: '', completedAt: new Date(clock - 3 * DAY).toISOString() } } as never;
    expect(runAction('demographics_edit', actor, p, { args: [p.id, { phone: '555-0101' }, editor, 'Member gave a new number'] }).ok).toBe(true);
    expect(automationRuns(p)).toBe(before + 2);
    expect(p.tasks.filter(t => t.screenerKey === 'ahc-hrsn')).toHaveLength(0);
  });
  it('a failed or refused staff write does not trigger a re-check', () => {
    const { p } = member();
    const before = automationRuns(p);
    expect(runAction('contact_log', { role: 'billing_specialist' as never, staffId: 's-x' }, p, { args: [cm, { patientId: p.id, type: 'attempt', date: ymd(clock) }] }).ok).toBe(false);
    expect(runAction('contact_log', { role: cm.role, staffId: cm.id }, p, { args: [cm, { patientId: p.id, type: 'attempt', date: ymd(clock + 3 * DAY) }] }).ok).toBe(false);
    expect(automationRuns(p)).toBe(before);
  });
  it('safety is never counted by the re-check', () => {
    const { p, s } = member();
    p.sdohPlan = { items: [{ id: 'safe', need: 'Interpersonal safety', safetySensitive: true, source: 'intake_self_report', createdAt: new Date(clock).toISOString() }] } as never;
    attempt(p, 0);
    expect(flag(p, s)).toBeUndefined();
    expect(JSON.stringify(flag(p, s) ?? {})).not.toMatch(/safety/i);
  });
});
