// §Phase 7d — who owes what on a claim, the unrecorded-arrangement flag, and
// manual patient payment recording. Every write goes through ehr-ext, which
// enforces billing write itself; the page guard is feedback only.
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import {
  AdelanteEHRExt,
  PAYMENT_METHOD_LABEL,
  type Claim,
  type PaymentMethod,
} from "@/lib/ehr-ext";
import { PAYMENT_ARRANGEMENTS, PATIENT_PAY_PROGRAMS, type PaymentArrangement } from "@/lib/rates";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const DOLLARS = (c?: number) => (c === undefined ? "—" : `$${(c / 100).toFixed(2)}`);
const inputCls = "rounded-md border bg-background px-2 py-1 text-xs";

export function PatientBalance({ claim, canWrite }: { claim: Claim; canWrite: boolean }) {
  const arrangement = useEhr(() => AdelanteEHR.getPatient(claim.patientId)?.paymentArrangement);
  const patientPays = claim.program ? PATIENT_PAY_PROGRAMS.has(claim.program) : false;
  const payments = claim.patientPayments ?? [];
  return (
    <div className="font-sans space-y-0.5 text-[10px]" data-testid="patient-balance">
      {claim.arrangementMissing && (
        <div
          data-testid="arrangement-missing"
          className="inline-flex items-center gap-1 rounded-full bg-gold/20 px-2 py-0.5 text-navy"
        >
          <AlertTriangle className="h-3 w-3" /> Payment arrangement not recorded — confirm before billing
        </div>
      )}
      {claim.arrangementMissing && canWrite && (
        <ArrangementPicker patientId={claim.patientId} current={arrangement} />
      )}
      {claim.program === "grant_isl" ? (
        <div className="text-muted-foreground">Funder pays (grant / ISL) · patient owes $0.00</div>
      ) : patientPays ? (
        <div data-testid="patient-owes">
          Patient owes <span className="font-medium">{DOLLARS(claim.patientBalanceCents)}</span>
          {(claim.patientPaidCents ?? 0) > 0 && (
            <span className="text-muted-foreground"> · paid {DOLLARS(claim.patientPaidCents)} of {DOLLARS(claim.patientPortionCents)}</span>
          )}
          {claim.arrangementMissing && <span className="text-muted-foreground"> (provisional)</span>}
        </div>
      ) : null}
      {claim.overpaidReview && (
        <div className="text-destructive">Paid more than current charge — review</div>
      )}
      {payments.length > 0 && (
        <ul className="text-muted-foreground">
          {payments.map((p) => (
            <li key={p.id} className={p.voidedAt ? "line-through" : ""}>
              {DOLLARS(p.amountCents)} {PAYMENT_METHOD_LABEL[p.method]} · {p.receivedOn}
              {p.reference ? ` · ${p.reference}` : ""} · by {p.recordedByName}
              {p.voidedAt ? ` · void: ${p.voidReason}` : ""}
              {!p.voidedAt && canWrite && <VoidPayment claimId={claim.id} paymentId={p.id} />}
            </li>
          ))}
        </ul>
      )}
      {canWrite && patientPays && (claim.patientBalanceCents ?? 0) > 0 && <RecordPayment claim={claim} />}
    </div>
  );
}

function ArrangementPicker({ patientId, current }: { patientId: string; current?: PaymentArrangement }) {
  return (
    <label className="flex items-center gap-1">
      Set arrangement
      <select
        data-testid="arrangement-select"
        className={inputCls}
        value={current ?? ""}
        onChange={(e) => {
          const r = AdelanteEHRExt.setPaymentArrangement(patientId, e.target.value as PaymentArrangement);
          if (!r.ok) return toast.error(r.error);
          toast.success(`Arrangement saved · ${r.repriced.length} open claim(s) re-priced`);
        }}
      >
        <option value="" disabled>
          Choose…
        </option>
        {PAYMENT_ARRANGEMENTS.map((a) => (
          <option key={a.id} value={a.id}>
            {a.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function RecordPayment({ claim }: { claim: Claim }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [ref, setRef] = useState("");
  const save = () => {
    const cents = Math.round(Number(amount) * 100);
    const r = AdelanteEHRExt.recordPatientPayment({
      claimId: claim.id,
      amountCents: cents,
      receivedOn: date,
      method,
      reference: ref,
    });
    if (!r.ok) return toast.error(r.error);
    toast.success(`Payment recorded · balance ${DOLLARS(r.claim.patientBalanceCents)}`);
    setOpen(false);
    setAmount("");
    setRef("");
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="underline text-navy" data-testid="record-payment">
          Record payment
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-2 text-xs">
        <p className="font-medium">Record a payment received</p>
        <p className="text-muted-foreground">Balance {DOLLARS(claim.patientBalanceCents)}. No card processing here.</p>
        <label className="block">
          Amount ($)
          <input data-testid="payment-amount" className={`${inputCls} w-full`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="block">
          Date received
          <input className={`${inputCls} w-full`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="block">
          Method
          <select className={`${inputCls} w-full`} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABEL[m]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          Receipt / check no. — never a card number
          <input className={`${inputCls} w-full`} value={ref} onChange={(e) => setRef(e.target.value)} />
        </label>
        <button type="button" data-testid="save-payment" onClick={save} className="rounded-md bg-navy px-3 py-1 text-navy-foreground">
          Save payment
        </button>
      </PopoverContent>
    </Popover>
  );
}

function VoidPayment({ claimId, paymentId }: { claimId: string; paymentId: string }) {
  return (
    <button
      type="button"
      className="ml-1 underline"
      onClick={() => {
        const reason = window.prompt("Reason for voiding this payment?") ?? "";
        const r = AdelanteEHRExt.voidPatientPayment(claimId, paymentId, reason);
        if (!r.ok) toast.error(r.error);
        else toast.success("Payment voided");
      }}
    >
      Void
    </button>
  );
}
