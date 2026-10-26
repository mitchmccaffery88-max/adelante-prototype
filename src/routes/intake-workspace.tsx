import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Lock } from "lucide-react";
import { useActingStaff, INTAKE_ROLE_DRAFT } from "@/lib/roles";
import { useEhr } from "@/lib/ehr";
import { intakeReferrals, intakeLane, seedIntakeStaff, INTAKE_ROLE_PURPOSE } from "@/lib/intakeWorkspace";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { openBookVisit } from "@/lib/bookingFlow";
export const Route = createFileRoute("/intake-workspace")({head: () => ({meta:[{title:"Intake workspace — Adelante"},{name:"description",content:"Referral intake, identity review, paperwork and first visits."},{property:"og:title",content:"Intake workspace — Adelante"},{property:"og:description",content:"The non-clinical front door for Adelante care."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}]}), component: IntakeWorkspace});
function IntakeWorkspace() {
  const actor = useActingStaff();
  useEffect(seedIntakeStaff, []);
  const referrals = useEhr(intakeReferrals);
  if (actor.role !== "intake_coordinator") return <p className="p-6 flex gap-2"><Lock />Intake Coordinator role required.</p>;
  return <main className="mx-auto max-w-6xl p-4 sm:p-6 space-y-5"><h1 className="text-2xl font-bold">Intake workspace</h1><p className="text-sm text-ink-muted">{INTAKE_ROLE_DRAFT}</p><p>{INTAKE_ROLE_PURPOSE}</p><div className="flex flex-wrap gap-3"><Button asChild><Link to="/admin-identity-review">Identity review</Link></Button><Button variant="outline" onClick={() => openBookVisit()}>First visits to schedule</Button></div>
    <section className="space-y-4"><h2 className="text-xl font-bold">Referral intake</h2>{["New","Outreach in progress","Waiting on paperwork","Ready to schedule","Handed off"].map(lane => <section key={lane} className="border-t border-line pt-3 space-y-2"><h3 className="font-bold">{lane}</h3>{referrals.filter(r => intakeLane(r) === lane).map(r => <div key={r.id} className="flex flex-wrap items-center gap-3 border-b border-line py-3"><span>{r.firstName} {r.lastName}</span><StatusChip lang="en" state={lane === "Handed off" ? "done" : lane === "Waiting on paperwork" ? "team" : "yourturn"} label={lane === "Handed off" ? "Handed off" : lane === "Waiting on paperwork" ? "With others" : "Your turn"} waitingDays={Math.max(0,Math.floor((Date.now()-Date.parse(r.createdAt))/86400000))} /><span className="text-sm">Intake Coordinator</span></div>)}</section>)}</section>
    <section className="border-t border-line pt-4 space-y-3"><h2 className="text-xl font-bold">Paperwork and consents to collect</h2><p className="text-sm text-ink-muted">Open consent records from the person's record; clinical scope stays with the clinical team.</p><p className="flex gap-2 text-sm"><Lock />Clinical notes, medications, assessments and crisis details are restricted for intake.</p></section>
  </main>;
}