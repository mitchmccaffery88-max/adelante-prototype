import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AdelanteEHR, useEhr, type AuditCategory } from "@/lib/ehr";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ClientDate } from "@/components/ClientDate";
import { CatalogResolutionMetricsCard } from "@/components/admin/CatalogResolutionMetricsCard";
import { RiskTextReviewPanel } from "@/components/admin/RiskTextReviewPanel";

export const Route = createFileRoute("/admin-audit")({
  head: () => ({
    meta: [
      { title: "Audit log — Adelante Admin" },
      {
        name: "description",
        content: "Unified activity log across consent, eRx, telehealth, and vendor events.",
      },
      { property: "og:title", content: "Audit log — Adelante Admin" },
      {
        property: "og:description",
        content: "Cross-cutting activity trail for consent, medications, telehealth, and vendors.",
      },
    ],
  }),
  component: AdminAuditPage,
});

const CATEGORIES: { value: AuditCategory | "all"; label: string }[] = [
  { value: "all", label: "All categories" },
  { value: "consent", label: "Consent" },
  { value: "rx", label: "Medications / eRx" },
  { value: "telehealth", label: "Telehealth" },
  { value: "vendor", label: "Vendor" },
  { value: "access", label: "Access" },
  { value: "provider_switch", label: "Provider switches" },
  { value: "care_plan", label: "Care plan / goals" },
  { value: "assignment", label: "Assignment" },
  { value: "clinical", label: "Clinical" },
];

function AdminAuditPage() {
  const [cat, setCat] = useState<AuditCategory | "all">("all");
  const [patientId, setPatientId] = useState<string>("all");
  const [actorRole, setActorRole] = useState<string>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const patients = useEhr(() => AdelanteEHR.listPatients());
  const roles = useEhr(() =>
    Array.from(
      new Set(
        AdelanteEHR.listAuditEvents({})
          .map((e) => e.actorRole)
          .filter((r): r is string => !!r),
      ),
    ).sort(),
  );

  const events = useEhr(() =>
    AdelanteEHR.listAuditEvents({
      category: cat === "all" ? undefined : cat,
      patientId: patientId === "all" ? undefined : patientId,
      actorRole: actorRole === "all" ? undefined : actorRole,
      since: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
      until: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
      limit: 200,
    }),
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-5">
      <Link to="/admin" className="text-xs text-teal inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Back to admin
      </Link>
      <h1 className="font-display text-2xl text-navy flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-teal" /> Audit log
      </h1>
      <p className="text-sm text-muted-foreground">
        De-identified activity trail. Program IDs shown; no PHI beyond patient IDs used for internal
        linking.
      </p>

      <CatalogResolutionMetricsCard />

      <RiskTextReviewPanel />

      <div className="flex flex-wrap items-end gap-3">
        <Select value={cat} onValueChange={(v) => setCat(v as AuditCategory | "all")}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={patientId} onValueChange={setPatientId}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Patient" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All patients</SelectItem>
            {patients.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name} · {p.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={actorRole} onValueChange={setActorRole}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Actor role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actor roles</SelectItem>
            {roles.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="text-[11px] text-muted-foreground flex flex-col gap-1">
          From
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-9 w-36"
          />
        </label>
        <label className="text-[11px] text-muted-foreground flex flex-col gap-1">
          To
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-9 w-36"
          />
        </label>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setCat("all");
            setPatientId("all");
            setActorRole("all");
            setFrom("");
            setTo("");
          }}
        >
          Reset
        </Button>
        <Badge variant="outline" className="text-[10px]">
          {events.length} events
        </Badge>
      </div>

      <Card className="p-0 overflow-hidden">
        {events.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No events recorded.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground bg-muted/40">
              <tr className="text-left">
                <th className="p-2">When</th>
                <th className="p-2">Category</th>
                <th className="p-2">Action</th>
                <th className="p-2">Patient</th>
                <th className="p-2">Actor</th>
                <th className="p-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-t align-top">
                  <td className="p-2 whitespace-nowrap text-xs">
                    <ClientDate value={e.at} />
                  </td>
                  <td className="p-2">
                    <Badge variant="outline" className="text-[10px]">
                      {e.category}
                    </Badge>
                  </td>
                  <td className="p-2 font-mono text-[11px]">{e.action}</td>
                  <td className="p-2 font-mono text-[11px]">{e.programId ?? e.patientId ?? "—"}</td>
                  <td className="p-2 text-[11px]">
                    {e.actorRole ?? "—"}
                    {e.actorId ? <span className="text-muted-foreground"> · {e.actorId}</span> : null}
                  </td>
                  <td className="p-2 text-[11px] text-muted-foreground">
                    {e.detail ? summarize(e.detail) : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function summarize(d: Record<string, unknown>): string {
  return Object.entries(d)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .slice(0, 4)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(" · ");
}
