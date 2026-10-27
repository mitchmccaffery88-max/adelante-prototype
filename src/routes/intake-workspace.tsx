import { useEffect } from "react";
import { IntakePhaseBActions, IntakeStagingImport } from "@/components/staff/IntakePhaseBActions";
import { IntakePhaseAActions, IntakeSafetyActions } from "@/components/staff/IntakePhaseAActions";
import { INTAKE_PHASE_A_DRAFT, intakeState } from "@/lib/intakePhaseA";
import { seedIntakePhaseAThroughRegistry } from "@/lib/intakePhaseADemo";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { runAction } from "@/lib/actions/runAction";
import { toast } from "sonner";
import { REFERRAL_OUTREACH_OUTCOMES, type ReferralOutreachOutcome } from "@/lib/referralOutreach";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Lock } from "lucide-react";
import { useActingStaff, INTAKE_ROLE_DRAFT } from "@/lib/roles";
import { useEhr } from "@/lib/ehr";
import { intakeReferrals, intakeLane, intakeReferralRestricted, INTAKE_ROLE_PURPOSE } from "@/lib/intakeWorkspace";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { ReferralSubmissionForm } from "@/components/referral/ReferralSubmissionForm";
import { canSubmitReferral } from "@/lib/website/publicReferral";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
export const Route = createFileRoute("/intake-workspace")({head: () => ({meta:[{title:"Intake workspace — Adelante"},{name:"description",content:"Public referral intake and authorized identity review."},{property:"og:title",content:"Intake workspace — Adelante"},{property:"og:description",content:"The non-clinical front door for Adelante care."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}]}), component: IntakeWorkspace});
function IntakeWorkspace() {
  const actor = useActingStaff();
  useEffect(() => { if (actor.role === "intake_coordinator") seedIntakePhaseAThroughRegistry(actor); }, [actor.staffId, actor.role]);
  const referrals = useEhr(intakeReferrals);
  const [outcome,setOutcome] = useState<ReferralOutreachOutcome>("no_answer");
  const [reason,setReason] = useState("");
  const [submitOpen, setSubmitOpen] = useState(false);
  const canSend = canSubmitReferral(actor);
  if (actor.role !== "intake_coordinator") return <p className="p-6 flex gap-2"><Lock />Intake Coordinator role required.</p>;
  return <main className="mx-auto max-w-6xl p-4 sm:p-6 space-y-5"><h1 className="text-2xl font-bold">Intake workspace</h1><p className="text-sm text-ink-muted">{INTAKE_ROLE_DRAFT}</p><p>{INTAKE_ROLE_PURPOSE}</p><p className="text-sm text-ink-muted">{INTAKE_PHASE_A_DRAFT}</p><IntakeSafetyActions actor={actor} /><div className="flex flex-wrap gap-3"><Button asChild><Link to="/admin-identity-review">Identity review</Link></Button>{canSend ? <Button variant="outline" data-testid="staff-submit-referral" onClick={() => setSubmitOpen(true)}>Send a referral</Button> : <p>Referrals are sent by Intake or the clinical coordinator.</p>}</div>
    {canSend && <Dialog open={submitOpen} onOpenChange={setSubmitOpen}><DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>Send referral on someone's behalf</DialogTitle><DialogDescription>Enter the referring person and agency as they gave them to you.</DialogDescription></DialogHeader><ReferralSubmissionForm variant="staff" onSubmitted={() => setSubmitOpen(false)} /></DialogContent></Dialog>}
    <IntakeStagingImport actor={actor} />
    <section className="space-y-4"><div className="flex flex-wrap gap-3"><label>Outreach outcome<Select value={outcome} onValueChange={value=>setOutcome(value as ReferralOutreachOutcome)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{REFERRAL_OUTREACH_OUTCOMES.map(o=><SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}</SelectContent></Select></label><label>Reason — Required<Textarea value={reason} onChange={e=>setReason(e.target.value)} /></label></div><h2 className="text-xl font-bold">Referral intake</h2>{["New","Outreach in progress","Waiting on paperwork","Ready to schedule","Handed off"].map(lane => <section key={lane} className="border-t border-line pt-3 space-y-2"><h3 className="font-bold">{lane}</h3>{referrals.filter(r => (r.enrolledPatientId && !intakeReferralRestricted(r) && !intakeState(r.id, actor).completedAt ? "Ready to schedule" : intakeLane(r)) === lane).map(r => <div key={r.id} className="flex flex-wrap items-center gap-3 border-b border-line py-3"><span>{intakeReferralRestricted(r) ? <span className="flex gap-2"><Lock />Restricted — intake consent required</span> : <>{r.firstName} {r.lastName}</>}</span><StatusChip lang="en" state={lane === "Handed off" ? "done" : lane === "Waiting on paperwork" ? "team" : "yourturn"} label={lane === "Handed off" ? "Handed off" : lane === "Waiting on paperwork" ? "With others" : "Your turn"} waitingDays={Math.max(0,Math.floor((Date.now()-Date.parse(r.createdAt))/86400000))} /><span className="text-sm">Intake Coordinator</span>{!intakeReferralRestricted(r) && ["submitted","contacted"].includes(r.status) && <Button variant="outline" disabled={reason.trim().length < 3} onClick={()=>{const result=runAction("intake_outreach_record",actor,undefined,{args:[actor,r.id,outcome,reason]});if(!result.ok)toast.error(result.reason);else toast.success("Outreach recorded");}}>Log outreach</Button>}{r.enrolledPatientId && !intakeReferralRestricted(r) && <IntakePhaseAActions actor={actor} referralId={r.id} />}<IntakePhaseBActions actor={actor} referralId={r.id} linked={!!r.enrolledPatientId} completed={!!intakeState(r.id, actor).completedAt} /></div>)}</section>)}</section>
  </main>;
}
