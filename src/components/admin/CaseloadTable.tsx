import { StatusChip } from "@/components/ui/status-chip";
import { useMemo, useState } from "react";
import { AdelanteEHR, type Patient, type EpisodeType } from "@/lib/ehr";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StaffTable } from "@/components/staff/StaffTable";
import { useActingStaff } from "@/lib/roles";
import { roleSeesSudProgram, patientSudProgramVisible } from "@/lib/sudProgramVisibility";
import { Download } from "lucide-react";
import { ClientDate } from "@/components/ClientDate";
import { AssignClinicianButton } from "@/components/AssignClinicianButton";

interface Props {
  patients: Patient[];
  title?: string;
  onOpenPatient?: (id: string) => void;
  showAssignClinician?: boolean;
  exportLabel?: string;
  exportFilename?: string;
}

export function CaseloadTable({
  patients,
  title = "Caseload",
  onOpenPatient,
  showAssignClinician = false,
  exportLabel = "Export CSV",
  exportFilename = "adelante-caseload",
}: Props) {
  const [coverageFilter, setCoverageFilter] = useState<string>("all");
  const [bucketFilter, setBucketFilter] = useState<string>("all");
  const [programFilter, setProgramFilter] = useState<string>("all");
  // §Group A #2 — the SUD program is Part 2 classification: the option shows
  // only to roles with unconditional screeners_sud access, and matching keeps
  // the per-patient Part 2 check (hidden, like the chart's ASAM section).
  const { role } = useActingStaff();
  const showSudProgram = roleSeesSudProgram(role);
  const [clinicianFilter, setClinicianFilter] = useState<string>("all");
  const [careNeedFilter, setCareNeedFilter] = useState<string>("all");
  const filtered = useMemo(
    () =>
      patients.filter((p) => {
        if (coverageFilter !== "all" && p.coverage?.status !== coverageFilter) return false;
        if (bucketFilter !== "all") {
          const d = p.episodeDay;
          if (bucketFilter === "0-30" && !(d <= 30)) return false;
          if (bucketFilter === "31-60" && !(d > 30 && d <= 60)) return false;
          if (bucketFilter === "61-90" && !(d > 60)) return false;
        }
        if (programFilter !== "all") {
          const hasProgram = (p.episodes ?? []).some(
            (e) => !e.closedAt && e.type === (programFilter as EpisodeType),
          );
          if (programFilter === "sud_dmc_ods" && !patientSudProgramVisible(role, p)) return false;
          if (!hasProgram) return false;
        }
        if (clinicianFilter !== "all") {
          if (clinicianFilter === "unassigned") {
            if (p.primaryClinicianId) return false;
          } else if (p.primaryClinicianId !== clinicianFilter) return false;
        }
        if (careNeedFilter !== "all") {
          if (careNeedFilter === "crisis" && !p.crisisFlag) return false;
          if (careNeedFilter === "ecm" && !p.coverage?.ecmEligible) return false;
          if (careNeedFilter === "ji_reentry" && !p.coverage?.jiReentryFlag) return false;
          if (careNeedFilter === "unassigned" && p.primaryClinicianId) return false;
        }
        return true;
      }),
    [patients, coverageFilter, bucketFilter, programFilter, clinicianFilter, careNeedFilter, role],
  );
  const clinicians = AdelanteEHR.listClinicians();
  const activeFilters =
    coverageFilter !== "all" ||
    bucketFilter !== "all" ||
    programFilter !== "all" ||
    clinicianFilter !== "all" ||
    careNeedFilter !== "all";

  const downloadCsv = () => {
    const headers = [
      "Program ID",
      "CIN (last 4)",
      "Episode day (of 90)",
      "Coverage status",
      "Coverage verified",
      "JI Reentry flag",
      "ECM eligible",
      "SMS reminders",
    ];
    const rows = filtered.map((p) => [
      p.programId,
      p.cin ? `••••${p.cin.slice(-4)}` : "",
      p.episodeDay,
      p.coverage?.status ?? "",
      p.coverage?.verified ?? "",
      p.coverage?.jiReentryFlag ? "Yes" : "No",
      p.coverage?.ecmEligible ? "Yes" : "No",
      AdelanteEHR.isSmsOn(p.id) ? "On" : "Off",
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportFilename}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="font-display text-lg text-navy">{title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {filtered.length}/{patients.length}
          </Badge>
          <Button size="sm" variant="outline" onClick={downloadCsv}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> {exportLabel}
          </Button>
        </div>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <Select value={bucketFilter} onValueChange={setBucketFilter}>
          <SelectTrigger className="h-9 sm:h-8 w-full sm:w-[140px] text-xs">
            <SelectValue placeholder="Episode day" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All days</SelectItem>
            <SelectItem value="0-30">Day 0–30</SelectItem>
            <SelectItem value="31-60">Day 31–60</SelectItem>
            <SelectItem value="61-90">Day 61–90</SelectItem>
          </SelectContent>
        </Select>
        <Select value={coverageFilter} onValueChange={setCoverageFilter}>
          <SelectTrigger className="h-9 sm:h-8 w-full sm:w-[140px] text-xs">
            <SelectValue placeholder="Coverage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All coverage</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="none_unsure">None / unsure</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
        <Select value={programFilter} onValueChange={setProgramFilter}>
          <SelectTrigger className="h-9 sm:h-8 w-full sm:w-[160px] text-xs">
            <SelectValue placeholder="Program" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All programs</SelectItem>
            <SelectItem value="mental_health">Mental health</SelectItem>
            {showSudProgram && <SelectItem value="sud_dmc_ods">SUD (DMC-ODS)</SelectItem>}
            <SelectItem value="ecm">ECM</SelectItem>
            <SelectItem value="ji_pre_release">JI pre-release</SelectItem>
            <SelectItem value="bhsa">BHSA</SelectItem>
          </SelectContent>
        </Select>
        <Select value={clinicianFilter} onValueChange={setClinicianFilter}>
          <SelectTrigger className="h-9 sm:h-8 w-full sm:w-[180px] text-xs">
            <SelectValue placeholder="Clinician" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clinicians</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {clinicians.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={careNeedFilter} onValueChange={setCareNeedFilter}>
          <SelectTrigger className="h-9 sm:h-8 w-full sm:w-[160px] text-xs">
            <SelectValue placeholder="Care need" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All care needs</SelectItem>
            <SelectItem value="crisis">Crisis flagged</SelectItem>
            <SelectItem value="ecm">ECM eligible</SelectItem>
            <SelectItem value="ji_reentry">JI reentry</SelectItem>
            <SelectItem value="unassigned">Unassigned clinician</SelectItem>
          </SelectContent>
        </Select>
        {activeFilters && (
          <Button
            size="sm"
            variant="ghost"
            className="col-span-2 h-9 sm:h-8 sm:col-span-1"
            onClick={() => {
              setCoverageFilter("all");
              setBucketFilter("all");
              setProgramFilter("all");
              setClinicianFilter("all");
              setCareNeedFilter("all");
            }}
          >
            Clear
          </Button>
        )}
      </div>
      <StaffTable
        rows={filtered} rowKey={(p) => p.id} label={title} testId="caseload-table"
        views={[{ id: "all", label: "Current caseload", matches: () => true }]}
        emptyState="No patients match these filters."
        columns={[
          { id: "program", label: "Patient ID", mono: true, sortValue: (p) => p.programId, cell: (p) => p.programId },
          { id: "cin", label: "CIN", mono: true, cell: (p) => p.cin ? `••••${p.cin.slice(-4)}` : "—" },
          { id: "episode", label: "Episode day", sortValue: (p) => p.episodeDay, cell: (p) => <span>{p.episodeDay}/90</span> },
          { id: "coverage", label: "Coverage", sortValue: (p) => p.coverage?.status ?? "", cell: (p) => <CoverageBadge status={p.coverage?.status} /> },
          { id: "visit", label: "Next appt", sortValue: (p) => nextAppointment(p.id)?.start ?? "", cell: (p) => { const next = nextAppointment(p.id); return next ? <ClientDate value={next.start} /> : "—"; } },
          { id: "engagement", label: "Engagement", sortValue: (p) => p.episodeDay, cell: (p) => <Badge variant="outline">{p.episodeDay > 30 ? "Steady" : "New"}</Badge> },
          { id: "sms", label: "SMS", cell: (p) => AdelanteEHR.isSmsOn(p.id) ? <Badge className="bg-gold/30 text-on-gold border-0">On</Badge> : "Off" },
          ...(showAssignClinician ? [{ id: "clinician", label: "Primary clinician", cell: (p: Patient) => <span>{clinicians.find((c) => c.id === p.primaryClinicianId)?.name ?? <StatusChip lang="en" state="yourturn" label="Unassigned" />}</span> }] : []),
        ]}
        primaryAction={onOpenPatient ? (p) => <Button size="sm" variant="outline" onClick={() => onOpenPatient(p.id)}>Open profile</Button> : undefined}
        moreContent={showAssignClinician ? (p) => <AssignClinicianButton patientId={p.id} size="sm" variant="ghost" /> : undefined}
      />
      <p className="mt-3 text-xs text-muted-foreground">
        Open the patient profile. No names, diagnoses, or care-plan narrative
        shown in the table — clinical detail lives only in Case Manager and Clinician workspaces.
      </p>
    </Card>
  );
}

function CoverageBadge({ status }: { status?: string }) {
  if (!status) return <span className="text-xs text-muted-foreground">—</span>;
  const styles: Record<string, string> = {
    active: "bg-success/20 text-success",
    suspended: "bg-gold/30 text-navy",
    none_unsure: "bg-surface-sunk text-attention",
    other: "bg-muted text-muted-foreground",
  };
  const labels: Record<string, string> = {
    active: "Active",
    suspended: "Suspended",
    none_unsure: "Assistance",
    other: "Other",
  };
  return (
    <Badge className={`${styles[status] ?? ""} border-0 text-xs`}>{labels[status] ?? status}</Badge>
  );
}
function nextAppointment(id: string) {
  return AdelanteEHR.appointmentsForPatient(id).filter((a) => +new Date(a.start) > Date.now()).sort((a, b) => +new Date(a.start) - +new Date(b.start))[0];
}
