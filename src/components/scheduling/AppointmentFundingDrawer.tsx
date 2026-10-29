import { useState } from "react";
import { toast } from "sonner";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ClientDate } from "@/components/ClientDate";
import { useActingStaff } from "@/lib/roles";
import { runAction } from "@/lib/actions/runAction";
import { useEhr } from "@/lib/ehr";
import { canOverrideFundingSource, FUNDING_SOURCES, FUNDING_SOURCE_LABEL, FUNDING_OVERRIDE_REASONS, FUNDING_OVERRIDE_REASON_LABEL, FUNDING_FLAG_LABEL, SLIDING_SCALE_FEE_LABEL, type FundingSource, type FundingOverrideReason } from "@/lib/fundingSource";
import { intakeFundingAppointments, type FundingAppointmentView } from "@/lib/fundingAppointmentView";

const selectClass = "min-h-9 w-full rounded-sm border border-line-strong bg-surface px-2 text-base text-ink";

export function AppointmentFundingDrawer({ appointment }: { appointment: FundingAppointmentView }) {
  const actor = useActingStaff();
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<FundingSource | "">("");
  const [reasonCode, setReasonCode] = useState<FundingOverrideReason | "">("");
  if (!canOverrideFundingSource(actor.role)) return null;
  const current = appointment.fundingSource?.source;
  return <>
    <Button variant="outline" size="sm" onClick={() => { setSource(current ?? ""); setReasonCode(""); setOpen(true); }}><Wallet className="size-4" />Change who pays</Button>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="w-full space-y-4 overflow-y-auto sm:max-w-md" data-testid="appointment-funding-drawer">
        <SheetHeader><SheetTitle>Change who pays</SheetTitle><SheetDescription>Draft — pending clinical sign-off and billing review with Christi.</SheetDescription></SheetHeader>
        <p className="text-base"><ClientDate value={appointment.start} /> · Visit <span className="font-mono">{appointment.id}</span></p>
        <p className="text-base" role="status">Who pays: {current ? FUNDING_SOURCE_LABEL[current] : "Coverage — needs review"}</p>
        {appointment.fundingSource?.flags.map(flag => <p key={flag} className="text-sm text-ink-muted">{FUNDING_FLAG_LABEL[flag]}</p>)}
        <label className="block space-y-1">Funding source — Required<select className={selectClass} value={source} onChange={e => setSource(e.target.value as FundingSource)}><option value="">Choose funding source</option>{FUNDING_SOURCES.map(value => <option key={value} value={value}>{FUNDING_SOURCE_LABEL[value]}</option>)}</select></label>
        <label className="block space-y-1">Change reason — Required<select className={selectClass} value={reasonCode} onChange={e => setReasonCode(e.target.value as FundingOverrideReason)}><option value="">Choose reason</option>{FUNDING_OVERRIDE_REASONS.map(value => <option key={value} value={value}>{FUNDING_OVERRIDE_REASON_LABEL[value]}</option>)}</select></label>
        {source === "private_pay" && <p className="text-sm text-ink-muted">{SLIDING_SCALE_FEE_LABEL}</p>}
        <p className="text-sm text-ink-muted">The visit stays booked. No claim or patient notification is sent.</p>
        <div className="flex flex-wrap gap-2"><Button disabled={!source || !reasonCode} onClick={() => {
          if (!source || !reasonCode || !actor.staffId) return;
          const result = runAction("appointment_funding_set", actor, undefined, { via: "setAppointmentFundingSource", args: [appointment.id, { source, reasonCode, actorId: actor.staffId, actorRole: actor.role }] });
          if (!result.ok) { toast.error(result.reason); return; }
          toast.success("Who pays updated."); setOpen(false);
        }}>Save funding source</Button><Button variant="ghost" onClick={() => setOpen(false)}>Keep current source</Button></div>
      </SheetContent>
    </Sheet>
  </>;
}

export function IntakeAppointmentFunding({ referralId }: { referralId: string }) {
  const actor = useActingStaff();
  const json = useEhr(() => JSON.stringify(intakeFundingAppointments(actor, referralId)));
  const appointments = JSON.parse(json) as FundingAppointmentView[];
  if (!appointments.length) return null;
  return <section className="space-y-2 border-t border-line pt-3" aria-label="First visit funding"><h4 className="font-bold">First visit funding</h4>{appointments.map(appointment => <div key={appointment.id} className="flex flex-wrap items-center gap-3 text-base"><ClientDate value={appointment.start} /><span role="status">{appointment.fundingSource?.source ? FUNDING_SOURCE_LABEL[appointment.fundingSource.source] : "Coverage — needs review"}</span><AppointmentFundingDrawer appointment={appointment} /></div>)}</section>;
}