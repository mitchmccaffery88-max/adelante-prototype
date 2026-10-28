import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClientDate } from "@/components/ClientDate";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { STAFF_ROSTER, useActingStaff } from "@/lib/roles";
import { careTeamRequests, weeklyReasonedOpens, onCareTeam } from "@/lib/chartAccess";
import { canManageCoverage, listCoverageAssignments } from "@/lib/chartRelationships";
import { OPEN_REASONS } from "@/lib/chartAccessRules";
import { runAction } from "@/lib/actions/runAction";

export function ChartAccessCoordination() {
  const actor = useActingStaff();
  return canManageCoverage(actor) ? <CoordinatorAccessWork /> : null;
}

function CoordinatorAccessWork() {
  const actor = useActingStaff();
  const requests = useEhr(() => careTeamRequests(actor));
  const review = useEhr(() => weeklyReasonedOpens(actor));
  const coverage = useEhr(() => listCoverageAssignments());
  const [covering, setCovering] = useState("");
  const [covered, setCovered] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const clinicians = STAFF_ROSTER.filter(s => s.active !== false && ["physician", "pmhnp", "therapist", "sud_counselor", "clinical_trainee"].includes(s.role));
  const staffName = (id: string) => STAFF_ROSTER.find(s => s.id === id)?.name ?? id;
  const patientName = (id: string) => { const p = AdelanteEHR.getPatient(id); return p ? `${p.firstName} ${p.lastName}` : id; };
  return <section className="space-y-6 border-t border-line pt-6" data-testid="chart-access-coordination">
    <header><h2 className="text-xl font-bold">Chart access review</h2><p className="text-sm text-ink-muted">Draft — pending clinical sign-off · Simulated assignments and access log</p></header>
    <section className="space-y-3">
      <h3 className="font-bold">Care-team requests · Your turn</h3>
      {!requests.length && <p className="text-ink-muted">No care-team requests.</p>}
      <ul className="divide-y divide-line">{requests.map(r => {
        const p = AdelanteEHR.getPatient(r.patientId);
        const added = !!p && onCareTeam(r.staffId, p);
        return <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><Link to="/record/$patientId" params={{ patientId: r.patientId }} search={{}} className="underline">{patientName(r.patientId)}</Link> · {staffName(r.staffId)}<div className="text-sm text-ink-muted"><ClientDate value={r.at} /></div></div><Button variant="outline" disabled={added} onClick={() => {
          const result = runAction("chart_team_assignment", actor, p, { args: [actor, { patientId: r.patientId, staffId: r.staffId, start: new Date().toISOString() }], auditReason: "care_team_request_review" });
          setMessage(result.ok ? "Simulated — care-team assignment added." : result.reason);
        }}>{added ? "On care team" : "Add to care team"}</Button></li>;
      })}</ul>
    </section>
    <section className="space-y-3">
      <h3 className="font-bold">Clinical coverage · Your turn</h3>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={e => {
        e.preventDefault();
        const result = runAction("chart_coverage_set", actor, undefined, { args: [actor, { coveringStaffId: covering, coveredStaffId: covered, start: new Date(start).toISOString(), end: new Date(end).toISOString() }], auditReason: reason });
        setMessage(result.ok ? "Simulated — clinical coverage saved." : result.reason);
        if (result.ok) { setCovering(""); setCovered(""); setStart(""); setEnd(""); setReason(""); }
      }}>
        {(["Covering clinician", "Covered clinician"] as const).map((label, i) => <label key={label} className="space-y-1"><span>{label}</span><select aria-label={label} className="block min-h-9 w-full rounded-sm border border-line-strong bg-surface px-3" value={i === 0 ? covering : covered} onChange={e => i === 0 ? setCovering(e.target.value) : setCovered(e.target.value)} required><option value="">Choose clinician</option>{clinicians.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>)}
        <label className="space-y-1"><span>Coverage starts</span><Input aria-label="Coverage starts" type="datetime-local" value={start} onChange={e => setStart(e.target.value)} required /></label>
        <label className="space-y-1"><span>Coverage ends</span><Input aria-label="Coverage ends" type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} required /></label>
        <label className="space-y-1 sm:col-span-2"><span>Coverage reason</span><Input aria-label="Coverage reason" value={reason} onChange={e => setReason(e.target.value)} required /></label>
        <div><Button type="submit" variant="outline" disabled={!covering || !covered || covering === covered || !start || !end || Date.parse(end) <= Date.parse(start) || !reason.trim()}>Save coverage</Button></div>
      </form>
      <ul className="divide-y divide-line">{coverage.map(r => <li key={r.id} className="py-3">{staffName(r.coveringStaffId)} covers {staffName(r.coveredStaffId)} · <ClientDate value={r.start} /> to <ClientDate value={r.end} /></li>)}</ul>
    </section>
    <section className="space-y-3"><h3 className="font-bold">Reasoned opens · Last 7 days · Your turn</h3>{!review.length && <p className="text-ink-muted">No reasoned opens in the last 7 days.</p>}<ul className="divide-y divide-line">{review.map(r => <li key={r.id} className="py-3"><Link to="/record/$patientId" params={{ patientId: r.patientId }} search={{}} className="underline">{patientName(r.patientId)}</Link> · {staffName(r.staffId)} · {OPEN_REASONS[r.reasonCode]}<div className="text-sm text-ink-muted"><ClientDate value={r.at} /> · Ends <ClientDate value={r.expiresAt} /></div></li>)}</ul></section>
    {message && <p role="status" className="text-ink-muted">{message}</p>}
  </section>;
}