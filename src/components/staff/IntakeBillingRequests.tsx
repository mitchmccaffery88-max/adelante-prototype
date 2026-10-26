import { useState } from "react";
import { toast } from "sonner";
import { useActingStaff } from "@/lib/roles";
import { useEhr } from "@/lib/ehr";
import { billingIntakeRequests } from "@/lib/intakePhaseB";
import { billingCoverageRequests, billingCoverageDetail } from "@/lib/coverageRequests";
import { COVERAGE_PATHS, COVERAGE_CONFIG_DRAFT, listCountyPrograms, listFeeSchedules, listPayers, getAdapterConfig, type CoveragePath } from "@/lib/eligibility/coverageConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CoverageCheckDialog } from "@/components/coverage/CoverageCheckDialog";
import { SimulatedBadge } from "@/components/SimulatedBadge";
import { runAction } from "@/lib/actions/runAction";
import { Textarea } from "@/components/ui/textarea";

const selectClass = "min-h-9 w-full rounded-sm border border-line-strong bg-surface px-2 text-base text-ink";
type Row = ReturnType<typeof billingCoverageRequests>[number];

export function IntakeBillingRequests() {
  const actor = useActingStaff();
  const [patientId, setPatientId] = useState<string>();
  const [referralId, setReferralId] = useState("");
  const [reason, setReason] = useState("");
  const rows = JSON.parse(useEhr(() => JSON.stringify(billingCoverageRequests(actor)))) as Row[];
  const intakeIds = new Set((JSON.parse(useEhr(() => JSON.stringify(billingIntakeRequests(actor)))) as ReturnType<typeof billingIntakeRequests>).map((r) => r.referralId));
  if (!rows.length) return null;
  const run = (id: string, args: unknown[]) => {
    const r = runAction<unknown>(id, actor, undefined, { args: [actor, ...args, reason], auditReason: reason });
    if (!r.ok) { toast.error(r.reason); return; }
    Promise.resolve(r.value).then((v) => { const notice = (v as { notice?: string } | undefined)?.notice; toast.success(notice ?? "Recorded"); }, (e: Error) => toast.error(e.message));
  };
  return (
    <section className="space-y-3 border-t border-line pt-4" aria-label="Coverage requests">
      <h2 className="text-xl font-bold">Coverage requests</h2>
      <p className="text-sm text-ink-muted">{COVERAGE_CONFIG_DRAFT}. Adapter: {getAdapterConfig().selected.replace("_", " ")}{getAdapterConfig().clearinghouse.enabled ? "" : " · clearinghouse off until contracted"}</p>
      <Button variant="outline" disabled={reason.trim().length < 3} onClick={() => run("billing_coverage_recheck", [])}>Create due re-verification tasks</Button>
      <label className="block">Check reason — Required<Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></label>
      {rows.map((r) => (
        <BillingRow key={r.key} row={r} reason={reason} run={run} actorJson={JSON.stringify(actor)} onManual={() => { setReferralId(r.referralId ?? ""); setPatientId(r.patientId); }} manualAllowed={!!r.referralId && intakeIds.has(r.referralId)} />
      ))}
      {patientId && (
        <CoverageCheckDialog
          patientId={patientId}
          open={true}
          onOpenChange={(v) => { if (!v) setPatientId(undefined); }}
          actor={{ actorId: actor.staffId ?? "", actorRole: actor.role }}
          onRecord={(input) => { const r = runAction<{ ok: boolean; error?: string }>("billing_intake_check", actor, undefined, { args: [actor, referralId, input, reason], auditReason: reason }); return r.ok ? r.value : { ok: false, error: r.reason }; }}
        />
      )}
    </section>
  );
}

