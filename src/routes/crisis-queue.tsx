// §Crisis escalation queue — cross-patient list of OPEN escalations.
//
// This page is the entire notification story for crisis escalation: there is
// no paging, SMS, email, or push. If nobody opens this queue, nobody is told.
// Sorted oldest-open first, because the longest-open escalation is the most
// urgent thing on the screen.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdelanteEHR, useEhr, type CrisisEscalation } from "@/lib/ehr";
import { canAccess, canFlagCrisis, canWorkSdohCrisisLane, useActingStaff } from "@/lib/roles";
import { CRISIS_POLICY_DRAFT_LABEL, sweepCrisisSla } from "@/lib/crisisPolicy";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ClientDate } from "@/components/ClientDate";
import { EmptyState } from "@/components/EmptyState";
import {
  CrisisClaimControl,
  CrisisClassification,
  CrisisOverdueBadge,
  CrisisRetriggerBadge,
  ResolveCrisisDialog,
  timeOpenLabel,
} from "@/components/clinical/CrisisPanel";
import { ArrowLeft, Lock, Siren, UserX } from "lucide-react";
import { CssrsRiskBadge, CssrsStaffControl } from "@/components/screeners/CssrsStaffControl";

export const Route = createFileRoute("/crisis-queue")({
  // §Crisis Redesign Phase 1 — `scope=mine` is the nav destination for
  // flag-capable roles with no cross-patient queue access. The page already
  // renders the self-scoped section from the RBAC check; the param only keeps
  // the two nav destinations distinct.
  validateSearch: (s: Record<string, unknown>) => ({
    scope: s["scope"] === "mine" ? ("mine" as const) : undefined,
    // §Crisis Redesign Phase 2 — `lane=sdoh` is the case-management view of the
    // same queue, filtered to social-need escalations.
    lane:
      s["lane"] === "sdoh"
        ? ("sdoh" as const)
        : s["lane"] === "clinical"
          ? ("clinical" as const)
          : undefined,
  }),
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
  const { lane } = Route.useSearch();
  const access = canAccess(role, "crisis_queue");
  // §Crisis Redesign Phase 2 — case management owns the SDOH lane. A role with
  // `sdoh` write and any queue access can claim and resolve SOCIAL-need rows
  // even when its clinical-queue access is read-only.
  const sdohWrite = canWorkSdohCrisisLane(role);
  const allRows = useEhr(() => AdelanteEHR.listOpenCrisisEscalations());
  const rows = lane
    ? allRows.filter((r) =>
        lane === "sdoh" ? r.escalation.category === "sdoh" : r.escalation.category !== "sdoh",
      )
    : allRows;
  const sdohCount = allRows.filter((r) => r.escalation.category === "sdoh").length;
  const anonymous = useEhr(() =>
    lane === "sdoh" ? [] : AdelanteEHR.listAnonymousCrisisAlerts(),
  );
  const { staffName } = useActingStaff();
  // Draft aging policy — sweep on mount and every minute while the queue is
  // open. The stamp is written once per escalation, so a supervisor is
  // re-notified once, not every tick.
  useEffect(() => {
    sweepCrisisSla();
    const t = setInterval(() => sweepCrisisSla(), 60_000);
    return () => clearInterval(t);
  }, []);
  const canWorkRow = (e: CrisisEscalation) =>
    access.level === "write" || (e.category === "sdoh" && sdohWrite);
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
      <header className="space-y-2">
        <h1 className="font-display text-2xl text-navy flex items-center gap-2">
          <Siren className="h-5 w-5 text-destructive" />{" "}
          {access.locked
            ? "Crises you flagged"
            : lane === "sdoh"
              ? "Urgent social needs"
              : "Crisis queue"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {access.locked
            ? "You do not have the cross-patient crisis queue. This page shows what came of the escalations you personally raised."
            : lane === "sdoh"
              ? "Social needs a staff member judged urgent enough to work as a crisis. These are routed to case management, not the on-call clinical coordinator."
              : "Open escalations across the population, longest-open first. Every new escalation also sends an out-of-band SMS to the on-call clinical coordinator number when the Twilio connection and alert numbers are configured; if they are not, this queue is still the only notification."}
        </p>
        {!access.locked && (
          <>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { key: undefined, label: `All open (${allRows.length})` },
                  {
                    key: "clinical" as const,
                    label: `Clinical (${allRows.length - sdohCount})`,
                  },
                  { key: "sdoh" as const, label: `Urgent social needs (${sdohCount})` },
                ] as const
              ).map((tab) => (
                <Button
                  key={tab.label}
                  asChild
                  size="sm"
                  variant={lane === tab.key ? "default" : "outline"}
                >
                  <Link to="/crisis-queue" search={{ scope: undefined, lane: tab.key }}>
                    {tab.label}
                  </Link>
                </Button>
              ))}
            </div>
            <p className="text-[11px] text-amber-900">{CRISIS_POLICY_DRAFT_LABEL}</p>
          </>
        )}
      </header>


      {access.locked ? (
        <>
          <Card className="p-6 text-sm text-muted-foreground flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Your role does not have access to the cross-patient crisis queue.
          </Card>
          {/* §Crisis Redesign Phase 1 — peers (and other flag-capable roles
              without queue access) could raise a flag and never learn what
              happened. This is deliberately NOT the queue: it is only the
              escalations this person personally flagged. */}
          {canFlagCrisis(role) && <MyFlaggedEscalations />}
        </>
      ) : rows.length === 0 && anonymous.length === 0 ? (
        <EmptyState icon={Siren} title="No open crisis escalations" />
      ) : (
        <>
        {anonymous.length > 0 && (
          <section className="space-y-2">
            <h2 className="flex items-center gap-1.5 font-display text-sm text-navy">
              <UserX className="h-4 w-4 text-destructive" /> Front door — no patient record
            </h2>
            <p className="text-xs text-muted-foreground">
              Crisis language from someone who is not a patient yet. There is no chart to open and
              no escalation to resolve — acknowledge once someone has picked this up.
            </p>
            <ul className="space-y-2">
              {anonymous.map((a) => (
                <Card key={a.id} className="space-y-1.5 border-destructive/40 p-3 text-xs">
                  <p className="text-navy">
                    Crisis language detected in {a.surface}. Unvalidated screen — clinician review
                    required.
                  </p>
                  <p className="text-muted-foreground">
                    Patterns: {a.patternIds.join(", ")} · <ClientDate value={a.createdAt} />
                    {a.contact ? ` · contact: ${a.contact}` : " · no contact details given"}
                  </p>
                  {access.level === "write" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => AdelanteEHR.acknowledgeAnonymousCrisisAlert(a.id, staffName)}
                    >
                      Acknowledge
                    </Button>
                  )}
                </Card>
              ))}
            </ul>
          </section>
        )}
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
                <div className="flex flex-wrap items-center gap-1.5">
                  <CrisisRetriggerBadge escalation={escalation} />
                  <CrisisOverdueBadge escalation={escalation} />
                  {!canWorkRow(escalation) && <CssrsRiskBadge risk={escalation.cssrsRisk} />}
                  <Badge className="bg-destructive/15 text-destructive border-0 text-[10px]">
                    {timeOpenLabel(escalation.triggeredAt)}
                  </Badge>
                </div>
              </div>
              <CrisisClassification escalation={escalation} />
              <p className="text-navy">{escalation.triggerDetail}</p>
              <p className="text-muted-foreground">
                <span className="capitalize">{escalation.triggerSource.replace("_", " ")}</span> ·
                flagged by {escalation.triggeredBy} ·{" "}
                <ClientDate value={escalation.triggeredAt} />
              </p>
              {(escalation.retriggers?.length ?? 0) > 0 && (
                <ul className="space-y-0.5 border-l-2 border-destructive/40 pl-2 text-muted-foreground">
                  {escalation.retriggers!.map((r, i) => (
                    <li key={i}>
                      Further signal <ClientDate value={r.at} /> — {r.detail}
                    </li>
                  ))}
                </ul>
              )}
              {canWorkRow(escalation) && (
                <div className="flex flex-wrap items-center gap-2">
                  <CrisisClaimControl patientId={patient.id} escalation={escalation} />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setResolving({ patientId: patient.id, escalation })}
                  >
                    Resolve
                  </Button>
                  <CssrsStaffControl patientId={patient.id} risk={escalation.cssrsRisk} />
                </div>
              )}
            </Card>
          ))}
        </ul>
        </>
      )}

      <ResolveCrisisDialog
        patientId={resolving?.patientId ?? ""}
        escalation={resolving?.escalation ?? null}
        onClose={() => setResolving(null)}
      />
    </div>
  );
}

