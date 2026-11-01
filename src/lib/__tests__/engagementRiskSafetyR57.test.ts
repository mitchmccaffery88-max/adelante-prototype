import { expect, it } from 'vitest';
import { AdelanteEHR } from '../ehr';
import { evaluateEngagement } from '../engagementRisk';
it('C-SSRS outstanding safety follow-up never becomes an engagement signal', () => {
  const p = AdelanteEHR.listPatients()[0];
  if (!p) throw new Error('Member fixture missing');
  const now = Date.parse('2026-11-01T23:00:00Z');
  const patient = { ...p, releaseDate: '', screeners: {}, screenerHistory: [], sdohPlan: { items: [] }, demographicsHistory: [], coverage: undefined, tasks: [{ id: 'safety', kind: 'rescreen' as const, label: '', screenerKey: 'c-ssrs-screener', createdAt: '2026-10-01T23:00:00Z' }] };
  expect(evaluateEngagement({ patient, appointments: [], outreach: [] }, now)).toBeUndefined();
});