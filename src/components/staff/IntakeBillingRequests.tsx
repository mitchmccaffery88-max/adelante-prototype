import { useState } from "react";
import { useActingStaff } from "@/lib/roles";
import { useEhr } from "@/lib/ehr";
import { billingIntakeRequests } from "@/lib/intakePhaseB";
import { Button } from "@/components/ui/button";
import { CoverageCheckDialog } from "@/components/coverage/CoverageCheckDialog";
export function IntakeBillingRequests() {
  const actor = useActingStaff(); const [patientId, setPatientId] = useState<string>();
  const rows = JSON.parse(useEhr(() => JSON.stringify(billingIntakeRequests(actor)))) as ReturnType<typeof billingIntakeRequests>;
  if (!rows.length) return null;
  return <section className="space-y-3 border-t border-line pt-4" aria-label="Intake coverage requests"><h2 className="text-xl font-bold">Intake coverage requests</h2>{rows.map(r => <div key={r.referralId} className="flex flex-wrap gap-3"><span>Referral {r.referralId} · Requested {r.requestedAt.slice(0, 10)} · Your turn — Billing</span><Button variant="outline" onClick={() => setPatientId(r.patientId)}>Record manual check</Button></div>)}{patientId && <CoverageCheckDialog patientId={patientId} open={true} onOpenChange={v => { if (!v) setPatientId(undefined); }} actor={{ actorId: actor.staffId ?? "", actorRole: actor.role }} />}</section>;
}