// §Population health — group utilization.
//
// Adjacent to the KPI-vs-target list because a group attendance target is not
// configured by default (inventing one would be inventing regulatory content).
// The rate follows the page's honesty rule: when no facilitator has recorded
// attendance in the window, it says so instead of rendering 0%.
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, CalendarClock, PieChart, ChevronRight } from "lucide-react";
import { formatMetric, type LiveMetric } from "@/lib/dashboardMetrics";
import type { GroupAttendanceBreakdown, OpenGroupEngagement } from "@/lib/groupMetrics";

interface Props {
  activeGroups: number;
  enrolledPatients: number;
  attendance: GroupAttendanceBreakdown;
  metric: LiveMetric | undefined;
  onOpenAbsences: () => void;
  /** Non-billing open-group engagement rollup. */
  openGroups: OpenGroupEngagement;
}

export function GroupUtilizationSection({
  activeGroups,
  enrolledPatients,
  attendance,
  metric,
  onOpenAbsences,
  openGroups,
}: Props) {
  const measured = attendance.pct !== null;
  return (
    <section className="space-y-3" aria-labelledby="group-util-heading">
      <div>
        <h2 id="group-util-heading" className="font-display text-lg text-navy">
          Group utilization
        </h2>
        <p className="text-xs text-muted-foreground">
          Live from group rosters and facilitator-recorded attendance. Occurrences where nobody
          took attendance are excluded — missing data, not a missed group.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4" data-tile="group-active">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarClock className="h-4 w-4" /> Active groups
          </div>
          {activeGroups > 0 ? (
            <p className="mt-2 font-display text-3xl text-navy" data-testid="group-active-count">
              {activeGroups}
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              No groups with an active roster yet.
            </p>
          )}
        </Card>

        <Card className="p-4" data-tile="group-enrolled">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="h-4 w-4" /> Patients enrolled
          </div>
          <p className="mt-2 font-display text-3xl text-navy" data-testid="group-enrolled-count">
            {enrolledPatients}
          </p>
          <p className="text-[11px] text-muted-foreground">Distinct active enrollments</p>
        </Card>

        <Card className="p-4" data-tile="group-attendance">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <PieChart className="h-4 w-4" /> Attendance rate (30d)
          </div>
          {measured ? (
            <>
              <p className="mt-2 font-display text-3xl text-navy" data-testid="group-attendance-pct">
                {formatMetric(metric)}
              </p>
              <p className="text-[11px] text-muted-foreground">{metric?.basis}</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={onOpenAbsences}>
                Details <ChevronRight className="ml-1 h-3 w-3" />
              </Button>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              No live metric yet — no attendance has been recorded in the last 30 days.
            </p>
          )}
        </Card>
      </div>

      <Card className="p-4" data-tile="open-group-engagement">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="h-4 w-4" /> Open group engagement (non-billing)
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          Open psychoeducational groups are tracked for program reach only. They never create a
          claim, so this is engagement data, not clinical claims data.
        </p>
        {openGroups.activeGroups === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No open groups running yet.</p>
        ) : (
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
            <div>
              <dt className="text-[11px] text-muted-foreground">Open groups</dt>
              <dd className="font-display text-2xl text-navy">{openGroups.activeGroups}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">Enrolled</dt>
              <dd className="font-display text-2xl text-navy">{openGroups.enrolledPatients}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">Reached (30d)</dt>
              <dd className="font-display text-2xl text-navy">{openGroups.patientsReached}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">Attendance (30d)</dt>
              <dd className="font-display text-2xl text-navy">
                {openGroups.attendance.pct === null
                  ? "—"
                  : `${Math.round(openGroups.attendance.pct)}%`}
              </dd>
            </div>
          </dl>
        )}
      </Card>
    </section>
  );
}