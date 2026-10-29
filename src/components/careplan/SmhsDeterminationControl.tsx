import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActingStaff } from "@/lib/roles";
import { useEhr } from "@/lib/ehr";
import { actFor } from "@/lib/actions/act";
import { canRecordSmhsDetermination, getStructuredPlan, PLAN_DRAFT_LABEL, SMHS_REASON_LABEL, SMHS_REASONS, type SmhsReason } from "@/lib/structuredCarePlan";

const selectClass = "min-h-9 w-full rounded-sm border border-line-strong bg-surface px-2 text-base text-ink";
export function SmhsDeterminationControl({ patientId, readOnly }: { patientId: string; readOnly?: boolean }) {
  const actor = useActingStaff();
  const determination = useEhr(() => getStructuredPlan(patientId).smhsDetermination);
  const allowed = !readOnly && canRecordSmhsDetermination(patientId, { role: actor.role, staffId: actor.staffId });
  const [editing, setEditing] = useState(false);
  const [meets, setMeets] = useState<"yes" | "no" | "">("");
  const [date, setDate] = useState("");
  const [reason, setReason] = useState<SmhsReason | "">("");
  return <section className="space-y-3 border-y border-line py-3" aria-label="SMHS determination">
    <h5 className="text-base font-bold">SMHS determination</h5>
    <p className="text-sm text-ink-muted">{PLAN_DRAFT_LABEL} · Christi review pending.</p>
    <p className="text-base" role="status">{determination ? `${determination.meets ? "Meets" : "Does not meet"} SMHS criteria · ${determination.determinedAt} · ${determination.determinedBy}` : "No clinician determination recorded."}</p>
    {allowed && !editing && <Button variant="outline" size="sm" onClick={() => { setMeets(determination ? determination.meets ? "yes" : "no" : ""); setDate(determination?.determinedAt ?? ""); setReason(""); setEditing(true); }}>Record SMHS determination</Button>}
    {allowed && editing && <div className="space-y-3">
      <label className="block space-y-1">Meets SMHS criteria — Required<select className={selectClass} value={meets} onChange={e => setMeets(e.target.value as typeof meets)}><option value="">Choose determination</option><option value="yes">Meets criteria</option><option value="no">Does not meet criteria</option></select></label>
      <label className="block space-y-1">Determination date — Required<Input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
      <label className="block space-y-1">Determination reason — Required<select className={selectClass} value={reason} onChange={e => setReason(e.target.value as SmhsReason)}><option value="">Choose reason</option>{SMHS_REASONS.map(value => <option key={value} value={value}>{SMHS_REASON_LABEL[value]}</option>)}</select></label>
      <p className="text-sm text-ink-muted">Applies on or after this date. Existing visits are not changed.</p>
      <div className="flex flex-wrap gap-2"><Button disabled={!meets || !date || !reason} onClick={() => {
        if (!meets || !date || !reason) return;
        try { actFor("smhs_determination_set", "setSmhsDetermination", patientId, patientId, { meets: meets === "yes", determinedAt: date, reasonCode: reason }, { name: actor.staffName, role: actor.role, staffId: actor.staffId }); toast.success("SMHS determination recorded."); setEditing(false); }
        catch (error) { toast.error(error instanceof Error ? error.message : "Could not record determination."); }
      }}>Save determination</Button><Button variant="ghost" onClick={() => setEditing(false)}>Keep current determination</Button></div>
    </div>}
  </section>;
}