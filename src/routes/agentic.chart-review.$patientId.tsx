// §Agentic Roadmap prototype — 1. Guided Chart Review (pre-visit).
//
// The FACTS on this page are read live out of the existing patient record.
// Only the synthesis narrative is illustrative, and it says so.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEhr } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { chartReviewFacts, sampleNarrative } from "@/lib/agenticPrototype";
import {
  PrototypeBanner,
  PrototypePanel,
  RealDataBadge,
  SampleBadge,
} from "@/components/agentic/PrototypeChrome";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClientDate } from "@/components/ClientDate";
import {
  AlertTriangle,
  ArrowLeft,
  ClipboardCheck,
  FileText,
  Mic,
  Pill,
  Sparkles,
  Stethoscope,
  TrendingUp,
} from "lucide-react";

export const Route = createFileRoute("/agentic/chart-review/$patientId")({
  head: () => ({
    meta: [
      { title: "Guided chart review (prototype) — Adelante" },
      {
        name: "description",
        content:
          "Prototype pre-visit chart review: real chart facts from the patient record alongside an illustrative synthesis narrative and flagged care gaps.",
      },
      { property: "og:title", content: "Guided chart review (prototype) — Adelante" },
      {
        property: "og:description",
        content:
          "Walkthrough prototype of a pre-visit summary built on the existing patient record. Not connected to a live AI model.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GuidedChartReview,
});

function GuidedChartReview() {
  const { patientId } = Route.useParams();
  const { role } = useActingStaff();
  const facts = useEhr(() => chartReviewFacts(patientId, role));

  if (!facts) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <EmptyState title="Client not found" description="This record is not available." />
      </div>
    );
  }
  const p = facts.patient;
  const name = `${p.firstName} ${p.lastName}`;

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="mb-2">
        <Link to="/record/$patientId" params={{ patientId }}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to chart
        </Link>
      </Button>

      <PrototypeBanner detail="The chart facts below are read from this patient's real record. The synthesis narrative is illustrative sample text written for the walkthrough — no model produced it." />

      <header className="mb-5">
        <div className="text-xs font-medium uppercase tracking-wider text-teal">
          Agentic roadmap · pre-visit
        </div>
        <h1 className="mt-1 font-display text-2xl text-navy sm:text-3xl">
          Guided chart review — {name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {facts.nextAppointment ? (
            <>
              Next visit <ClientDate value={facts.nextAppointment.start} /> ·{" "}
              {facts.nextAppointment.serviceType?.replace(/_/g, " ") ?? "visit"}
            </>
          ) : (
            "No upcoming visit currently scheduled."
          )}
          {" · "}Episode day {p.episodeDay}/90
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to="/agentic/scribe/$patientId" params={{ patientId }}>
              <Stethoscope className="mr-1.5 h-4 w-4" /> Scribe copilot
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/agentic/dictation/$patientId" params={{ patientId }}>
              <Mic className="mr-1.5 h-4 w-4" /> Smart dictation
            </Link>
          </Button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <PrototypePanel
            title="Pre-visit synthesis"
            icon={Sparkles}
            badge={<SampleBadge label="Sample narrative — illustrative only" />}
          >
            <div className="space-y-2 text-sm leading-relaxed text-foreground">
              {sampleNarrative(p.firstName).map((para) => (
                <p key={para.slice(0, 24)}>{para}</p>
              ))}
            </div>
            <p className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] leading-snug text-amber-900 dark:text-amber-200">
              This paragraph was written by hand for the demo. A real implementation would
              generate it from the chart; nothing here reflects an actual reading of this
              patient's record.
            </p>
          </PrototypePanel>

          <PrototypePanel
            title="Care gaps flagged"
            icon={AlertTriangle}
            tone={facts.careGaps.length > 0 ? "alert" : "default"}
            badge={<RealDataBadge label="Derived from this chart" />}
          >
            {facts.careGaps.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No gaps derived from the current record.
              </p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {facts.careGaps.map((g) => (
                  <li key={g} className="flex gap-2">
                    <span className="text-destructive">•</span>
                    <span>{g}</span>
                  </li>
                ))}
              </ul>
            )}
          </PrototypePanel>

          <PrototypePanel
            title="Recent notes"
            icon={FileText}
            badge={<RealDataBadge />}
          >
            {facts.recentNotes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No progress notes on file.</p>
            ) : (
              <ul className="space-y-3">
                {facts.recentNotes.map((n) => (
                  <li key={n.id} className="rounded-md border p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <ClientDate value={n.date} />
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {n.sessionType.replace("_", " ")}
                      </Badge>
                    </div>
                    <p className="mt-1 line-clamp-3 text-foreground">
                      {n.assessment || n.subjective || n.plan || "—"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </PrototypePanel>
        </div>

        <div className="space-y-4">
          <PrototypePanel title="Medications" icon={Pill} badge={<RealDataBadge />}>
            {facts.activeOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active orders.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {facts.activeOrders.map((o) => (
                  <li key={o.id}>
                    <span className="text-foreground">{o.productName ?? o.drugName}</span>
                    <span className="text-muted-foreground">
                      {o.dose ? ` · ${o.dose}` : ""}
                      {o.frequency ? ` · ${o.frequency}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Last 14 days charted: {facts.dosesGiven} given · {facts.dosesRefusedOrHeld}{" "}
              refused or held.
            </p>
          </PrototypePanel>

          <PrototypePanel title="Screening history" icon={TrendingUp} badge={<RealDataBadge />}>
            {facts.visibleScreeners.length === 0 ? (
              <p className="text-sm text-muted-foreground">No screener results visible.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {facts.visibleScreeners.slice(0, 5).map((s, i) => (
                  <li key={`${s.key}-${s.completedAt}-${i}`} className="flex justify-between gap-2">
                    <span className="uppercase text-muted-foreground">{s.key}</span>
                    <span className="tabular-nums">
                      {s.score} · {s.severity}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {facts.hiddenScreenerCount > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {facts.hiddenScreenerCount} substance-use result
                {facts.hiddenScreenerCount === 1 ? "" : "s"} hidden — 42 CFR Part 2 consent
                required for your role.
              </p>
            )}
          </PrototypePanel>

          <PrototypePanel title="Plan & open work" icon={ClipboardCheck} badge={<RealDataBadge />}>
            <ul className="space-y-1.5 text-sm">
              <li className="flex justify-between">
                <span className="text-muted-foreground">Goals done</span>
                <span className="tabular-nums">
                  {facts.doneGoals}/{facts.doneGoals + facts.openGoals}
                </span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">Open tasks</span>
                <span className="tabular-nums">{facts.openTasks}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">Open referrals</span>
                <span className="tabular-nums">{facts.openReferrals}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">Open social-needs items</span>
                <span className="tabular-nums">{facts.openSdoh}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted-foreground">Active alerts</span>
                <span className="tabular-nums">{facts.activeAlerts.length}</span>
              </li>
            </ul>
            <Button asChild size="sm" variant="outline" className="mt-3 w-full">
              <Link to="/record/$patientId" params={{ patientId }} search={{ section: "care-plan" }}>
                Open the real care plan
              </Link>
            </Button>
          </PrototypePanel>
        </div>
      </div>
    </div>
  );
}
