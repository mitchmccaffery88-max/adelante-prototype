import { billingAppointments, billingPatients, billingClaims, billingLaneFor as laneFor, type BillingPatient, type BillingAppointment } from "@/lib/billingProjection";
import { IntakeBillingRequests } from "@/components/staff/IntakeBillingRequests";
import { StatTile } from "@/components/ui/stat-tile";
import { claimWeeklyProjection } from "@/lib/billingSparkline";
import { StaffTable } from "@/components/staff/StaffTable";
import { StatusChip } from "@/components/ui/status-chip";
import { Badge } from "@/components/ui/badge";
const tableCopy = { claims: "Claims worklist", isl: "ISL encounters", credentials: "Credentialing" };
import { useConfirmDialog } from "@/components/staff/use-confirm-dialog";
import { confirmedAction } from "@/components/staff/confirmed-action";
import { BillingWorkspaceTiles, billingHomeSimulatedLabel } from "@/components/ops/OpsWorkspace";
import { afbiCounts } from "@/lib/afbiOutreach";
import { OpsActionLauncher } from "@/components/ops/OpsActionLauncher";
import { ManagedCarePlansPanel } from "@/components/billing/ManagedCarePlansPanel";
import { actResult, actFor, currentRunActor } from "@/lib/actions/act";
import "@/lib/countyReporting";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AdelanteEHR,
  useEhr,
  type Appointment,
  type Patient,
} from "@/lib/ehr";
import {
  AdelanteEHRExt,
  claimBillingBucket,
  useEhrExt,
  type Claim,
  type ClaimState,
} from "@/lib/ehr-ext";
import { toast } from "sonner";
import { LANE_LABEL, LANE_ORDER, type LaneKey } from "@/lib/billingLane";
import { AlertTriangle, Building2, Check, Download, FileText, ShieldCheck, X } from "lucide-react";
import { canAccess, useActingStaff } from "@/lib/roles";
import { ClaimSignatureLine } from "@/components/billing/ClaimSignatureLine";
import { ClaimAmount, RatesPanel } from "@/components/billing/RatesPanel";
import {
  BillingStatusStrip,
  BILLING_STATUS_ROWS,
  billingStatusCounts,
  type BillingStatus,
} from "@/components/billing/BillingStatusSummary";

