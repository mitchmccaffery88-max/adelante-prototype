// §Phase 8c — the chart's eligibility history with a source badge on every
// record, plus the honest "Check electronically" control.
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClientDate } from "@/components/ClientDate";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { checkEligibility } from "@/lib/eligibility/eligibility";
import { VerificationSourceBadge } from "@/components/coverage/VerificationSourceBadge";

const money = (c?: number) => (typeof c === "number" ? `$${(c / 100).toFixed(2)}` : undefined);

export function EligibilityHistoryCard({
  patientId,
  canCheck,
  onRecordManual,
}: {
  patientId: string;
  canCheck: boolean;
  onRecordManual: () => void;
}) {
  const records = useEhr(() => AdelanteEHR.getPatient(patientId)?.coverage?.verifications ?? []);
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <Card className="p-3 space-y-2" data-testid="eligibility-history">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-medium uppercase text-muted-foreground">Eligibility history</div>
        {canCheck && (
          <Button
            size="sm"
            variant="outline"
            data-testid="check-electronically"
            onClick={() => setNotice(checkEligibility(patientId).detail)}
          >
            Check electronically
          </Button>
        )}
      </div>
      {notice && (
        <div className="rounded border bg-secondary/40 p-2 text-xs" role="status" data-testid="eligibility-not-connected">
          {notice}{" "}
          <button type="button" className="underline text-teal" onClick={onRecordManual}>
            Record a manual check
          </button>
        </div>
      )}
      {records.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing reported or checked yet.</p>
      ) : (
        <ul className="space-y-2 text-xs">
          {records.map((v) => {
            const b = v.electronic?.benefits;
            const plan = b?.managedCarePlan;
            return (
              <li key={v.id} className="rounded border p-2 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <VerificationSourceBadge record={v} />
                  <span className="text-muted-foreground">
                    <ClientDate value={v.checkedAt} /> · {v.checkedBy} · result {v.result}
                  </span>
                </div>
                {v.electronic && (
                  <div className="text-muted-foreground">
                    Trace {v.electronic.transactionId} · {v.electronic.vendor}
                    {v.electronic.errorReason ? ` · ${v.electronic.errorReason}` : ""}
                    {b?.aidCode ? ` · aid code ${b.aidCode}` : ""}
                    {money(b?.shareOfCostCents) ? ` · share of cost ${money(b?.shareOfCostCents)}` : ""}
                    {plan ? ` · plan ${plan.matchedListName ?? `${plan.payerName} (not on plan list)`}` : ""}
                    {b?.coverageStart ? ` · ${b.coverageStart}–${b.coverageEnd ?? "open"}` : ""}
                  </div>
                )}
                {v.channelNote && !v.electronic && <div className="text-muted-foreground">{v.channelNote}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
