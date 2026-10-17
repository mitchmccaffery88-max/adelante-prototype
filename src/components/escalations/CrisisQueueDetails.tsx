import { StaffTable } from "@/components/staff/StaffTable";
import { StatusChip } from "@/components/ui/status-chip";
// §Crisis escalation queue details — moved from /crisis-queue (U1), which now
// redirects to /escalations with a crisis filter. Claim/resolve/front-door
// rows and "Crises you flagged" are unchanged.
//
// This page is the entire notification story for crisis escalation: there is
// no paging, SMS, email, or push. If nobody opens this queue, nobody is told.
// Sorted oldest-open first, because the longest-open escalation is the most
// urgent thing on the screen.
import { Link } from "@tanstack/react-router";
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
import { Lock, Siren, UserX } from "lucide-react";
import { CssrsRiskBadge, CssrsStaffControl } from "@/components/screeners/CssrsStaffControl";

export function CrisisQueueDetails({ lane }: { lane?: "sdoh" | "clinical" }) {
  const { role } = useActingStaff();
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
    <div className="space-y-4" data-testid="crisis-details">
      <header className="space-y-2">
        <h2 className="font-display text-lg text-navy flex items-center gap-2">
          <Siren className={lane === "sdoh" ? "h-5 w-5 text-attention" : "h-5 w-5 text-destructive"} />{" "}
          {access.locked
            ? "Crises you flagged"
            : lane === "sdoh"
              ? "Urgent social needs"
              : "Crisis details & resolution"}
        </h2>
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
                  <Link to="/escalations" search={{ view: undefined, owner: undefined, overdue: undefined, type: tab.key === "sdoh" ? "urgent_social_need" : "crisis" }}>
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
            <StaffTable rows={anonymous} rowKey={(a)=>a.id} label="Front door crisis alerts" testId="anonymous-crises-table" defaultView="current" views={[{id:"current",label:"Current view",matches:()=>true}]}
              columns={[
                {id:"surface",label:"Surface",sortValue:(a)=>a.surface,cell:(a)=> <>Crisis language detected in {a.surface}. Unvalidated screen — clinician review required.</>},
                {id:"patterns",label:"Patterns",cell:(a)=>a.patternIds.join(", ")},
                {id:"date",label:"Received",sortValue:(a)=>a.createdAt,cell:(a)=><ClientDate value={a.createdAt} />},
                {id:"contact",label:"Contact",cell:(a)=>a.contact || "no contact details given"},
              ]}
              primaryAction={access.level === "write" ? (a)=><Button size="sm" variant="outline" onClick={()=>AdelanteEHR.acknowledgeAnonymousCrisisAlert(a.id,staffName)}>Acknowledge</Button> : undefined}
            />
          </section>
        )}
        <StaffTable rows={rows} rowKey={(r)=>r.escalation.id} label="Open crisis details" testId="crisis-resolution-table" defaultView="current" views={[{id:"current",label:"Current view",matches:()=>true}]}
          columns={[
            {id:"patient",label:"Patient",sortValue:(r)=>`${r.patient.firstName} ${r.patient.lastName}`,cell:(r)=><Link to="/record/$patientId" params={{patientId:r.patient.id}} search={{section:"alerts"}}>{r.patient.firstName} {r.patient.lastName}</Link>},
            {id:"status",label:"Status",cell:({escalation})=><><CrisisRetriggerBadge escalation={escalation} /><CrisisOverdueBadge escalation={escalation} />{!canWorkRow(escalation) && <CssrsRiskBadge risk={escalation.cssrsRisk} />}<StatusChip lang="en" state="urgent" label={timeOpenLabel(escalation.triggeredAt)} /></>},
            {id:"detail",label:"Detail",cell:({escalation})=><><CrisisClassification escalation={escalation} /><p>{escalation.triggerDetail}</p>{escalation.retriggers?.map((r,i)=><p key={i}>Further signal <ClientDate value={r.at} /> — {r.detail}</p>)}</>},
            {id:"owner",label:"Flagged by",sortValue:(r)=>r.escalation.triggeredBy,cell:({escalation})=><>{escalation.triggerSource.replace("_"," ")} · flagged by {escalation.triggeredBy} · <ClientDate value={escalation.triggeredAt} /></>},
          ]}
          primaryAction={({patient,escalation})=>canWorkRow(escalation) ? <CrisisClaimControl patientId={patient.id} escalation={escalation} /> : null}
          moreContent={({patient,escalation})=>canWorkRow(escalation) ? <div className="space-y-2 p-2"><Button size="sm" variant="outline" onClick={()=>setResolving({patientId:patient.id,escalation})}>Resolve</Button><CssrsStaffControl patientId={patient.id} risk={escalation.cssrsRisk} /></div> : null}
        />
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
        <StaffTable rows={mine} rowKey={(r)=>r.escalation.id} label="Crises you flagged" testId="my-flagged-crises-table" views={[{id:"current",label:"Current view",matches:()=>true}]} defaultView="current"
          columns={[
            {id:"patient",label:"Patient",sortValue:(r)=>`${r.patient.firstName} ${r.patient.lastName}`,cell:(r)=>`${r.patient.firstName} ${r.patient.lastName}`},
            {id:"status",label:"Status",sortValue:(r)=>r.escalation.status,cell:({escalation})=><StatusChip lang="en" state={escalation.status === "open" ? "urgent" : "done"} label={escalation.status === "open" ? "Open" : "Resolved"} />},
            {id:"date",label:"Flagged",sortValue:(r)=>r.escalation.triggeredAt,cell:({escalation})=><ClientDate value={escalation.triggeredAt} />},
            {id:"disposition",label:"Disposition",cell:({escalation})=>escalation.status === "resolved" ? <>Disposition: {escalation.disposition} — resolved by {escalation.resolvedBy}{escalation.resolvedAt && <ClientDate value={escalation.resolvedAt} />}</> : <>Still open · {timeOpenLabel(escalation.triggeredAt)}</>},
          ]}
        />
      )}
    </section>
  );
}
