// §B1/B2 — allergy cross-check, NKDA prompt and the CURES/PDMP step on a
// draft order. The store (`orderSigningBlocker`) enforces the same rules.
import { act, actFor } from "@/lib/actions/act";
import { useState } from "react";
import { toast } from "sonner";
import { AdelanteEHR, useEhr, type MedOrder } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import {
  ALLERGY_CLASS_DRAFT_LABEL,
  CURES_PLACEHOLDER_LABEL,
  CURES_RESULT_LABEL,
  allergiesNotRecorded,
  deaScheduleOf,
  findAllergyMatches,
  requiresCuresCheck,
  type CuresResult,
} from "@/lib/orderSafety";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ShieldAlert, ShieldCheck } from "lucide-react";

// CURES recorders — prescribers only (physician, PMHNP), same list the store enforces.
const PRESCRIBERS = ["pmhnp", "physician"];

export function OrderSafetyPanel({ order, patientId }: { order: MedOrder; patientId: string }) {
  const { role, staffName } = useActingStaff();
  const allergies = useEhr(() => AdelanteEHR.getPatient(patientId)?.allergies ?? []);
  const hits = findAllergyMatches(order, allergies);
  const noAllergies = allergiesNotRecorded(allergies);
  const needsCures = requiresCuresCheck(order);
  const [ovr, setOvr] = useState("");
  const nowLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const [at, setAt] = useState(nowLocal);
  const [result, setResult] = useState<CuresResult>("no_concerns");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [emergency, setEmergency] = useState(false);
  const run = (f: () => void, ok: string) => {
    try {
      f();
      toast.success(ok);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-2">
      {noAllergies && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/60 bg-destructive/5 p-3 text-xs text-destructive">
          <ShieldAlert className="h-4 w-4" />
          <span className="flex-1 min-w-0">Allergies not recorded — confirm NKDA or add allergies before signing.</span>
          <Button size="sm" variant="outline" onClick={() => run(() => AdelanteEHR.confirmNkda(patientId, staffName), "NKDA recorded")}>
            Confirm NKDA
          </Button>
        </div>
      )}
      {hits.length > 0 && (
        <div role="alert" className="space-y-2 rounded-lg border border-destructive/60 bg-destructive/5 p-3 text-xs">
          <div className="flex items-start gap-2 text-destructive font-medium">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Allergy warning: {hits.map((h) => (h.kind === "class" ? `${h.substance} (same class: ${h.className})` : `${h.substance} (same ingredient)`)).join("; ")}.
              {" "}Signing is blocked unless you override.
            </span>
          </div>
          {hits.some((h) => h.kind === "class") && <p className="text-muted-foreground">{ALLERGY_CLASS_DRAFT_LABEL}</p>}
          {order.allergyOverride ? (
            <p className="text-navy">Overridden by {order.allergyOverride.by}: {order.allergyOverride.reason}</p>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[12rem]">
                <Label htmlFor={`ovr-${order.id}`} className="text-xs">Override reason (required)</Label>
                <Input id={`ovr-${order.id}`} value={ovr} onChange={(e) => setOvr(e.target.value)} />
              </div>
              <Button size="sm" variant="destructive" onClick={() => run(() => AdelanteEHR.overrideOrderAllergy(patientId, order.id, { reason: ovr, by: staffName, role }), "Allergy override recorded")}>
                Override allergy
              </Button>
            </div>
          )}
        </div>
      )}
      {needsCures && (
        <div className="space-y-2 rounded-lg border p-3 text-xs" aria-label="CURES check">
          <div className="flex items-center gap-2 font-medium text-navy">
            {order.curesCheck ? <ShieldCheck className="h-4 w-4 text-teal" /> : <ShieldAlert className="h-4 w-4 text-destructive" />}
            CURES check required ({deaScheduleOf(order) ?? "controlled"})
          </div>
          <p className="rounded bg-muted px-2 py-1 text-muted-foreground">{CURES_PLACEHOLDER_LABEL}</p>
          {order.curesCheck ? (
            <p>
              {order.curesCheck.emergencyOverride ? "Emergency override" : CURES_RESULT_LABEL[order.curesCheck.result]} · checked{" "}
              {order.curesCheck.checkedAt.replace("T", " ")} by {order.curesCheck.by}
              {order.curesCheck.reason ? ` · ${order.curesCheck.reason}` : ""}
            </p>
          ) : !PRESCRIBERS.includes(role) ? (
            <p className="text-muted-foreground">A prescriber must record the CURES check before this order can be signed.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label htmlFor={`cat-${order.id}`} className="text-xs">Date and time checked</Label>
                <Input id={`cat-${order.id}`} type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
              </div>
              <div>
                <Label htmlFor={`cres-${order.id}`} className="text-xs">Result</Label>
                <select id={`cres-${order.id}`} className="mt-0.5 h-9 w-full rounded-md border bg-background px-2" value={result} onChange={(e) => setResult(e.target.value as CuresResult)}>
                  {Object.entries(CURES_RESULT_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 sm:col-span-2">
                <input type="checkbox" checked={emergency} onChange={(e) => setEmergency(e.target.checked)} /> Emergency override (sign without a completed check)
              </label>
              {(result === "unable_to_access" || emergency) && (
                <div className="sm:col-span-2">
                  <Label htmlFor={`crs-${order.id}`} className="text-xs">Reason (required)</Label>
                  <Input id={`crs-${order.id}`} value={reason} onChange={(e) => setReason(e.target.value)} />
                </div>
              )}
              <div className="sm:col-span-2">
                <Label htmlFor={`cnote-${order.id}`} className="text-xs">Note (optional)</Label>
                <Textarea id={`cnote-${order.id}`} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              <Button size="sm" className="w-fit" onClick={() => run(() => act("cures", "recordCuresCheck", patientId, order.id, { checkedAt: at, result, reason, note, emergencyOverride: emergency, by: staffName, role }), "CURES check recorded")}>
                Record CURES check
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
