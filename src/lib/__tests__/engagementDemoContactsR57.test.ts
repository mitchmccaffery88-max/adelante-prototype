import { expect, it } from 'vitest';
import { AdelanteEHR } from '../ehr';
import { __resetCaseloadReview, listContacts, seedCaseloadDemo } from '../caseloadReview';
import { runEngagementRiskSweep } from '../engagementRiskSweep';
import { engagementFacts, engagementFlagFor } from '../engagementRiskAutomation';
import { evaluateEngagement } from '../engagementRisk';

it('approved Tomás demo attempts use contact_log and real sweep creates one Elevated task', () => {
  __resetCaseloadReview();
  const now = new Date();
  const p = AdelanteEHR.listPatients().find(p => p.firstName === 'Tomás' && p.lastName === 'Reyna');
  if (!p) throw new Error('Existing fictional Tomás fixture missing');
  const before = AdelanteEHR.listAuditEvents({ category: 'action' }).length;
  seedCaseloadDemo(now);
  const attempts = listContacts(p.id).filter(c => c.type === 'attempt');
  expect(attempts).toHaveLength(3);
  expect(attempts.every(c => +now - +new Date(c.date) <= 7 * 86400000)).toBe(true);
  const audits = AdelanteEHR.listAuditEvents({ category: 'action' }).slice(before);
  expect(audits.filter(e => e.action === 'action.succeeded' && e.detail?.actionId === 'contact_log')).toHaveLength(2);
  expect(evaluateEngagement(engagementFacts(p, now), now).level).toBe('Elevated');
  runEngagementRiskSweep(now);
  runEngagementRiskSweep(now);
  expect(engagementFlagFor({ role: 'ecm_provider', staffId: 's-cm1' }, p.id)?.level).toBe('Elevated');
  expect(AdelanteEHR.caseTasksForPatient(p.id).filter(t => t.sourceAutomationId === 'engagement_risk_automation' && t.status !== 'done')).toHaveLength(1);
  seedCaseloadDemo(now);
  expect(listContacts(p.id).filter(c => c.type === 'attempt')).toHaveLength(3);
});