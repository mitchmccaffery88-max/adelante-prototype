import { staffPatientLabel } from "@/lib/staffPatientLabel";
import { StaffTable } from "@/components/staff/StaffTable";
import { StatusChip } from "@/components/ui/status-chip";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { runAction } from "@/lib/actions/runAction";
import { ACCESS_MODEL_DRAFT_LABEL, RESTRICT_ROLES, UNUSUAL_VOLUME_DRAFT, isRestricted, listRestrictedOpenItems } from "@/lib/chartAccess";
import { canViewCompliance, outsideCaseloadReport, unusualVolumeFlags } from "@/lib/complianceMonitoring";
import { ACCESS_LOG_LABEL } from "@/lib/accessLog";

const copy = {
  outside: "Charts opened outside caseload",
  actor: "Staff member",
  role: "Role",
  charts: "Charts",
  opens: "Opens",
};

export const Route = createFileRoute("/quality-compliance")({
  head: () => ({
    meta: [
      { title: "Quality & compliance — Adelante" },
      { name: "description", content: "Chart access monitoring: charts opened outside caseload, unusual volume and restricted-record opens." },
      { property: "og:title", content: "Quality & compliance — Adelante" },
      { property: "og:description", content: "Compliance monitoring built from the chart access log." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: QualityCompliancePage,
});

function QualityCompliancePage() {
  const { role, staffId, staffName } = useActingStaff();
  const actor = { role, staffId, staffName };
  const report = useEhr(() => JSON.stringify(outsideCaseloadReport()));
  const flags = useEhr(() => JSON.stringify(unusualVolumeFlags()));
  const items = useEhr(() => JSON.stringify(listRestrictedOpenItems()));
  const patients = useEhr(() => AdelanteEHR.listPatients().map((p) => ({ id: p.id, name: staffPatientLabel({ role, staffId }, p.id), restricted: isRestricted(p.id) })));
  const [drill, setDrill] = useState<string | null>(null);
  const [pick, setPick] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  if (!canViewCompliance(role)) return <Card className="m-6 p-6 text-sm">Quality & compliance isn't available for your role.</Card>;
  const rows = JSON.parse(report) as ReturnType<typeof outsideCaseloadReport>;
  const vol = JSON.parse(flags) as ReturnType<typeof unusualVolumeFlags>;
  const opens = JSON.parse(items) as ReturnType<typeof listRestrictedOpenItems>;
  const name = (id: string) => patients.find((p) => p.id === id)?.name ?? "Client";
  return (
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Quality &amp; compliance</h1>
          <p className="text-sm text-muted-foreground">{ACCESS_MODEL_DRAFT_LABEL} · {ACCESS_LOG_LABEL}</p>
        </div>

        <Card className="p-4" data-testid="restricted-opens">
          <h2 className="font-semibold">Restricted record opened</h2>
          {opens.length ? <ul className="mt-2 divide-y">{opens.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <span className="flex-1">{i.actorName} {i.disclosureId ? "used emergency access" : "opened a restricted record"} · {new Date(i.at).toLocaleString()}{i.medicalFollowUp ? " · Medical compliance follow-up" : ""}</span>
              <Input className="w-56" aria-label="Review note" placeholder="Review note" value={note[i.id] ?? ""} onChange={(e) => setNote({ ...note, [i.id]: e.target.value })} />
              <Button size="sm" variant="outline" disabled={!note[i.id]?.trim()} onClick={() => runAction("compliance_restricted_review", actor, undefined, { args: [{ id: i.id, note: note[i.id], actor: { staffId, name: staffName, role } }] })}>Mark reviewed</Button>
            </li>))}</ul> : <p className="mt-2 text-sm text-muted-foreground">Nothing waiting.</p>}
        </Card>

        <Card className="p-4" data-testid="unusual-volume">
          <h2 className="font-semibold">Unusual volume — today</h2>
          <p className="text-xs text-muted-foreground">Flag when one person opens more than {UNUSUAL_VOLUME_DRAFT} distinct charts in a day (Draft threshold).</p>
          {vol.length ? <ul className="mt-2 text-sm">{vol.map((v) => <li key={v.actorId}><StatusChip lang="en" state={RESTRICT_ROLES.includes(role) ? "yourturn" : "team"} label="Unusual volume" /> {v.actorName} · {v.charts} charts</li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">No one over the threshold today.</p>}
        </Card>

        <Card className="p-4" data-testid="outside-caseload-report">
          <h2 className="font-semibold">Charts opened outside caseload — this week</h2>
          <StaffTable
    rows={rows}
    rowKey={(r) => r.actorId}
    label={copy.outside}
    testId="outside-caseload-table"
    emptyState="No charts opened outside caseload this week."
    columns={[
      { id: "actor", label: copy.actor, cell: (r) => r.actorName },
      { id: "role", label: copy.role, cell: (r) => r.role },
      {
        id: "charts",
        label: copy.charts,
        cell: (r) => r.charts,
        sortValue: (r) => r.charts,
      },
      {
        id: "opens",
        label: copy.opens,
        cell: (r) => r.opens,
        sortValue: (r) => r.opens,
      },
    ]}
    primaryAction={(r) => (
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setDrill(drill === r.actorId ? null : r.actorId)}
      >
        {drill === r.actorId ? "Hide" : "Access log"}
      </Button>
    )}
    rowDetails={(r) =>
      drill === r.actorId ? (
        <ul className="text-sm">
          {r.rows.map((x) => (
            <li key={x.id}>
              {new Date(x.at).toLocaleString()} · {name(x.patientId)} ·{" "}
              {x.sectionId}
            </li>
          ))}
        </ul>
      ) : null
    }
  />
        </Card>

        {RESTRICT_ROLES.includes(role) && (
          <Card className="space-y-2 p-4" data-testid="restrict-record">
            <h2 className="font-semibold">Restricted records</h2>
            <p className="text-xs text-muted-foreground">For example a staff member who is also a client. Hidden from search except for their care team; others must give a reason to open.</p>
            <div className="flex flex-wrap gap-2">
              <Select value={pick} onValueChange={setPick}><SelectTrigger className="w-60" aria-label="Client to restrict"><SelectValue placeholder="Choose a client" /></SelectTrigger>
                <SelectContent>{patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}{p.restricted ? " (restricted)" : ""}</SelectItem>)}</SelectContent></Select>
              <Input className="w-64" aria-label="Restriction reason" placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
              <Button disabled={!pick || !reason.trim()} onClick={() => {
                const on = !isRestricted(pick);
                const r = runAction("chart_restrict", actor, AdelanteEHR.getPatient(pick), { args: [{ patientId: pick, restricted: on, reason, actor: { staffId, name: staffName, role } }] });
                setMsg(r.ok ? (on ? "Record restricted." : "Restriction removed.") : r.reason); setReason("");
              }}>{pick && isRestricted(pick) ? "Remove restriction" : "Mark restricted"}</Button>
            </div>
            {msg && <p className="text-sm">{msg}</p>}
          </Card>
        )}
      </div>
  );
}
