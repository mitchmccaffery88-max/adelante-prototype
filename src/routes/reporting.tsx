// §Reporting Redesign Tier 1 — the Reporting home.
//
// Before this route, reporting was five unlinked pages discovered only through
// the staff nav, each accreted in build order. This page is the single entry
// point, organised by PURPOSE rather than by build history:
//
//   1. Operational performance  — is the program running correctly right now?
//   2. Program eligibility      — who qualifies for what (CalAIM)?
//   3. Patient behavior         — are patients engaging with the program?
//   4. Billing & claims         — did the work convert to revenue?
//   5. Configuration & audit    — what shapes the numbers above.
//
// Hierarchy is summary -> detail: each area shows its headline numbers here
// and links to the existing detail surface. No number is duplicated by a
// second calculation — every tile calls the same live helper the detail page
// calls, so the two can never disagree.
//
// Honesty rules carried over unchanged: a measure with no source says so, and
// a measure that cannot be re-windowed declares itself point-in-time instead
// of silently ignoring the period selector.
import { createFileRoute, Link } from "@tanstack/react-router";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { AdelanteEHRExt, useEhrExt } from "@/lib/ehr-ext";
import { canAccess, useActingStaff } from "@/lib/roles";
import { computeLiveMetrics } from "@/lib/dashboardMetrics";
import { engagementProjection } from "@/lib/engagementReporting";
import { activeGroupSessions, enrolledPatientCount } from "@/lib/groupMetrics";
import { calaimEligibleDischarges, calaimEligiblePatients, distinctPatients } from "@/lib/calaim";
import {
  parsePeriod,
  periodDays,
  periodLabel,
  type ReportingPeriodKey,
} from "@/lib/reportingPeriods";
// §Reporting Tier 2 — structured CalOMS capture, aggregated live from the
// patient record rather than parsed out of note templates.
import {
  calomsCompleteness,
  dischargeStatusBreakdown,
  justiceSelfReportCoverage,
  priorTreatmentBreakdown,
  substanceUseBreakdown,
  type Breakdown,
} from "@/lib/calomsReporting";
import { CALOMS_DRAFT_NOTE, JUSTICE_SELF_REPORT_NOTE } from "@/lib/caloms";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";
import { PeriodSelector } from "@/components/dashboards/PeriodSelector";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity,
  ArrowLeft,
  ChevronRight,
  ClipboardList,
  FileSearch,
  Gauge,
  Lock,
  Receipt,
  Target,
} from "lucide-react";

