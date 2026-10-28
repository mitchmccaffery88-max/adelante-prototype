// 28 Oct credentialing reconciliation: one authority, registry-only verification.
import { useState } from 'react';
import { useCredentialing, listCredentialingRecords, EXCLUSION_LISTS, CREDENTIALING_REASON_LABEL, credentialedForService } from '@/lib/credentialing';
import { runAction } from '@/lib/actions/runAction';
import { getStaffMember, type StaffRole } from '@/lib/roles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
export function CredentialingRecordEditor({ role, staffId }: { role: StaffRole; staffId: string }) {
  const records = useCredentialing(listCredentialingRecords);
  const [target, setTarget] = useState('s-th1');
  const record = records.find(r => r.staffId === target);
  const [payer, setPayer] = useState('Medi-Cal FFS');
  const [service, setService] = useState('therapy_individual');
  const [effective, setEffective] = useState('');
  const [caqh, setCaqh] = useState('');
  const [status, setStatus] = useState('active');
  const actor = { role, staffId };
  const act = (id: string, args: unknown[]) => {
    const result = runAction(id, actor, undefined, { args });
    if (result.ok) toast.success('Recorded'); else toast.error(result.reason);
  };
  const check = credentialedForService(target, payer, service, new Date().toISOString());
  return <section className="space-y-4 border-t pt-4" aria-label="Clinician credential record">
    <h2 className="font-semibold">Clinician credential record</h2>
    <Label htmlFor="credential-person">Clinician</Label>
    <select id="credential-person" className="border border-line-strong bg-surface rounded-sm p-2 w-full" value={target} onChange={e => setTarget(e.target.value)}>{records.map(r => <option key={r.staffId} value={r.staffId}>{getStaffMember(r.staffId)?.name ?? r.staffId}</option>)}</select>
    {record && <dl className="grid gap-2 sm:grid-cols-2 text-sm">
      <div><dt className="font-semibold">License / registration</dt><dd>{record.license?.number ?? record.registration?.number}</dd></div>
      <div><dt className="font-semibold">Supervisor</dt><dd>{record.registration?.supervision?.supervisorStaffId ?? 'Not applicable / not recorded'}</dd></div>
      <div><dt className="font-semibold">DEA / board certification</dt><dd>{record.dea?.number ?? 'Not recorded'} · {record.boardCertification ?? 'Not recorded'}</dd></div>
      <div><dt className="font-semibold">Malpractice</dt><dd>{record.malpractice?.carrier ?? 'Not recorded'} · {record.malpractice?.policy}</dd></div>
      <div><dt className="font-semibold">Education / CE attested</dt><dd>{record.educationAttestedAt?.slice(0,10) ?? 'Not recorded'} · {record.ceAttestedAt?.slice(0,10) ?? 'Not recorded'}</dd></div>
      <div><dt className="font-semibold">IN 18-019 attestation</dt><dd>{record.attestation?.status ?? 'Pending'} · {record.attestation?.signedAt?.slice(0,10)}</dd></div>
      <div><dt className="font-semibold">Documents</dt><dd>Simulated — {record.documentStatus.replaceAll('_',' ')}</dd></div>
    </dl>}
    <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => act('credential_verify', [actor, target, { source: record?.license?.verificationSource ?? 'other' }])}>Record manual verification</Button>{EXCLUSION_LISTS.map(({key,label}) => <div key={key} className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => act('credential_exclusion_check', [actor,target,{list:key,result:'clear'}])}>Record clear — {label}</Button><Button variant="outline" onClick={() => act('credential_exclusion_check',[actor,target,{list:key,result:'hit'}])}>Record match — {label}</Button></div>)}</div>
    <h3 className="font-semibold">Payer and service enrollment</h3>
    <div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="credential-payer">Payer</Label><Input id="credential-payer" value={payer} onChange={e=>setPayer(e.target.value)}/></div><div><Label htmlFor="credential-service">Service type</Label><Input id="credential-service" value={service} onChange={e=>setService(e.target.value)}/></div><div><Label htmlFor="credential-effective">Effective date</Label><Input id="credential-effective" type="date" value={effective} onChange={e=>setEffective(e.target.value)}/></div><div><Label htmlFor="credential-caqh">CAQH ID</Label><Input id="credential-caqh" value={caqh} onChange={e=>setCaqh(e.target.value)}/></div><div><Label htmlFor="credential-status">Status</Label><select id="credential-status" className="w-full border border-line-strong bg-surface rounded-sm p-2" value={status} onChange={e=>setStatus(e.target.value)}>{['not_started','submitted','active','inactive'].map(s=><option key={s} value={s}>{s.replaceAll('_',' ')}</option>)}</select></div></div>
    <Button variant="outline" onClick={()=>act('credential_enrollment_set',[actor,target,{payer,serviceType:service,status,effectiveAt:effective || undefined,caqhId:caqh || undefined}])}>Record enrollment</Button>
    <p role="status">{check.ok ? 'Credentialed for this payer and service' : [...new Set(check.reasons.map(r=>CREDENTIALING_REASON_LABEL[r]))].join('; ')}</p>
  </section>;
}
