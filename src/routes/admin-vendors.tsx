import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShieldCheck, Video, Pill, ArrowLeft } from "lucide-react";
import { ClientDate } from "@/components/ClientDate";

export const Route = createFileRoute("/admin-vendors")({
  head: () => ({
    meta: [
      { title: "Vendor status — Adelante Admin" },
      { name: "description", content: "Live health of integrated telehealth and eRx vendors, session lifecycle, and connection tests." },
      { property: "og:title", content: "Vendor status — Adelante Admin" },
      { property: "og:description", content: "Monitor telehealth and eRx vendor health, session lifecycle, and recent connection tests." },
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

  useEffect(() => { AdelanteEHR.pingVendors().catch(() => {}); }, []);

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

  const active = sessions.filter((s) => s.state === "in_progress" || s.state === "clinician_joined" || s.state === "patient_joined");
  const recent = sessions.slice(0, 10);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-5">
      <Link to="/admin" className="text-xs text-teal inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Back to admin
      </Link>
      <h1 className="font-display text-2xl text-navy">Vendor status</h1>
      <p className="text-sm text-muted-foreground">
        Adelante Pathways is the EHR of record. Vendors below deliver bounded services (telehealth video, eRx).
      </p>

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
          <Badge variant="outline" className="text-[10px]">{active.length} active</Badge>
        </div>
        {recent.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No telehealth sessions yet.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="text-left">
                <th className="py-1 pr-2">Room</th>
                <th className="py-1 pr-2">State</th>
                <th className="py-1 pr-2">Created</th>
                <th className="py-1 pr-2">Duration</th>
                <th className="py-1 pr-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="py-1.5 pr-2 font-mono text-[11px]">{s.roomId}</td>
                  <td className="py-1.5 pr-2"><StateBadge state={s.state} /></td>
                  <td className="py-1.5 pr-2 text-xs"><ClientDate value={s.createdAt} /></td>
                  <td className="py-1.5 pr-2 text-xs">
                    {s.durationSec ? `${Math.round(s.durationSec / 60)} min` : "—"}
                  </td>
                  <td className="py-1.5 pr-2 text-xs text-muted-foreground">{s.endReason ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function VendorPanel({ label, icon, name, mode, pings }: {
  label: string; icon: React.ReactNode; name: string; mode: string;
  pings: { ok: boolean; at: string }[];
}) {
  const last = pings[0];
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">{icon}<h3 className="font-display text-base text-navy">{label}</h3></div>
      <div className="mt-2 text-[11px] text-muted-foreground font-mono">{name}</div>
      <div className="mt-2 flex items-center gap-2">
        <Badge className="bg-gold/30 text-navy border-0 text-[10px]">{mode}</Badge>
        {last && (
          <Badge className={`${last.ok ? "bg-success/20 text-success" : "bg-destructive/15 text-destructive"} border-0 text-[10px]`}>
            {last.ok ? "healthy" : "degraded"}
          </Badge>
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
  const map: Record<string, string> = {
    scheduled: "bg-muted text-muted-foreground",
    clinician_joined: "bg-gold/30 text-navy",
    patient_joined: "bg-gold/30 text-navy",
    in_progress: "bg-teal/20 text-teal",
    ended: "bg-success/20 text-success",
    expired: "bg-muted text-muted-foreground",
    failed: "bg-destructive/15 text-destructive",
  };
  return <Badge className={`${map[state] ?? "bg-muted"} border-0 text-[10px]`}>{state.replace("_", " ")}</Badge>;
}
