// §Crisis escalation queue — cross-patient list of OPEN escalations.
//
// This page is the entire notification story for crisis escalation: there is
// no paging, SMS, email, or push. If nobody opens this queue, nobody is told.
// Sorted oldest-open first, because the longest-open escalation is the most
// urgent thing on the screen.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AdelanteEHR, useEhr, type CrisisEscalation } from "@/lib/ehr";
import { canAccess, useActingStaff } from "@/lib/roles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ClientDate } from "@/components/ClientDate";
import { EmptyState } from "@/components/EmptyState";
import { ResolveCrisisDialog, timeOpenLabel } from "@/components/clinical/CrisisPanel";
import { ArrowLeft, Lock, Siren } from "lucide-react";

export const Route = createFileRoute("/crisis-queue")({
  head: () => ({
    meta: [
      { title: "Crisis queue — Adelante" },
      {
        name: "description",
        content:
          "Cross-patient queue of open crisis escalations, oldest-open first, with disposition-required resolution.",
      },
      { property: "og:title", content: "Crisis queue — Adelante" },
      {
        property: "og:description",
        content: "Track and resolve open crisis escalations across the population.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CrisisQueuePage,
});

function CrisisQueuePage() {
  const { role } = useActingStaff();
  const access = canAccess(role, "crisis_queue");
  const rows = useEhr(() => AdelanteEHR.listOpenCrisisEscalations());
  const [resolving, setResolving] = useState<{
    patientId: string;
    escalation: CrisisEscalation;
  } | null>(null);

  return (
    <div className="mx-auto max-w-5xl p-4 space-y-4">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link to="/clinician">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>
      </Button>
      <header>
        <h1 className="font-display text-2xl text-navy flex items-center gap-2">
          <Siren className="h-5 w-5 text-destructive" /> Crisis queue
        </h1>
        <p className="text-sm text-muted-foreground">
          Open escalations across the population, longest-open first. This queue is the only
          notification — there is no paging, SMS, or email.
        </p>
      </header>

      {access.locked ? (
        <Card className="p-6 text-sm text-muted-foreground flex items-center gap-2">
          <Lock className="h-4 w-4" />
          Your role does not have access to the cross-patient crisis queue.
        </Card>
      ) : rows.length === 0 ? (
        <EmptyState icon={Siren} title="No open crisis escalations" />
      ) : (
        <ul className="space-y-2">
          {rows.map(({ patient, escalation }) => (
            <Card key={escalation.id} className="p-3 text-xs space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  to="/record/$patientId"
                  params={{ patientId: patient.id }}
                  search={{ section: "alerts" }}
                  className="font-display text-base text-navy underline-offset-2 hover:underline"
                >
                  {patient.firstName} {patient.lastName}
                </Link>
                <Badge className="bg-destructive/15 text-destructive border-0 text-[10px]">
                  {timeOpenLabel(escalation.triggeredAt)}
                </Badge>
              </div>
              <p className="text-navy">{escalation.triggerDetail}</p>
              <p className="text-muted-foreground">
                <span className="capitalize">{escalation.triggerSource.replace("_", " ")}</span> ·
                flagged by {escalation.triggeredBy} ·{" "}
                <ClientDate value={escalation.triggeredAt} />
              </p>
              {access.level === "write" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setResolving({ patientId: patient.id, escalation })}
                >
                  Resolve
                </Button>
              )}
            </Card>
          ))}
        </ul>
      )}

      <ResolveCrisisDialog
        patientId={resolving?.patientId ?? ""}
        escalation={resolving?.escalation ?? null}
        onClose={() => setResolving(null)}
      />
    </div>
  );
}
