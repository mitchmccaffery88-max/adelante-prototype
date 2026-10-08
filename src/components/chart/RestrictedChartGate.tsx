// §Access A1 — a Restricted record asks anyone off the care team for a reason
// before it opens. The open is logged and raises a compliance item.
import { useState, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useEhr, AdelanteEHR } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { chartEntryFor, isChartUnlocked, ACCESS_MODEL_DRAFT_LABEL } from "@/lib/chartAccess";
import { runAction } from "@/lib/actions/runAction";

export function RestrictedChartGate({ patientId, children }: { patientId: string; children: ReactNode }) {
  const { role, staffId, staffName } = useActingStaff();
  const state = useEhr(() => {
    const e = chartEntryFor(role, staffId, patientId);
    if (!e.ok) return "denied";
    if (!e.restricted || e.careTeam || isChartUnlocked(staffId, patientId)) return "open";
    return "ask";
  });
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  if (state === "open") return <>{children}</>;
  if (state === "denied")
    return <div className="mx-auto max-w-3xl px-4 py-10"><Card className="p-6 text-sm">This chart isn't available for your role.</Card></div>;
  const submit = () => {
    const r = runAction("chart_restricted_open", { role, staffId, staffName }, AdelanteEHR.getPatient(patientId), {
      args: [{ patientId, reason, actor: { staffId, name: staffName, role } }],
    });
    if (!r.ok) setError(r.reason);
  };
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <Card className="space-y-3 p-6" data-testid="restricted-chart-gate">
        <p className="flex items-center gap-2 font-display text-lg text-navy"><Lock className="h-4 w-4" /> Restricted record</p>
        <p className="text-sm text-muted-foreground">
          You're not on this client's care team. Opening it is logged and reviewed by compliance. Tell us why you need it.
        </p>
        <Textarea aria-label="Reason for opening" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for opening this chart" />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">{ACCESS_MODEL_DRAFT_LABEL}</span>
          <Button disabled={!reason.trim()} onClick={submit}>Open chart</Button>
        </div>
      </Card>
    </div>
  );
}
