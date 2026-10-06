// §Scribe Phase 1 — the old sample-only dictation screen is retired. Post-visit
// dictation is not built; this page points to the working AI scribe and the
// chart's note form instead of showing scripted sample output.
import { createFileRoute, Link } from "@tanstack/react-router";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/agentic/dictation/$patientId")({
  head: () => ({
    meta: [
      { title: "Dictation (not yet available) — Adelante" },
      { name: "description", content: "Post-visit dictation isn't built yet. Use the AI scribe or write the note in the chart." },
      { property: "og:title", content: "Dictation (not yet available) — Adelante" },
      { property: "og:description", content: "Use the consent-gated AI scribe or the chart's note form." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DictationRetired,
});

function DictationRetired() {
  const { patientId } = Route.useParams();
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  if (!patient) return <div className="mx-auto max-w-3xl px-4 py-10"><EmptyState title="Client not found" description="This record is not available." /></div>;
  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-6">
      <Button asChild variant="ghost" size="sm"><Link to="/record/$patientId" params={{ patientId }}><ArrowLeft className="mr-1.5 h-4 w-4" /> Back to chart</Link></Button>
      <Card className="space-y-3 p-4" data-testid="dictation-retired">
        <h1 className="font-display text-xl text-navy">Dictation isn't available yet</h1>
        <p className="text-sm text-muted-foreground">The old sample screen was removed. Post-visit dictation is a later phase.</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm"><Link to="/agentic/scribe/$patientId" params={{ patientId }} search={{}}>Start AI scribe</Link></Button>
          <Button asChild size="sm" variant="outline"><Link to="/record/$patientId" params={{ patientId }} search={{ section: "notes" } as never}>Write the note</Link></Button>
        </div>
      </Card>
    </div>
  );
}
