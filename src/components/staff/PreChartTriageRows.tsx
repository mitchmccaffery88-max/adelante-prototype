import { useState } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEhr } from "@/lib/ehr";
import { preChartTodayTasks, preChartTriageDetail } from "@/lib/intakeTriage";
import type { IntakeActor } from "@/lib/intakePhaseA";
import { runAction } from "@/lib/actions/runAction";
export function PreChartTriageRows({ actor }: { actor: IntakeActor }) {
  const json = useEhr(() => JSON.stringify(preChartTodayTasks(actor)));
  const rows = JSON.parse(json) as ReturnType<typeof preChartTodayTasks>;
  const [selected, setSelected] = useState(""); const [reason, setReason] = useState("");
  const detail = selected ? preChartTriageDetail(actor, selected) : undefined;
  if (!rows.length) return null;
  return <section className="space-y-3 border-t border-line py-3" aria-label="Pre-chart clinical triage"><h2 className="text-lg font-bold">Clinical triage — source follow-up</h2>{rows.map(r => <div key={r.id} className="flex flex-wrap items-center justify-between gap-2"><span>{r.title} · {r.sourceId} · {r.ownerName} · {r.status}</span><Button variant="outline" onClick={() => setSelected(r.id)}>Review triage source</Button></div>)}{detail && <div className="space-y-2">{"restricted" in detail ? <p className="flex gap-2"><Lock className="size-4" />{detail.reason}</p> : <><p>{detail.source.field} · {detail.source.trigger} · {detail.tier}</p><p>{detail.source.text ?? "Structured safety flag; no narrative supplied."}</p></>}<label>Reason — Required<Input value={reason} onChange={e => setReason(e.target.value)} /></label><Button variant="outline" disabled={reason.trim().length < 3} onClick={() => { const r = runAction("prechart_triage_acknowledge", actor, undefined, { args: [actor, selected, reason] }); if (!r.ok) toast.error(r.reason); else toast.success("Triage acknowledged"); }}>Acknowledge triage</Button></div>}</section>;
}