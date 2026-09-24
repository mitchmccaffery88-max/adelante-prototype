// §Phase 7d follow-up — payment arrangement on the chart (Eligibility section),
// so billing can record it before any claim exists. Writes go through
// AdelanteEHRExt.setPaymentArrangement, which enforces billing write, audits,
// and re-prices open unsubmitted claims. Everyone else sees it read-only.
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { AdelanteEHRExt } from "@/lib/ehr-ext";
import { PAYMENT_ARRANGEMENTS, type PaymentArrangement } from "@/lib/rates";
import { canAccess, useActingStaff } from "@/lib/roles";
import { Card } from "@/components/ui/card";
import { ClientDate } from "@/components/ClientDate";

export function PaymentArrangementCard({ patientId }: { patientId: string }) {
  const p = useEhr(() => AdelanteEHR.getPatient(patientId));
  const { role } = useActingStaff();
  const canWrite = canAccess(role, "billing").level === "write";
  if (!p) return null;
  const current = p.paymentArrangement;
  const label = PAYMENT_ARRANGEMENTS.find((a) => a.id === current)?.label;
  const by = p.paymentArrangementSetBy;
  return (
    <Card className="p-3 space-y-2" data-testid="payment-arrangement-card">
      <div className="text-xs font-medium uppercase text-muted-foreground">Payment arrangement</div>
      <p className="text-xs text-muted-foreground">
        How this client pays when a visit isn't covered by Medi-Cal. Set by billing.
      </p>
      {canWrite ? (
        <select
          data-testid="chart-arrangement-select"
          aria-label="Payment arrangement"
          className="rounded-md border bg-background px-2 py-1 text-sm"
          value={current ?? ""}
          onChange={(e) => {
            const r = AdelanteEHRExt.setPaymentArrangement(patientId, e.target.value as PaymentArrangement);
            if (!r.ok) return void toast.error(r.error);
            toast.success(
              r.repriced.length
                ? `Arrangement saved · ${r.repriced.length} open claim(s) re-priced`
                : "Arrangement saved",
            );
          }}
        >
          <option value="" disabled>
            Not recorded — choose…
          </option>
          {PAYMENT_ARRANGEMENTS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      ) : (
        <div className="text-sm text-navy" data-testid="chart-arrangement-value">
          {label ?? "Not recorded"}
        </div>
      )}
      {by ? (
        <p className="text-[11px] text-muted-foreground" data-testid="chart-arrangement-setby">
          Set by {by.name} ({by.role.replace(/_/g, " ")}) on <ClientDate value={by.at} />
        </p>
      ) : current ? null : (
        <p className="text-[11px] text-muted-foreground">
          Not recorded yet. Claims for this client will be flagged until billing sets it.
        </p>
      )}
    </Card>
  );
}
