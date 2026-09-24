// §Phase 3b — the one coverage model, visible.
//
// Payer spans used to live in a second, disconnected store that no screen
// ever showed. They now live on `Patient.coverage.plans` and are shown and
// edited here, alongside the coverage status/check history they belong with.
import { useState } from "react";
import {
  AdelanteEHR,
  COVERAGE_PLAN_SOURCE_LABEL,
  useEhr,
  type CoveragePlanSource,
} from "@/lib/ehr";
import type { StaffRole } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClientDate } from "@/components/ClientDate";
import { toast } from "sonner";

const SOURCES = Object.keys(COVERAGE_PLAN_SOURCE_LABEL) as CoveragePlanSource[];

export function CoveragePlansSection({
  patientId,
  actor,
  readOnly,
}: {
  patientId: string;
  actor: { actorId: string; actorRole: StaffRole };
  readOnly?: boolean;
}) {
  const plans = useEhr(() => AdelanteEHR.listCoveragePlans(patientId));
  const [adding, setAdding] = useState(false);
  const [payer, setPayer] = useState("");
  const [plan, setPlan] = useState("");
  const [memberId, setMemberId] = useState("");
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [source, setSource] = useState<CoveragePlanSource>("self_report");

  function save() {
    const res = AdelanteEHR.addCoveragePlan(patientId, {
      payer,
      plan,
      memberId,
      from,
      source,
      actorId: actor.actorId,
      actorRole: actor.actorRole,
    });
    if (!res.ok) {
      toast.error(res.error ?? "Could not add this plan.");
      return;
    }
    toast.success("Plan added to the coverage record");
    setAdding(false);
    setPayer("");
    setPlan("");
    setMemberId("");
  }

  return (
    <div className="mt-4 border-t pt-3" data-testid="coverage-plans">
      <div className="flex items-center justify-between">
        <h4 className="text-xs uppercase tracking-wider text-muted-foreground">Plans on file</h4>
        {!readOnly && !adding && (
          <Button size="sm" variant="ghost" onClick={() => setAdding(true)} data-testid="coverage-plan-add">
            Add plan
          </Button>
        )}
      </div>

      {plans.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground" data-testid="coverage-plans-empty">
          No plan recorded. Nobody has written down which plan this person is on.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {plans.map((c) => {
            const current = !c.to;
            return (
              <li key={c.id} className="rounded border p-2.5 text-sm" data-testid="coverage-plan-row">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {c.payer}
                    {c.plan ? ` — ${c.plan}` : ""}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {current ? "Current" : "Ended"}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  <ClientDate value={c.from} /> –{" "}
                  {c.to ? <ClientDate value={c.to} /> : "no end date recorded"}
                  {c.memberId ? ` · member ${c.memberId}` : ""}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {COVERAGE_PLAN_SOURCE_LABEL[c.source]}
                  {c.recordedBy ? ` · recorded by ${c.recordedBy}` : ""}
                  {c.aidCode ? ` · aid code ${c.aidCode}` : ""}
                  {typeof c.shareOfCostCents === "number" ? ` · share of cost $${(c.shareOfCostCents / 100).toFixed(2)}` : ""}
                  {c.planNotOnList ? " · plan not on plan list" : ""}
                </p>
                {!readOnly && current && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-1 h-7 px-2 text-[11px]"
                    data-testid="coverage-plan-end"
                    onClick={() => {
                      const res = AdelanteEHR.endCoveragePlan(
                        patientId,
                        c.id,
                        new Date().toISOString().slice(0, 10),
                        actor,
                      );
                      if (!res.ok) toast.error(res.error ?? "Could not end this plan.");
                      else toast.success("Plan marked as ended today");
                    }}
                  >
                    Mark ended today
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {adding && (
        <div className="mt-3 space-y-2 rounded border p-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground">Plan / payer</Label>
              <Input
                className="h-8 text-xs"
                value={payer}
                onChange={(e) => setPayer(e.target.value)}
                data-testid="coverage-plan-payer"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Product (optional)</Label>
              <Input className="h-8 text-xs" value={plan} onChange={(e) => setPlan(e.target.value)} />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Member ID (not the CIN)</Label>
              <Input
                className="h-8 text-xs"
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Start date</Label>
              <Input
                type="date"
                className="h-8 text-xs"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Where this came from</Label>
            <Select value={source} onValueChange={(v) => setSource(v as CoveragePlanSource)}>
              <SelectTrigger className="h-8 text-xs" data-testid="coverage-plan-source">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {COVERAGE_PLAN_SOURCE_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Adding a plan records what someone was told or read. It does not change the coverage
            status above, and nothing is checked with the plan automatically.
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={save} data-testid="coverage-plan-save">
              Save plan
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
