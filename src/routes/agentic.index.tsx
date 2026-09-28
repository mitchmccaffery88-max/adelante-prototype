// §Agentic guide — home for the prototype demos that used to sit in the chart
// header. None of them write to the record.
import { createFileRoute, Link } from "@tanstack/react-router";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PrototypeBanner } from "@/components/agentic/PrototypeChrome";
import { ArrowLeft, FlaskConical } from "lucide-react";

interface GuideSearch {
  patientId?: string;
}

export const Route = createFileRoute("/agentic/")({
  validateSearch: (s: Record<string, unknown>): GuideSearch => ({
    patientId: typeof s.patientId === "string" ? s.patientId : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Agentic guide (prototype) — Adelante staff" },
      {
        name: "description",
        content: "Prototype walkthroughs: guided chart review, scribe copilot and smart dictation.",
      },
      { property: "og:title", content: "Agentic guide (prototype) — Adelante staff" },
      {
        property: "og:description",
        content: "Staff demo walkthroughs of Adel-assisted chart work. Nothing here writes to a record.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AgenticGuidePage,
});

const DEMOS = [
  { to: "/agentic/chart-review/$patientId", label: "Guided chart review" },
  { to: "/agentic/scribe/$patientId", label: "Scribe copilot" },
  { to: "/agentic/dictation/$patientId", label: "Smart dictation" },
] as const;

function AgenticGuidePage() {
  const { patientId } = Route.useSearch();
  const patients = useEhr(() => AdelanteEHR.listPatients());
  const selected = patientId ? patients.find((p) => p.id === patientId) : undefined;
  const list = selected ? [selected] : patients.slice(0, 12);

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      {selected && (
        <Link
          to="/record/$patientId"
          params={{ patientId: selected.id }}
          className="inline-flex items-center gap-1 text-xs text-teal"
        >
          <ArrowLeft className="h-3 w-3" /> Back to chart
        </Link>
      )}
      <h1 className="font-display text-2xl text-navy">Agentic guide</h1>
      <PrototypeBanner />
      {list.map((p) => (
        <Card key={p.id} className="space-y-2 p-4">
          <p className="font-medium text-navy">
            {p.firstName} {p.lastName}
          </p>
          <div className="flex flex-wrap gap-2">
            {DEMOS.map((d) => (
              <Button key={d.to} size="sm" variant="outline" asChild>
                <Link to={d.to} params={{ patientId: p.id }}>
                  <FlaskConical className="h-3.5 w-3.5" /> {d.label}
                </Link>
              </Button>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
