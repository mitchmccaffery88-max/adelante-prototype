import { StaffTable } from "@/components/staff/StaffTable";
import { StatusChip } from "@/components/ui/status-chip";
import { VoiceGuardrailNotice } from "@/components/voice/VoiceGuardrailNotice";
import { HieStatusCard } from "@/components/hie/OutsideRecords";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShieldCheck, Video, Pill, ArrowLeft } from "lucide-react";
import { ClientDate } from "@/components/ClientDate";
import { scribe as scribeVendor } from "@/lib/vendors/scribe";
import { scribePilotMetrics, SCRIBE_DICTATION_ONLY_ROLES, SCRIBE_NO_ACCESS_ROLES, SCRIBE_SETTINGS, SCRIBE_SETTING_LABEL, ROLE_SCOPE_DRAFT_LABEL, SCRIBE_CAPTURE_ROLES, sweepScribeRetention } from "@/lib/scribe";
import { simulatedSurfaceLabel } from "@/lib/features";

function ScribeVendorCard() {
  const m = JSON.parse(useEhr(() => JSON.stringify(scribePilotMetrics()))) as ReturnType<typeof scribePilotMetrics>;
  useEffect(() => { sweepScribeRetention(); }, []);
  return (
    <Card className="space-y-2 p-4" data-testid="scribe-vendor-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base text-navy">AI scribe · {scribeVendor.name}</h2>
        <Badge variant="outline">{simulatedSurfaceLabel("scribe_simulated")}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">Full scribe (all settings): {SCRIBE_CAPTURE_ROLES.join(", ")}. Post-encounter dictation only (AFBI + own contact notes): {SCRIBE_DICTATION_ONLY_ROLES.join(", ")}. No access: {SCRIBE_NO_ACCESS_ROLES.join(", ")}. {ROLE_SCOPE_DRAFT_LABEL}.</p>
      <h3 className="text-sm font-medium">Pilot metrics (prototype, aggregate only)</h3>
      {m.belowMinimumCohort ? (
        <p className="text-sm text-muted-foreground" data-testid="scribe-metrics-suppressed">Hidden until at least 11 signed scribe notes exist.</p>
      ) : (
        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4" data-testid="scribe-metrics">
          <div><dt className="text-[11px] text-muted-foreground">Session end to sign (median min)</dt><dd>{m.medianEndToSignMin}</dd></div>
          <div><dt className="text-[11px] text-muted-foreground">Draft text edited (mean %)</dt><dd>{m.meanEditPct}%</dd></div>
          <div><dt className="text-[11px] text-muted-foreground">Unsupported sentences</dt><dd>{m.unsupportedTotal}</dd></div>
          <div><dt className="text-[11px] text-muted-foreground">Clinician rating (1–5)</dt><dd>{m.meanRating ?? "—"}</dd></div>
        </dl>
      )}
      <h3 className="text-sm font-medium">By setting</h3>
      <ul className="text-sm" data-testid="scribe-metrics-by-setting">
        {SCRIBE_SETTINGS.map((k) => {
          const x = scribePilotMetrics({ setting: k });
          return <li key={k}>{SCRIBE_SETTING_LABEL[k]}: {x.belowMinimumCohort ? "hidden (fewer than 11)" : `median ${x.medianEndToSignMin} min to sign · ${x.meanEditPct}% edited · rating ${x.meanRating ?? "—"}`}</li>;
        })}
      </ul>
    </Card>
  );
}

export const Route = createFileRoute("/admin-vendors")({
  head: () => ({
    meta: [
      { title: "Vendor status — Adelante Admin" },
      {
        name: "description",
        content:
          "Live health of integrated telehealth and eRx vendors, session lifecycle, and connection tests.",
      },
      { property: "og:title", content: "Vendor status — Adelante Admin" },
      {
        property: "og:description",
        content:
          "Monitor telehealth and eRx vendor health, session lifecycle, and recent connection tests.",
      },
    ],
  }),
  component: AdminVendorsPage,
});

