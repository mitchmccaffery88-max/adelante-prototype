// §HIE — every surface here shows HIE_LABEL. Staff-only.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import {
  ADEL_DRAFT_LABEL,
  HIE_LABEL,
  HIE_SOURCE,
  KIND_LABEL,
  acceptHieDraft,
  decideHieMed,
  dismissHieDraft,
  hieChartView,
  hieDraftFor,
  hieStatus,
  hieUtilization,
  listHieMeds,
  runSimulatedHieSync,
  type HieEncounter,
} from "@/lib/hie";

export function HieNotice() {
  return (
    <p className="rounded-md border border-warning/50 bg-warning/10 px-2 py-1 text-[11px] font-medium text-navy" data-testid="hie-label">
      {HIE_LABEL}
    </p>
  );
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

function DraftBox({ encounter }: { encounter: HieEncounter }) {
  const actor = useActingStaff();
  const draft = useEhr(() => hieDraftFor(encounter.id));
  const [text, setText] = useState<string | null>(null);
  const [dismissing, setDismissing] = useState(false);
  const [reason, setReason] = useState("");
  if (!draft) return null;
  const who = { name: actor.staffName, role: actor.role };
  const run = (fn: () => void, msg: string) => {
    try { fn(); toast.success(msg); } catch (e) { toast.error((e as Error).message); }
  };
  if (draft.status !== "draft")
    return (
      <p className="text-[11px] text-muted-foreground">
        Follow-up {draft.status} by {draft.decidedBy}{draft.reason ? ` — ${draft.reason}` : ""}.
      </p>
    );
  return (
    <div className="space-y-2 rounded-md border border-dashed p-2" data-testid="hie-draft">
      <Badge variant="outline" className="text-[10px]">{ADEL_DRAFT_LABEL}</Badge>
      {text === null ? (
        <p className="text-xs text-navy">{draft.text}</p>
      ) : (
        <Textarea value={text} onChange={(e) => setText(e.target.value)} className="text-xs" aria-label="Edit follow-up task" />
      )}
      {dismissing && (
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for dismissing (required)" className="text-xs" />
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => run(() => acceptHieDraft(draft.id, who, text ?? undefined), "Task created")}>
          Accept — create task
        </Button>
        {text === null && (
          <Button size="sm" variant="outline" onClick={() => setText(draft.text)}>Edit</Button>
        )}
        {dismissing ? (
          <Button size="sm" variant="ghost" onClick={() => run(() => dismissHieDraft(draft.id, reason, who), "Draft dismissed")}>
            Confirm dismiss
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setDismissing(true)}>Dismiss</Button>
        )}
      </div>
    </div>
  );
}

export function OutsideRecordsPanel({ patientId }: { patientId: string }) {
  const actor = useActingStaff();
  const view = useEhr(() => hieChartView(patientId, actor.role));
  return (
    <div className="space-y-3" data-testid="outside-records">
      <HieNotice />
      {view.heldCount > 0 && (
        <Card className="p-3 text-xs text-navy">
          {view.heldCount} record{view.heldCount === 1 ? "" : "s"} held — Part 2 consent required
        </Card>
      )}
      {view.hiddenForRole && (
        <p className="text-xs text-muted-foreground">Some outside records are not shown for your role.</p>
      )}
      {view.encounters.length === 0 && (
        <Card className="p-3 text-xs text-muted-foreground">No outside encounters received.</Card>
      )}
      {view.encounters.map((e) => (
        <Card key={e.id} className="space-y-1 p-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-display text-sm text-navy">Outside encounter — {KIND_LABEL[e.kind]}</p>
            <Badge variant="outline" className="text-[10px]">Source: {HIE_SOURCE}</Badge>
          </div>
          <p><span className="text-muted-foreground">Date:</span> {fmt(e.at)}</p>
          <p><span className="text-muted-foreground">Facility:</span> {e.facility}</p>
          <p><span className="text-muted-foreground">Reason:</span> {e.reason}</p>
          {e.dischargeDiagnosis && (
            <p><span className="text-muted-foreground">Discharge diagnosis:</span> {e.dischargeDiagnosis}</p>
          )}
          {e.sud && <p className="text-muted-foreground">Received with Part 2 consent: {e.part2Consent ? "yes" : "no"}</p>}
          <DraftBox encounter={e} />
        </Card>
      ))}
    </div>
  );
}

/** Timeline strip on the chart overview. */
export function HieTimelineStrip({ patientId }: { patientId: string }) {
  const actor = useActingStaff();
  const rows = useEhr(() => hieChartView(patientId, actor.role).encounters);
  if (!rows.length) return null;
  return (
    <Card className="space-y-2 p-3 text-xs" data-testid="hie-timeline">
      <p className="font-display text-sm text-navy">Patient timeline — outside events</p>
      <HieNotice />
      <ol className="space-y-1">
        {rows.map((e) => (
          <li key={e.id}>
            <span className="text-muted-foreground">{fmt(e.at)}</span> · {KIND_LABEL[e.kind]} · {e.facility} · {HIE_SOURCE}
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function HieMedsPanel({ patientId, readOnly }: { patientId: string; readOnly?: boolean }) {
  const actor = useActingStaff();
  const rows = useEhr(() => listHieMeds(patientId));
  if (!rows.length) return null;
  const decide = (id: string, d: "accepted" | "ignored") => {
    try { decideHieMed(id, d, { name: actor.staffName, role: actor.role }); toast.success(d === "accepted" ? "Accepted for review" : "Ignored"); }
    catch (e) { toast.error((e as Error).message); }
  };
  return (
    <Card className="space-y-2 p-3 text-xs" data-testid="hie-meds">
      <p className="font-display text-sm text-navy">Outside medications</p>
      <HieNotice />
      <p className="text-muted-foreground">Nothing here changes the medication list automatically.</p>
      {rows.map((m) => (
        <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
          <div>
            <div className="text-navy">{m.name} <Badge variant="outline" className="ml-1 text-[10px]">From HIE — review</Badge></div>
            <p className="text-muted-foreground">{m.sig} · {m.prescriber}</p>
          </div>
          {m.status === "review" ? (
            !readOnly && (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => decide(m.id, "accepted")}>Accept</Button>
                <Button size="sm" variant="outline" onClick={() => decide(m.id, "ignored")}>Ignore</Button>
              </div>
            )
          ) : (
            <span className="text-muted-foreground">{m.status === "accepted" ? "Accepted" : "Ignored"} by {m.decidedBy}</span>
          )}
        </div>
      ))}
    </Card>
  );
}

export function HieStatusCard() {
  const actor = useActingStaff();
  const s = useEhr(() => hieStatus());
  return (
    <Card className="space-y-2 p-4" data-testid="hie-status">
      <p className="font-display text-base text-navy">HIE connection</p>
      <HieNotice />
      <div className="text-xs"><span className="text-muted-foreground">Status:</span> <Badge variant="outline">{s.mode}</Badge></div>
      <p className="text-xs"><span className="text-muted-foreground">Last sync:</span> {s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleString() : "never"}</p>
      <Button
        size="sm"
        onClick={() => {
          const r = runSimulatedHieSync({ name: actor.staffName, role: actor.role });
          toast.success("Simulated sync complete", { description: `${r.added} new record(s)` });
        }}
      >
        Run simulated sync
      </Button>
      <Link to="/data-exchange" className="block text-xs text-navy underline">Open Data exchange</Link>
    </Card>
  );
}

export function HieUtilizationTile() {
  const u = useEhr(() => hieUtilization());
  useEhr(() => AdelanteEHR.listPatients().length);
  return (
    <Card className="space-y-2 p-4" data-testid="hie-utilization">
      <p className="font-display text-base text-navy">Outside utilization (simulated HIE)</p>
      <HieNotice />
      <div className="grid grid-cols-3 gap-2 text-center">
        <div><p className="text-2xl text-navy">{u.edVisits}</p><p className="text-[11px] text-muted-foreground">ED visits, 30 days</p></div>
        <div><p className="text-2xl text-navy">{u.admissions}</p><p className="text-[11px] text-muted-foreground">Admissions, 30 days</p></div>
        <div><p className="text-2xl text-navy">{u.followUpPct === null ? "—" : `${u.followUpPct}%`}</p><p className="text-[11px] text-muted-foreground">Follow-up within 48 h</p></div>
      </div>
      <p className="text-[11px] text-muted-foreground">De-identified counts; outside SUD records are never counted.</p>
      {u.belowMinimumCohort && (
        <p className="rounded-md border border-warning/50 bg-warning/10 p-2 text-[11px] text-navy">
          Cohort of {u.cohortSize} is below the {u.minimumCohortSize}-patient minimum for safe small-cell reporting. Shown for the demo; before production these must be suppressed.
        </p>
      )}
    </Card>
  );
}
