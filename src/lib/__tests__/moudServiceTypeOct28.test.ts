// 28 Oct MOUD service type (Mitch, Draft): one controlled-substance catalog entry.
import { describe, expect, it } from 'vitest';
import { AdelanteEHR, bookingCredentialingBlock } from '../ehr';
import { AdelanteEHRExt } from '../ehr-ext';
import { credentialedForService, evaluateCredentialing, isBillableServiceType, type ClinicianCredentialing } from '../credentialing';
import { checkBookingRights, isPrescriberServiceType } from '../bookingRights';
import { eligibleClinicians, bookableServiceTypes } from '../bookingFlow';
import { projectBillingAppointment, APPOINTMENT_KEYS } from '../billingProjection';
import { codeMappingNeedsReview, defaultCodeFor } from '../rates';
import { STAFF_ROLES } from '../roles';
const ROLES = STAFF_ROLES.map(r => r.key);

const at = (d: number) => new Date(Date.now() + d * 86400000).toISOString();
const rec = (dea?: ClinicianCredentialing['dea']): ClinicianCredentialing => ({ staffId: 's-th3', license: { licenseType: 'PMHNP', number: 'D', state: 'CA', verifiedAt: at(-30), expiresAt: at(400), method: 'manual' }, dea, exclusionChecks: (['oig', 'sam_gov', 'medi_cal_suspended'] as const).map(list => ({ list, checkedAt: at(-5), nextDueAt: at(25), result: 'clear' })), enrollments: [{ payer: 'Medi-Cal FFS', serviceType: '*', status: 'active' }], documentStatus: 'simulated_unavailable' });
const q = (serviceType: string, days = 30) => ({ payer: 'Medi-Cal FFS', serviceType, dateOfService: at(days), asOf: at(0) });

describe('Controlled medication / MOUD visit', () => {
  it('is in the one catalog, billable, prescriber-only, video + in person', () => {
    const t = AdelanteEHR.getServiceType('controlled_med_moud')!;
    expect(t.label).toBe('Controlled medication / MOUD visit');
    expect(t.allowedModalities).toEqual(AdelanteEHR.getServiceType('med_management')!.allowedModalities);
    expect(t.controlledSubstanceDraft).toBe(true);
    expect(AdelanteEHR.getServiceType('med_management')!.controlledSubstanceDraft).toBeUndefined();
    expect(isBillableServiceType('controlled_med_moud')).toBe(true);
    expect(isPrescriberServiceType('controlled_med_moud')).toBe(true);
  });
  it('requires a current DEA; med_management does not', () => {
    expect(evaluateCredentialing(rec(undefined), q('controlled_med_moud'))).toEqual({ ok: false, reasons: ['dea_not_verified', 'dea_expired'] });
    expect(evaluateCredentialing(rec(undefined), q('med_management'))).toEqual({ ok: true });
    const r = rec({ number: 'D', verifiedAt: at(-10), expiresAt: at(40) });
    expect(evaluateCredentialing(r, q('controlled_med_moud', 30))).toEqual({ ok: true });
    expect(evaluateCredentialing(r, q('controlled_med_moud', 60))).toEqual({ ok: false, reasons: ['dea_expired'] });
  });
  it('only prescriber calendars are offered', () => {
    const actor = { staffId: 's-cc1', staffName: 'Priya Raman', role: 'clinical_coordinator' as const };
    const ids = eligibleClinicians('controlled_med_moud', undefined, actor).map(s => s.clinician.id).sort();
    expect(ids).toEqual(['c3', 'c5']);
  });
  it('non-prescriber clinicians cannot be booked for it by the store', () => {
    const p = AdelanteEHR.listPatients()[0]!;
    expect(() => AdelanteEHR.bookAppointment({ patientId: p.id, clinicianId: 'c1', start: '2090-01-01T17:00:00Z', durationMin: 30, serviceType: 'controlled_med_moud', modality: 'video', source: 'staff_scheduled' })).toThrow();
  });
  it('enrollment rows exist; only the demo prescriber is active', () => {
    const rows = AdelanteEHRExt.listAllEnrollments().filter(e => e.serviceType === 'controlled_med_moud');
    const clinicians = new Set(AdelanteEHRExt.listAllEnrollments().map(e => e.clinicianId));
    expect(new Set(rows.map(r => r.clinicianId))).toEqual(clinicians);
    // 29 Oct: c3 also holds a DMC-ODS MOUD row (one prescriber, two payers).
    expect([...new Set(rows.filter(r => r.status === 'enrolled').map(r => r.clinicianId))]).toEqual(['c3']);
    expect(rows.filter(r => r.clinicianId !== 'c3').every(r => r.status === 'not_enrolled')).toBe(true);
    // Service-specific "not started" wins over a payer-wide active row.
    expect(credentialedForService('s-th1', 'Medi-Cal FFS', 'controlled_med_moud', at(5))).toMatchObject({ ok: false });
  });
  // 29 Oct (Mitch): the DEA-expiry case moved from c5 to c3, fully credentialed and MOUD-enrolled.
  it('demo seeds: future booking with c3; c3 DEA expires before a later booked date (the only block)', () => {
    expect(AdelanteEHR.listAppointments().some(a => a.serviceType === 'controlled_med_moud' && a.clinicianId === 'c3' && a.start > new Date().toISOString())).toBe(true);
    const r = credentialedForService('s-th3', 'Medi-Cal FFS', 'controlled_med_moud', at(30), { asOf: at(0) });
    expect(r.ok ? [] : r.reasons).toEqual(['dea_expired']);
    const mm = credentialedForService('s-th3', 'Medi-Cal FFS', 'med_management', at(30), { asOf: at(0) });
    expect(mm.ok ? [] : mm.reasons).not.toContain('dea_expired');
    const p = AdelanteEHR.listPatients().find(x => x.id === 'p1')!;
    expect(bookingCredentialingBlock('c3', 'controlled_med_moud', p.id, at(5))).toBeUndefined();
  });
  it('billing projection: same keys, new value only, no code invented', () => {
    const base = { id: 'x', patientId: 'p', clinicianId: 'c3', start: at(5), durationMin: 30, status: 'scheduled', source: 'staff_scheduled', notes: 'secret note' } as never;
    const a = projectBillingAppointment({ ...(base as object), serviceType: 'med_management' } as never);
    const b = projectBillingAppointment({ ...(base as object), serviceType: 'controlled_med_moud' } as never);
    expect(Object.keys(b).sort()).toEqual(Object.keys(a).sort());
    expect(Object.keys(b).every(k => (APPOINTMENT_KEYS as readonly string[]).includes(k))).toBe(true);
    expect(JSON.stringify(b)).not.toContain('secret note');
    expect(b.serviceType).toBe('controlled_med_moud');
    expect(codeMappingNeedsReview('controlled_med_moud')).toBe(true);
    expect(codeMappingNeedsReview('med_management')).toBe(false);
    void defaultCodeFor;
  });
  it('picker and store agree for every role', () => {
    for (const role of ROLES) {
      const offered = bookableServiceTypes(role as never).some(s => s.id === 'controlled_med_moud');
      const store = checkBookingRights({ role, op: 'book', inCaseload: true, serviceType: 'controlled_med_moud' }).ok;
      expect([role, offered]).toEqual([role, store]);
    }
  });
});
