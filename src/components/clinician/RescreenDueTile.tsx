// R53 part 2 — "Re-screens due" Today tile for clinician roles, plus the same
// per-instrument detail under Needs my action screener rows for other roles.
// Draft — pending clinical sign-off. Presentation only: rows come from
// `rescreenDashboardRows` (existing `screeners_sud` gate); sends run the
// existing `rescreen_send` registry action once per instrument.
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { act as runAct } from "@/lib/actions/act";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { myCaseload, screenerDueRows, type ActingIdentity } from "@/lib/myWork";
import { useActingStaff, type StaffRole } from "@/lib/roles";
import { staffPatientLabel } from "@/lib/staffPatientLabel";
import { RESCREEN_DASHBOARD_DRAFT, RESCREEN_EMPTY_TEXT, RESCREEN_RESEND_DAYS, rescreenDashboardRows, rescreenInstrumentView, sendRescreens, sendableKeys, type RescreenInstrumentView, type RescreenPatientRow } from "@/lib/rescreenDashboard";
import { StatusChip } from "@/components/ui/status-chip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const chipStatus = (s: RescreenInstrumentView["chipState"]) => (s === "requested" ? "team" : "yourturn") as const;

function useOpenTracking() {
  const navigate = useNavigate();
  return (patientId: string, key: string) =>
    navigate({ to: "/record/$patientId", params: { patientId }, search: { section: "tracking" }, hash: `instrument=${encodeURIComponent(key)}` });
}

function Trend({ i }: { i: RescreenInstrumentView }) {
  if (!i.trend) return null;
  const Icon = i.trend === "up" ? TrendingUp : i.trend === "down" ? TrendingDown : Minus;
  const words = i.trend === "up" ? `Up from ${i.previousScore}` : i.trend === "down" ? `Down from ${i.previousScore}` : `Same as previous ${i.previousScore}`;
  return <span className="inline-flex items-center gap-1 text-ink-muted" title={words}><Icon className="size-4" aria-hidden="true" /><span className="sr-only">{words}</span></span>;
}

function InstrumentChip({ i, patientName, onOpen }: { i: RescreenInstrumentView; patientName: string; onOpen: () => void }) {
  return <button type="button" className="rounded-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2" aria-label={`${i.label} for ${patientName}: ${i.chipText}. Open Tracking`} onClick={onOpen} data-testid={`rescreen-chip-${i.key}`}>
    <StatusChip state={chipStatus(i.chipState)} label={`${i.label} · ${i.chipText}`} />
  </button>;
}

function ScoreLine({ i }: { i: RescreenInstrumentView }) {
  return <p className="flex flex-wrap items-center gap-x-2 text-sm text-ink-muted" data-testid={`rescreen-score-${i.key}`}>
    <span>Last: {i.lastText ?? "No scored result"}</span><Trend i={i} />
    <span title={RESCREEN_DASHBOARD_DRAFT}>· {i.cadenceNote} (Draft)</span>
  </p>;
}

function PatientRescreenRow({ row, viewer }: { row: RescreenPatientRow; viewer: { role: StaffRole; staffId: string } }) {
  const openTracking = useOpenTracking();
  const name = staffPatientLabel(viewer, row.patientId);
  const send = (keys: string[]) => {
    try {
      const n = sendRescreens(row.patientId, keys, (id, via, pid, key) => runAct(id, via, pid, key));
      toast.success(n === 1 ? "Re-screen sent" : `${n} re-screens sent`);
    } catch (e) { toast.error((e as Error).message); }
  };
  const sendable = sendableKeys(row);
  return <li className="space-y-2 py-3" data-testid="rescreen-patient-row">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm font-medium">{name}</p>
      <Button size="sm" variant="outline" disabled={sendable.length === 0} aria-label={`Send all due re-screens to ${name}`} onClick={() => send(sendable)}>Send all due</Button>
    </div>
    <ul className="space-y-2">
      {row.instruments.map((i) => <li key={i.key} className="flex flex-wrap items-start justify-between gap-2" data-testid={`rescreen-instrument-${i.key}`}>
        <div className="min-w-0 space-y-1"><InstrumentChip i={i} patientName={name} onOpen={() => openTracking(row.patientId, i.key)} /><ScoreLine i={i} /></div>
        <Button size="sm" variant="outline" disabled={!i.sendEnabled} aria-label={i.sendEnabled ? `${i.sendLabel} ${i.label} re-screen to ${name}` : `${i.label} re-screen sent to ${name}. Send again after ${RESCREEN_RESEND_DAYS} days`} onClick={() => send([i.key])}>{i.sendLabel}</Button>
      </li>)}
    </ul>
  </li>;
}

/** The clinician Today tile. One row per caseload patient with something due. */
export function RescreenDueTile({ actor }: { actor: ActingIdentity & { role: StaffRole }; openChart?: (patientId: string) => void }) {
  const acting = useActingStaff();
  const [open, setOpen] = useState(true);
  const json = useEhr(() => JSON.stringify(rescreenDashboardRows(myCaseload(actor), { role: actor.role })));
  const rows = JSON.parse(json) as RescreenPatientRow[];
  const count = rows.reduce((n, r) => n + r.instruments.length, 0);
  return <Collapsible open={open} onOpenChange={setOpen}><Card id="workspace-tile-rescreens" className="scroll-mt-28 overflow-hidden" data-testid="workspace-tile-rescreens">
    <CollapsibleTrigger asChild><Button variant="ghost" className="h-auto w-full justify-between rounded-none p-4 text-left"><span><span className="block font-display text-lg text-navy">Re-screens due</span><span className="block text-sm font-normal text-muted-foreground">{rows.length} {rows.length === 1 ? "patient" : "patients"} · {count} {count === 1 ? "instrument" : "instruments"}</span></span><ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" /></Button></CollapsibleTrigger>
    <CollapsibleContent><div className="border-t p-3 sm:p-4">
      <p className="text-sm text-ink-muted">Cadence and resend timing: {RESCREEN_DASHBOARD_DRAFT}.</p>
      {rows.length === 0 ? <p className="py-3 text-sm text-muted-foreground" data-testid="rescreen-empty">{RESCREEN_EMPTY_TEXT}</p> : <ul className="divide-y" aria-label="Re-screens due by patient">{rows.map((r) => <PatientRescreenRow key={r.patientId} row={r} viewer={{ role: acting.role, staffId: acting.staffId }} />)}</ul>}
    </div></CollapsibleContent>
  </Card></Collapsible>;
}

/** Same row content under an existing Needs my action screener row (non-clinician roles). */
export function RescreenActionDetail({ patientId, screenerKey, viewer }: { patientId: string; screenerKey: string; viewer: { role: StaffRole; staffId: string; staffName?: string } }) {
  const openTracking = useOpenTracking();
  const json = useEhr(() => {
    const p = AdelanteEHR.getPatient(patientId);
    const due = p ? screenerDueRows([p], { role: viewer.role }).find((d) => d.screenerKey === screenerKey) : undefined;
    return p && due ? JSON.stringify(rescreenInstrumentView(p, due, Date.now())) : "";
  });
  if (!json) return null;
  const i = JSON.parse(json) as RescreenInstrumentView;
  const name = staffPatientLabel(viewer, patientId);
  return <div className="mt-1 space-y-1" data-testid={`rescreen-detail-${i.key}`}><InstrumentChip i={i} patientName={name} onOpen={() => openTracking(patientId, i.key)} /><ScoreLine i={i} /></div>;
}
