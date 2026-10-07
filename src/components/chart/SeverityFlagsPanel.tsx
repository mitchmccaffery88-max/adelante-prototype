// §C3 — re-screen severity flags on the chart's Tracking section. Neutral
// wording; "Mark reviewed" runs registry action severity_flag_review.
import { toast } from "sonner";
import { actFor } from "@/lib/actions/act";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { canReviewSeverity, listSeverityFlags, SEVERITY_DRAFT_LABEL, SEVERITY_ROW_LABEL } from "@/lib/severityFlags";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function SeverityFlagsPanel({ patientId }: { patientId: string }) {
  const a = useActingStaff();
  const p = useEhr(() => AdelanteEHR.getPatient(patientId));
  if (!p) return null;
  const flags = listSeverityFlags(p, a.role).filter((f) => (f.kind === "flag" && !f.reviewedAt) || (f.kind === "improving" && Date.now() - +new Date(f.resultAt) <= 30 * 86400000)).slice(0, 4);
  if (!flags.length) return null;
  const can = canReviewSeverity(a.role, p);
  return (
    <div className="mb-3 space-y-2 rounded-md border p-3 text-sm" data-testid="severity-flags">
      {flags.map((f) => (
        <div key={f.id} className="flex flex-wrap items-center gap-2" data-testid={`severity-flag-${f.kind}`}>
          <Badge variant={f.kind === "flag" ? "destructive" : "secondary"} className="text-[10px]">{f.kind === "flag" ? SEVERITY_ROW_LABEL : "Improving"}</Badge>
          <span className="min-w-0 flex-1">{f.text}</span>
          {f.kind === "flag" && can && (
            <Button size="sm" variant="outline" onClick={() => { try { actFor("severity_flag_review", "reviewSeverityFlag", patientId, patientId, f.id, { name: a.staffName, role: a.role, staffId: a.staffId }); toast.success("Marked reviewed"); } catch (e) { toast.error((e as Error).message); } }}>
              Mark reviewed
            </Button>
          )}
        </div>
      ))}
      <p className="text-[10px] text-muted-foreground">Flag rules: {SEVERITY_DRAFT_LABEL}. Crisis answers still follow the crisis path.</p>
    </div>
  );
}
