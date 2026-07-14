import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { EMR, useEMR, listDocs } from "@/lib/emr";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClientDate } from "@/components/ClientDate";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/documents")({
  head: () => ({ meta: [{ title: "Documents to verify — Adelante wireframe" }] }),
  component: DocumentsPage,
});

const CLASSIFICATIONS = [
  { id: "id", label: "ID" },
  { id: "release", label: "Release paperwork" },
  { id: "benefits", label: "Benefits doc" },
  { id: "prior_clinical", label: "Prior clinical record" },
  { id: "part2_program", label: "Part 2 program record" },
] as const;

function DocumentsPage() {
  useEMR((s) => s.people); // subscribe
  const people = useEMR((s) => s.people);
  const docs = listDocs();

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Documents to verify</h1>
      <p className="text-sm text-muted-foreground">Uploads land here as Unverified. Promote to chart, or reject. Part 2 program records carry a redisclosure badge.</p>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File</TableHead>
              <TableHead>Person</TableHead>
              <TableHead>Uploader</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead>Scan</TableHead>
              <TableHead>Classification</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {docs.map((d) => {
              const person = people.find((p) => p.id === d.personId);
              return (
                <TableRow key={d.id}>
                  <TableCell className="text-sm">
                    {d.fileName}
                    {d.part2 && <div><Badge className="mt-1 text-[9px] bg-destructive/15 text-destructive border-0">Carries redisclosure prohibition</Badge></div>}
                  </TableCell>
                  <TableCell className="text-sm">{person && <Link to="/patients/$id" params={{ id: person.id }} className="text-teal hover:underline">{person.firstName} {person.lastName}</Link>}</TableCell>
                  <TableCell className="text-xs">{d.uploader}</TableCell>
                  <TableCell className="text-xs"><ClientDate value={d.uploadedAt} /></TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px] text-success">Scanned — no threats</Badge></TableCell>
                  <TableCell>
                    <select
                      className="text-xs border rounded-md px-1 py-0.5"
                      value={d.classification ?? ""}
                      onChange={(e) => EMR.classifyDoc(d.id, e.target.value as any)}
                    >
                      <option value="">— Classify —</option>
                      {CLASSIFICATIONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </TableCell>
                  <TableCell>
                    {d.verified ? <Badge className="bg-success/15 text-success border-0 text-[10px]">Verified</Badge> : (
                      <div className="flex gap-1">
                        <Button size="sm" onClick={() => { EMR.verifyDoc(d.personId, d.id); toast.success("Promoted to chart · audit entry written"); }}>Verify → chart</Button>
                        <Button size="sm" variant="outline" onClick={() => { EMR.rejectDoc(d.id); toast("Rejected"); }}>Reject</Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
