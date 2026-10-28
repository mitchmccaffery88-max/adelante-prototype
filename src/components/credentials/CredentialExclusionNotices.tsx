// 28 Oct credentialing reconciliation: neutral urgent notices, no patient records.
import { listCredentialingNotices, useCredentialing } from '@/lib/credentialing';
import { runAction } from '@/lib/actions/runAction';
import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';
import type { StaffRole } from '@/lib/roles';
export function CredentialExclusionNotices({ role, staffId }: { role: StaffRole; staffId: string }) {
  const notices = useCredentialing(() => listCredentialingNotices().filter(n => !n.acknowledgedAt));
  if ((role !== 'clinical_coordinator' && role !== 'sys_admin') || !notices.length) return null;
  return <section className="border border-urgent rounded-md p-4" aria-label="Credential safety review">
    <h2 className="flex items-center gap-2 font-semibold text-urgent"><ShieldAlert className="size-5" />Urgent — clinician review</h2>
    {notices.map(n => <div key={n.id} className="flex flex-wrap justify-between gap-2 mt-2"><p>A clinician needs credentialing review. New billable bookings are blocked; existing visits remain unchanged.</p><Button variant="outline" onClick={() => runAction('credential_notice_ack', { role, staffId }, undefined, { args: [{ role, staffId }, n.id] })}>Acknowledge</Button></div>)}
  </section>;
}
