import { ManagedCarePlansPanel } from "@/components/billing/ManagedCarePlansPanel";
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
import { LANE_LABEL, LANE_ORDER, laneFor, type LaneKey } from "@/lib/billingLane";
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
  patient?: Patient;
  clinicianId: string;
  lane: LaneKey;
  appt?: Appointment;
  claim?: Claim;
}

export function noClaimLabel(appt: Appointment): string {
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
  const [tab, setTab] = useState<Tab>("claims");
  const [entity, setEntity] = useState<"bagga_npi" | "adelante">("adelante");
  const appointments = useEhr(() => AdelanteEHR.listAppointments());
  const patients = useEhr(() => AdelanteEHR.listPatients());
  const clinicians = useEhr(() => AdelanteEHR.listClinicians());

  const { role } = useActingStaff();
  const canWrite = canAccess(role, "billing").level === "write";
  const claims = useEhrExt(() => AdelanteEHRExt.listClaims());
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
        date: c.history[0]?.at ?? c.updatedAt,
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

  // §Phase 7b — the page guard is fast feedback only; `transitionClaim`
  // enforces billing write itself and attributes the real acting staff.
  function advance(claim: Claim, to: ClaimState) {
    if (!canWrite) {
      toast.error("View only — billing staff change billing status.");
      return;
    }
    let reason: string | undefined;
    if (to === "denied" || to === "written_off" || claim.state === "written_off") {
      const prompt =
        to === "denied"
          ? "Denial reason (required):"
          : claim.state === "written_off"
            ? "Why is this write-off being reversed? (required)"
            : "Write-off reason (required):";
      reason = window.prompt(prompt) ?? undefined;
      if (!reason?.trim()) return;
    }
    const res = AdelanteEHRExt.transitionClaim(claim.id, to, reason ? { denialReason: reason } : undefined);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Claim moved to ${to.replace("_", " ")}.`);
  }

  function downloadIsl() {
    const csv = AdelanteEHR.exportIslReport();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `adelante-isl-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("ISL report exported.");
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-navy">Billing coordinator</h1>
          <p className="text-sm text-muted-foreground">
            Tulare County pilot · 7 funding lanes tracked separately from billing status.
          </p>
        </div>
        <Link
          to="/admin-claims"
          className="text-xs rounded-md border bg-card px-3 py-2 hover:bg-secondary"
        >
          Open claims worklist →
        </Link>
      </header>

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

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi
          label="Outstanding"
          value={DOLLARS(kpis.outstandingCents)}
          sub={`${kpis.byStatus.ready + kpis.byStatus.submitted} claims`}
        />
        <Kpi
          label="Paid"
          value={DOLLARS(kpis.paidCents)}
          sub={`${kpis.byStatus.paid} claims`}
          tone="teal"
        />
        <Kpi
          label="Denied"
          value={DOLLARS(kpis.deniedCents)}
          sub={`${kpis.byStatus.denied} claims`}
          tone="destructive"
        />
        <Kpi
          label="Drafts / write-offs"
          value={String(kpis.byStatus.draft + kpis.byStatus.write_off)}
          sub={`${kpis.byStatus.draft} draft · ${kpis.byStatus.write_off} write-off`}
        />
      </div>

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
              className={`px-2.5 py-1 rounded-full ${entity === k ? "bg-navy text-navy-foreground" : "text-foreground/60"}`}
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
          <div className="text-xs text-navy/80">
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
              className={`rounded-full border px-2.5 py-1 text-xs ${noRateOnly ? "border-destructive bg-destructive/10 text-destructive" : "text-muted-foreground"}`}
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
          <div className="rounded-xl border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">Date</th>
                  <th className="text-left px-3 py-2">Program ID</th>
                  <th className="text-left px-3 py-2">Clinician</th>
                  <th className="text-left px-3 py-2">Lane</th>
                  <th className="text-left px-3 py-2">Charge</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-right px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ key, date, appt, claim, patient, clinicianId, lane }) => {
                  const clinician = clinicians.find((c) => c.id === clinicianId);
                  const bucket = claim ? claimBillingBucket(claim.state) : null;
                  return (
                    <tr key={key} className="border-t" data-testid="billing-row" data-encounter={claim?.encounterId ?? appt?.id}>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {new Date(date).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2">{patient?.programId ?? "—"}</td>
                      <td className="px-3 py-2">{clinician?.name ?? "—"}</td>
                      <td className="px-3 py-2">
                        <span data-testid="billing-row-lane" className={`text-[10px] rounded-full px-2 py-0.5 ${lane === "unknown" ? "bg-gold/20 text-navy" : "bg-navy/10 text-navy"}`}>
                          {LANE_LABEL[lane]}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs" data-testid="billing-row-charge">
                        {claim ? <ClaimAmount claim={claim} /> : "—"}
                      </td>
                      <td className="px-3 py-2" data-testid="billing-row-status">
                        {claim && bucket ? (
                          <>
                            <span className={`text-[10px] rounded-full px-2 py-0.5 ${STATUS_STYLE[bucket]}`}>
                              {BILLING_STATUS_ROWS.find((r) => r.status === bucket)?.label}
                            </span>
                            <ClaimSignatureLine claim={claim} />
                            {bucket === "draft" && (
                              <span className="ml-1 text-[10px] text-muted-foreground">{claim.state}</span>
                            )}
                            {claim.state === "denied" && claim.denialReason && (
                              <div className="text-[10px] text-destructive mt-0.5">{claim.denialReason}</div>
                            )}
                          </>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">{appt ? noClaimLabel(appt) : "—"}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {!claim ? null : canWrite ? (
                          <ClaimActions claim={claim} lane={lane} onAdvance={advance} />
                        ) : (
                          <span className="text-[10px] text-muted-foreground">View only</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">
                      No claims to show.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
              <table className="w-full text-sm">
                <thead className="bg-secondary/60 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Date</th>
                    <th className="text-left px-3 py-2">Program ID</th>
                    <th className="text-left px-3 py-2">Service</th>
                    <th className="text-left px-3 py-2">Reason</th>
                    <th className="text-left px-3 py-2">Charge</th>
                  </tr>
                </thead>
                <tbody>
                  {islRows.map(({ key, date, appt, claim, patient }) => (
                    <tr key={key} className="border-t">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {new Date(date).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2">{patient?.programId ?? "—"}</td>
                      <td className="px-3 py-2 text-xs">
                        {appt?.serviceType?.replace("_", " ") ?? claim?.serviceCode ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {appt?.islReason ?? "uninsured"}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {claim ? <ClaimAmount claim={claim} /> : "No claim"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === "rates" && <RatesPanel canWrite={canWrite} />}
      {tab === "rates" && <ManagedCarePlansPanel />}

      {tab === "credentials" && (
        <section className="space-y-3">
          <div className="rounded-xl border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">Clinician</th>
                  <th className="text-left px-3 py-2">Credential</th>
                  <th className="text-left px-3 py-2">Medi-Cal</th>
                  <th className="text-left px-3 py-2">License #</th>
                  <th className="text-left px-3 py-2">NPI</th>
                  <th className="text-left px-3 py-2">DEA</th>
                  <th className="text-left px-3 py-2">DMC cert</th>
                  <th className="text-left px-3 py-2">License exp.</th>
                  <th className="text-left px-3 py-2">Booking</th>
                </tr>
              </thead>
              <tbody>
                {clinicians.map((c, i) => {
                  const canBook = AdelanteEHR.canBook(c.id);
                  const expired = c.mediCalStatus === "expired" || !canBook.ok;
                  return (
                    <tr key={c.id} className={`border-t ${expired ? "bg-destructive/5" : ""}`}>
                      <td className="px-3 py-2">{c.name}</td>
                      <td className="px-3 py-2">{c.credential}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`text-[10px] rounded-full px-2 py-0.5 ${
                            c.mediCalStatus === "active"
                              ? "bg-teal/15 text-teal"
                              : c.mediCalStatus === "pending"
                                ? "bg-gold/20 text-navy"
                                : "bg-destructive/10 text-destructive"
                          }`}
                        >
                          {c.mediCalStatus}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">LIC-{1000 + i}</td>
                      <td className="px-3 py-2 font-mono text-xs">
                        193{i}45678{i}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{i === 0 ? "BR1234567" : "—"}</td>
                      <td className="px-3 py-2 font-mono text-xs">{i === 0 ? "DMC-0042" : "—"}</td>
                      <td className="px-3 py-2 text-xs">{c.licenseExpiresOn ?? "—"}</td>
                      <td className="px-3 py-2">
                        {canBook.ok ? (
                          <span className="text-[10px] rounded-full px-2 py-0.5 bg-teal/15 text-teal">
                            Allowed
                          </span>
                        ) : (
                          <span
                            className="text-[10px] rounded-full px-2 py-0.5 bg-destructive/10 text-destructive"
                            title={canBook.reason}
                          >
                            Blocked
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
          <FileText className="h-3 w-3" /> Submit
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