export const Route = createFileRoute("/billing")({
  head: () => ({
    meta: [
      { title: "Billing coordinator — Adelante" },
      {
        name: "description",
        content:
          "Claims worklist, ISL non-Medi-Cal reportable encounters, code & rate table, and credentialing tracker.",
      },
      { property: "og:title", content: "Billing coordinator — Adelante" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        property: "og:description",
        content: "Claims worklist, ISL reportable encounters, code & rate table, credentialing.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { status?: BillingStatus } => {
    const v = search.status;
    return typeof v === "string" && BILLING_STATUSES.includes(v as BillingStatus)
      ? { status: v as BillingStatus }
      : {};
  },
  component: BillingPage,
});

const BILLING_STATUSES: BillingStatus[] = BILLING_STATUS_ROWS.map((r) => r.status);

/**
 * §Phase 7b — one row per claim, plus attended/closed visits that have no
 * claim. A visit without a claim gets a plain label, never a fake status.
 */
interface BillingRow {
  key: string;
  date: string;
  patient?: Patient | BillingPatient;
  clinicianId: string;
  lane: LaneKey;
  appt?: Appointment | BillingAppointment;
  claim?: Claim;
}

export function noClaimLabel(appt: Pick<Appointment, "status">): string {
  if (appt.status === "attended") return "Not documented";
  return "No claim — not billable";
}


type Tab = "claims" | "isl" | "rates" | "credentials";

const DOLLARS = (cents?: number) =>
  ((cents ?? 0) / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });

const STATUS_STYLE: Record<BillingStatus, string> = {
  draft: "bg-secondary text-foreground/80",
  ready: "bg-navy/10 text-navy",
  submitted: "bg-gold/25 text-navy",
  paid: "bg-teal/15 text-teal",
  denied: "bg-destructive/10 text-destructive",
  write_off: "bg-muted text-muted-foreground",
  partial: "bg-gold/20 text-navy",
};

function BillingPage() {
  const confirmation = useConfirmDialog();
  const [tab, setTab] = useState<Tab>("claims");
  const [entity, setEntity] = useState<"bagga_npi" | "adelante">("adelante");
  const appointments = useEhr(() => billingAppointments());
  const patients = useEhr(() => billingPatients());
  const clinicians = useEhr(() => AdelanteEHR.listClinicians());

  const { role } = useActingStaff();
  const canWrite = canAccess(role, "billing").level === "write";
  const claims = useEhrExt(() => billingClaims());
  const statusCounts = useMemo(() => billingStatusCounts(claims), [claims]);

  const rows = useMemo<BillingRow[]>(() => {
    const byEncounter = new Map(claims.map((c) => [c.encounterId, c]));
    const apptIds = new Set(appointments.map((a) => a.id));
    const out: BillingRow[] = appointments
      .filter((a) => a.status !== "scheduled")
      .map((a) => {
        const claim = byEncounter.get(a.id);
        const patient = patients.find((p) => p.id === a.patientId);
        return {
          key: a.id,
          date: a.start,
          patient,
          clinicianId: a.clinicianId,
          lane: laneFor({ claim, appt: a, patient }),
          appt: a,
          ...(claim ? { claim } : {}),
        };
      });
    // Group / peer / CHW claims have no 1:1 visit — list them too so this page
    // and the Claims worklist cover the same claims.
    for (const c of claims) {
      if (apptIds.has(c.encounterId)) continue;
      const patient = patients.find((p) => p.id === c.patientId);
      out.push({
        key: c.id,
        date: c.serviceDate ?? c.history[0]?.at ?? c.updatedAt,
        ...(patient ? { patient } : {}),
        clinicianId: c.clinicianId,
        lane: laneFor({ claim: c, patient }),
        claim: c,
      });
    }
    return out.sort((a, b) => b.date.localeCompare(a.date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointments, patients, claims]);

  const [laneFilter, setLaneFilter] = useState<"all" | LaneKey>("all");
  const initialStatus = Route.useSearch().status;
  const [statusFilter, setStatusFilter] = useState<"all" | BillingStatus>(initialStatus ?? "all");
  const [noRateOnly, setNoRateOnly] = useState(false);
  const noRateCount = claims.filter((c) => c.rateStatus === "no_rate").length;
  const [arrangementOnly, setArrangementOnly] = useState(false);
  const [balanceOnly, setBalanceOnly] = useState(false);
  const arrangementCount = claims.filter((c) => c.arrangementMissing).length;
  const balanceCount = claims.filter((c) => (c.patientBalanceCents ?? 0) > 0).length;
  const filtered = rows.filter(
    (r) =>
      (laneFilter === "all" || r.lane === laneFilter) &&
      (statusFilter === "all" || (r.claim && claimBillingBucket(r.claim.state) === statusFilter)) &&
      (!noRateOnly || r.claim?.rateStatus === "no_rate") &&
      (!arrangementOnly || Boolean(r.claim?.arrangementMissing)) &&
      (!balanceOnly || (r.claim?.patientBalanceCents ?? 0) > 0),
  );
  const islRows = rows.filter((r) => r.lane === "grant_isl");

  const kpis = useMemo(() => {
    let outstandingCents = 0;
    let paidCents = 0;
    let deniedCents = 0;
    const byStatus: Record<BillingStatus, number> = {
      draft: 0,
      ready: 0,
      submitted: 0,
      paid: 0,
      denied: 0,
      write_off: 0,
      partial: 0,
    };
    for (const c of claims) {
      const b = claimBillingBucket(c.state);
      byStatus[b] += 1;
      if (b === "submitted" || b === "ready") outstandingCents += c.chargeCents ?? 0;
      if (b === "paid") paidCents += c.chargeCents ?? 0;
      if (b === "denied") deniedCents += c.chargeCents ?? 0;
    }
    return { byStatus, outstandingCents, paidCents, deniedCents };
  }, [claims]);

  const paidSpark = useMemo(() => claimWeeklyProjection("paid", claims, new Date()), [claims]);
  const submittedSpark = useMemo(() => claimWeeklyProjection("submitted", claims, new Date()), [claims]);

  // §Phase 7b — the page guard is fast feedback only; `transitionClaim`
  // enforces billing write itself and attributes the real acting staff.
  function advance(claim: Claim, to: ClaimState) {
    if (!canWrite) {
      toast.error("View only — billing staff change billing status.");
      return;
    }
    if (to === "denied" || to === "written_off" || claim.state === "written_off") {
      const verb = to === "denied" ? "Deny claim" : to === "written_off" ? "Write off claim" : "Reverse write-off";
      confirmation.ask({ title: `${verb}?`, description: "The claim status changes and its history is kept. A later correction follows the existing billing workflow; no new patient notification is sent.", confirmLabel: verb, keepLabel: "Keep claim", requireReason: true, onConfirm: reason => { confirmedAction("claim_status", "transitionClaim", claim.patientId, reason, claim.id, to, { denialReason: reason }); toast.success(`Claim moved to ${to.replaceAll("_", " ")}.`); return true; } });
      return;
    }
    const res = actResult<ReturnType<typeof AdelanteEHRExt.transitionClaim>>("claim_status", "transitionClaim", claim.patientId, claim.id, to);
    if (!res.ok) { toast.error(res.error); return; }
    toast.success(`Claim moved to ${to.replaceAll("_", " ")}.`);
  }

  function downloadIsl() {
    let csv: string;
    try { const a = currentRunActor(); csv = actFor<string>("isl_export", "exportIslReport", undefined, undefined, { staffId: a.staffId, name: a.staffName, role: a.role }); } catch (e) { toast.error((e as Error).message); return; }
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `adelante-isl-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("ISL report exported.");
  }

  const summary = (
      <div role="region" aria-label="Billing summary" tabIndex={0} className="grid grid-flow-col auto-cols-[minmax(15rem,1fr)] lg:grid-flow-row lg:grid-cols-4 gap-3 overflow-x-auto rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" data-testid="billing-kpis">
        <StatTile
          label="Outstanding"
          value={kpis.outstandingCents}
          formattedValue={DOLLARS(kpis.outstandingCents)}
          nonPatient
          tileTestId="billing-kpi-outstanding"
          comparison={`${kpis.byStatus.ready + kpis.byStatus.submitted} claims`}
          sparkline={submittedSpark}
        />
        <StatTile
          label="Paid"
          value={kpis.paidCents}
          formattedValue={DOLLARS(kpis.paidCents)}
          nonPatient
          tileTestId="billing-kpi-paid"
          comparison={`${kpis.byStatus.paid} claims`}
          sparkline={paidSpark}
        />
        <Kpi
          label="Denied"
          value={DOLLARS(kpis.deniedCents)}
          sub={`${kpis.byStatus.denied} claims`}
          tone="destructive"
        />
        <StatTile
          label="Drafts / write-offs"
          value={kpis.byStatus.draft + kpis.byStatus.write_off}
          nonPatient
          tileTestId="billing-kpi-drafts"
          comparison={`${kpis.byStatus.draft} draft · ${kpis.byStatus.write_off} write-off`}
        />
      </div>


  );

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl text-navy">Billing coordinator</h1>
          {!canWrite && <Badge variant="outline" className="max-w-full whitespace-normal text-sm">{billingHomeSimulatedLabel()}</Badge>}
          <p className="text-sm text-muted-foreground">
            Tulare County pilot · 7 funding lanes tracked separately from billing status.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
        <Link to="/provider-reference" className="text-xs rounded-md border bg-card px-3 py-2 hover:bg-secondary" data-testid="billing-provider-ref-link">
          Provider &amp; site reference
        </Link>
        <Link to="/county-reporting" className="text-xs rounded-md border bg-card px-3 py-2 hover:bg-secondary" data-testid="billing-county-reporting-link">
          County reporting
        </Link>
        <Link
          to="/admin-claims"
          className="text-xs rounded-md border bg-card px-3 py-2 hover:bg-secondary"
        >
          Open claims worklist to
        </Link>
        </div>
      </header>

      {confirmation.dialog}
      {canWrite && <BillingWorkspaceTiles summary={summary} />}
      {!canWrite && summary}
      <OpsActionLauncher />
      <IntakeBillingRequests />

      {!canWrite && (
        <div className="rounded-xl border bg-card p-3 text-sm text-muted-foreground" data-testid="billing-read-only">
          View only — billing staff change billing status and work claims.
        </div>
      )}

      <BillingStatusStrip
        counts={statusCounts}
        active={statusFilter}
        onSelect={(s) => {
          setStatusFilter(s);
          setTab("claims");
        }}
      />

      {/* Billing entity toggle — surfaces the unresolved contract-type decision */}
      <div className="rounded-xl border bg-amber-50/60 border-amber-200 p-3 flex items-center gap-3 text-sm">
        <Building2 className="h-4 w-4 text-amber-700 shrink-0" />
        <div className="flex-1">
          <div className="font-medium text-amber-900">Billing entity</div>
          <div className="text-xs text-amber-800">
            Contract-type decision unresolved — toggle here for demo.
          </div>
        </div>
        <div className="rounded-full bg-white p-0.5 flex text-xs border">
          {(["bagga_npi", "adelante"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setEntity(k)}
              className={`px-2.5 py-1 rounded-full ${entity === k ? "bg-navy text-navy-foreground" : "text-muted-foreground"}`}
            >
              {k === "bagga_npi" ? "Bagga's clinic NPI" : "Adelante"}
            </button>
          ))}
        </div>
      </div>

      {/* ISL 2027 mandate banner */}
      <div className="rounded-xl border border-navy/20 bg-navy/5 p-3 flex items-start gap-3 text-sm">
        <AlertTriangle className="h-4 w-4 text-navy mt-0.5 shrink-0" />
        <div>
          <div className="font-medium text-navy">ISL reportable encounters — mandate 1/1/2027</div>
          <div className="text-xs text-navy">
            Uninsured, benefit-exhausted, and restricted-setting encounters are non-billable but
            county-reportable. An annual export is stubbed on the ISL tab.
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b">
        {(
          [
            { k: "claims", label: "Claims worklist" },
            { k: "isl", label: `ISL (${islRows.length})` },
            { k: "rates", label: "Code & rate table" },
            { k: "credentials", label: "Credentialing" },
          ] as const
        ).map((x) => (
          <button
            key={x.k}
            onClick={() => setTab(x.k)}
            className={`px-3 py-2 text-sm border-b-2 -mb-px ${
              tab === x.k
                ? "border-navy text-navy font-medium"
                : "border-transparent text-muted-foreground"
            }`}
          >
            {x.label}
          </button>
        ))}
      </div>

      {tab === "claims" && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="text-muted-foreground">Lane:</label>
            <select
              aria-label="Lane filter"
              value={laneFilter}
              onChange={(e) => setLaneFilter(e.target.value as typeof laneFilter)}
              className="rounded-md border bg-card px-2 py-1"
            >
              <option value="all">All lanes</option>
              {LANE_ORDER.map((k) => (
                <option key={k} value={k}>
                  {LANE_LABEL[k]}
                </option>
              ))}
            </select>
            <label className="text-muted-foreground">Status:</label>
            <select
              aria-label="Status filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="rounded-md border bg-card px-2 py-1"
            >
              <option value="all">All statuses</option>
              {(
                ["draft", "ready", "submitted", "paid", "denied", "write_off"] as BillingStatus[]
              ).map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>
            <button
              type="button"
              data-testid="no-rate-filter"
              onClick={() => setNoRateOnly((v) => !v)}
              className={`rounded-full border px-2.5 py-1 text-xs ${noRateOnly ? "border-input bg-surface-sunk text-attention" : "text-muted-foreground"}`}
            >
              No rate on file ({noRateCount})
            </button>
            <button
              type="button"
              data-testid="arrangement-filter"
              onClick={() => setArrangementOnly((v) => !v)}
              className={`rounded-full border px-2.5 py-1 text-xs ${arrangementOnly ? "border-gold bg-gold/20 text-navy" : "text-muted-foreground"}`}
            >
              Payment arrangement not recorded ({arrangementCount})
            </button>
            <button
              type="button"
              data-testid="balance-filter"
              onClick={() => setBalanceOnly((v) => !v)}
              className={`rounded-full border px-2.5 py-1 text-xs ${balanceOnly ? "border-navy bg-navy/10 text-navy" : "text-muted-foreground"}`}
            >
              Patient balances ({balanceCount})
            </button>
            {filtered.length === 0 && (
              <span className="text-xs text-muted-foreground">No claims match these filters.</span>
            )}
          </div>
          <div className="rounded-xl border bg-card overflow-x-auto [&_select]:max-w-full">
<StaffTable rows={filtered} rowKey={(r) => r.key} label={tableCopy.claims} testId="billing-table" rowTestId={() => "billing-row"} rowAttributes={(r) => ({ "data-encounter": r.claim?.encounterId ?? r.appt?.id })} columns={[{ id: "date", label: "Date", cell: ({ date, appt, claim, patient, clinicianId, lane }) => { const clinician = clinicians.find((c) => c.id === clinicianId); const bucket = claim ? claimBillingBucket(claim.state) : null; return <>{new Date(/^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00` : date).toLocaleDateString()}</>; } },{ id: "patient", label: "Program ID", mono: true, cell: ({ date, appt, claim, patient, clinicianId, lane }) => { const clinician = clinicians.find((c) => c.id === clinicianId); const bucket = claim ? claimBillingBucket(claim.state) : null; return <>{patient?.programId ?? "—"}</>; } },{ id: "clinician", label: "Clinician", cell: ({ date, appt, claim, patient, clinicianId, lane }) => { const clinician = clinicians.find((c) => c.id === clinicianId); const bucket = claim ? claimBillingBucket(claim.state) : null; return <>{clinician?.name ?? "—"}</>; } },{ id: "lane", label: "Lane", cell: ({ date, appt, claim, patient, clinicianId, lane }) => { const clinician = clinicians.find((c) => c.id === clinicianId); const bucket = claim ? claimBillingBucket(claim.state) : null; return <><span data-testid="billing-row-lane" className={`text-sm rounded-full px-2 py-0.5 ${lane === "unknown" ? "bg-gold/20 text-navy" : "bg-navy/10 text-navy"}`}>
                          {LANE_LABEL[lane]}
                        </span></>; } },{ id: "charge", label: "Charge", testId: "billing-row-charge", mono: true, sortValue: (r) => r.claim?.chargeCents ?? -1, cell: ({ date, appt, claim, patient, clinicianId, lane }) => { const clinician = clinicians.find((c) => c.id === clinicianId); const bucket = claim ? claimBillingBucket(claim.state) : null; return <>{claim ? <ClaimAmount claim={claim} /> : "—"}</>; } },{ id: "status", label: "Status", testId: "billing-row-status", cell: ({ date, appt, claim, patient, clinicianId, lane }) => { const clinician = clinicians.find((c) => c.id === clinicianId); const bucket = claim ? claimBillingBucket(claim.state) : null; return <>{claim && bucket ? (
                          <>
                            {bucket === "denied" ? (<span className={`text-[10px] rounded-full px-2 py-0.5 ${STATUS_STYLE[bucket]}`}>
                              {BILLING_STATUS_ROWS.find((r) => r.status === bucket)?.label}
                            </span>) : <StatusChip lang="en" state={claim.state === "documented" ? "upnext" : claim.state === "submitted" ? "team" : claim.state === "paid" ? "done" : claim.state === "written_off" ? "closed" : canWrite ? "yourturn" : "team"} label={BILLING_STATUS_ROWS.find((r) => r.status === bucket)?.label ?? bucket} />}
                            <ClaimSignatureLine claim={claim} />
                            {bucket === "draft" && (
                              <span className="ml-1 text-sm text-muted-foreground">{claim.state}</span>
                            )}
                            {claim.state === "denied" && claim.denialReason && (
                              <div className="text-[10px] text-attention mt-0.5">{claim.denialReason}</div>
                            )}
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground">{appt ? noClaimLabel(appt) : "—"}</span>
                        )}</>; } }]} primaryAction={({ claim, lane }) => <>{!claim ? null : canWrite ? (
                          <ClaimActions claim={claim} lane={lane} onAdvance={advance} />
                        ) : (
                          <span className="text-sm text-muted-foreground">View only</span>
                        )}</>} emptyState="No claims to show." />
          </div>
        </section>
      )}

      {tab === "isl" && (
        <section className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Non-Medi-Cal, non-billable encounters that are county-reportable for uninsured /
            benefit-exhausted patients.
          </p>
          <div className="rounded-xl border bg-card p-4 flex flex-wrap items-center gap-4">
            <div className="text-sm">
              <div className="font-medium">
                {islRows.length} reportable encounter{islRows.length === 1 ? "" : "s"} this period.
              </div>
              <div className="text-xs text-muted-foreground">
                Charges shown at demo rates; export includes appt id, program id, clinician,
                service, and lane.
              </div>
              <AfbiCountsLine />
            </div>
            <button
              onClick={downloadIsl}
              disabled={islRows.length === 0}
              className="inline-flex items-center gap-1.5 rounded-md bg-navy text-navy-foreground px-3 py-1.5 text-xs disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" /> Export ISL report (.csv)
            </button>
          </div>
          {islRows.length > 0 && (
            <div className="rounded-xl border bg-card overflow-hidden">
              <StaffTable rows={islRows} rowKey={(r) => r.key} label={tableCopy.isl} testId="billing-isl-table" columns={[{ id: "date", label: "Date", cell: ({ date, appt, claim, patient }) => <>{new Date(date).toLocaleDateString()}</> },{ id: "patient", label: "Program ID", mono: true, cell: ({ date, appt, claim, patient }) => <>{patient?.programId ?? "—"}</> },{ id: "service", label: "Service", cell: ({ date, appt, claim, patient }) => <>{appt?.serviceType?.replace("_", " ") ?? claim?.serviceCode ?? "—"}</> },{ id: "reason", label: "Reason", cell: ({ date, appt, claim, patient }) => <>{appt?.islReason ?? "uninsured"}</> },{ id: "charge", label: "Charge", mono: true, cell: ({ date, appt, claim, patient }) => <>{claim ? <ClaimAmount claim={claim} /> : "No claim"}</> }]} />
            </div>
          )}
        </section>
      )}

      {tab === "rates" && <RatesPanel canWrite={canWrite} />}
      {tab === "rates" && <ManagedCarePlansPanel />}

      {tab === "credentials" && (
        <section className="space-y-3">
          {credFlags.length > 0 && (
            <div className="rounded-xl border border-gold bg-gold/10 p-4" data-testid="billing-cred-review-flags">
              <h3 className="font-semibold">Flagged for Billing review ({credFlags.length})</h3>
              <p className="text-xs text-muted-foreground">
                Existing appointments and claims whose rendering clinician currently fails the credentialing rule.
                Nothing is cancelled or changed — review only.
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {credFlags.map((f) => (
                  <li key={`${f.kind}-${f.id}`} className="flex flex-wrap items-center gap-2">
                    <StatusChip lang="en" state="yourturn" label={f.kind === "claim" ? "Claim" : "Appointment"} />
                    <span className="font-medium">{getStaffMember(f.staffId)?.name ?? f.staffId}</span>
                    <span className="text-muted-foreground">
                      {[...new Set(f.reasons.map((r) => CREDENTIALING_REASON_LABEL[r]))].join("; ")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="rounded-xl border bg-card overflow-hidden">
            <StaffTable rows={clinicians} rowKey={(c) => c.id} label={tableCopy.credentials} testId="billing-credentials-table" columns={[{ id: "name", label: "Clinician", cell: (c) => { const i = clinicians.indexOf(c); const canBook = AdelanteEHR.canBook(c.id); return <>{c.name}</>; } },{ id: "credential", label: "Credential", cell: (c) => { const i = clinicians.indexOf(c); const canBook = AdelanteEHR.canBook(c.id); return <>{c.credential}</>; } },{ id: "medical", label: "Medi-Cal", cell: (c) => { const i = clinicians.indexOf(c); const canBook = AdelanteEHR.canBook(c.id); return <><StatusChip lang="en" state={c.mediCalStatus === "active" ? "done" : c.mediCalStatus === "pending" ? "upnext" : "closed"} label={c.mediCalStatus} /></>; } },{ id: "license", label: "License #", mono: true, cell: (c) => { const i = clinicians.indexOf(c); const canBook = AdelanteEHR.canBook(c.id); return <>LIC-{1000 + i}</>; } },{ id: "npi", label: "NPI", mono: true, cell: (c) => { const i = clinicians.indexOf(c); const canBook = AdelanteEHR.canBook(c.id); return <>193{i}45678{i}</>; } },{ id: "dea", label: "DEA", mono: true, cell: (c) => { const i = clinicians.indexOf(c); const canBook = AdelanteEHR.canBook(c.id); return <>{i === 0 ? "BR1234567" : "—"}</>; } },{ id: "dmc", label: "DMC cert", mono: true, cell: (c) => { const i = clinicians.indexOf(c); const canBook = AdelanteEHR.canBook(c.id); return <>{i === 0 ? "DMC-0042" : "—"}</>; } },{ id: "expires", label: "License exp.", cell: (c) => { const i = clinicians.indexOf(c); const canBook = AdelanteEHR.canBook(c.id); return <>{c.licenseExpiresOn ?? "—"}</>; } },{ id: "booking", label: "Booking", cell: (c) => { const i = clinicians.indexOf(c); const canBook = AdelanteEHR.canBook(c.id); return <><StatusChip lang="en" state={canBook.ok ? "done" : "yourturn"} label={canBook.ok ? "Allowed" : "Blocked"} />{!canBook.ok && <div className="text-sm text-muted-foreground">{canBook.reason}</div>}</>; } }]} />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-teal" />
            Expired licenses now hard-stop booking on the clinician surface via{" "}
            <code>AdelanteEHR.canBook</code>.
          </div>
        </section>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "teal" | "destructive";
}) {
  const toneClass =
    tone === "teal" ? "text-teal" : tone === "destructive" ? "text-destructive" : "text-navy";
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`font-display text-xl ${toneClass}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function ClaimActions({
  claim,
  lane,
  onAdvance,
}: {
  claim: Claim;
  lane: LaneKey;
  onAdvance: (c: Claim, to: ClaimState) => void;
}) {
  // Visits staff marked non-billable have no claim workflow. Grant/ISL claims
  // still move (reportable to the funder, $0 patient charge).
  if (lane === "non_billable") {
    return <span className="text-[10px] text-muted-foreground">Non-billable</span>;
  }
  const s = claim.state;
  const btn =
    "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-secondary";
  const canWriteOff = s === "documented" || s === "signed" || s === "coded" || s === "generated" || s === "denied";
  return (
    <div className="inline-flex flex-wrap gap-1 justify-end">
      {s === "documented" && (
        <span className="text-[10px] text-muted-foreground">Awaiting note signature</span>
      )}
      {s === "signed" && (
        <button className={btn} onClick={() => onAdvance(claim, "coded")}>
          <Check className="h-3 w-3" /> Mark coded
        </button>
      )}
      {s === "coded" && (
        <button className={btn} onClick={() => onAdvance(claim, "generated")}>
          <Check className="h-3 w-3" /> Mark ready
        </button>
      )}
      {s === "generated" && (
        <button className={btn} onClick={() => onAdvance(claim, "submitted")}>
          <FileText className="h-3 w-3" /> Send claim
        </button>
      )}
      {s === "submitted" && (
        <>
          <button className={btn} onClick={() => onAdvance(claim, "paid")}>
            <Check className="h-3 w-3" /> Mark paid
          </button>
          <button className={btn} onClick={() => onAdvance(claim, "denied")}>
            <X className="h-3 w-3" /> Deny
          </button>
        </>
      )}
      {s === "denied" && (
        <button className={btn} onClick={() => onAdvance(claim, "generated")}>
          Resubmit
        </button>
      )}
      {canWriteOff && (
        <button className={btn} onClick={() => onAdvance(claim, "written_off")}>
          <X className="h-3 w-3" /> Write off
        </button>
      )}
      {(s === "paid" || s === "partial") && <span className="text-[10px] text-teal">Closed</span>}
      {s === "written_off" && (
        <button className={btn} data-testid="reverse-write-off" onClick={() => onAdvance(claim, "generated")}>
          Reverse write-off
        </button>
      )}
    </div>
  );
}

// §Batch A3 — billing sees AFBI counts only, never details; cohort guard 11.
function AfbiCountsLine() {
  const c = useEhr(() => afbiCounts());
  return (
    <div className="text-xs text-muted-foreground" data-testid="billing-afbi-counts">
      Field outreach (AFBI): {c.contacts} contact{c.contacts === 1 ? "" : "s"}, {c.minutes} min — ISL only, never claimed.
      {c.guard.belowMinimumCohort && ` Fewer than ${c.guard.minimumCohortSize} people — small numbers, do not publish.`}
    </div>
  );
}
