// §Phase 7c — the real billing code table + effective-dated rate table on
// /billing, and the per-claim amount cell (rate × units, basis, no-rate flag,
// billing corrections). Every write goes through src/lib/rates.ts or
// `AdelanteEHRExt.correctClaim`, which enforce billing write themselves; the
// hidden buttons here are only fast feedback.
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { useEhr } from "@/lib/ehr";
import { AdelanteEHRExt, claimUnitLabel, type Claim } from "@/lib/ehr-ext";
import { canAccess, useActingStaff } from "@/lib/roles";
import {
  PAYER_PROGRAMS,
  PROGRAM_LABEL,
  addRate,
  endDateRate,
  listBillingCodes,
  listRates,
  unitBasisLabel,
  upsertBillingCode,
  type PayerProgram,
  type RoundingRule,
  type UnitType,
} from "@/lib/rates";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const DOLLARS = (cents?: number) =>
  cents === undefined ? "—" : `$${(cents / 100).toFixed(2)}`;
const today = () => new Date().toISOString().slice(0, 10);
const inputCls = "rounded-md border bg-background px-2 py-1 text-xs";
const btnCls = "rounded-md bg-navy text-navy-foreground px-3 py-1.5 text-xs disabled:opacity-50";

// ---------------------------------------------------------------------------
// Amount cell
// ---------------------------------------------------------------------------

export function ClaimAmount({ claim }: { claim: Claim }) {
  const { role } = useActingStaff();
  const canWrite = canAccess(role, "billing").level === "write";
  const locked = ["submitted", "paid", "denied", "partial"].includes(claim.state);
  return (
    <div className="space-y-0.5" data-testid="claim-amount" data-rate-status={claim.rateStatus}>
      {claim.rateStatus === "no_rate" ? (
        <span
          data-testid="no-rate-badge"
          title={claim.noRateReason}
          className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] text-destructive"
        >
          <AlertTriangle className="h-3 w-3" /> No rate on file
        </span>
      ) : (
        <div>{DOLLARS(claim.chargeCents)}</div>
      )}
      <div className="font-sans text-[10px] text-muted-foreground" data-testid="claim-units">
        {claim.serviceCode ?? "no code"}
        {claim.program ? ` · ${PROGRAM_LABEL[claim.program]}` : ""} · {claimUnitLabel(claim)}
        {claim.rateCentsPerUnit !== undefined ? ` @ ${DOLLARS(claim.rateCentsPerUnit)}` : ""}
      </div>
      {canWrite && !locked && <CorrectClaim claim={claim} />}
    </div>
  );
}

