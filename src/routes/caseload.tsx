import { createFileRoute, Link } from "@tanstack/react-router";
import { useEMR, EPISODE_LABEL } from "@/lib/emr";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClientDate } from "@/components/ClientDate";

export const Route = createFileRoute("/caseload")({
  head: () => ({ meta: [{ title: "My caseload — Adelante wireframe" }] }),
  component: Caseload,
});

const CLOSURE_REASONS = ["transportation", "re-arrest", "hospitalization", "communication loss", "preference", "provider availability"];

function Caseload() {
  const role = useEMR((s) => s.role);
  const people = useEMR((s) => s.people);
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">My caseload</h1>
        <p className="text-sm text-muted-foreground">
          Risk-tiered retention — not a generic no-show flag. Missed engagements are classified by medication continuity,
          overdose/withdrawal risk, suicidality, housing, and elapsed time.
        </p>
      </header>

      {role === "peer_specialist" && (
        <Card className="p-4 border-warning/30 bg-warning/5 text-sm">
          <b>Peer adherence alerts.</b> The high-risk row below shows a "missed 2+ — re-engage" flag.
        </Card>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Person</TableHead>
              <TableHead>Episodes</TableHead>
              <TableHead>Risk tier</TableHead>
              <TableHead>Last contact</TableHead>
              <TableHead>Next appt</TableHead>
              <TableHead>Open tasks</TableHead>
              <TableHead>Closure</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {people.map((p) => {
              const stale = p.lastContactAt && Math.floor((Date.now() - +new Date(p.lastContactAt)) / 86400000) > 7;
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link to="/patients/$id" params={{ id: p.id }} className="text-teal hover:underline font-medium">{p.firstName} {p.lastName}</Link>
                  </TableCell>
                  <TableCell><div className="flex gap-1 flex-wrap">{p.episodes.map((e) => <span key={e.id} className="text-[10px] bg-teal/10 text-teal rounded-full px-2 py-0.5">{EPISODE_LABEL[e.type]}</span>)}</div></TableCell>
                  <TableCell><span className={`text-[10px] rounded-full px-2 py-0.5 capitalize ${p.riskTier === "high" ? "bg-destructive/15 text-destructive" : p.riskTier === "moderate" ? "bg-warning/25 text-warning" : "bg-success/15 text-success"}`}>{p.riskTier}</span></TableCell>
                  <TableCell className="text-xs">{p.lastContactAt ? <span className={stale ? "text-destructive" : ""}><ClientDate value={p.lastContactAt} dateOnly /></span> : <span className="text-destructive">None</span>}</TableCell>
                  <TableCell className="text-xs">{p.nextAppointmentAt ? <ClientDate value={p.nextAppointmentAt} dateOnly /> : "—"}</TableCell>
                  <TableCell className="text-xs">{p.riskTier === "high" ? <Badge className="bg-destructive/15 text-destructive border-0 text-[9px]">Missed 2+ — re-engage</Badge> : "—"}</TableCell>
                  <TableCell><select className="text-xs border rounded-md px-1 py-0.5"><option value="">Open</option>{CLOSURE_REASONS.map((r) => <option key={r}>{r}</option>)}</select></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
      <p className="text-xs text-muted-foreground">Keep referrals/appointments open until a documented closure reason exists.</p>
    </div>
  );
}
