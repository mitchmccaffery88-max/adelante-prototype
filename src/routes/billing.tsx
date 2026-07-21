import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AdelanteEHR,
  useEhr,
  type Appointment,
  type BillingStatus,
  type FundingLane,
} from "@/lib/ehr";
import { toast } from "sonner";
import { AlertTriangle, Building2, Check, Download, FileText, ShieldCheck, X } from "lucide-react";

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
  component: BillingPage,
});

const LANES: { key: FundingLane; label: string }[] = [
  { key: "medi_cal_ffs", label: "Medi-Cal FFS" },
  { key: "dmc_ods", label: "DMC-ODS" },
  { key: "ecm", label: "ECM" },
  { key: "private_pay", label: "Private pay" },
  { key: "isl_non_medi_cal", label: "ISL (non-Medi-Cal)" },
  { key: "bhsa", label: "BHSA" },
  { key: "non_billable", label: "Non-billable" },
];

// Tulare-scoped mock rate table (placeholder — real rates come from DHCS + contracts).
const RATE_TABLE = [
  { code: "H0031", desc: "MH assessment", medi_cal: "$118.42", dmc_ods: "—", isl: "reportable" },
  {
    code: "H0004",
    desc: "Individual counseling (SUD)",
    medi_cal: "—",
    dmc_ods: "$92.10",
    isl: "reportable",
  },
  {
    code: "90834",
    desc: "Psychotherapy 45 min",
    medi_cal: "$96.55",
    dmc_ods: "—",
    isl: "reportable",
  },
  {
    code: "90837",
    desc: "Psychotherapy 60 min",
    medi_cal: "$142.03",
    dmc_ods: "—",
    isl: "reportable",
  },
  {
    code: "T1017",
    desc: "Targeted case management",
    medi_cal: "$32.18",
    dmc_ods: "—",
    isl: "reportable",
  },
  {
    code: "H2019",
    desc: "Rehab / recovery services",
    medi_cal: "—",
    dmc_ods: "$68.75",
    isl: "reportable",
  },
];

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
};

