// 28 Oct credentialing reconciliation: additive rules; previous assertions unchanged.
import { describe, it, expect } from 'vitest';
import { AdelanteEHRExt } from '../ehr-ext';
import { AdelanteEHR } from '../ehr';
import { credentialingRecordForStaff, evaluateCredentialing, credentialedForService, recordExclusionCheck, EXCLUSION_LISTS, CREDENTIALING_DRAFT } from '../credentialing';
import { runAction } from '../actions/runAction';
import { credentialRecordCommand } from '../credentialingActions';
import { STAFF_ROLES } from '../roles';
const actor = { role: 'credentialing_coordinator' as const, staffId: 's-cred1' };
describe('credentialing reconciliation authority', () => {
  it('existing expiry edits and verification update the evaluator', () => {
    const c = AdelanteEHRExt.credentialsForClinician('c1').find(c => c.kind === 'license');
    if (!c) throw new Error('Missing credential');
    const expiry = c.expiresAt;
    credentialRecordCommand(actor, 'edit', { id: c.id, patch: { expiresAt: '2020-01-01' }, reason: 'Reconciliation test' });
    expect(credentialedForService('s-th1', 'Medi-Cal FFS', 'therapy_individual', '2026-10-28').ok).toBe(false);
    credentialRecordCommand(actor, 'edit', { id: c.id, patch: { expiresAt: expiry }, reason: 'Restore fixture' });
    credentialRecordCommand(actor, 'verify', { id: c.id });
    expect(credentialingRecordForStaff('s-th1')?.license?.expiresAt).toBe(expiry);
  });
  it('historical exclusions ignore checks after the service date and later revoke-like hits', () => {
    const r = credentialingRecordForStaff('s-th1'); if (!r) throw new Error('Missing record');
    const checks = EXCLUSION_LISTS.flatMap(({ key }) => [
      { list: key, checkedAt: '2026-01-01', nextDueAt: '2026-01-31', result: 'clear' as const },
      { list: key, checkedAt: '2026-02-01', nextDueAt: '2026-03-03', result: 'hit' as const },
    ]);
    const historical = { ...r, license: { ...r.license, licenseType: 'LCSW', number: 'DEMO', state: 'CA', method: 'manual' as const, verifiedAt: '2025-01-01', expiresAt: '2027-01-01' }, exclusionChecks: checks };
    expect(evaluateCredentialing(historical, { payer: 'Medi-Cal FFS', serviceType: 'therapy_individual', dateOfService: '2026-01-15' }).ok).toBe(true);
    const hit = evaluateCredentialing(historical, { payer: 'Medi-Cal FFS', serviceType: 'therapy_individual', dateOfService: '2026-02-15' });
    expect(hit.ok).toBe(false); if (!hit.ok) expect(hit.reasons).toContain('exclusion_hit');
  });
  it('monthly exclusion cadence remains 30 days, recredentialing at most three years', () => {
    expect(CREDENTIALING_DRAFT.exclusionCadenceDays).toBe(30);
    expect(CREDENTIALING_DRAFT.recredentialingYears).toBe(3);
    expect(CREDENTIALING_DRAFT.expiryTaskThresholdsDays).toEqual([90, 60, 30]);
    expect(CREDENTIALING_DRAFT.clinicianHeadsUpDays).toBe(30);
  });
  it('count boundary returns staff ids and numbers only', () => {
    const counts = AdelanteEHRExt.credentialingClaimCounts();
    expect(Object.keys(counts)).toContain('s-th1');
    expect(Object.values(counts).every(n => typeof n === 'number')).toBe(true);
    expect(JSON.stringify(counts)).not.toMatch(/patientId|encounterId|serviceDate|history/);
  });
  it('existing writer registry path matches role gates', () => {
    for (const { key: role } of STAFF_ROLES) {
      const result = runAction('credential_verify', { role, staffId: 'probe' }, undefined, { via: 'credentialRecordCommand', args: [{ role, staffId: 'probe' }, 'clear', { id: 'missing' }] });
      expect(result.ok).toBe(['sys_admin', 'clinical_coordinator', 'credentialing_coordinator'].includes(role));
    }
  });
  it('monitor attempt is simulated, exactly one audit and no live success', () => {
    const before = AdelanteEHR.listAuditEvents({ category: 'action' }).length;
    const result = runAction('credential_monitor_run', actor, undefined, { args: [actor, 'cvo'] });
    expect(result.ok).toBe(true); expect(result.event.detail?.simulated).toBe(true);
    expect(result.event.detail?.outcome).toBe('simulated');
    expect(AdelanteEHR.listAuditEvents({ category: 'action' }).length).toBe(before + 1);
  });
});
