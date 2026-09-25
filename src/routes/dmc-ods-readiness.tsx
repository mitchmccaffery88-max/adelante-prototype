// §Phase 10d-3 — DMC-ODS operational readiness (PROTOTYPE). CalOMS
// completeness worklist + export-ready per-episode view. Part 2 protected:
// roles failing `canAccess(role, "screeners_sud")` see nothing.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEhr } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import {
  CALOMS_ADMISSION_REQUIRED_DRAFT,
  CALOMS_DISCHARGE_REQUIRED_DRAFT,
  DMC_ODS_DRAFT_NOTE,
  DMC_ODS_PROTOTYPE_BANNER,
  EXPORT_COLUMNS,
  MEDICAL_NECESSITY_GATE_DRAFT,
  calomsWorklist,
  dmcOdsExportRows,
  exportDmcOdsCsv,
} from "@/lib/dmcOdsReadiness";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/dmc-ods-readiness")({
  head: () => ({
    meta: [
      { title: "DMC-ODS readiness (prototype) — Adelante" },
      { name: "description", content: "CalOMS completeness and an export-ready view of ASAM and CalOMS fields. Prototype, never submitted." },
      { property: "og:title", content: "DMC-ODS readiness (prototype) — Adelante" },
      { property: "og:description", content: "CalOMS completeness worklist and export-ready DMC-ODS episode view." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReadinessPage,
});

function ReadinessPage() {
  const acting = useActingStaff();
  const worklist = useEhr(() => calomsWorklist(acting.role));
  const rows = useEhr(() => dmcOdsExportRows(acting.role));

  if (!worklist || !rows) {
    return (
      <div className="mx-auto max-w-3xl p-6" data-testid="dmc-ods-hidden">
        <Card className="p-4 text-sm text-muted-foreground">
          DMC-ODS readiness is protected under 42 CFR Part 2 and isn't available for your role.
        </Card>
      </div>
    );
  }

  const download = () => {
    const out = exportDmcOdsCsv({ staffId: acting.staffId, role: acting.role });
    if (!out) return;
    const blob = new Blob([out.csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dmc-ods-export-prototype-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${out.rowCount} row(s). Export recorded in the audit log.`);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold text-navy">DMC-ODS readiness</h1>
        <p className="text-sm text-muted-foreground">CalOMS completeness and the fields a county/DHCS submission would need.</p>
      </div>
      <Card className="space-y-1 border-amber-warm/60 p-3" data-testid="dmc-ods-banner">
        <Badge variant="outline" className="text-[10px]">Prototype</Badge>
        <p className="text-sm font-medium">{DMC_ODS_PROTOTYPE_BANNER}</p>
        <p className="text-xs text-muted-foreground">
          Required-field lists, the medical necessity rule (signed ASAM within {MEDICAL_NECESSITY_GATE_DRAFT.windowDaysBefore} days
          before / {MEDICAL_NECESSITY_GATE_DRAFT.windowDaysAfter} days after the service, linked SUD diagnosis{" "}
          {MEDICAL_NECESSITY_GATE_DRAFT.sudDiagnosisRule}; H0001 exempt): {DMC_ODS_DRAFT_NOTE}. Figures describe what was recorded — association only.
        </p>
      </Card>

      <Card className="space-y-2 p-4" data-testid="caloms-worklist">
        <h2 className="text-sm font-medium text-navy">Incomplete CalOMS records ({worklist.length})</h2>
        <p className="text-[11px] text-muted-foreground">
          Draft required fields — admission: {CALOMS_ADMISSION_REQUIRED_DRAFT.join(", ")}. Discharge: {CALOMS_DISCHARGE_REQUIRED_DRAFT.join(", ")}.
        </p>
        {worklist.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing incomplete.</p>
        ) : (
          <ul className="divide-y divide-border">
            {worklist.map((r) => (
              <li key={r.patientId} className="py-2 text-sm" data-testid="caloms-worklist-row">
                <Link to="/record/$patientId" params={{ patientId: r.patientId }} className="font-medium text-navy underline-offset-2 hover:underline">
                  {r.patientName}
                </Link>
                {r.admissionMissing.length > 0 && <p className="text-xs text-muted-foreground">Admission missing: {r.admissionMissing.join(", ")}</p>}
                {r.dischargeMissing.length > 0 && <p className="text-xs text-destructive">Discharge missing: {r.dischargeMissing.join(", ")}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-2 p-4" data-testid="dmc-ods-export">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-navy">Export-ready view — {rows.length} episode(s)</h2>
          <Button size="sm" onClick={download} data-testid="dmc-ods-download">Download CSV (prototype)</Button>
        </div>
        <p className="text-[11px] text-muted-foreground">Every download is audited (who, when, row count — never the values).</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>{EXPORT_COLUMNS.map((c) => <th key={c} className="whitespace-nowrap border-b border-border px-2 py-1 text-left font-medium">{c}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r["Episode ID"]}>{EXPORT_COLUMNS.map((c) => <td key={c} className="whitespace-nowrap border-b border-border/50 px-2 py-1">{r[c] || "—"}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
