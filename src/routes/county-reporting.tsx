import { STAFF_ROLES } from "@/lib/roles";
// §Batch D — County reporting hub (prototype; nothing is submitted anywhere).
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { useEhr } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { act } from "@/lib/actions/act";
import {
  BHOATR_DOLLARS_NOTE,
  bhoatrRollup,
  calomsBlockerRows,
  canViewCountyReporting,
  CARD_STATUS_LABEL,
  COUNTY_DRAFT_LABEL,
  COUNTY_PROTOTYPE_LABEL,
  COUNTY_INTERIM_PREPARER_ROLE,
  COUNTY_INTERIM_PREPARER_LABEL,
  COUNTY_SIMULATED_LABEL,
  datarCounts,
  ISL_DEADLINE_NOTE,
  ISL_PRIVATE_PAY_NOTE,
  listCountyErrors,
  listSubmissions,
  rangeForPeriod,
  reportCards,
  reportingMonthFor,
  seesClientLevel,
  TPS_ADMIN_ROLES,
  tpsCounts,
  tpsList,
  tpsWindow,
  type CountyReportId,
} from "@/lib/countyReporting";
import { DEFAULT_PERIOD, REPORTING_PERIODS, periodLabel, type ReportingPeriodKey } from "@/lib/reportingPeriods";
import { MIN_COHORT_SIZE } from "@/lib/cohortGuard";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/county-reporting")({
  head: () => ({
    meta: [
      { title: "County reporting — Adelante" },
      { name: "description", content: "Prototype county reporting hub: CalOMS, DATAR, ISL, BHOATR and Treatment Perception Survey." },
      { property: "og:title", content: "County reporting — Adelante" },
      { property: "og:description", content: "Due dates, blockers and one next action for every county report." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CountyReportingPage,
});

const cell = (v: number | null) => (v === null ? <span title={`Suppressed — fewer than ${MIN_COHORT_SIZE}`}>{`<${MIN_COHORT_SIZE}`}</span> : v);

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function CountyReportingPage() {
  const me = useActingStaff();
  const [period, setPeriod] = useState<ReportingPeriodKey>(DEFAULT_PERIOD as ReportingPeriodKey);
  const actor = { staffId: me.staffId, name: me.staffName, role: me.role };
  const cards = useEhr(() => reportCards(me.role));
  const subs = useEhr(() => listSubmissions());
  const errs = useEhr(() => listCountyErrors(me.role));
  const blockers = useEhr(() => calomsBlockerRows(me.role));
  const datar = useEhr(() => datarCounts(reportingMonthFor(new Date()).range));
  const bhoatr = useEhr(() => bhoatrRollup(rangeForPeriod(period)));
  const tpsC = useEhr(() => tpsCounts());
  const tpsRows = useEhr(() => tpsList(me.role));
  const win = useEhr(() => tpsWindow());
  const [winForm, setWinForm] = useState({ start: win?.start ?? "", end: win?.end ?? "" });
  if (!canViewCountyReporting(me.role))
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Card className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Lock className="h-4 w-4" /> Your role can&apos;t view county reporting.</Card>
      </div>
    );
  const client = seesClientLevel(me.role);
  const run = (id: string, via: string, ...args: unknown[]) => {
    try {
      act(id, via, actor, ...args);
      toast.success(id === "county_submit" || id === "county_resend" ? "Simulated — marked submitted. Nothing was sent." : "Done.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const latest = (r: CountyReportId) => subs.find((s) => s.report === r);
  const cardAction = (r: CountyReportId) => {
    const s = latest(r);
    const errOpen = errs.some((e) => e.report === r && e.status === "open");
    if (s?.status === "submitted" && !errOpen) return <Button size="sm" variant="outline" onClick={() => run("county_simulate_response", "simulateCountyResponse", s.id)}>Simulate county response</Button>;
    if (s?.status === "ready") return <Button size="sm" onClick={() => run("county_submit", "submitReport", s.id)}>Submit (Simulated)</Button>;
    if (s && errOpen) return <a href="#county-errors" className="text-xs text-teal underline">Open error queue</a>;
    if (r === "caloms" && !client) return null;
    return <Button size="sm" variant="outline" onClick={() => run("county_generate", "generateReport", r, period)}>Generate draft</Button>;
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6" data-testid="county-reporting">
      <header className="space-y-1">
        <h1 className="font-display text-2xl text-navy">County reporting</h1>
        <p className="text-sm text-muted-foreground">Tulare DMC-ODS · Premier Visalia</p>
        <div className="flex flex-wrap gap-2">
          <Badge variant="destructive">{COUNTY_PROTOTYPE_LABEL}</Badge>
          <Badge variant="outline">{COUNTY_SIMULATED_LABEL}</Badge>
          <Badge variant="outline">Layouts and rules: {COUNTY_DRAFT_LABEL}</Badge>
          <Badge variant="outline" data-testid="interim-preparer">
            CalOMS / TPS preparer: {STAFF_ROLES.find((r) => r.key === COUNTY_INTERIM_PREPARER_ROLE)?.label} — {COUNTY_INTERIM_PREPARER_LABEL}
          </Badge>
          {!client && <Badge variant="secondary" data-testid="aggregate-only">Counts only — client-level rows need substance-use access</Badge>}
        </div>
        <label className="flex items-center gap-2 pt-2 text-sm">
          Reporting period
          <select className="rounded border bg-card px-2 py-1" value={period} onChange={(e) => setPeriod(e.target.value as ReportingPeriodKey)} data-testid="county-period">
            {REPORTING_PERIODS.map((p) => <option key={p.key} value={p.key}>{periodLabel(p.key)}</option>)}
          </select>
        </label>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" data-testid="county-cards">
        {cards.map((c) => (
          <Card key={c.report} className="space-y-2 p-3" data-testid={`county-card-${c.report}`}>
            <div className="text-sm font-medium text-navy">{c.label}</div>
            <div className="text-xs text-muted-foreground">Next due: {c.due ?? "On request"}</div>
            <Badge variant={c.status === "errors_returned" || c.status === "blockers" ? "destructive" : "outline"} data-testid="card-status">{CARD_STATUS_LABEL[c.status]}</Badge>
            <div className="text-xs">Blockers: {c.blockers}</div>
            <div className="text-xs font-medium" data-testid="card-next">{c.nextAction}</div>
            {cardAction(c.report)}
            {c.report === "isl" && <p className="text-[11px] text-muted-foreground">{ISL_DEADLINE_NOTE}</p>}
          </Card>
        ))}
      </section>

      <Card className="space-y-2 p-4">
        <h2 className="font-medium text-navy">CalOMS monthly file — blockers</h2>
        {blockers === null ? (
          <p className="text-sm text-muted-foreground">Client-level CalOMS records are only shown to substance-use–authorised staff.</p>
        ) : blockers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No missing required fields.</p>
        ) : (
          <ul className="divide-y text-sm" data-testid="caloms-blockers">
            {blockers.map((b) => (
              <li key={b.patientId} className="flex items-center gap-2 py-1.5">
                <Link to="/record/$patientId" params={{ patientId: b.patientId }} search={{ section: "caloms" } as never} className="flex-1 text-navy underline-offset-2 hover:underline">{b.patientName}</Link>
                <span className="text-xs text-muted-foreground">Missing: {[...b.admissionMissing, ...(b.dischargeMissing ?? [])].join(", ")}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-2 p-4">
        <h2 className="font-medium text-navy">DATAR counts (aggregate)</h2>
        <table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted-foreground"><th>Program</th><th>Capacity (Simulated placeholder)</th><th>Waitlist</th><th>Admissions</th></tr></thead>
          <tbody>{datar.map((r) => <tr key={r.programId}><td>{r.program}</td><td>{r.capacity}</td><td>{cell(r.waitlist)}</td><td>{cell(r.admissions)}</td></tr>)}</tbody></table>
      </Card>

      <Card className="space-y-2 p-4">
        <h2 className="font-medium text-navy">ISL export</h2>
        <p className="text-xs text-muted-foreground">ISL / BHSA lanes, attended or completed services only, AFBI outreach included. {ISL_PRIVATE_PAY_NOTE}. Also on the billing page.</p>
      </Card>

      <Card className="space-y-3 p-4" data-testid="bhoatr">
        <h2 className="font-medium text-navy">BHOATR rollups · {periodLabel(period)}</h2>
        <p className="text-xs text-muted-foreground">{BHOATR_DOLLARS_NOTE}. Age bands: {COUNTY_DRAFT_LABEL}.</p>
        <div className="flex flex-wrap gap-4 text-sm">
          <span>Unduplicated clients: <b>{cell(bhoatr.unduplicated)}</b></span>
          <span>Medi-Cal: <b>{cell(bhoatr.mediCal)}</b></span>
          <span>Non-Medi-Cal: <b>{cell(bhoatr.nonMediCal)}</b></span>
          {bhoatr.byAge.map((a) => <span key={a.band}>{a.band}: <b>{cell(a.count)}</b></span>)}
        </div>
        <div className="flex flex-wrap gap-4 text-sm">FSP presumptive-eligible: {bhoatr.fsp.map((f) => <span key={f.band}>{f.band}: <b>{cell(f.count)}</b></span>)}</div>
        <table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted-foreground"><th>Funding</th><th>Program</th><th>Care continuum</th><th>Service units</th><th>Minutes</th></tr></thead>
          <tbody>{bhoatr.services.map((s) => <tr key={`${s.funding}${s.program}${s.continuum}`}><td>{s.funding}</td><td>{s.program}</td><td>{s.continuum}</td><td>{cell(s.units)}</td><td>{cell(s.minutes)}</td></tr>)}</tbody></table>
      </Card>

      <Card className="space-y-3 p-4" data-testid="tps">
        <h2 className="font-medium text-navy">Treatment Perception Survey</h2>
        <p className="text-xs text-muted-foreground">Window (Draft): {win ? `${win.start} to ${win.end}` : "not set"}</p>
        {TPS_ADMIN_ROLES.includes(me.role) && (
          <div className="flex flex-wrap items-end gap-2">
            <Input type="date" className="w-40" value={winForm.start} onChange={(e) => setWinForm({ ...winForm, start: e.target.value })} aria-label="Survey start" />
            <Input type="date" className="w-40" value={winForm.end} onChange={(e) => setWinForm({ ...winForm, end: e.target.value })} aria-label="Survey end" />
            <Button size="sm" variant="outline" onClick={() => run("tps_set_window", "setTpsWindow", winForm)}>Save window</Button>
          </div>
        )}
        <div className="flex flex-wrap gap-4 text-sm">
          <span>In treatment: <b>{cell(tpsC.eligible)}</b></span><span>Offered: <b>{cell(tpsC.offered)}</b></span><span>Completed: <b>{cell(tpsC.completed)}</b></span><span>Declined: <b>{cell(tpsC.declined)}</b></span>
        </div>
        {tpsRows && (
          <ul className="divide-y text-sm">
            {tpsRows.map((r) => (
              <li key={r.patientId} className="flex flex-wrap items-center gap-2 py-1.5">
                <span className="flex-1">{r.name} <span className="text-xs text-muted-foreground">· {r.status.replace("_", " ")}</span></span>
                <Button size="sm" variant="outline" onClick={() => run("tps_send_link", "sendTpsLink", r.patientId)}>Send link (Simulated)</Button>
                <Button size="sm" variant="ghost" onClick={() => run("tps_mark", "markTps", r.patientId, "completed")}>Completed</Button>
                <Button size="sm" variant="ghost" onClick={() => run("tps_mark", "markTps", r.patientId, "declined")}>Declined</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-2 p-4" id="county-errors" data-testid="county-errors">
        <h2 className="font-medium text-navy">Returned errors (Simulated)</h2>
        {errs.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> : (
          <ul className="divide-y text-sm">
            {errs.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-2 py-1.5">
                <span className="flex-1">{e.recordRef}<span className="block text-xs text-muted-foreground">{e.text} · owner: {e.ownerRole.replace(/_/g, " ")} · {e.status}</span></span>
                {e.patientId && <Link to="/record/$patientId" params={{ patientId: e.patientId }} className="text-xs text-teal underline">Open chart</Link>}
                {e.status === "open" && <Button size="sm" variant="outline" onClick={() => run("county_fix_error", "fixCountyError", e.id)}>Mark fixed</Button>}
                {e.status === "fixed" && <Button size="sm" onClick={() => run("county_resend", "resendReport", e.submissionId)}>Resend (Simulated)</Button>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-2 p-4" data-testid="county-submissions">
        <h2 className="font-medium text-navy">Report runs</h2>
        {subs.length === 0 ? <p className="text-sm text-muted-foreground">No runs yet.</p> : (
          <ul className="divide-y text-sm">
            {subs.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2 py-1.5">
                <span className="flex-1">{s.report.toUpperCase()} · {s.periodLabel} · {s.rowCount} rows{s.withheld ? ` · ${s.withheld} withheld` : ""}<span className="block text-xs text-muted-foreground">by {s.generatedBy} · {s.status === "submitted" ? `submitted (Simulated) ${s.submittedAt?.slice(0, 16).replace("T", " ")}` : s.status}{s.resendOf ? " · resend" : ""}</span></span>
                <Button size="sm" variant="ghost" onClick={() => download(`${s.report}-${s.periodKey}.csv`, s.file)}>Download</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
