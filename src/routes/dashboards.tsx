// §Population health dashboards — Phase 1.
//
// Cross-patient aggregate view gated on the `population_health` record class.
// Every number here is computed live from real records; metrics with no data
// source render "No live metric yet" rather than a fabricated zero.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { canAccess, useActingStaff } from "@/lib/roles";
import {
  computeLiveMetrics,
  marExceptions,
  overdueTasks,
  unsignedNotes,
  type MetricKey,
} from "@/lib/dashboardMetrics";
import { KpiVsTargetSection } from "@/components/dashboards/KpiVsTargetSection";
import { PopulationCarePlanStrip } from "@/components/CarePlanCard";
import { CalAimSection } from "@/components/dashboards/CalAimSection";
import { GroupUtilizationSection } from "@/components/dashboards/GroupUtilizationSection";
import {
  activeGroupSessions,
  enrolledPatientCount,
  groupAbsences,
  groupAttendanceRate,
} from "@/lib/groupMetrics";
import { calaimEligibleDischarges, calaimEligiblePatients, distinctPatients } from "@/lib/calaim";
import {
  DrillDownDialog,
  PatientLink,
  type DrillDownColumn,
} from "@/components/dashboards/DrillDownDialog";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Lock, Settings2 } from "lucide-react";

export const Route = createFileRoute("/dashboards")({
  head: () => ({
    meta: [
      { title: "Population health dashboard — Adelante" },
      {
        name: "description",
        content:
          "Cross-patient KPI vs target view for MAR compliance, unsigned notes and overdue case tasks, with drill-down into the records behind each number.",
      },
      { property: "og:title", content: "Population health dashboard — Adelante" },
      {
        property: "og:description",
        content:
          "Live program metrics measured against admin-configured KPI targets, with record-level drill-down.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardsPage,
});

type DrillKind = MetricKey | "calaim_caseload" | "calaim_discharges" | null;

function DashboardsPage() {
  const { role } = useActingStaff();
  const access = canAccess(role, "population_health");
  const canManage = access.level === "write";

  const targets = useEhr(() => AdelanteEHR.listKpiTargets());
  const metrics = useEhr(() => computeLiveMetrics());
  const qualifyingCodes = useEhr(() => AdelanteEHR.listQualifyingCodes());
  const calaimCaseload = useEhr(() => calaimEligiblePatients());
  const calaimDischarges = useEhr(() => calaimEligibleDischarges());
  const groupActive = useEhr(() => activeGroupSessions().length);
  const groupEnrolled = useEhr(() => enrolledPatientCount());
  const groupAttendance = useEhr(() => groupAttendanceRate());
  const [drill, setDrill] = useState<DrillKind>(null);

  const drillConfig = useMemo(() => {
    if (drill === "unsigned_notes_count") {
      const columns: DrillDownColumn<ReturnType<typeof unsignedNotes>[number]>[] = [
        {
          key: "patient",
          header: "Patient",
          render: (r) => <PatientLink patientId={r.patientId} name={r.patientName} />,
        },
        { key: "date", header: "Note date", render: (r) => r.date.slice(0, 10) },
        { key: "type", header: "Session", render: (r) => r.sessionType },
        { key: "clinician", header: "Author", render: (r) => r.clinicianId },
        {
          key: "age",
          header: "Age",
          className: "text-right",
          render: (r) => `${r.ageDays}d`,
        },
      ];
      return {
        title: "Unsigned notes",
        description: "Progress notes still in draft — no clinician has attested to them yet.",
        columns,
        loader: () => unsignedNotes(AdelanteEHR.listPatients()),
        emptyMessage: "No unsigned notes.",
      };
    }
    if (drill === "overdue_task_count") {
      const columns: DrillDownColumn<ReturnType<typeof overdueTasks>[number]>[] = [
        {
          key: "patient",
          header: "Patient",
          render: (r) => <PatientLink patientId={r.patientId} name={r.patientName} />,
        },
        { key: "title", header: "Task", render: (r) => r.title },
        { key: "due", header: "Due", render: (r) => r.dueDate.slice(0, 10) },
        { key: "origin", header: "Origin", render: (r) => r.origin },
        {
          key: "overdue",
          header: "Overdue",
          className: "text-right",
          render: (r) => `${r.overdueDays}d`,
        },
      ];
      return {
        title: "Overdue case tasks",
        description: "Open case tasks past their recorded due date.",
        columns,
        loader: () => overdueTasks(AdelanteEHR.listCaseTasks(), AdelanteEHR.listPatients()),
        emptyMessage: "No overdue tasks.",
      };
    }
    if (drill === "mar_compliance_pct") {
      const columns: DrillDownColumn<ReturnType<typeof marExceptions>[number]>[] = [
        {
          key: "patient",
          header: "Patient",
          render: (r) => <PatientLink patientId={r.patientId} name={r.patientName} />,
        },
        { key: "action", header: "Outcome", render: (r) => r.action },
        { key: "when", header: "Scheduled", render: (r) => r.scheduledAt.slice(0, 16).replace("T", " ") },
        { key: "reason", header: "Reason", render: (r) => r.reason ?? "—" },
        { key: "by", header: "Charted by", render: (r) => r.chartedBy },
      ];
      return {
        title: "MAR exceptions (30 days)",
        description: "Refused and held doses — the administrations pulling compliance below 100%.",
        columns,
        loader: () => marExceptions(AdelanteEHR.listPatients()),
        emptyMessage: "No refused or held doses in the window.",
      };
    }
    if (drill === "group_attendance_rate_pct") {
      const columns: DrillDownColumn<ReturnType<typeof groupAbsences>[number]>[] = [
        {
          key: "patient",
          header: "Patient",
          render: (r) => <PatientLink patientId={r.patientId} name={r.patientName} />,
        },
        { key: "topic", header: "Group", render: (r) => r.topic },
        {
          key: "when",
          header: "Occurrence",
          render: (r) => r.occurrenceStart.slice(0, 16).replace("T", " "),
        },
        { key: "status", header: "Status", render: (r) => r.status },
      ];
      return {
        title: "Group attendance exceptions (30 days)",
        description:
          "Absent and late seats in occurrences where the facilitator recorded attendance.",
        columns,
        loader: () => groupAbsences(),
        emptyMessage: "Every recorded seat was present.",
      };
    }
    if (drill === "calaim_caseload") {
      const columns: DrillDownColumn<ReturnType<typeof calaimEligiblePatients>[number]>[] = [
        {
          key: "patient",
          header: "Patient",
          render: (r) => <PatientLink patientId={r.patientId} name={r.patientName} />,
        },
        { key: "icd", header: "ICD-10", render: (r) => r.icd10Code || "—" },
        { key: "problem", header: "Problem", render: (r) => r.problemDescription },
        {
          key: "matched",
          header: "Qualifying code",
          render: (r) => `${r.matchedCode} (${r.matchKind})`,
        },
      ];
      return {
        title: "CalAIM caseload",
        description:
          "Clinically active problems matching an active qualifying code, exact or category prefix.",
        columns,
        loader: () => calaimEligiblePatients(),
        emptyMessage: "No active problems match a qualifying code.",
      };
    }
    if (drill === "calaim_discharges") {
      const columns: DrillDownColumn<ReturnType<typeof calaimEligibleDischarges>[number]>[] = [
        {
          key: "patient",
          header: "Patient",
          render: (r) => <PatientLink patientId={r.patientId} name={r.patientName} />,
        },
        {
          key: "released",
          header: "Released",
          render: (r) => r.releasedAt.slice(0, 16).replace("T", " "),
        },
        { key: "facility", header: "Facility", render: (r) => r.facilityName },
        {
          key: "matched",
          header: "Qualifying code",
          render: (r) => `${r.matchedCode} (${r.matchKind})`,
        },
        { key: "problem", header: "Condition", render: (r) => r.problemDescription },
      ];
      return {
        title: "Eligible discharges (last 24h)",
        description:
          "Releases in the trailing 24 hours where the patient has, or ever had, a qualifying condition.",
        columns,
        loader: () => calaimEligibleDischarges(),
        emptyMessage: "No qualifying releases in the last 24 hours.",
      };
    }
    return null;
  }, [drill]);

  if (access.level === "none") {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6">
        <EmptyState
          icon={Lock}
          title="Population health dashboards are restricted"
          description={
            access.reason ?? "Your role can't view cross-patient population health reporting."
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <Link to="/home" className="inline-flex items-center gap-1 text-xs text-teal">
        <ArrowLeft className="h-3 w-3" /> Back
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-navy">Population health</h1>
          <p className="text-sm text-muted-foreground">
            Program-level performance against configured targets. Each measured row drills into the
            actual records behind the number.
          </p>
        </div>
        {canManage && (
          <Button size="sm" variant="outline" asChild>
            <Link to="/admin-kpi-targets">
              <Settings2 className="mr-1 h-4 w-4" /> Manage targets
            </Link>
          </Button>
        )}
      </header>

      <KpiVsTargetSection
        targets={targets}
        metrics={metrics}
        onDrillDown={(key) => setDrill(key)}
      />

      <PopulationCarePlanStrip />

      <GroupUtilizationSection
        activeGroups={groupActive}
        enrolledPatients={groupEnrolled}
        attendance={groupAttendance}
        metric={metrics.group_attendance_rate_pct}
        onOpenAbsences={() => setDrill("group_attendance_rate_pct")}
      />

      <CalAimSection
        codeCount={qualifyingCodes.length}
        caseloadCount={distinctPatients(calaimCaseload)}
        dischargeCount={calaimDischarges.length}
        canManage={canManage}
        onOpenCaseload={() => setDrill("calaim_caseload")}
        onOpenDischarges={() => setDrill("calaim_discharges")}
      />

      <p className="text-xs text-muted-foreground">
        NCCHC measures and kite volume remain deferred — those rows have no data source and are
        shown as gaps rather than as zeros. CalAIM here is eligibility visibility only, not a
        claims feed.
      </p>

      {drillConfig && (
        <DrillDownDialog
          open={drill !== null}
          onOpenChange={(o) => !o && setDrill(null)}
          title={drillConfig.title}
          description={drillConfig.description}
          columns={drillConfig.columns as DrillDownColumn<never>[]}
          loader={drillConfig.loader as () => never[]}
          emptyMessage={drillConfig.emptyMessage}
        />
      )}
    </div>
  );
}
