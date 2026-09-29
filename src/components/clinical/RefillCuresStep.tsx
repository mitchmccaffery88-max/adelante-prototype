// §Refill safety — CURES step on a controlled (DEA II–V) refill. The store
// (`reviewRefill` with actorRole) enforces the same rule.
import { act, actFor } from "@/lib/actions/act";
import { useState } from "react";
import { toast } from "sonner";
import { AdelanteEHR, type RefillRequest } from "@/lib/ehr";
import { isPrescriberRole, useActingStaff } from "@/lib/roles";
import { CURES_PLACEHOLDER_LABEL, CURES_RESULT_LABEL, type CuresResult } from "@/lib/orderSafety";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldAlert, ShieldCheck } from "lucide-react";

export function RefillCuresStep({ refill }: { refill: RefillRequest }) {
  const { role, staffName } = useActingStaff();
  const nowLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const [at, setAt] = useState(nowLocal);
  const [result, setResult] = useState<CuresResult>("no_concerns");
  const [reason, setReason] = useState("");
  const [emergency, setEmergency] = useState(false);
  const c = refill.curesCheck;
  const id = refill.id;
  return (
    <div className="mt-2 space-y-2 rounded-lg border p-3 text-xs" aria-label="CURES check for refill">
      <div className="flex items-center gap-2 font-medium text-navy">
        {c ? <ShieldCheck className="h-4 w-4 text-teal" /> : <ShieldAlert className="h-4 w-4 text-destructive" />}
        CURES check required before approval
      </div>
      <p className="rounded bg-muted px-2 py-1 text-muted-foreground">{CURES_PLACEHOLDER_LABEL}</p>
      {c ? (
        <p>
          {c.emergencyOverride ? "Emergency override" : CURES_RESULT_LABEL[c.result]} · checked {c.checkedAt.replace("T", " ")} by {c.by}
          {c.reason ? ` · ${c.reason}` : ""}
        </p>
      ) : !isPrescriberRole(role) ? (
        <p className="text-muted-foreground">A prescriber must record the CURES check before this refill can be approved.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <Label htmlFor={`rcat-${id}`} className="text-xs">Date and time checked</Label>
            <Input id={`rcat-${id}`} type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
          </div>
          <div>
            <Label htmlFor={`rcres-${id}`} className="text-xs">Result</Label>
            <select id={`rcres-${id}`} className="mt-0.5 h-9 w-full rounded-md border bg-background px-2" value={result} onChange={(e) => setResult(e.target.value as CuresResult)}>
              {Object.entries(CURES_RESULT_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 sm:col-span-2">
            <input type="checkbox" checked={emergency} onChange={(e) => setEmergency(e.target.checked)} /> Emergency override (approve without a completed check)
          </label>
          {(result === "unable_to_access" || emergency) && (
            <div className="sm:col-span-2">
              <Label htmlFor={`rcrs-${id}`} className="text-xs">Reason (required)</Label>
              <Input id={`rcrs-${id}`} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          )}
          <Button
            size="sm"
            className="w-fit"
            onClick={() => {
              try {
                actFor("cures", "recordRefillCuresCheck", refill.patientId, id, { checkedAt: at, result, reason, emergencyOverride: emergency, by: staffName, role });
                toast.success("CURES check recorded");
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            Record CURES check
          </Button>
        </div>
      )}
    </div>
  );
}
