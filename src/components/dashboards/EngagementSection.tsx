// §Engagement/Reporting Build 1 — dashboard section.
//
// Same honesty rule as the rest of `/dashboards`: a measure with no underlying
// events renders "No live metric yet", never a fabricated 0. Access is NOT
// re-invented here — the page already gates on the `population_health` record
// class and this section renders inside that gate.
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, AlertTriangle, HeartPulse, Users } from "lucide-react";
import type { EngagementProjection } from "@/lib/engagementReporting";

function pct(v: number | null): string {
  return v === null ? "No live metric yet" : `${Math.round(v * 10) / 10}%`;
}

function num(v: number | null, hasData: boolean): string {
  if (!hasData || v === null || !Number.isFinite(v)) return "—";
  return String(Math.round(v * 10) / 10);
}

function Stat({
  label,
  value,
  basis,
}: {
  label: string;
  value: string;
  basis?: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl text-navy">{value}</p>
      {basis && <p className="mt-0.5 text-[11px] text-muted-foreground">{basis}</p>}
    </div>
  );
}

export function EngagementSection({ projection }: { projection: EngagementProjection }) {
  const { overall, byTrack, selfTracking, hasAnyEngagementData, windowDays, cohorts } = projection;

  return (
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg text-navy">
            <Activity className="h-4 w-4 text-teal" /> Patient engagement
          </h2>
          <p className="text-sm text-muted-foreground">
            Self-help and recovery-module activity across the program, broken down by derived
            population track. Activity window: last {windowDays} days.
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {cohorts.total} patient{cohorts.total === 1 ? "" : "s"}
        </Badge>
      </div>

      {!hasAnyEngagementData ? (
        <p className="rounded-md border border-dashed border-border/70 p-3 text-sm text-muted-foreground">
          No live metric yet — no patient has completed or started a lesson, exercise or tool flow.
          Nothing is estimated here.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label={`Active in last ${windowDays} days`}
            value={pct(overall.activeRatePct)}
            basis={`${overall.activeInWindow} of ${overall.patients} patients`}
          />
          <Stat
            label="Patients ever engaged"
            value={String(overall.everEngaged)}
            basis="Any completion or saved lesson work"
          />
          <Stat
            label="Completions per patient"
            value={num(overall.avgCompletionsPerPatient, hasAnyEngagementData)}
            basis={`${overall.totalLessonsCompleted + overall.totalRecoveryLessonsCompleted + overall.totalExercisesCompleted} total completions`}
          />
          <Stat
            label="Median days since activity"
            value={
              overall.medianDaysSinceActivity === null
                ? "No live metric yet"
                : `${overall.medianDaysSinceActivity}d`
            }
            basis="Among patients who ever engaged"
          />
        </div>
      )}

      {/* Cohort breakdown — derived population track, never a stored field. */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Engagement by derived population track</caption>
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-1.5 pr-2 font-medium">
                <Users className="mr-1 inline h-3 w-3" /> Population track
              </th>
              <th className="py-1.5 pr-2 text-right font-medium">Patients</th>
              <th className="py-1.5 pr-2 text-right font-medium">Ever engaged</th>
              <th className="py-1.5 pr-2 text-right font-medium">Active ({windowDays}d)</th>
              <th className="py-1.5 pr-2 text-right font-medium">Lessons</th>
              <th className="py-1.5 pr-2 text-right font-medium">Recovery</th>
              <th className="py-1.5 text-right font-medium">Tool flows</th>
            </tr>
          </thead>
          <tbody>
            {byTrack.map((c) => (
              <tr key={c.track} className="border-b border-border/40 last:border-0">
                <td className="py-1.5 pr-2">
                  {c.label}
                  {c.provisionalPatients > 0 && (
                    <Badge variant="outline" className="ml-2 text-[10px]">
                      {c.provisionalPatients} unconfirmed
                    </Badge>
                  )}
                </td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{c.patients}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{c.everEngaged}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">
                  {c.patients === 0 ? "—" : `${c.activeInWindow} (${pct(c.activeRatePct)})`}
                </td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{c.totalLessonsCompleted}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">
                  {c.totalRecoveryLessonsCompleted}
                </td>
                <td className="py-1.5 text-right tabular-nums">{c.totalToolFlowsCompleted}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Population track is derived live from pre-release episodes, front-door answers and referral
        source — it is never stored on the patient. &ldquo;Unconfirmed&rdquo; counts justice
        involvement answered &ldquo;not sure&rdquo;; those patients are shown separately and are
        never counted as confirmed.
      </p>

      {/* Self-tracking — population level only. */}
      <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
        <h3 className="flex items-center gap-2 text-sm font-medium text-navy">
          <HeartPulse className="h-4 w-4 text-teal" /> Private self-tracking — population totals
          only
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Craving logs, lapse records and recovery start dates are patient-private: they are not in
          the clinical record and there is no per-patient view of them anywhere for staff. Only
          de-aggregated counts appear here.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Craving logs"
            value={String(selfTracking.cravingLogs)}
            basis={`${selfTracking.cravingLogsWithSurfCompleted} rode the craving out`}
          />
          <Stat label="Lapse records" value={String(selfTracking.lapses)} basis="Self-reported" />
          <Stat
            label="Recovery date set"
            value={pct(
              selfTracking.recoveryDateSetRate === null
                ? null
                : selfTracking.recoveryDateSetRate * 100,
            )}
            basis={`${selfTracking.recoveryDateSet} of ${selfTracking.cohortSize} patients`}
          />
          <Stat
            label="Patients using self-tracking"
            value={String(selfTracking.patientsWithAnyActivity)}
            basis="Any craving, lapse, check-in or date"
          />
        </div>
        {selfTracking.belowMinimumCohort && (
          <p className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-900 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Cohort of {selfTracking.cohortSize} is below the {selfTracking.minimumCohortSize}
              -patient minimum for safe small-cell reporting. At this size these totals are
              practically re-identifiable by anyone who knows the caseload. Shown for the demo;
              before production these must be suppressed, not just flagged.
            </span>
          </p>
        )}
      </div>
    </Card>
  );
}
