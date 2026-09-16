// §Agentic Roadmap prototype — 2. Scribe Copilot (live encounter).
//
// Layout language follows the Xaia live-encounter reference: parallel panels
// (red flags, chart insights, differential, suggested questions,
// recommendations) beside a running transcript. EVERY panel is sample content.
// Nothing is recorded, transcribed, or sent anywhere.
import { createFileRoute, Link } from "@tanstack/react-router";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { sampleScribePanels } from "@/lib/agenticPrototype";
import {
  PrototypeBanner,
  PrototypePanel,
  RecordingConsentBanner,
  SampleBadge,
} from "@/components/agentic/PrototypeChrome";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  ArrowLeft,
  Brain,
  FileSearch,
  HelpCircle,
  ListChecks,
  Mic,
  Radio,
} from "lucide-react";

export const Route = createFileRoute("/agentic/scribe/$patientId")({
  head: () => ({
    meta: [
      { title: "Scribe copilot (prototype) — Adelante" },
      {
        name: "description",
        content:
          "Walkthrough prototype of a live-encounter scribe copilot: red flags, chart insights, differential, suggested questions and transcript panels, all sample content.",
      },
      { property: "og:title", content: "Scribe copilot (prototype) — Adelante" },
      {
        property: "og:description",
        content:
          "Live-encounter copilot layout with a visible recording-consent precondition. Not connected to a live AI model and nothing is recorded.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ScribeCopilot,
});

function ScribeCopilot() {
  const { patientId } = Route.useParams();
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  if (!patient) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <EmptyState title="Client not found" description="This record is not available." />
      </div>
    );
  }
  const name = `${patient.firstName} ${patient.lastName}`;
  const panels = sampleScribePanels(patient.firstName);

  const list = (items: string[]) => (
    <ul className="space-y-1.5 text-sm">
      {items.map((i) => (
        <li key={i} className="flex gap-2">
          <span className="text-muted-foreground">•</span>
          <span>{i}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="mb-2">
        <Link to="/record/$patientId" params={{ patientId }}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to chart
        </Link>
      </Button>

      <PrototypeBanner detail="Every panel below is hand-written sample content. No audio is captured, no transcription runs, and no note is written to this chart." />

      <RecordingConsentBanner patientName={name} />

      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-teal">
            Agentic roadmap · live encounter
          </div>
          <h1 className="mt-1 font-display text-2xl text-navy sm:text-3xl">
            Scribe copilot — {name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ambient support during the visit: the clinician talks to the patient, not to
            the software.
          </p>
        </div>
        <Badge className="border-0 bg-destructive/15 text-destructive">
          <Radio className="mr-1.5 h-3.5 w-3.5" /> Simulated live session
        </Badge>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid gap-4 md:grid-cols-2">
          <PrototypePanel
            title="Red flags"
            icon={AlertTriangle}
            tone="alert"
            badge={<SampleBadge />}
          >
            {list(panels.redFlags)}
          </PrototypePanel>
          <PrototypePanel title="Clinical insights from chart" icon={FileSearch} badge={<SampleBadge />}>
            {list(panels.chartInsights)}
          </PrototypePanel>
          <PrototypePanel title="Differential" icon={Brain} badge={<SampleBadge />}>
            {list(panels.differential)}
          </PrototypePanel>
          <PrototypePanel title="Suggested questions" icon={HelpCircle} badge={<SampleBadge />}>
            {list(panels.suggestedQuestions)}
          </PrototypePanel>
          <PrototypePanel
            title="Recommendations"
            icon={ListChecks}
            badge={<SampleBadge />}
          >
            {list(panels.recommendations)}
            <p className="mt-3 text-xs text-muted-foreground">
              A real build would let the clinician accept or dismiss each item. Nothing here
              writes to the chart.
            </p>
          </PrototypePanel>
        </div>

        <PrototypePanel title="Live transcript" icon={Mic} badge={<SampleBadge label="Scripted sample" />}>
          <div className="space-y-3 text-sm">
            {panels.transcript.map((line, i) => (
              <div key={i}>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {line.speaker}
                </div>
                <p className="text-foreground">{line.text}</p>
              </div>
            ))}
            <p className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
              Scripted excerpt. The prototype has no microphone access and performs no
              speech recognition.
            </p>
          </div>
        </PrototypePanel>
      </div>
    </div>
  );
}
