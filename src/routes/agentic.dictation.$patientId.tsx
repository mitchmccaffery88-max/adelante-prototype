// §Agentic Roadmap prototype — 3. Smart Dictation (post-encounter).
//
// Deliberately NOT the live scribe: the patient has left, nothing is captured
// during a visit, and there is NO recording-consent banner on this screen —
// its counterpart notice says plainly why. Sample content throughout.
import { createFileRoute, Link } from "@tanstack/react-router";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { sampleDictation } from "@/lib/agenticPrototype";
import {
  PostEncounterNotice,
  PrototypeBanner,
  PrototypePanel,
  SampleBadge,
} from "@/components/agentic/PrototypeChrome";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle2, FileText, Mic, Stethoscope } from "lucide-react";

export const Route = createFileRoute("/agentic/dictation/$patientId")({
  head: () => ({
    meta: [
      { title: "Smart dictation (prototype) — Adelante" },
      {
        name: "description",
        content:
          "Walkthrough prototype of post-encounter clinician dictation turning into a polished, chart-aware progress note. Sample content, no live model.",
      },
      { property: "og:title", content: "Smart dictation (prototype) — Adelante" },
      {
        property: "og:description",
        content:
          "Post-visit dictation prototype — no patient recording, no live-visit consent burden, nothing written to the chart.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SmartDictation,
});

function SmartDictation() {
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
  const sample = sampleDictation(patient.firstName);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="mb-2">
        <Link to="/record/$patientId" params={{ patientId }}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to chart
        </Link>
      </Button>

      <PrototypeBanner detail="The dictation and the finished note below are both hand-written samples. No speech recognition runs, no note is generated, and nothing is saved to this chart." />

      <PostEncounterNotice />

      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-teal">
            Agentic roadmap · after the visit
          </div>
          <h1 className="mt-1 font-display text-2xl text-navy sm:text-3xl">
            Smart dictation — {name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The simpler sibling of the live scribe: one clinician, one recap, no patient in
            the room.
          </p>
        </div>
        <Badge variant="outline" className="text-muted-foreground">
          Encounter ended · documentation stage
        </Badge>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <PrototypePanel
          title="Clinician dictation"
          icon={Mic}
          badge={<SampleBadge label="Scripted sample" />}
        >
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
            {sample.spoken}
          </p>
          <p className="mt-3 rounded-md border border-dashed p-2 text-xs text-muted-foreground">
            Shown as text because nothing is recorded. A real build would capture the
            clinician's own voice after the visit — never the patient's.
          </p>
        </PrototypePanel>

        <PrototypePanel
          title="Chart-aware note"
          icon={FileText}
          badge={<SampleBadge label="Sample output" />}
        >
          <dl className="space-y-3 text-sm">
            {(
              [
                ["Subjective", sample.note.subjective],
                ["Objective", sample.note.objective],
                ["Assessment", sample.note.assessment],
                ["Plan", sample.note.plan],
              ] as const
            ).map(([label, body]) => (
              <div key={label}>
                <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {label}
                </dt>
                <dd className="mt-0.5 whitespace-pre-line text-foreground">{body}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] leading-snug text-amber-900 dark:text-amber-200">
            Illustrative output only. It is not saved, not signed, and does not appear in
            this patient's real notes. No billing or diagnosis codes are produced anywhere
            in this prototype.
          </div>
        </PrototypePanel>
      </div>

      <div className="mt-4">
      <PrototypePanel
        title="What 'chart-aware' would mean"
        icon={CheckCircle2}
        badge={<SampleBadge label="Illustrative claims" />}
      >
        <ul className="space-y-1.5 text-sm">
          {sample.chartAwareness.map((c) => (
            <li key={c} className="flex gap-2">
              <span className="text-muted-foreground">•</span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </PrototypePanel>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline">
          <Link to="/agentic/scribe/$patientId" params={{ patientId }}>
            <Stethoscope className="mr-1.5 h-4 w-4" /> Compare with scribe copilot
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/record/$patientId" params={{ patientId }} search={{ section: "notes" }}>
            Open the real notes section
          </Link>
        </Button>
      </div>
    </div>
  );
}
