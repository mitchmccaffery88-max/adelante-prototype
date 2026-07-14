import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { EMR, useEMR, ROLES } from "@/lib/emr";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClientDate } from "@/components/ClientDate";
import { ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Adelante wireframe" }] }),
  component: AdminPage,
});

function AdminPage() {
  const providers = useEMR((s) => s.providers);
  const audit = useEMR((s) => s.audit);
  const breakGlass = useEMR((s) => s.breakGlassOpen);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">System admin</h1>
      <Card className="p-4 text-sm">
        <b>Segregation of duties.</b> Admin provisions access but cannot read charts. DevOps and privacy officer are separate designations.
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold mb-2">Users & roles</h2>
        <Table>
          <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Assigned role</TableHead><TableHead>License</TableHead></TableRow></TableHeader>
          <TableBody>
            {providers.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.name}</TableCell>
                <TableCell>
                  <select className="text-xs border rounded-md px-1 py-0.5" defaultValue={p.role}>
                    {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                </TableCell>
                <TableCell className="text-xs">{p.licenseType} · {p.licenseNumber}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card className="p-4 border-destructive/30 bg-destructive/5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-destructive" /> Break-glass audit access</h2>
            <p className="text-xs text-muted-foreground">This access is logged.</p>
          </div>
          <Button variant={breakGlass ? "outline" : "destructive"} onClick={() => { EMR.toggleBreakGlass(); toast(breakGlass ? "Audit view closed" : "Audit view opened — logged"); }}>
            {breakGlass ? "Close audit view" : "Open audit view"}
          </Button>
        </div>
      </Card>

      {breakGlass && (
        <Card className="p-4">
          <h2 className="font-semibold mb-2">Audit log</h2>
          <ul className="text-sm divide-y">
            {audit.map((a) => (
              <li key={a.id} className="py-1.5 text-xs">
                <ClientDate value={a.at} /> · <b>{a.actor}</b> ({a.actorRole}) — {a.action} {a.personId && <Badge variant="outline" className="ml-1 text-[9px]">Person {a.personId}</Badge>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
