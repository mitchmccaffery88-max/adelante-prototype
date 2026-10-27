import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Circle } from "lucide-react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { runAction } from "@/lib/actions/runAction";
import { billingReadiness, LIFECYCLE_DRAFT, lifecycleForPatient } from "@/lib/careLifecycle";
import { canMarkDidntStart } from "@/lib/referralLifecycleActions";
import { DIDNT_START_DRAFT, DIDNT_START_REASONS, didntStartCareFor, didntStartReasonLabel } from "@/lib/lifecycleState";
import { LifecycleChip } from "./LifecycleChip";

/** Client Journey: enrolled stages 5–8, billing-readiness labels and the reopenable "Didn't start care" status. */
export function PatientLifecyclePanel({ patientId }: { patientId: string }) {
  const actor = useActingStaff();
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  const viewJson = useEhr(() => { const p = AdelanteEHR.getPatient(patientId); return p ? JSON.stringify(lifecycleForPatient(p)) : ""; });
  const readinessJson = useEhr(() => JSON.stringify(billingReadiness(patientId)));
  const dsc = useEhr(() => didntStartCareFor(patientId));
  const [reasonKey, setReasonKey] = useState("");
  const [why, setWhy] = useState("");
  if (!patient?.enrolledAt || !viewJson) return null;
  const view = JSON.parse(viewJson);
  const readiness = JSON.parse(readinessJson) as ReturnType<typeof billingReadiness>;
  const open = dsc && !dsc.reopenedAt;
  const a = { role: actor.role, staffId: actor.staffId, staffName: actor.staffName };
  const mayMark = canMarkDidntStart(a, patientId);
  const run = (id: string, args: unknown[], ok: string) => {
    const r = runAction(id, a, patient, { args: [a, patientId, ...args], auditReason: why });
    if (!r.ok) toast.error(r.reason); else { toast.success(ok); setWhy(""); setReasonKey(""); }
  };
  return (
    <Card className="p-4 space-y-3" data-testid="patient-lifecycle">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold">Getting started</h3>
        <LifecycleChip view={view} role={actor.role} showOwner />
      </div>
      {view.gaps.length > 0 && <p className="text-sm">Still missing: {view.gaps.join(" · ")}</p>}
      <div>
        <p className="text-sm font-bold">Billing readiness</p>
        <ul className="mt-1 space-y-1">
          {readiness.checklist.map((c) => (
            <li key={c.label} className="flex items-center gap-2 text-sm">
              {c.done ? <CheckCircle2 className="size-4 text-path" aria-hidden="true" /> : <Circle className="size-4 text-ink-muted" aria-hidden="true" />}
              {c.label} — {c.done ? "Done" : "Not yet"}
            </li>
          ))}
        </ul>
      </div>
      {open ? (
        <div className="space-y-2 border-t border-line pt-3">
          <p className="text-sm">Didn&apos;t start care — {didntStartReasonLabel(dsc!.reason)}.</p>
          {mayMark && <>
            <Label htmlFor="dsc-why" className="text-sm">Reason — Required</Label>
            <Textarea id="dsc-why" value={why} onChange={(e) => setWhy(e.target.value)} rows={2} />
            <Button variant="outline" disabled={why.trim().length < 3} onClick={() => run("didnt_start_care_reopen", [why], "Reopened — getting started again")}>Reopen</Button>
          </>}
        </div>
      ) : view.stage < 8 && mayMark && (
        <div className="space-y-2 border-t border-line pt-3">
          <p className="text-sm font-bold">Didn&apos;t start care</p>
          <p className="text-sm text-ink-muted">{DIDNT_START_DRAFT} Separate from a closed referral or a discharge; it can be reopened.</p>
          <Select value={reasonKey} onValueChange={setReasonKey}>
            <SelectTrigger aria-label="Reason"><SelectValue placeholder="Choose a reason" /></SelectTrigger>
            <SelectContent>
              {DIDNT_START_REASONS.filter((r) => canMarkDidntStart(a, patientId, r.key)).map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Label htmlFor="dsc-why2" className="text-sm">Reason — Required</Label>
          <Textarea id="dsc-why2" value={why} onChange={(e) => setWhy(e.target.value)} rows={2} />
          <Button variant="outline" disabled={!reasonKey || why.trim().length < 3} onClick={() => run("didnt_start_care_mark", [{ reason: reasonKey }, why], "Recorded")}>Record didn&apos;t start care</Button>
        </div>
      )}
      <p className="text-sm text-ink-muted">{LIFECYCLE_DRAFT}</p>
    </Card>
  );
}
