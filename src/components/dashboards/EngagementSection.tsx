// §Engagement/Reporting Build 1 — dashboard section.
//
// Same honesty rule as the rest of `/dashboards`: a measure with no underlying
// events renders "No live metric yet", never a fabricated 0. Access is NOT
// re-invented here — the page already gates on the `population_health` record
// class and this section renders inside that gate.
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Users } from "lucide-react";
import { StatTile } from "@/components/ui/stat-tile";
import { MIN_COHORT_SIZE } from "@/lib/cohortGuard";
import type { EngagementProjection } from "@/lib/engagementReporting";

function pct(v: number | null): string {
  return v === null ? "No live metric yet" : `${Math.round(v * 10) / 10}%`;
}

/** §9a-2 — table cells are cross-patient counts too: below 11 shows "<11". */
function cell(n: number): string {
  return n < MIN_COHORT_SIZE ? "<11" : String(n);
}

export function EngagementSection({ projection }: { projection: EngagementProjection }) {
  const { overall, byTrack, hasAnyEngagementData, windowDays, cohorts } = projection;

  return (
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2
            id="engagement-heading"
            className="flex items-center gap-2 font-display text-lg text-foreground"
          >
            <Activity className="h-4 w-4 text-primary" /> Patient engagement
          </h2>

          <p className="text-sm text-muted-foreground">
            Self-help and recovery-module activity across the program, broken down by derived
            population track. Activity window: last {windowDays} days.
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {cell(cohorts.total)} patient{cohorts.total === 1 ? "" : "s"}
        </Badge>
      </div>

      {!hasAnyEngagementData ? (
        <p className="rounded-md border border-dashed border-border/70 p-3 text-sm text-muted-foreground">
          No live metric yet — no patient has completed or started a lesson, exercise or tool flow.
          Nothing is estimated here.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label={`Active in last ${windowDays} days`}
            value={overall.activeRatePct === null ? null : Math.round(overall.activeRatePct * 10) / 10}
            unit="percent"
            cohortSize={overall.patients}
            basis={`${overall.activeInWindow} of ${overall.patients} patients`}
          />
          <StatTile
            label="Patients ever engaged"
            value={overall.everEngaged}
            basis="Any completion or saved lesson work"
          />
          <StatTile
            label="Completions per patient"
            value={overall.avgCompletionsPerPatient === null || !Number.isFinite(overall.avgCompletionsPerPatient) ? null : Math.round(overall.avgCompletionsPerPatient * 10) / 10}
            cohortSize={overall.patients}
            basis={`${overall.totalLessonsCompleted + overall.totalRecoveryLessonsCompleted + overall.totalExercisesCompleted} total completions`}
          />
          <StatTile
            label="Median days since activity"
            value={overall.medianDaysSinceActivity}
            formattedValue={overall.medianDaysSinceActivity === null ? undefined : `${overall.medianDaysSinceActivity}d`}
            cohortSize={overall.everEngaged}
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
                      {cell(c.provisionalPatients)} unconfirmed
                    </Badge>
                  )}
                </td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{cell(c.patients)}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{cell(c.everEngaged)}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">
                  {c.patients === 0 ? "—" : c.patients < MIN_COHORT_SIZE ? "<11" : `${c.activeInWindow} (${pct(c.activeRatePct)})`}
                </td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{cell(c.totalLessonsCompleted)}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">
                  {cell(c.totalRecoveryLessonsCompleted)}
                </td>
                <td className="py-1.5 text-right tabular-nums">{cell(c.totalToolFlowsCompleted)}</td>
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

      {/* §Privacy P1 — private self-tracking totals are no longer shown on
          any aggregate dashboard; they stay with the patient and care team. */}
    </Card>
  );
}