export const Route = createFileRoute("/reporting")({
  validateSearch: (s: Record<string, unknown>): { period?: ReportingPeriodKey } => ({
    period: s.period === undefined ? undefined : parsePeriod(s.period),
  }),
  head: () => ({
    meta: [
      { title: "Reporting home — Adelante" },
      {
        name: "description",
        content:
          "Single entry point for Adelante reporting: operational KPIs, CalAIM eligibility, patient engagement and billing claims, each summarised and linked to its detail view.",
      },
      { property: "og:title", content: "Reporting home — Adelante" },
      {
        property: "og:description",
        content:
          "Operational, eligibility, engagement and billing reporting organised by purpose with a working reporting period selector.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportingHome,
});

// ---------------------------------------------------------------------------
// Presentational primitives
// ---------------------------------------------------------------------------

function Stat({
  label,
  value,
  note,
  muted,
}: {
  label: string;
  value: string;
  note?: string;
  muted?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-1 font-display text-2xl ${muted ? "text-muted-foreground" : "text-navy"}`}
      >
        {value}
      </p>
      {note && <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{note}</p>}
    </div>
  );
}

function Area({
  id,
  title,
  purpose,
  icon: Icon,
  children,
  actions,
}: {
  id: string;
  title: string;
  purpose: string;
  icon: typeof Gauge;
  children: React.ReactNode;
  actions: React.ReactNode;
}) {
  return (
    <section className="space-y-3" aria-labelledby={`${id}-heading`} data-area={id}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2
            id={`${id}-heading`}
            className="flex items-center gap-2 font-display text-lg text-navy"
          >
            <Icon className="h-4 w-4 text-teal" aria-hidden />
            {title}
          </h2>
          <p className="max-w-2xl text-xs text-muted-foreground">{purpose}</p>
        </div>
        <div className="flex flex-wrap gap-2">{actions}</div>
      </div>
      {children}
    </section>
  );
}

/** Small distribution list used by the CalOMS area. */
function BreakdownCard({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: Breakdown<string>[];
  empty: string;
}) {
  return (
    <Card className="space-y-2 p-4">
      <h3 className="text-sm font-medium text-navy">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((r) => (
            <li key={r.key} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{r.label}</span>
              <span className="tabular-nums text-foreground">{r.count}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function pctText(v: number | null): string {
  return v === null ? "No live metric yet" : `${Math.round(v * 10) / 10}%`;
}

// ---------------------------------------------------------------------------

function ReportingHome() {
  const { role } = useActingStaff();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const period: ReportingPeriodKey = parsePeriod(search.period);
  const days = periodDays(period);

  const population = canAccess(role, "population_health");
  const billing = canAccess(role, "billing");
  const seesPopulation = population.level !== "none";
  const seesBilling = billing.level !== "none";
  const canManageTargets = population.level === "write";
  const seesAudit = canAccess(role, "consent_ledger").level !== "none";

  // Every selector below re-runs when `days` changes, so the windowed numbers
  // genuinely move with the period selector.
  const metrics = useEhr(() => (seesPopulation ? computeLiveMetrics(new Date(), days) : null));
  const engagement = useEhr(() =>
    seesPopulation ? engagementProjection({ windowDays: days }) : null,
  );
  const qualifyingCodes = useEhr(() =>
    seesPopulation ? AdelanteEHR.listQualifyingCodes().length : 0,
  );
  const calaimCaseload = useEhr(() => (seesPopulation ? calaimEligiblePatients() : []));
  // Deliberately NOT re-windowed — see the note rendered beside it.
  const calaimDischarges = useEhr(() => (seesPopulation ? calaimEligibleDischarges() : []));
  const groupActive = useEhr(() => (seesPopulation ? activeGroupSessions().length : 0));
  const groupEnrolled = useEhr(() => (seesPopulation ? enrolledPatientCount() : 0));
  const claims = useEhrExt(() => (seesBilling ? AdelanteEHRExt.listClaims() : []));
  // CalOMS capture is a current-state completeness question ("what is on file
  // right now"), so it deliberately does not respond to the period selector.
  // These are plain counts over the caseload; the CalOMS Area itself is what
  // the population-health gate hides.
  const completeness = useEhr(() => calomsCompleteness());
  const substanceRows = useEhr(() => substanceUseBreakdown());
  const priorRows = useEhr(() => priorTreatmentBreakdown());
  const dischargeRows = useEhr(() => dischargeStatusBreakdown());
  const justice = useEhr(() => justiceSelfReportCoverage());

  if (!seesPopulation && !seesBilling) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <EmptyState
          icon={Lock}
          title="Reporting is restricted"
          description={
            population.reason ??
            "Your role can't view cross-patient reporting. Ask an administrator if you need access."
          }
        />
      </div>
    );
  }

  const claimsByState = claims.reduce<Record<string, number>>((acc, c) => {
    acc[c.state] = (acc[c.state] ?? 0) + 1;
    return acc;
  }, {});
  const openClaims = claims.filter((c) => c.state !== "paid" && c.state !== "denied").length;

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-6">
      <Link to="/home" className="inline-flex items-center gap-1 text-xs text-teal">
        <ArrowLeft className="h-3 w-3" /> Back
      </Link>

      <header className="space-y-3">
        <div>
          <h1 className="font-display text-2xl text-navy">Reporting</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Every reporting surface in one place, grouped by what you are trying to answer. Each
            area shows its headline numbers and links straight to the records behind them.
          </p>
        </div>
        <Card className="flex flex-wrap items-center justify-between gap-3 p-3">
          <PeriodSelector
            value={period}
            onChange={(v) => navigate({ search: { period: v }, replace: true })}
          />
          <p className="max-w-md text-[11px] leading-tight text-muted-foreground">
            The period applies to measures computed from timestamped records. Current-state
            backlogs and the 24-hour discharge handoff lane are labelled separately — they are not
            silently re-windowed.
          </p>
        </Card>
      </header>

      {/* §Tier 3 — the reflexive-need entry point. Population reporting answers
          "how is the program doing"; this answers "what is open on me". */}
      <Card className="flex flex-wrap items-center justify-between gap-3 border-teal/40 bg-teal/5 p-4">
        <div>
          <h2 className="font-display text-base text-navy">My work</h2>
          <p className="max-w-xl text-xs text-muted-foreground">
            Crisis escalations you claimed, your unsigned notes and overdue tasks, plus re-screens
            due and caseload patients going quiet.
          </p>
        </div>
        <Button size="sm" asChild>
          <Link to="/my-work">
            Open my work <ChevronRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </Card>



      {seesPopulation && metrics && (
        <Area
          id="operational"
          title="Operational performance"
          purpose="Is the program running correctly? Medication administration, clinical documentation, case work and group delivery."
          icon={Gauge}
          actions={
            <Button size="sm" variant="outline" asChild>
              <Link to="/dashboards" search={{ period }}>
                Population health detail <ChevronRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="MAR compliance"
              value={pctText(metrics.mar_compliance_pct.value)}
              note={`${periodLabel(period)} · ${metrics.mar_compliance_pct.basis ?? ""}`}
              muted={metrics.mar_compliance_pct.value === null}
            />
            <Stat
              label="Group attendance"
              value={pctText(metrics.group_attendance_rate_pct.value)}
              note={`${periodLabel(period)} · ${groupActive} active group(s), ${groupEnrolled} enrolled`}
              muted={metrics.group_attendance_rate_pct.value === null}
            />
            <Stat
              label="Unsigned notes"
              value={String(metrics.unsigned_notes_count.value ?? 0)}
              note="As of now — current backlog, not a period measure"
            />
            <Stat
              label="Overdue tasks"
              value={String(metrics.overdue_task_count.value ?? 0)}
              note="As of now — current backlog, not a period measure"
            />
          </div>
        </Area>
      )}

      {seesPopulation && (
        <Area
          id="eligibility"
          title="Program eligibility"
          purpose="Who qualifies for what. Eligibility visibility only — nothing here generates a claim."
          icon={ClipboardList}
          actions={
            <>
              <Button size="sm" variant="outline" asChild>
                <Link to="/dashboards" search={{ period }} hash="calaim-heading">
                  CalAIM detail <ChevronRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
              {canManageTargets && (
                <Button size="sm" variant="ghost" asChild>
                  <Link to="/admin-kpi-targets" hash="calaim-codes">
                    Manage codes
                  </Link>
                </Button>
              )}
            </>
          }
        >
          {qualifyingCodes === 0 ? (
            <Card className="p-4 text-sm text-muted-foreground">
              No qualifying codes configured yet — CalAIM eligibility can&apos;t be computed.
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat
                label="Qualifying codes configured"
                value={String(qualifyingCodes)}
                note="Admin-maintained code list"
              />
              <Stat
                label="CalAIM caseload"
                value={String(distinctPatients(calaimCaseload))}
                note="As of now — patients with an active qualifying diagnosis"
              />
              <Stat
                label="Eligible discharges"
                value={String(calaimDischarges.length)}
                note="Fixed 24-hour handoff window — not affected by the period selector"
              />
            </div>
          )}
        </Area>
      )}

      {seesPopulation && (
        <Area
          id="caloms"
          title="CalOMS data capture"
          purpose="Is the structured CalOMS-shaped intake data actually being captured? Substance use, prior treatment, discharge and self-reported justice involvement."
          icon={ClipboardList}
          actions={null}
        >
          <Card className="mb-3 space-y-1 p-3">
            <Badge variant="outline" className="text-[10px]">
              Draft value sets
            </Badge>
            <p className="text-xs text-muted-foreground">{CALOMS_DRAFT_NOTE}</p>
          </Card>
          {completeness.total === 0 ? (
            <Card className="p-4 text-sm text-muted-foreground">
              No patients in the caseload — nothing to report.
            </Card>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-4">
                <Stat
                  label="Substance use recorded"
                  value={`${completeness.substanceUse} of ${completeness.total}`}
                  note={`As of now — ${pctText(completeness.substanceUsePct)} of the caseload`}
                />
                <Stat
                  label="Prior treatment recorded"
                  value={`${completeness.priorTreatment} of ${completeness.total}`}
                  note={`As of now — ${pctText(completeness.priorTreatmentPct)} of the caseload`}
                />
                <Stat
                  label="Discharge recorded"
                  value={`${completeness.discharge} of ${completeness.total}`}
                  note="As of now — most recent discharge per patient"
                />
                <Stat
                  label="Justice estimates reported"
                  value={`${completeness.justice} of ${completeness.total}`}
                  note="Self-reported by patients — not verified facility data"
                />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <BreakdownCard
                  title="Primary substance"
                  rows={substanceRows}
                  empty="No primary substance recorded yet."
                />
                <BreakdownCard
                  title="Prior treatment episodes"
                  rows={priorRows}
                  empty="No prior treatment history recorded yet."
                />
                <BreakdownCard
                  title="Most recent discharge status"
                  rows={dischargeRows}
                  empty="No discharge recorded yet."
                />
              </div>
              <Card className="space-y-2 border-amber-warm/60 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-medium text-navy">Justice involvement</h3>
                  <ProvenanceBadge source="self_report" />
                </div>
                <p className="text-xs text-muted-foreground">{JUSTICE_SELF_REPORT_NOTE}</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Stat
                    label="Reported any arrest, past 12 months"
                    value={String(justice.anyArrestPast12Months)}
                    note="Patient estimate"
                  />
                  <Stat
                    label="Median time in custody"
                    value={
                      justice.medianCustodyMonths === null
                        ? "No live metric yet"
                        : `${justice.medianCustodyMonths} months`
                    }
                    note="Patient estimate"
                  />
                  <Stat
                    label="Referral sources reported"
                    value={String(justice.referralSources.length)}
                    note="Self-reported referral source values in use"
                  />
                </div>
              </Card>
            </div>
          )}
        </Area>
      )}


      {seesPopulation && engagement && (
        <Area
          id="behavior"
          title="Patient behavior"
          purpose="Are patients engaging with the program between visits? Lesson, exercise and check-in activity across resolved cohorts."
          icon={Activity}
          actions={
            <Button size="sm" variant="outline" asChild>
              <Link to="/dashboards" search={{ period }} hash="engagement-heading">
                Engagement detail <ChevronRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          }
        >
          {!engagement.hasAnyEngagementData ? (
            <Card className="p-4 text-sm text-muted-foreground">
              No live metric yet — no patient has recorded a lesson, exercise or check-in event.
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat
                label="Patients in program"
                value={String(engagement.cohorts.members.length)}
                note={`${engagement.cohorts.buckets.length} resolved cohort(s)`}
              />
              <Stat
                label="Active in period"
                value={pctText(engagement.overall.activeRatePct)}
                note={`${periodLabel(period)} · any recorded activity`}
                muted={engagement.overall.activeRatePct === null}
              />
              <Stat
                label="Median days since activity"
                value={
                  engagement.overall.medianDaysSinceActivity === null
                    ? "—"
                    : String(engagement.overall.medianDaysSinceActivity)
                }
                note="Among patients who ever engaged"
                muted={engagement.overall.medianDaysSinceActivity === null}
              />
            </div>
          )}
        </Area>
      )}

      {seesBilling && (
        <Area
          id="billing"
          title="Billing & claims"
          purpose="Did delivered care convert to revenue? Claim lifecycle state and the ISL non-Medi-Cal reportable lane."
          icon={Receipt}
          actions={
            <>
              <Button size="sm" variant="outline" asChild>
                <Link to="/admin-claims">
                  Claims worklist <ChevronRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
              <Button size="sm" variant="ghost" asChild>
                <Link to="/billing">Billing & ISL export</Link>
              </Button>
            </>
          }
        >
          {claims.length === 0 ? (
            <Card className="p-4 text-sm text-muted-foreground">
              No claims yet — completed, signed encounters will appear here.
            </Card>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-4">
                <Stat
                  label="Open claims"
                  value={String(openClaims)}
                  note="As of now — not yet paid or denied"
                />
                <Stat label="Total claims" value={String(claims.length)} note="All time" />
                <Stat label="Paid" value={String(claimsByState["paid"] ?? 0)} note="All time" />
                <Stat
                  label="Denied"
                  value={String(claimsByState["denied"] ?? 0)}
                  note="All time"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Claim counts are lifecycle states, not period measures — a claim keeps its state
                until someone works it. The period selector does not apply.
              </p>
            </>
          )}
        </Area>
      )}

      <Area
        id="configuration"
        title="Configuration & audit"
        purpose="What shapes the numbers above, and the trail of who looked at them."
        icon={Target}
        actions={null}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {canManageTargets && (
            <Card className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-medium text-navy">KPI targets</p>
                <p className="text-xs text-muted-foreground">
                  The targets every operational row is measured against.
                </p>
              </div>
              <Button size="sm" variant="outline" asChild>
                <Link to="/admin-kpi-targets">
                  <Target className="mr-1 h-3.5 w-3.5" /> Manage
                </Link>
              </Button>
            </Card>
          )}
          {seesAudit && (
            <Card className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-medium text-navy">Audit log</p>
                <p className="text-xs text-muted-foreground">
                  Traceability for record access, with CSV export.
                </p>
              </div>
              <Button size="sm" variant="outline" asChild>
                <Link to="/admin-audit">
                  <FileSearch className="mr-1 h-3.5 w-3.5" /> Open
                </Link>
              </Button>
            </Card>
          )}
        </div>
      </Area>

      <Card className="space-y-1 p-4">
        <Badge variant="outline" className="text-[11px]">
          Scope note
        </Badge>
        <p className="text-xs text-muted-foreground">
          This is internal reporting only. There is no external submission path here — no CalOMS,
          DATAR, 274 or 837 generator exists yet, and CalAIM rows are eligibility visibility, not a
          claims feed. Measures with no data source are shown as gaps rather than as zeros.
        </p>
      </Card>
    </div>
  );
}