function BillingPage() {
  const [tab, setTab] = useState<Tab>("claims");
  const [entity, setEntity] = useState<"bagga_npi" | "adelante">("adelante");
  const appointments = useEhr(() => AdelanteEHR.listAppointments());
  const patients = useEhr(() => AdelanteEHR.listPatients());
  const clinicians = useEhr(() => AdelanteEHR.listClinicians());

  // Auto-classify a lane for display if the appointment doesn't carry one yet.
  const laneFor = (a: Appointment): FundingLane => {
    if (a.fundingLane) return a.fundingLane;
    const p = patients.find((x) => x.id === a.patientId);
    const status = p?.coverage?.status;
    if (status === "uninsured") return "isl_non_medi_cal";
    if (status === "private_pay") return "private_pay";
    if (status === "active") return "medi_cal_ffs";
    return "non_billable";
  };

  const rows = useMemo(
    () =>
      appointments
        .filter((a) => a.status !== "scheduled")
        .map((a) => ({
          appt: a,
          patient: patients.find((p) => p.id === a.patientId),
          clinician: clinicians.find((c) => c.id === a.clinicianId),
          lane: laneFor(a),
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appointments, patients, clinicians],
  );

  const [laneFilter, setLaneFilter] = useState<"all" | FundingLane>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | BillingStatus>("all");
  const filtered = rows.filter(
    (r) =>
      (laneFilter === "all" || r.lane === laneFilter) &&
      (statusFilter === "all" || r.appt.billingStatus === statusFilter),
  );
  const islRows = rows.filter((r) => r.lane === "isl_non_medi_cal");

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
    };
    for (const r of rows) {
      const cents = r.appt.chargeCents ?? AdelanteEHR.chargeForService(r.appt.serviceType);
      byStatus[r.appt.billingStatus] += 1;
      if (r.appt.billingStatus === "submitted" || r.appt.billingStatus === "ready") {
        outstandingCents += cents;
      }
      if (r.appt.billingStatus === "paid") paidCents += cents;
      if (r.appt.billingStatus === "denied") deniedCents += cents;
    }
    return { byStatus, outstandingCents, paidCents, deniedCents };
  }, [rows]);

  function advance(appt: Appointment, to: BillingStatus, opts?: { denialReason?: string }) {
    const res = AdelanteEHR.transitionBilling(appt.id, to, {
      actor: "billing coordinator",
      denialReason: opts?.denialReason,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Claim moved to ${to.replace("_", " ")}.`);
  }

  function markDenied(appt: Appointment) {
    const reason = window.prompt("Denial reason (required):", "Missing prior auth");
    if (!reason) return;
    advance(appt, "denied", { denialReason: reason });
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
      <header>
        <h1 className="font-display text-2xl text-navy">Billing coordinator</h1>
        <p className="text-sm text-muted-foreground">
          Tulare County pilot · 7 funding lanes tracked separately from billing status.
        </p>
      </header>

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
              {LANES.map((l) => (
                <option key={l.key} value={l.key}>
                  {l.label}
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
                {filtered.map(({ appt, patient, clinician, lane }) => {
                  const cents = appt.chargeCents ?? AdelanteEHR.chargeForService(appt.serviceType);
                  return (
                    <tr key={appt.id} className="border-t">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {new Date(appt.start).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2">{patient?.programId ?? "—"}</td>
                      <td className="px-3 py-2">{clinician?.name ?? "—"}</td>
                      <td className="px-3 py-2">
                        <span className="text-[10px] rounded-full px-2 py-0.5 bg-navy/10 text-navy">
                          {LANES.find((l) => l.key === lane)?.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{DOLLARS(cents)}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`text-[10px] rounded-full px-2 py-0.5 ${STATUS_STYLE[appt.billingStatus]}`}
                        >
                          {appt.billingStatus.replace("_", " ")}
                        </span>
                        {appt.denialReason && (
                          <div className="text-[10px] text-destructive mt-0.5">
                            {appt.denialReason}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <ClaimActions
                          appt={appt}
                          lane={lane}
                          onAdvance={advance}
                          onDeny={markDenied}
                        />
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
                  {islRows.map(({ appt, patient }) => (
                    <tr key={appt.id} className="border-t">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {new Date(appt.start).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2">{patient?.programId ?? "—"}</td>
                      <td className="px-3 py-2 text-xs">
                        {appt.serviceType?.replace("_", " ") ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {appt.islReason ?? "uninsured"}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {DOLLARS(
                          appt.chargeCents ?? AdelanteEHR.chargeForService(appt.serviceType),
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === "rates" && (
        <section className="rounded-xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Code</th>
                <th className="text-left px-3 py-2">Description</th>
                <th className="text-left px-3 py-2">Medi-Cal FFS</th>
                <th className="text-left px-3 py-2">DMC-ODS</th>
                <th className="text-left px-3 py-2">ISL</th>
              </tr>
            </thead>
            <tbody>
              {RATE_TABLE.map((r) => (
                <tr key={r.code} className="border-t">
                  <td className="px-3 py-2 font-mono text-xs">{r.code}</td>
                  <td className="px-3 py-2">{r.desc}</td>
                  <td className="px-3 py-2">{r.medi_cal}</td>
                  <td className="px-3 py-2">{r.dmc_ods}</td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">{r.isl}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="p-3 text-xs text-muted-foreground">
            Versioned rate table scoped to Tulare · demo values · billing entity:{" "}
            {entity === "bagga_npi" ? "Bagga's clinic NPI" : "Adelante"}.
            {/* TODO(adelante): source rates from DHCS + local contracts */}
          </p>
        </section>
      )}

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
  appt,
  lane,
  onAdvance,
  onDeny,
}: {
  appt: Appointment;
  lane: FundingLane;
  onAdvance: (a: Appointment, to: BillingStatus) => void;
  onDeny: (a: Appointment) => void;
}) {
  // ISL/non-billable encounters have no claim workflow.
  if (lane === "isl_non_medi_cal" || lane === "non_billable") {
    return <span className="text-[10px] text-muted-foreground">Non-billable</span>;
  }
  const s = appt.billingStatus;
  const btn =
    "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-secondary";
  return (
    <div className="inline-flex flex-wrap gap-1 justify-end">
      {s === "draft" && (
        <>
          <button className={btn} onClick={() => onAdvance(appt, "ready")}>
            <Check className="h-3 w-3" /> Mark ready
          </button>
          <button className={btn} onClick={() => onAdvance(appt, "write_off")}>
            <X className="h-3 w-3" /> Write off
          </button>
        </>
      )}
      {s === "ready" && (
        <>
          <button className={btn} onClick={() => onAdvance(appt, "submitted")}>
            <FileText className="h-3 w-3" /> Submit
          </button>
          <button className={btn} onClick={() => onAdvance(appt, "draft")}>
            Back to draft
          </button>
        </>
      )}
      {s === "submitted" && (
        <>
          <button className={btn} onClick={() => onAdvance(appt, "paid")}>
            <Check className="h-3 w-3" /> Mark paid
          </button>
          <button className={btn} onClick={() => onDeny(appt)}>
            <X className="h-3 w-3" /> Deny
          </button>
        </>
      )}
      {s === "denied" && (
        <button className={btn} onClick={() => onAdvance(appt, "ready")}>
          Resubmit
        </button>
      )}
      {s === "paid" && <span className="text-[10px] text-teal">Closed</span>}
      {s === "write_off" && (
        <button className={btn} onClick={() => onAdvance(appt, "draft")}>
          Reopen
        </button>
      )}
    </div>
  );
}
