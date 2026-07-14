import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { useEMR, EPISODE_LABEL } from "@/lib/emr";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/patients")({
  head: () => ({ meta: [{ title: "Patients — Adelante wireframe" }] }),
  component: PatientsLayout,
});

function PatientsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // If a child route (patients/$id) is matched, render it fullscreen.
  if (pathname !== "/patients") return <Outlet />;
  return <PatientsList />;
}

function PatientsList() {
  const people = useEMR((s) => s.people);
  const [q, setQ] = useState("");
  const filtered = people.filter((p) => {
    const s = q.toLowerCase();
    return !s || `${p.firstName} ${p.lastName} ${p.cin ?? ""} ${p.dob}`.toLowerCase().includes(s);
  });
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Patients</h1>
          <p className="text-sm text-muted-foreground">Person records with linked episodes. Access filtered per role.</p>
        </div>
        <Input placeholder="Search name, CIN, DOB" value={q} onChange={(e) => setQ(e.target.value)} className="w-72" />
      </header>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>DOB</TableHead>
              <TableHead>CIN</TableHead>
              <TableHead>Episodes</TableHead>
              <TableHead>Payer</TableHead>
              <TableHead>Risk</TableHead>
              <TableHead>Tags</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <Link to="/patients/$id" params={{ id: p.id }} className="text-teal hover:underline font-medium">
                    {p.firstName} {p.lastName}
                  </Link>
                </TableCell>
                <TableCell className="text-xs">{p.dob}</TableCell>
                <TableCell className="text-xs font-mono">{p.cin ? `••••${p.cin.slice(-4)}` : "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    {p.episodes.map((e) => (
                      <span key={e.id} className={badgeCls(e.type)}>{EPISODE_LABEL[e.type]}</span>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-xs capitalize">{p.payer[0]?.status.replace(/_/g, " ")}</TableCell>
                <TableCell><span className={riskCls(p.riskTier)}>{p.riskTier}</span></TableCell>
                <TableCell className="text-xs text-muted-foreground">{(p.tags ?? []).join(" · ")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function badgeCls(t: string) {
  const map: Record<string, string> = {
    MH: "bg-info/20 text-info",
    SUD: "bg-teal/15 text-teal",
    ECM: "bg-warning/25 text-warning",
    JI_PRE: "bg-destructive/15 text-destructive",
    BHSA: "bg-success/15 text-success",
  };
  return `text-[10px] rounded-full px-2 py-0.5 ${map[t] ?? "bg-secondary"}`;
}
function riskCls(t: string) {
  const map: Record<string, string> = {
    low: "bg-success/15 text-success",
    moderate: "bg-warning/25 text-warning",
    high: "bg-destructive/15 text-destructive",
  };
  return `text-[10px] rounded-full px-2 py-0.5 capitalize ${map[t]}`;
}