/**
 * §Crisis Redesign Phase 1 — "what came of the flag I raised", scoped to the
 * acting staff member's OWN flags only. Read-only: no claim, no resolve, no
 * cross-patient list.
 */
function MyFlaggedEscalations() {
  const { staffName } = useActingStaff();
  const mine = useEhr(() => AdelanteEHR.listCrisisEscalationsFlaggedBy(staffName));

  return (
    <section className="space-y-2">
      <h2 className="font-display text-sm text-navy">Crises you flagged</h2>
      <p className="text-xs text-muted-foreground">
        Resolution status for the escalations you personally raised. This is not the cross-patient
        queue — you only see your own flags.
      </p>
      {mine.length === 0 ? (
        <EmptyState icon={Siren} title="You have not flagged any crises" />
      ) : (
        <ul className="space-y-2">
          {mine.map(({ patient, escalation }) => (
            <Card key={escalation.id} className="space-y-1.5 p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-display text-base text-navy">
                  {patient.firstName} {patient.lastName}
                </span>
                <Badge
                  className={
                    escalation.status === "open"
                      ? "bg-destructive/15 text-destructive border-0 text-[10px]"
                      : "text-[10px]"
                  }
                  variant={escalation.status === "open" ? undefined : "secondary"}
                >
                  {escalation.status === "open" ? "Open" : "Resolved"}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                Flagged <ClientDate value={escalation.triggeredAt} />
              </p>
              {escalation.status === "resolved" ? (
                <p className="text-navy">
                  Disposition: {escalation.disposition} — resolved by {escalation.resolvedBy}
                  {escalation.resolvedAt && (
                    <>
                      {" "}
                      <ClientDate value={escalation.resolvedAt} />
                    </>
                  )}
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Still open · {timeOpenLabel(escalation.triggeredAt)}
                </p>
              )}
            </Card>
          ))}
        </ul>
      )}
    </section>
  );
}
