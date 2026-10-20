// §Population health — group utilization.
//
// Adjacent to the KPI-vs-target list because a group attendance target is not
// configured by default (inventing one would be inventing regulatory content).
// The rate follows the page's honesty rule: when no facilitator has recorded
// attendance in the window, it says so instead of rendering 0%.
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Download } from "lucide-react";
import { StatTile } from "@/components/ui/stat-tile";
import { formatMetric, type LiveMetric } from "@/lib/dashboardMetrics";
import {
  openGroupEngagementRows,
  type GroupAttendanceBreakdown,
  type OpenGroupEngagement,
} from "@/lib/groupMetrics";

/**
 * Non-billing engagement export. Same download pattern as the caseload and
 * claims CSVs, but the label is deliberately loud: if this file is shared with
 * program staff it must not be mistaken for a claims/billing export.
 */
function downloadOpenGroupCsv() {
  const rows = openGroupEngagementRows();
  const banner = [
    "NON-BILLING ENGAGEMENT DATA — open psychoeducational groups. These occurrences never create a claim. Not a billing or claims export.",
  ];
  const headers = [
    "Group session ID",
    "Topic",
    "Enrolled",
    "Capacity",
    "Occurrences with attendance (30d)",
    "Present",
    "Late",
    "Absent",
    "Patients reached (30d)",
    "Attendance %",
    "Billing status",
  ];
  const body = rows.map((r) => [
    r.sessionId,
    r.topic,
    r.enrolled,
    r.capacity,
    r.occurrencesRecorded,
    r.present,
    r.late,
    r.absent,
    r.patientsReached,
    r.attendancePct === null ? "" : Math.round(r.attendancePct),
    "Non-billing",
  ]);
  const csv = [banner, headers, ...body]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `adelante-open-group-engagement-NON-BILLING-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

interface Props {
  activeGroups: number;
  enrolledPatients: number;
  attendance: GroupAttendanceBreakdown;
  metric: LiveMetric | undefined;
  onOpenAbsences: () => void;
  /** Non-billing open-group engagement rollup. */
  openGroups: OpenGroupEngagement;
  /**
   * §Reporting Redesign Tier 1 — the selected reporting window. Attendance and
   * open-group reach are both computed from timestamped occurrence records, so
   * they re-window honestly; the caller has already recomputed with this value
   * and passes it in purely so the labels match the numbers.
   */
  windowDays?: number;
}

export function GroupUtilizationSection({
  activeGroups,
  enrolledPatients,
  attendance,
  metric,
  onOpenAbsences,
  openGroups,
  windowDays = 30,
}: Props) {
  const measured = attendance.pct !== null;

  return (
    <section className="space-y-3" aria-labelledby="group-util-heading">
      <div>
        <h2 id="group-util-heading" className="font-display text-lg text-foreground">
          Group utilization
        </h2>
        <p className="text-sm text-muted-foreground">
          Live from group rosters and facilitator-recorded attendance. Occurrences where nobody
          took attendance are excluded — missing data, not a missed group.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div data-tile="group-active" className="min-w-0">
          <StatTile
            label="Active groups"
            value={activeGroups > 0 ? activeGroups : null}
            nonPatient
            numberTestId={activeGroups > 0 ? "group-active-count" : undefined}
          >
            {activeGroups === 0 && (
              <p className="mt-1 text-sm text-muted-foreground">No groups with an active roster yet.</p>
            )}
          </StatTile>
        </div>

        <div data-tile="group-enrolled" className="min-w-0">
          <StatTile
            label="Patients enrolled"
            value={enrolledPatients}
            basis="Distinct active enrollments"
            numberTestId="group-enrolled-count"
          />
        </div>

        <div data-tile="group-attendance" className="min-w-0">
          <StatTile
            label={`Attendance rate (${windowDays}d)`}
            value={measured ? (metric?.value ?? attendance.pct) : null}
            formattedValue={formatMetric(metric)}
            unit="percent"
            cohortSize={attendance.denominator}
            basis={metric?.basis}
            numberTestId={measured ? "group-attendance-pct" : undefined}
            onDrillDown={measured ? onOpenAbsences : undefined}
          >
            {!measured && (
              <p className="mt-1 text-sm text-muted-foreground">
                No attendance has been recorded in the last {windowDays} days.
              </p>
            )}
          </StatTile>
        </div>
      </div>

      <Card className="p-4" data-tile="open-group-engagement">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" aria-hidden /> Open group engagement (non-billing)
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Open psychoeducational groups are tracked for program reach only. They never create a
          claim, so this is engagement data, not clinical claims data.
        </p>
        <Button
          size="sm"
          variant="outline"
          className="mt-3"
          disabled={openGroups.activeGroups === 0}
          onClick={downloadOpenGroupCsv}
          data-testid="open-group-engagement-export"
        >
          <Download className="h-4 w-4 mr-1.5" aria-hidden /> Export CSV (non-billing)
        </Button>
        {openGroups.activeGroups === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No open groups running yet.</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Open groups" value={openGroups.activeGroups} nonPatient />
            <StatTile label="Enrolled" value={openGroups.enrolledPatients} />
            <StatTile label={`Reached (${windowDays}d)`} value={openGroups.patientsReached} />
            <StatTile
              label={`Attendance (${windowDays}d)`}
              value={openGroups.attendance.pct === null ? null : Math.round(openGroups.attendance.pct)}
              unit="percent"
              cohortSize={openGroups.attendance.denominator}
            />
          </div>
        )}
      </Card>
    </section>
  );
}
