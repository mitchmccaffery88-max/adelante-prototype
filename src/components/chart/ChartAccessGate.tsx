import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Lock, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { chartEntryFor, patientSiteName, reasonGrantFor, ACCESS_MODEL_DRAFT_LABEL } from "@/lib/chartAccess";
import { OPEN_REASONS, type OpenReason } from "@/lib/chartAccessRules";
import { runAction } from "@/lib/actions/runAction";
import { safeLandingFor } from "@/lib/navGuard";

/** Do not mount children until entry passes: no clinical reads behind the gate. */
export function ChartAccessGate({ patientId, children }: { patientId: string; children: ReactNode }) {
  const { role, staffId, staffName } = useActingStaff();
  const navigate = useNavigate();
  const [, tick] = useState(0);
  const entryKey = useEhr(() => JSON.stringify(chartEntryFor(role, staffId, patientId)));
  const entry = JSON.parse(entryKey) as ReturnType<typeof chartEntryFor>;
  const [reason, setReason] = useState<OpenReason>("covering_consult");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [requested, setRequested] = useState(false);
  const grant = reasonGrantFor(role, staffId, patientId);
  useEffect(() => {
    if (!grant) return;
    const timer = window.setTimeout(() => tick(v => v + 1), Math.max(1, Date.parse(grant.expiresAt) - Date.now()));
    return () => window.clearTimeout(timer);
  }, [grant?.id, grant?.expiresAt]);
  // Re-evaluate after the expiry timer even when the store has not emitted.
  const current = chartEntryFor(role, staffId, patientId);
  if (entry.ok && current.ok) return <>{grant && <div role="status" className="border-b border-line bg-surface-sunk px-4 py-2 text-sm" data-testid="reason-open-banner"><Lock className="mr-2 inline size-4" />Opened with a reason: {OPEN_REASONS[grant.reasonCode]} · until end of day</div>}{children}</>;
  if (!current.ok && !current.entryEligible) return <section className="mx-auto max-w-xl space-y-4 px-4 py-10"><h1 className="text-2xl font-bold">Chart not available</h1><p>{current.message}</p><Button variant="outline" onClick={() => navigate({ to: safeLandingFor(role) })}>Cancel</Button></section>;
  const p = AdelanteEHR.getPatient(patientId);
  if (!p) return <p className="px-4 py-10">Client not found.</p>;
  const restricted = !current.ok && current.reason === "restricted";
  const submit = () => {
    if (!staffId) return;
    if (restricted) {
      const r = runAction("chart_restricted_open", { role, staffId, staffName }, p, { args: [{ patientId, reason: note, actor: { staffId, name: staffName, role } }] });
      if (!r.ok) { setError(r.reason); return; }
    }
    const r = runAction("chart_reason_open", { role, staffId, staffName }, p, { args: [{ patientId, reasonCode: reason, note, actor: { role, staffId } }] });
    if (!r.ok) setError(r.reason);
  };
  return <section className="mx-auto max-w-xl space-y-5 px-4 py-10" data-testid="chart-access-gate">
    <header className="border-b border-line pb-4"><h1 className="text-2xl font-bold">{p.firstName} {p.lastName}</h1><p className="text-ink-muted">DOB {p.dob} · {patientSiteName(p)}</p></header>
    <h2 className="flex items-start gap-2 text-xl font-bold"><Lock className="mt-1 size-5 shrink-0" />{restricted ? "Restricted record" : `You're not on ${p.firstName}'s care team.`}</h2>
    {restricted && <p>Opening this restricted record is logged and reviewed by compliance. A detailed reason is required.</p>}
    <fieldset className="space-y-2"><legend className="mb-2 font-bold">Reason for opening</legend>{Object.entries(OPEN_REASONS).map(([code, label]) => <label key={code} className="flex min-h-9 items-center gap-3"><input type="radio" name="chart-open-reason" value={code} checked={reason === code} onChange={() => setReason(code as OpenReason)} />{label}</label>)}</fieldset>
    <label className="block space-y-2"><span>Note{reason === "other" || restricted ? " — Required" : " — Optional"}</span><Textarea aria-label="Opening note" value={note} onChange={e => setNote(e.target.value)} /></label>
    {error && <p role="alert" className="text-attention"><CircleAlert className="mr-2 inline size-4" />{error}</p>}
    <div className="flex flex-wrap gap-3"><Button disabled={(reason === "other" || restricted) && !note.trim()} onClick={submit}>Open chart</Button><Button variant="outline" onClick={() => navigate({ to: safeLandingFor(role) })}>Cancel</Button></div>
    <Button variant="ghost" disabled={requested} className="h-auto whitespace-normal" onClick={() => {
      const r = runAction("chart_team_request", { role, staffId }, p, { args: [{ patientId, actor: { role, staffId } }] });
      if (r.ok) setRequested(true); else setError(r.reason);
    }}>{requested ? "Requested — with the clinical coordinator" : "Ask to be added to the care team"}</Button>
    <p className="text-sm text-ink-muted">{ACCESS_MODEL_DRAFT_LABEL} · Simulated access log</p>
  </section>;
}