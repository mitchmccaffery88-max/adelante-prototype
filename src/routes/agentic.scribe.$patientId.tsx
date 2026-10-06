// §Scribe Phase 1 — working AI scribe (Simulated vendor). Consent gate →
// simulated live capture → End session → unsigned AI draft in the chart.
// The old sample panels (red flags, differential, recommendations) are
// removed; chart insights and suggested questions come only from real chart
// facts (chartReviewFacts), filtered for the viewer's role.
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { chartReviewFacts } from "@/lib/agenticPrototype";
import { useActingStaff } from "@/lib/roles";
import { canCaptureScribe, SCRIBE_PHASE2_ROLES } from "@/lib/scribe";
import { simulatedSurfaceLabel } from "@/lib/features";
import { ScribeWorkspace } from "@/components/scribe/ScribeWorkspace";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/agentic/scribe/$patientId")({
  validateSearch: z.object({ appt: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "AI scribe — Adelante" },
      { name: "description", content: "Start the AI scribe with recording consent, capture a session and review the AI draft note in the chart." },
      { property: "og:title", content: "AI scribe — Adelante" },
      { property: "og:description", content: "Consent-gated AI scribe that creates a reviewable draft note with sentence-level sources." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ScribePage,
});

function ScribePage() {
  const { patientId } = Route.useParams();
  const { appt } = Route.useSearch();
  const staff = useActingStaff();
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  const facts = useEhr(() => {
    const f = chartReviewFacts(patientId, staff.role);
    return JSON.stringify(f ? { gaps: f.careGaps.slice(0, 4), rescreens: f.rescreensDue.map((r) => r.key).slice(0, 3), next: f.nextAppointment?.start } : null);
  });
  const real = JSON.parse(facts) as { gaps: string[]; rescreens: string[]; next?: string } | null;
  if (!patient) return <div className="mx-auto max-w-3xl px-4 py-10"><EmptyState title="Client not found" description="This record is not available." /></div>;
  const name = `${patient.firstName} ${patient.lastName}`;
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <Button asChild variant="ghost" size="sm"><Link to="/record/$patientId" params={{ patientId }}><ArrowLeft className="mr-1.5 h-4 w-4" /> Back to chart</Link></Button>
      <header>
        <h1 className="font-display text-2xl text-navy">AI scribe — {name}</h1>
        <Badge variant="outline" className="mt-1 text-[10px]" data-testid="scribe-simulated">{simulatedSurfaceLabel("scribe_simulated")}</Badge>
      </header>
      {!canCaptureScribe(staff.role) ? (
        <Card className="p-4 text-sm" data-testid="scribe-role-blocked">
          Your role doesn't use the AI scribe in this phase. Write the note in the chart.
          {SCRIBE_PHASE2_ROLES.includes(staff.role) && " Scribe for this role is a Phase 2 decision."}
        </Card>
      ) : (
        <ScribeWorkspace patientId={patientId} appointmentId={appt} />
      )}
      {real && (real.gaps.length > 0 || real.rescreens.length > 0) && (
        <Card className="space-y-2 p-4 text-sm" data-testid="scribe-chart-insights">
          <h2 className="font-display text-base text-navy">From the chart</h2>
          {real.gaps.length > 0 && <ul className="list-disc pl-5">{real.gaps.map((g) => <li key={g}>{g}</li>)}</ul>}
          {real.rescreens.length > 0 && <p className="text-xs text-muted-foreground">Suggested questions: re-screen due — {real.rescreens.join(", ").toUpperCase()}.</p>}
        </Card>
      )}
    </div>
  );
}
