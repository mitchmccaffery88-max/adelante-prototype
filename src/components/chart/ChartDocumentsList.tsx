// §Chart redesign turn 5 (a) — Documents card under Notes & Documents.
// Lists uploads with type, date, uploader and verified status. Part 2
// documents are hidden (not locked) for roles failing roleSeesAsamSection.
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { useActingStaff, type StaffRole } from "@/lib/roles";
import { roleSeesAsamSection } from "@/lib/asamReporting";
import { Badge } from "@/components/ui/badge";

export function visibleChartDocuments(patientId: string, role: StaffRole) {
  const p = AdelanteEHR.getPatient(patientId);
  const all = AdelanteEHR.listPatientDocuments(patientId);
  const sees = roleSeesAsamSection(role, p);
  const visible = all.filter((d) => sees || !d.isPart2);
  return { visible, hidden: all.length - visible.length };
}

export function ChartDocumentsList({ patientId }: { patientId: string }) {
  const { role } = useActingStaff();
  const json = useEhr(() => JSON.stringify(visibleChartDocuments(patientId, role)));
  const { visible, hidden } = JSON.parse(json) as ReturnType<typeof visibleChartDocuments>;
  return (
    <div className="space-y-2" data-testid="chart-documents">
      {visible.length === 0 && <p className="text-sm text-muted-foreground">No documents uploaded.</p>}
      {visible.length > 0 && (
        <ul className="divide-y rounded-md border text-sm">
          {visible.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <span className="min-w-0 flex-1 truncate font-medium text-navy">{d.fileName}</span>
              <span className="text-xs text-muted-foreground">{(d.docType ?? "Other").replace(/_/g, " ")}</span>
              <span className="text-xs text-muted-foreground">{new Date(d.uploadedAt).toLocaleDateString()}</span>
              <span className="text-xs text-muted-foreground">by {d.uploader.name}</span>
              <Badge variant={d.verification === "verified" ? "default" : d.verification === "rejected" ? "destructive" : "secondary"} className="text-[10px]">
                {d.verification === "verified" ? "Verified" : d.verification === "rejected" ? "Rejected" : "Pending review"}
              </Badge>
            </li>
          ))}
        </ul>
      )}
      {hidden > 0 && <p className="text-xs text-muted-foreground">Some documents are not shown for your role.</p>}
    </div>
  );
}