function BillingRow({ row, reason, run, onManual, manualAllowed, actorJson }: { row: Row; reason: string; run: (id: string, args: unknown[]) => void; onManual: () => void; manualAllowed: boolean; actorJson: string }) {
  const [path, setPath] = useState<CoveragePath>("medi_cal");
  const [programId, setProgramId] = useState("");
  const [payerId, setPayerId] = useState("");
  const [memberId, setMemberId] = useState("");
  const [group, setGroup] = useState("");
  const [relationship, setRelationship] = useState<"self" | "spouse" | "child" | "other">("self");
  const [fee, setFee] = useState(listFeeSchedules()[0]?.id ?? "");
  const [household, setHousehold] = useState("");
  const [income, setIncome] = useState("");
  const [docs, setDocs] = useState<"received" | "attested" | "">("");
  const detail = JSON.parse(useEhr(() => JSON.stringify(billingCoverageDetail(JSON.parse(actorJson), row.patientId)))) as ReturnType<typeof billingCoverageDetail>;
  const off = reason.trim().length < 3;
  const kind = COVERAGE_PATHS.find((p) => p.id === row.path)?.processing;
  return (
    <div className="space-y-2 border-b border-line py-2" data-testid="coverage-request-row">
      <div className="flex flex-wrap gap-3">
        <span>{row.referralId ? `Referral ${row.referralId}` : "Care team request"} · {row.pathLabel} · Requested {row.requestedAt.slice(0, 10)} · {row.status}</span>
      </div>
      {kind === "determine" && (
        <div className="grid gap-2 sm:grid-cols-3">
          <label>Path Billing found<select className={selectClass} value={path} onChange={(e) => setPath(e.target.value as CoveragePath)}>{COVERAGE_PATHS.filter((p) => p.id !== "unknown").map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
          {path === "county_program" && <label>Program<select className={selectClass} value={programId} onChange={(e) => setProgramId(e.target.value)}><option value="">Choose</option>{listCountyPrograms().map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>}
          <Button variant="outline" disabled={off} onClick={() => run("billing_coverage_path", [row.key, path, path === "county_program" ? programId : undefined])}>Set path</Button>
        </div>
      )}
      {(row.path === "private" || row.path === "medicare") && (
        <div className="grid gap-2 sm:grid-cols-4">
          <label>Payer<select className={selectClass} value={payerId} onChange={(e) => setPayerId(e.target.value)}><option value="">Choose</option>{listPayers(row.path === "medicare" ? "medicare" : "commercial").map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label>Member ID<Input value={memberId} onChange={(e) => setMemberId(e.target.value)} /></label>
          <label>Group<Input value={group} onChange={(e) => setGroup(e.target.value)} /></label>
          <label>Subscriber<select className={selectClass} value={relationship} onChange={(e) => setRelationship(e.target.value as typeof relationship)}><option value="self">Self</option><option value="spouse">Spouse</option><option value="child">Child</option><option value="other">Other</option></select></label>
          <Button variant="outline" disabled={off || !payerId || !memberId.trim()} onClick={() => run("billing_coverage_insurance", [row.key, { payerId, memberId, groupNumber: group, subscriberRelationship: relationship }])}>Save insurance details</Button>
        </div>
      )}
      {(kind === "check" || row.path === "uninsured_apply") && (
        <div className="flex flex-wrap items-center gap-2">
          <SimulatedBadge flag="eligibility_simulated" />
          <Button variant="outline" disabled={off} onClick={() => run("billing_coverage_run", [row.key, {}])}>Run coverage check</Button>
          {manualAllowed && <Button variant="outline" disabled={off} onClick={onManual}>Record manual check</Button>}
          {row.path === "uninsured_apply" && <Button variant="outline" disabled={off} onClick={() => run("billing_coverage_application", [row.key])}>Mark application in progress</Button>}
        </div>
      )}
      {kind === "self_pay" && (
        <div className="grid gap-2 sm:grid-cols-2">
          <label>Fee schedule<select className={selectClass} value={fee} onChange={(e) => setFee(e.target.value)}>{listFeeSchedules().map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</select></label>
          <Button variant="outline" disabled={off || !fee} onClick={() => run("billing_coverage_self_pay", [row.key, { feeScheduleId: fee, acknowledged: true }])}>Record self-pay acknowledgment</Button>
        </div>
      )}
      {kind === "sliding" && (
        <div className="grid gap-2 sm:grid-cols-4">
          <label>Household size<Input inputMode="numeric" value={household} onChange={(e) => setHousehold(e.target.value)} /></label>
          <label>Yearly income (dollars)<Input inputMode="decimal" value={income} onChange={(e) => setIncome(e.target.value)} /></label>
          <label>Income documents<select className={selectClass} value={docs} onChange={(e) => setDocs(e.target.value as typeof docs)}><option value="">Choose</option><option value="received">Received</option><option value="attested">Attested by the person</option></select></label>
          <Button variant="outline" disabled={off || !docs || !household || income === ""} onClick={() => run("billing_coverage_sliding", [row.key, { householdSize: Number(household), annualIncomeCents: Math.round(Number(income) * 100), documentation: docs }])}>Set tier</Button>
        </div>
      )}
      {detail.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>Coverage order: {detail.map((d) => `${d.rank} — ${COVERAGE_PATHS.find((p) => p.id === d.path)?.short}`).join(" · ")}</span>
          <Button variant="outline" disabled={off} onClick={() => run("billing_coverage_order", [row.patientId, [...detail].reverse().map((d) => d.id), ""])}>Swap primary and secondary</Button>
        </div>
      )}
    </div>
  );
}