function CorrectClaim({ claim }: { claim: Claim }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(claim.serviceCode ?? "");
  const [program, setProgram] = useState<string>(claim.program ?? "");
  const [units, setUnits] = useState(String(claim.units ?? 1));
  const [reason, setReason] = useState("");
  const codes = listBillingCodes();
  const save = () => {
    const change: { serviceCode?: string; program?: string; units?: number } = {};
    if (code !== (claim.serviceCode ?? "")) change.serviceCode = code;
    if (program !== (claim.program ?? "")) change.program = program;
    if (Number(units) !== (claim.units ?? 1)) change.units = Number(units);
    const r = AdelanteEHRExt.correctClaim(claim.id, change, reason);
    if (!r.ok) return toast.error(r.error);
    toast.success(r.claim.rateStatus === "priced" ? `Re-priced: ${DOLLARS(r.claim.chargeCents)}` : "Corrected — still no rate on file");
    setOpen(false);
    setReason("");
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="font-sans text-[10px] underline text-navy" data-testid="correct-claim">
          Correct
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-2 text-xs">
        <p className="font-medium">Correct code, program or units</p>
        <label className="block">
          Code
          <select className={`${inputCls} w-full`} value={code} onChange={(e) => setCode(e.target.value)}>
            {codes.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.description}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          Program
          <select className={`${inputCls} w-full`} value={program} onChange={(e) => setProgram(e.target.value)}>
            {PAYER_PROGRAMS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          Units
          <input className={`${inputCls} w-full`} type="number" min={1} value={units} onChange={(e) => setUnits(e.target.value)} />
        </label>
        <label className="block">
          Reason (required)
          <input className={`${inputCls} w-full`} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <button type="button" className={btnCls} onClick={save}>
          Save and re-price
        </button>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Code + rate tables
// ---------------------------------------------------------------------------

export function RatesPanel({ canWrite }: { canWrite: boolean }) {
  const rates = useEhr(() => listRates());
  const codes = useEhr(() => listBillingCodes());
  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-card" data-testid="rates-section">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
          <div>
            <h2 className="text-sm font-semibold">Rates</h2>
            <p className="text-xs text-muted-foreground">
              Per unit, by billing code and payer program, with effective dates. Rates are never edited
              or deleted — end-date one and add its replacement.
            </p>
          </div>
          {!canWrite && <span className="text-[10px] text-muted-foreground">View only</span>}
        </header>
        {canWrite && <AddRateForm codes={codes.map((c) => c.code)} />}
        <div className="divide-y md:hidden">
          {rates.map((r) => (
            <div key={r.id} className="p-3 text-xs space-y-1" data-testid="rate-row">
              <div className="flex justify-between font-medium">
                <span className="font-mono">{r.code}</span>
                <span>{DOLLARS(r.amountCents)} / unit</span>
              </div>
              <div className="text-muted-foreground">{PROGRAM_LABEL[r.program]}</div>
              <div>
                {r.effectiveFrom} → {r.effectiveTo ?? "open"} {r.placeholder && <PlaceholderTag />}
              </div>
              {canWrite && !r.effectiveTo && <EndDateRate id={r.id} />}
            </div>
          ))}
        </div>
        <table className="hidden w-full text-sm md:table">
          <thead className="bg-secondary/60 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Code</th>
              <th className="px-3 py-2 text-left">Program</th>
              <th className="px-3 py-2 text-left">Per unit</th>
              <th className="px-3 py-2 text-left">Effective</th>
              <th className="px-3 py-2 text-left">Added by</th>
              <th className="px-3 py-2 text-right" />
            </tr>
          </thead>
          <tbody>
            {rates.map((r) => (
              <tr key={r.id} className="border-t" data-testid="rate-row">
                <td className="px-3 py-2 font-mono text-xs">{r.code}</td>
                <td className="px-3 py-2 text-xs">{PROGRAM_LABEL[r.program]}</td>
                <td className="px-3 py-2 font-mono text-xs">{DOLLARS(r.amountCents)}</td>
                <td className="px-3 py-2 text-xs">
                  {r.effectiveFrom} → {r.effectiveTo ?? "open"}
                  {r.endReason && <div className="text-[10px] text-muted-foreground">Ended: {r.endReason}</div>}
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.placeholder ? <PlaceholderTag /> : r.createdBy}
                </td>
                <td className="px-3 py-2 text-right">{canWrite && !r.effectiveTo && <EndDateRate id={r.id} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border bg-card" data-testid="codes-section">
        <header className="border-b p-3">
          <h2 className="text-sm font-semibold">Billing codes and units</h2>
          <p className="text-xs text-muted-foreground">
            Unit length belongs to the code. Amount on a claim = rate per unit × units.
          </p>
        </header>
        {canWrite && <CodeForm />}
        <div className="divide-y">
          {codes.map((c) => (
            <div key={c.code} className="flex flex-wrap items-start justify-between gap-2 p-3 text-xs" data-testid="code-row">
              <div>
                <span className="font-mono font-medium">{c.code}</span> — {c.description}
                <div className="text-muted-foreground">
                  {unitBasisLabel(c)}
                  {c.unitType === "per_minutes" &&
                    (c.roundingRule === "half_plus" ? " · counts once more than half is delivered" : " · whole units only")}
                </div>
                {c.needsReview && <div className="text-[10px] text-destructive">Needs billing review: {c.needsReview}</div>}
              </div>
              {c.draft && (
                <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] text-navy">Draft — pending billing review</span>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function PlaceholderTag() {
  return (
    <span className="ml-1 rounded-full bg-gold/20 px-2 py-0.5 text-[10px] text-navy" data-testid="placeholder-tag">
      Placeholder — enter real fee schedule
    </span>
  );
}

function AddRateForm({ codes }: { codes: string[] }) {
  const [code, setCode] = useState(codes[0] ?? "");
  const [program, setProgram] = useState<PayerProgram>("dmc_ods");
  const [amount, setAmount] = useState("");
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState("");
  const submit = () => {
    const cents = Math.round(Number(amount) * 100);
    const r = addRate({ code, program, amountCents: cents, effectiveFrom: from, ...(to ? { effectiveTo: to } : {}) });
    if (!r.ok) return toast.error(r.error);
    toast.success(`Rate added: ${r.rate.code} ${DOLLARS(r.rate.amountCents)} / unit`);
    setAmount("");
  };
  return (
    <div className="flex flex-wrap items-end gap-2 border-b p-3 text-xs" data-testid="add-rate-form">
      <label>
        Code
        <select aria-label="Rate code" className={`${inputCls} block`} value={code} onChange={(e) => setCode(e.target.value)}>
          {codes.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label>
        Program
        <select aria-label="Rate program" className={`${inputCls} block`} value={program} onChange={(e) => setProgram(e.target.value as PayerProgram)}>
          {PAYER_PROGRAMS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        $ per unit
        <input aria-label="Rate amount" className={`${inputCls} block w-24`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      <label>
        From
        <input aria-label="Rate from" type="date" className={`${inputCls} block`} value={from} onChange={(e) => setFrom(e.target.value)} />
      </label>
      <label>
        To (optional)
        <input aria-label="Rate to" type="date" className={`${inputCls} block`} value={to} onChange={(e) => setTo(e.target.value)} />
      </label>
      <button type="button" className={btnCls} onClick={submit}>
        Add rate
      </button>
    </div>
  );
}

function EndDateRate({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(today());
  const [reason, setReason] = useState("");
  const save = () => {
    const r = endDateRate(id, to, reason, (rid) => AdelanteEHRExt.latestPricedServiceDate(rid));
    if (!r.ok) return toast.error(r.error);
    toast.success(`Rate ends ${to}`);
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="text-[11px] underline text-navy" data-testid="end-date-rate">
          End-date
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-2 text-xs">
        <label className="block">
          Last day this rate applies
          <input aria-label="End date" type="date" className={`${inputCls} w-full`} value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="block">
          Reason (required)
          <input aria-label="End reason" className={`${inputCls} w-full`} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <button type="button" className={btnCls} onClick={save}>
          Save end date
        </button>
      </PopoverContent>
    </Popover>
  );
}

function CodeForm() {
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [unitType, setUnitType] = useState<UnitType>("per_minutes");
  const [unitMinutes, setUnitMinutes] = useState("15");
  const [roundingRule, setRoundingRule] = useState<RoundingRule>("half_plus");
  const load = (c: string) => {
    setCode(c);
    const hit = listBillingCodes().find((x) => x.code === c.toUpperCase());
    if (hit) {
      setDescription(hit.description);
      setUnitType(hit.unitType);
      setUnitMinutes(String(hit.unitMinutes ?? 15));
      setRoundingRule(hit.roundingRule);
    }
  };
  const submit = () => {
    const r = upsertBillingCode({
      code,
      description,
      unitType,
      ...(unitType === "per_minutes" ? { unitMinutes: Number(unitMinutes) } : {}),
      roundingRule,
    });
    if (!r.ok) return toast.error(r.error);
    toast.success(`Saved ${r.code.code}`);
  };
  return (
    <div className="flex flex-wrap items-end gap-2 border-b p-3 text-xs" data-testid="code-form">
      <label>
        Code (type an existing one to edit)
        <input aria-label="Code" className={`${inputCls} block w-28`} value={code} onChange={(e) => load(e.target.value)} />
      </label>
      <label>
        Description
        <input aria-label="Code description" className={`${inputCls} block w-48`} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <label>
        Unit
        <select aria-label="Unit type" className={`${inputCls} block`} value={unitType} onChange={(e) => setUnitType(e.target.value as UnitType)}>
          <option value="per_minutes">Per minutes</option>
          <option value="per_encounter">Per encounter</option>
          <option value="per_month">Per month</option>
        </select>
      </label>
      {unitType === "per_minutes" && (
        <>
          <label>
            Minutes
            <input aria-label="Unit minutes" className={`${inputCls} block w-16`} value={unitMinutes} onChange={(e) => setUnitMinutes(e.target.value)} />
          </label>
          <label>
            Rounding
            <select aria-label="Rounding" className={`${inputCls} block`} value={roundingRule} onChange={(e) => setRoundingRule(e.target.value as RoundingRule)}>
              <option value="half_plus">More than half counts</option>
              <option value="whole_units">Whole units only</option>
            </select>
          </label>
        </>
      )}
      <button type="button" className={btnCls} onClick={submit}>
        Save code
      </button>
    </div>
  );
}
