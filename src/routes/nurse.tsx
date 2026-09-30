// §Batch E1 — nurse (RN) / LVN workspace. Mobile-first: Today, Needs my
// action, "+ New" (vitals, specimen, triage). Draft — pending clinical sign-off.
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Lock, Plus } from "lucide-react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { NURSING_ROLES, useActingStaff } from "@/lib/roles";
import { listClinicDoses, nurseQueue, NURSING_DRAFT_LABEL } from "@/lib/nursing";
import { CHART_ACTIONS } from "@/lib/chartActions";
import { confirmationFor } from "@/lib/actions/runAction";
import { NurseQueueList, SpecimenForm, TriageForm } from "@/components/nursing/NursingSection";
import { MetabolicForm } from "@/components/chart/LabsAndMeasures";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

export const Route = createFileRoute("/nurse")({
  head: () => ({
    meta: [
      { title: "Nursing workspace — Adelante" },
      { name: "description", content: "Outpatient nursing: order reviews, clinic doses, vitals, specimens and triage calls." },
      { property: "og:title", content: "Nursing workspace — Adelante" },
      { property: "og:description", content: "Today's nursing work and the steps waiting on you." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NursePage,
});

const NEW_IDS = ["metabolic", "specimen_collect", "triage_call"] as const;

function NursePage() {
  const me = useActingStaff();
  const rows = useEhr(() => nurseQueue({ role: me.role, staffId: me.staffId }));
  const patients = useEhr(() => AdelanteEHR.listPatients());
  const givenToday = useEhr(() => {
    const day = new Date().toDateString();
    return patients.flatMap((p) => listClinicDoses(p.id)).filter((d) => new Date(d.at).toDateString() === day && d.byStaffId === me.staffId).length;
  });
  const [open, setOpen] = useState<(typeof NEW_IDS)[number] | null>(null);
  const [patientId, setPatientId] = useState("");
  if (!NURSING_ROLES.includes(me.role))
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Card className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Lock className="h-4 w-4" /> The nursing workspace is for RN and LVN staff.</Card>
      </div>
    );
  const actions = CHART_ACTIONS.filter((a) => (NEW_IDS as readonly string[]).includes(a.id)).filter((a) => a.allowed({ role: me.role, staffId: me.staffId }).state !== "hidden");
  const done = (message: string) => {
    toast.success(confirmationFor(open ?? "", message));
    setOpen(null);
  };
  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6" data-testid="nurse-workspace">
      <header className="space-y-1">
        <h1 className="font-display text-2xl text-navy">Nursing</h1>
        <p className="text-sm text-muted-foreground">{me.staffName} · {me.role === "lvn" ? "LVN" : "RN"}</p>
        <Badge variant="outline">{NURSING_DRAFT_LABEL}</Badge>
      </header>
      <Card className="grid grid-cols-2 gap-3 p-4 text-center" data-testid="nurse-today">
        <div><div className="text-2xl font-semibold text-navy">{rows.length}</div><div className="text-xs text-muted-foreground">Waiting on you</div></div>
        <div><div className="text-2xl font-semibold text-navy">{givenToday}</div><div className="text-xs text-muted-foreground">Doses given today</div></div>
      </Card>
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-navy">Needs my action</h2>
        </div>
        <NurseQueueList rows={rows} />
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-navy">+ New</h2>
        <select className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm" value={patientId} onChange={(e) => setPatientId(e.target.value)} aria-label="Patient" data-testid="nurse-patient">
          <option value="">Choose a patient…</option>
          {patients.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
        </select>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {actions.map((a) => (
            <Button key={a.id} variant="outline" disabled={!patientId} onClick={() => setOpen(a.id as (typeof NEW_IDS)[number])} data-testid={`nurse-new-${a.id}`}>
              <Plus className="mr-1 h-4 w-4" /> {a.label.en}
            </Button>
          ))}
        </div>
        {patientId && <Link to="/record/$patientId" params={{ patientId }} className="text-xs underline">Open chart</Link>}
      </section>
      <Sheet open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetTitle className="text-navy">{CHART_ACTIONS.find((a) => a.id === open)?.label.en}</SheetTitle>
          <div className="mt-4">
            {open === "metabolic" && <MetabolicForm patientId={patientId} onDone={(m) => done(m)} />}
            {open === "specimen_collect" && <SpecimenForm patientId={patientId} onDone={(m) => done(m)} />}
            {open === "triage_call" && <TriageForm patientId={patientId} onDone={(m) => done(m)} />}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