function AdminVendorsPage() {
  const status = useEhr(() => AdelanteEHR.vendorStatus());
  const sessions = useEhr(() => AdelanteEHR.listTelehealthSessions({}));
  const pings = useEhr(() => ({
    th: AdelanteEHR.lastVendorPings(status.telehealth.name),
    er: AdelanteEHR.lastVendorPings(status.erx.name),
  }));
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    AdelanteEHR.pingVendors().catch(() => {});
  }, []);

  const runTest = async () => {
    setTesting(true);
    try {
      const r = await AdelanteEHR.pingVendors();
      toast.success("Vendor test complete", {
        description: `Video: ${r.telehealth.ok ? "OK" : "fail"} · eRx: ${r.erx.ok ? "OK" : "fail"}`,
      });
    } finally {
      setTesting(false);
    }
  };

  const active = sessions.filter(
    (s) =>
      s.state === "in_progress" || s.state === "clinician_joined" || s.state === "patient_joined",
  );
  const recent = sessions.slice(0, 10);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-5">
      <Link to="/admin" className="text-xs text-teal inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Back to admin
      </Link>
      <h1 className="font-display text-2xl text-navy">Vendor status</h1>
      <VoiceGuardrailNotice />
      <p className="text-sm text-muted-foreground">
        Adelante Pathways is the EHR of record. Vendors below deliver bounded services (telehealth
        video, eRx).
      </p>

      <HieStatusCard />
      <ScribeVendorCard />
      <div className="grid md:grid-cols-2 gap-4">
        <VendorPanel
          label="Telehealth video"
          icon={<Video className="h-4 w-4 text-teal" />}
          name={status.telehealth.name}
          mode={status.telehealth.mode}
          pings={pings.th}
        />
        <VendorPanel
          label="Medication management (eScribe)"
          icon={<Pill className="h-4 w-4 text-teal" />}
          name={status.erx.name}
          mode={status.erx.mode}
          pings={pings.er}
        />
      </div>

      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={runTest} disabled={testing}>
          <ShieldCheck className="h-4 w-4 mr-1.5" /> {testing ? "Testing…" : "Run connection test"}
        </Button>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-navy">Telehealth sessions</h2>
          <Badge variant="outline" className="text-[10px]">
            {active.length} active
          </Badge>
        </div>
        {recent.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No telehealth sessions yet.</p>
        ) : (
          <StaffTable rows={recent} rowKey={(s) => s.id} label={adminTableCopy.admin_vendor_sessions} testId="admin-vendor-sessions"  columns={[{ id: "column-0", label: adminTableCopy.admin_vendor_sessions_0, mono: true, cell: (s) => {  return <>{s.roomId}</>; } },
{ id: "column-1", label: adminTableCopy.admin_vendor_sessions_1, cell: (s) => {  return <><StateBadge state={s.state} /></>; } },
{ id: "column-2", label: adminTableCopy.admin_vendor_sessions_2, cell: (s) => {  return <><ClientDate value={s.createdAt} /></>; } },
{ id: "column-3", label: adminTableCopy.admin_vendor_sessions_3, cell: (s) => {  return <>{s.durationSec ? `${Math.round(s.durationSec / 60)} min` : "—"}</>; } },
{ id: "column-4", label: adminTableCopy.admin_vendor_sessions_4, cell: (s) => {  return <>{s.endReason ?? ""}</>; } }]}  />
        )}
      </Card>
    </div>
  );
}

function VendorPanel({
  label,
  icon,
  name,
  mode,
  pings,
}: {
  label: string;
  icon: React.ReactNode;
  name: string;
  mode: string;
  pings: { ok: boolean; at: string }[];
}) {
  const last = pings[0];
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="font-display text-base text-navy">{label}</h3>
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground font-mono">{name}</div>
      <div className="mt-2 flex items-center gap-2">
        <Badge className="bg-gold/30 text-navy border-0 text-[10px]">{mode}</Badge>
        {last && (
          last.ok ? <StatusChip lang="en" state="done" label="healthy" /> : <Badge className="bg-surface-sunk text-attention border-0 text-[10px]">degraded</Badge>
        )}
      </div>
      <div className="mt-3 text-xs text-muted-foreground">
        Recent tests:
        {pings.length === 0 ? " —" : ""}
      </div>
      <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
        {pings.map((p, i) => (
          <li key={i}>
            <ClientDate value={p.at} /> · {p.ok ? "ok" : "fail"}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function StateBadge({ state }: { state: string }) {
  return <StatusChip lang="en" state={state === "ended" || state === "expired" ? "closed" : state === "failed" ? "urgent" : state === "in_progress" ? "done" : "team"} label={state.replace("_", " ")} />;
}

const adminTableCopy = {
admin_vendor_sessions: "Telehealth sessions",
admin_vendor_sessions_0: "Room",
admin_vendor_sessions_1: "State",
admin_vendor_sessions_2: "Created",
admin_vendor_sessions_3: "Duration",
admin_vendor_sessions_4: "Reason",
};
