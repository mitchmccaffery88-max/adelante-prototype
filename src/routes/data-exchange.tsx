import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { PatientMatchingQueue } from "@/components/identity/PatientMatchingQueue";
import { HieNotice, HieStatusCard } from "@/components/hie/OutsideRecords";
import { KIND_LABEL, hieSyncLog, listHeldHieRecords, releaseHeldHieRecord } from "@/lib/hie";
import { resolveNavAccess } from "@/lib/navGuard";
import { DATA_EXCHANGE_ROLES } from "@/lib/dataExchangeRoles";
import {
  disclosureCsv,
  listIncomingEvents,
  listOutboundShares,
  type FollowUp,
} from "@/lib/dataExchange";

export const Route = createFileRoute("/data-exchange")({
  head: () => ({
    meta: [
      { title: "Data exchange — Adelante" },
      { name: "description", content: "Simulated HIE operations: sync health, patient matching, held Part 2 records and sharing log." },
      { property: "og:title", content: "Data exchange — Adelante" },
      { property: "og:description", content: "Simulated HIE operations hub for coordinators and admins." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DataExchangePage,
});

const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
const nameOf = (id: string) => {
  const p = AdelanteEHR.getPatient(id);
  return p ? `${p.firstName} ${p.lastName}` : "Unknown";
};

function Panel({ title, children, testId }: { title: string; children: React.ReactNode; testId: string }) {
  return (
    <Card className="space-y-3 p-4" data-testid={testId}>
      <p className="font-display text-base text-navy">{title}</p>
      <HieNotice />
      {children}
    </Card>
  );
}

function DataExchangePage() {
  const { role } = useActingStaff();
  if (!DATA_EXCHANGE_ROLES.has(role))
    return <p className="p-6 text-sm text-muted-foreground">Data exchange isn't available for your role.</p>;
  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <h1 className="font-display text-2xl text-navy">Data exchange</h1>
      <Health />
      <Matching />
      <Held />
      <Events />
      <Outbound />
    </main>
  );
}

function Health() {
  const log = useEhr(() => hieSyncLog(10));
  return (
    <Panel title="Connection health" testId="dx-health">
      <HieStatusCard />
      <table className="w-full text-xs">
        <thead><tr className="text-left text-muted-foreground"><th>Run</th><th>Received</th><th>Matched</th><th>Held</th><th>Errors</th></tr></thead>
        <tbody>
          {log.map((r) => (
            <tr key={r.id} className="border-t">
              <td>{new Date(r.at).toLocaleString()}</td><td>{r.received}</td><td>{r.matched}</td><td>{r.held}</td>
              <td>{r.errors}{r.note ? ` — ${r.note}` : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function Matching() {
  return (
    <Panel title="Patient matching" testId="dx-matching">
      <PatientMatchingQueue />
    </Panel>
  );
}

function Held() {
  const actor = useActingStaff();
  const held = useEhr(() => listHeldHieRecords());
  const canOpenConsent = resolveNavAccess(actor.role, "/consent").status === "allowed";
  return (
    <Panel title="Held records (Part 2)" testId="dx-held">
      {held.length === 0 && <p className="text-xs text-muted-foreground">No held records.</p>}
      {held.map((h) => (
        <div key={h.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-xs">
          <span>{h.sourceType}</span><span>{fmt(h.at)}</span>
          <Badge variant="outline">Part 2 consent required</Badge>
          {canOpenConsent ? (
            <Button asChild size="sm" variant="outline"><Link to="/consent" search={{ patientId: h.patientId }}>Open consent screen</Link></Button>
          ) : (
            <span className="text-[11px] text-muted-foreground">Consent is recorded by clinical staff or an admin on the consent screen.</span>
          )}
          {h.consentNowOnFile && (
            <Button size="sm" onClick={() => { releaseHeldHieRecord(h.id, { name: actor.staffName, role: actor.role }); toast.success("Released to chart"); }}>Release to chart</Button>
          )}
        </div>
      ))}
    </Panel>
  );
}

const FU_LABEL: Record<FollowUp, string> = { followed: "Followed up within 48h", overdue: "Overdue", open: "Open", "n/a": "—" };

function Events() {
  const { role } = useActingStaff();
  const events = useEhr(() => listIncomingEvents(role));
  const [kind, setKind] = useState("all");
  const [fu, setFu] = useState("all");
  const [days, setDays] = useState("30");
  const now = Date.now();
  const shown = events.filter(({ encounter: e, followUp }) =>
    (kind === "all" || e.kind === kind) && (fu === "all" || followUp === fu) && now - new Date(e.at).getTime() <= Number(days) * 86400000,
  );
  const sel = "h-8 rounded-md border bg-background px-2 text-xs";
  return (
    <Panel title="All incoming events" testId="dx-events">
      <div className="flex flex-wrap gap-2">
        <select aria-label="Type" className={sel} value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="all">All types</option><option value="ed_visit">ED visits</option><option value="admission">Admissions</option><option value="discharge">Discharges</option><option value="sud_program">Outside program visits</option>
        </select>
        <select aria-label="Date" className={sel} value={days} onChange={(e) => setDays(e.target.value)}>
          <option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="365">Last year</option>
        </select>
        <select aria-label="Follow-up" className={sel} value={fu} onChange={(e) => setFu(e.target.value)}>
          <option value="all">Any follow-up</option><option value="followed">Followed up within 48h</option><option value="overdue">Overdue</option><option value="open">Open</option>
        </select>
      </div>
      <ul className="space-y-1 text-xs">
        {shown.map(({ encounter: e, followUp }) => (
          <li key={e.id} className="flex flex-wrap items-center gap-2 border-t pt-1">
            <Link to="/record/$patientId" params={{ patientId: e.patientId }} search={{ section: "outside-records" }} className="text-navy underline">{nameOf(e.patientId)}</Link>
            <span>{KIND_LABEL[e.kind]}</span><span>{fmt(e.at)}</span>
            <Badge variant="outline">{FU_LABEL[followUp]}</Badge>
          </li>
        ))}
        {shown.length === 0 && <li className="text-muted-foreground">No events match.</li>}
      </ul>
    </Panel>
  );
}

function Outbound() {
  const actor = useActingStaff();
  const rows = useEhr(() => listOutboundShares());
  const patients = Array.from(new Set(rows.map((r) => r.patientId)));
  const [pid, setPid] = useState("");
  const exportCsv = () => {
    const id = pid || patients[0];
    if (!id) return;
    const csv = disclosureCsv(id, { name: actor.staffName, role: actor.role });
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `disclosures-${nameOf(id).replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Disclosure list exported");
  };
  return (
    <Panel title="Outbound sharing log" testId="dx-outbound">
      <table className="w-full text-xs">
        <thead><tr className="text-left text-muted-foreground"><th>Patient</th><th>Sent</th><th>To</th><th>What</th><th>Purpose</th><th>Consent used</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.id} className="border-t"><td>{nameOf(r.patientId)}</td><td>{fmt(r.sentAt)}</td><td>{r.recipient}</td><td>{r.what}</td><td>{r.purpose}</td><td>{r.consentUsed}</td></tr>)}</tbody>
      </table>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Patient for export" className="h-8 rounded-md border bg-background px-2 text-xs" value={pid || patients[0] || ""} onChange={(e) => setPid(e.target.value)}>
          {patients.map((id) => <option key={id} value={id}>{nameOf(id)}</option>)}
        </select>
        <Button size="sm" variant="outline" onClick={exportCsv}>Export disclosure list for a patient</Button>
      </div>
    </Panel>
  );
}
