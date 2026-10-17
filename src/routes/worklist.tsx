import { StaffTable } from "@/components/staff/StaffTable";
import { PageNewLauncher } from "@/components/staff/PageNewLauncher";
import { StatusChip } from "@/components/ui/status-chip";
// §Worklist Phase A — cross-facility operational task table.
//
// Built on the EXISTING `CaseTask` (extended additively), not a parallel task
// system: the CM queue, the notification feed's task_assigned trigger and this
// page all read the same rows. Stat cards are computed from the SCOPED set
// (every filter applied) so the numbers always describe what's on screen.
//
// Non-goals in this phase: scheduling rule engine, protocol starting
// (CIWA/COWS), order-task creation, real-time cross-user sync (same
// single-session limitation already flagged for MAR).
import { inFacilityEnabled, isInFacilityTask } from "@/lib/inFacility";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AdelanteEHR,
  useEhr,
  taskPriority,
  worklistStatusFor,
  type CaseTask,
  type TaskPriority,
  type WorklistStatus,
} from "@/lib/ehr";
import {
  canAccess,
  useActingStaff,
  STAFF_ROLES,
  type StaffRole,
} from "@/lib/roles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/EmptyState";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, ListChecks, Lock, Workflow } from "lucide-react";

export const Route = createFileRoute("/worklist")({
  // §Facility & Custody — `?view=facility-protocols` is the nav group's
  // "Facility protocols" entry: the same Worklist, narrowed to protocol rounds
  // generated for patients in an open booking episode. Filtering into the real
  // table beats cloning it, so claim/complete behaviour can never drift.
  validateSearch: (raw: Record<string, unknown>): { view?: "facility-protocols" } =>
    raw?.["view"] === "facility-protocols" ? { view: "facility-protocols" } : {},
  head: () => ({
    meta: [
      { title: "Worklist — Adelante" },
      {
        name: "description",
        content:
          "Cross-facility operational task worklist: filter by facility, role, priority and due date, then claim the work that is yours.",
      },
      { property: "og:title", content: "Worklist — Adelante" },
      {
        property: "og:description",
        content: "Claim and track cross-facility operational tasks in one table.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WorklistPage,
});

const PRIORITY_TONE: Record<TaskPriority, string> = {
  stat: "bg-surface-sunk text-attention border-0",
  urgent: "bg-warning/20 text-navy border-0",
  routine: "bg-muted text-muted-foreground border-0",
};

const STATUS_LABEL: Record<WorklistStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
  missed: "Missed",
};

const ANY = "__any";

/**
 * A protocol-generated round (CIWA/COWS/safety-cell) that was created while the
 * patient was in an open booking episode — tagged at generation time, so this
 * is a real data predicate, not a label.
 */
export function isFacilityProtocolRound(t: CaseTask): boolean {
  return Boolean(t.protocolInstanceId && t.facilityContext);
}

/** Overdue = a due date strictly before today and not yet closed out. */
export function isOverdue(t: CaseTask, today = new Date().toISOString().slice(0, 10)): boolean {
  const s = worklistStatusFor(t);
  if (s === "completed" || s === "cancelled") return false;
  return t.dueDate.slice(0, 10) < today;
}

/** allowedRoles undefined/empty = no discipline restriction. */
export function matchesDiscipline(t: CaseTask, role: StaffRole): boolean {
  return !t.allowedRoles?.length || t.allowedRoles.includes(role);
}

function WorklistPage() {
  const { role, staffName } = useActingStaff();
  const { view } = Route.useSearch();
  const navigate = useNavigate();
  const access = canAccess(role, "worklist");
  const canWrite = access.level === "write";

  const tasks = useEhr(() => AdelanteEHR.listCaseTasks());
  const patients = useEhr(() => AdelanteEHR.listPatients());
  const facilities = useEhr(() => AdelanteEHR.listFacilities(true));
  const types = useEhr(() => AdelanteEHR.worklistTaskTypes());

  const [q, setQ] = useState("");
  const [facilityId, setFacilityId] = useState(ANY);
  const [status, setStatus] = useState(ANY);
  const [priority, setPriority] = useState(ANY);
  const [taskType, setTaskType] = useState(ANY);
  const [forRole, setForRole] = useState(ANY);
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const [tableView, setTableView] = useState("needs");
  // Driven by the URL so the nav entry, deep links, and the toggle stay in sync.
  const facilityRoundsOnly = view === "facility-protocols";
  const setFacilityRoundsOnly = (on: boolean) =>
    navigate({ to: "/worklist", search: on ? { view: "facility-protocols" as const } : {} });
  // Non-supervisor roles default to discipline-scoped so a case manager isn't
  // wading through pmhnp-only rows; coordinators/admins see everything.
  const supervisory = role === "clinical_coordinator" || role === "sys_admin";
  const [myDiscipline, setMyDiscipline] = useState(!supervisory);

  const nameFor = (id: string) => {
    const p = patients.find((x) => x.id === id);
    return p ? `${p.firstName} ${p.lastName}` : id;
  };
  const facilityName = (id?: string) => facilities.find((f) => f.id === id)?.name;

  const scoped = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return tasks.filter((t) => {
      if (facilityRoundsOnly && !isFacilityProtocolRound(t)) return false;
      if (!inFacilityEnabled() && isInFacilityTask(t)) return false;
      if (facilityId !== ANY && t.facilityId !== facilityId) return false;
      if (status !== ANY && worklistStatusFor(t) !== status) return false;
      if (priority !== ANY && taskPriority(t) !== priority) return false;
      if (taskType !== ANY && t.taskType !== taskType) return false;
      if (forRole !== ANY && !matchesDiscipline(t, forRole as StaffRole)) return false;
      if (myDiscipline && !matchesDiscipline(t, role)) return false;
      if (mineOnly && t.claimedBy !== staffName && t.assignedTo !== staffName) return false;
      if (dueFrom && t.dueDate.slice(0, 10) < dueFrom) return false;
      if (dueTo && t.dueDate.slice(0, 10) > dueTo) return false;
      if (needle) {
        const hay = `${nameFor(t.patientId)} ${t.patientId} ${t.title}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tasks,
    patients,
    q,
    facilityId,
    status,
    priority,
    taskType,
    forRole,
    dueFrom,
    dueTo,
    mineOnly,
    myDiscipline,
    facilityRoundsOnly,
    role,
    staffName,
  ]);

  const needsYou = (t: CaseTask) => (worklistStatusFor(t) === "pending" || worklistStatusFor(t) === "in_progress") && (!t.claimedBy || t.claimedBy === staffName) && matchesDiscipline(t, role);
  const selectedRows = tableView === "needs" ? scoped.filter(needsYou) : scoped;
  // Every card counts the selected subset of the existing SCOPED set.
  const stats = useMemo(() => {
    const open = selectedRows.filter((t) => {
      const s = worklistStatusFor(t);
      return s === "pending" || s === "in_progress";
    });
    return {
      total: selectedRows.length,
      open: open.length,
      unclaimed: open.filter((t) => !t.claimedBy).length,
      mine: open.filter((t) => t.claimedBy === staffName || t.assignedTo === staffName).length,
      overdue: selectedRows.filter((t) => isOverdue(t)).length,
      stat: selectedRows.filter((t) => taskPriority(t) === "stat").length,
    };
  }, [selectedRows, staffName]);

  if (access.level === "none") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Card className="p-6 text-sm text-muted-foreground flex items-center gap-2">
          <Lock className="h-4 w-4" /> Your role can&apos;t view the worklist.
        </Card>
      </div>
    );
  }

  const claim = (t: CaseTask) => {
    const ok = AdelanteEHR.claimWorklistTask(t.id, staffName, role);
    toast[ok ? "success" : "error"](ok ? "Task claimed." : "Already claimed by someone else.");
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
      <PageNewLauncher />
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link to="/clinician">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to clinician
        </Link>
      </Button>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-navy flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-teal" />{" "}
            {facilityRoundsOnly ? "Facility protocols" : "Worklist"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {facilityRoundsOnly
              ? "CIWA/COWS and safety-cell rounds for patients in an open booking episode. Counts below describe the filtered view."
              : "Cross-facility operational tasks. Counts below describe the filtered view."}
          </p>
        </div>
        {/* §EHR audit Phase 1c — authoring AND execution both live behind the
            `scheduling_rules` write gate on the rules page; this only links out. */}
        {canAccess(role, "scheduling_rules").level !== "none" && (
          <Button asChild variant="outline" size="sm">
            <Link to="/admin-scheduling-rules">
              <Workflow className="h-3.5 w-3.5" /> Scheduling rules
            </Link>
          </Button>
        )}
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {(
          [
            ["Total", stats.total],
            ["Open", stats.open],
            ["Unclaimed", stats.unclaimed],
            ["Mine (open)", stats.mine],
            ["Follow-up needed", stats.overdue],
            ["STAT", stats.stat],
          ] as const
        ).map(([label, value]) => (
          <Card key={label} className="p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-display text-2xl text-navy" data-stat={label}>
              {value}
            </p>
          </Card>
        ))}
      </div>

      <Card className="p-3 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="wl-q">Search</Label>
            <Input
              id="wl-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Patient name or account"
            />
          </div>
          <FilterSelect label="Facility" value={facilityId} onChange={setFacilityId}>
            {facilities.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name}
              </SelectItem>
            ))}
          </FilterSelect>
          <FilterSelect label="Status" value={status} onChange={setStatus}>
            {(Object.keys(STATUS_LABEL) as WorklistStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </FilterSelect>
          <FilterSelect label="Priority" value={priority} onChange={setPriority}>
            {(["stat", "urgent", "routine"] as TaskPriority[]).map((p) => (
              <SelectItem key={p} value={p}>
                {p.toUpperCase()}
              </SelectItem>
            ))}
          </FilterSelect>
          <FilterSelect label="Task type" value={taskType} onChange={setTaskType}>
            {types.map((t) => (
              <SelectItem key={t} value={t}>
                {t.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </FilterSelect>
          <FilterSelect label="For role" value={forRole} onChange={setForRole}>
            {STAFF_ROLES.map((r) => (
              <SelectItem key={r.key} value={r.key}>
                {r.label}
              </SelectItem>
            ))}
          </FilterSelect>
          <div className="space-y-1.5">
            <Label htmlFor="wl-from">Due from</Label>
            <Input
              id="wl-from"
              type="date"
              value={dueFrom}
              onChange={(e) => setDueFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wl-to">Due to</Label>
            <Input id="wl-to" type="date" value={dueTo} onChange={(e) => setDueTo(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-6 pt-1">
          <label className="flex items-center gap-2 text-xs text-navy">
            <Switch checked={mineOnly} onCheckedChange={setMineOnly} /> Mine only
          </label>
          <label className="flex items-center gap-2 text-xs text-navy">
            <Switch checked={myDiscipline} onCheckedChange={setMyDiscipline} /> My discipline
          </label>
          {inFacilityEnabled() && (facilityRoundsOnly || canAccess(role, "custody_tracking").level !== "none") && (
            <label className="flex items-center gap-2 text-xs text-navy">
              <Switch
                checked={facilityRoundsOnly}
                onCheckedChange={setFacilityRoundsOnly}
                aria-label="Facility protocol rounds only"
              />{" "}
              Facility protocol rounds only
            </label>
          )}
        </div>
      </Card>

      {scoped.length === 0 ? (
        <EmptyState icon={ListChecks} title="No tasks match these filters" />
      ) : (
        <StaffTable
          rows={scoped} rowKey={(t) => t.id} label="Task worklist" testId="task-worklist-table"
          defaultView="needs"
          viewId={tableView} onViewChange={setTableView}
          emptyState="No tasks in this view."
          views={[{ id: "all", label: "Current view", matches: () => true }, { id: "needs", label: "Needs you", matches: needsYou }]}
          columns={[
          { id: "c0", label: "Priority", sortValue: (t) => taskPriority(t), cell: (t) => <>

                      <Badge className={PRIORITY_TONE[taskPriority(t)]}>
                        {taskPriority(t).toUpperCase()}
                      </Badge>
                    
          </> },
          { id: "c1", label: "Task", sortValue: (t) => t.title, cell: (t) => <>

                      {t.title}
                      {t.taskType && (
                        <span className="block text-muted-foreground">
                          {t.taskType.replace(/_/g, " ")}
                        </span>
                      )}
                    
          </> },
          { id: "c2", label: "Patient", sortValue: (t) => nameFor(t.patientId), cell: (t) => <>

                      {t.patientId ? <Link
                        to="/record/$patientId"
                        params={{ patientId: t.patientId }}
                        className="text-navy underline-offset-2 hover:underline"
                      >
                        {nameFor(t.patientId)}
                      </Link> : <span className="text-ink-muted">—</span>}
                    
          </> },
          { id: "c3", label: "Facility / housing", sortValue: (t) => facilityName(t.facilityId) ?? "", cell: (t) => <>

                      {facilityName(t.facilityId) ?? "—"}
                      {t.housingUnit ? ` · ${t.housingUnit}` : ""}
                    
          </> },
          { id: "c4", label: "Due", sortValue: (t) => t.dueDate, cell: (t) => <>

                      {t.dueDate.slice(0, 10)}
                    
          </> },
          { id: "c5", label: "For roles", sortValue: (t) => t.allowedRoles?.join(",") ?? "", cell: (t) => <>

                      {t.allowedRoles?.length ? (
                        <span className="flex flex-wrap gap-1">
                          {t.allowedRoles.map((r) => (
                            <Badge key={r} variant="outline" className="text-[10px]">
                              {STAFF_ROLES.find((x) => x.key === r)?.label ?? r}
                            </Badge>
                          ))}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Any</span>
                      )}
                    
          </> },
          { id: "c6", label: "Status", sortValue: (t) => worklistStatusFor(t), cell: (t) => <>

                      <StatusChip lang="en" state={worklistStatusFor(t) === "completed" ? "done" : worklistStatusFor(t) === "cancelled" ? "closed" : t.status === "snoozed" ? "upnext" : t.claimedBy ? (t.claimedBy === staffName ? "yourturn" : "team") : t.assignedTo === staffName || t.assignedTo === role || Boolean(t.allowedRoles?.includes(role)) ? "yourturn" : "team"} label={STATUS_LABEL[worklistStatusFor(t)]} />
                    
          </> },
          ]}
          primaryAction={(t) => <>

                      {!canWrite ? (
                        <span className="text-muted-foreground">{t.claimedBy ?? "—"}</span>
                      ) : t.claimedBy === staffName ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => AdelanteEHR.releaseWorklistTask(t.id, staffName, role)}
                        >
                          Release
                        </Button>
                      ) : t.claimedBy ? (
                        <span className="text-muted-foreground">{t.claimedBy}</span>
                      ) : worklistStatusFor(t) === "completed" || worklistStatusFor(t) === "cancelled" ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => claim(t)}>
                          Claim
                        </Button>
                      )}
                    
          </>}
          moreActions={(t) => t.patientId ? [{ label: "Open chart", onSelect: () => { void navigate({ to: "/record/$patientId", params: { patientId: t.patientId } }); } }] : []}
        />
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any</SelectItem>
          {children}
        </SelectContent>
      </Select>
    </div>
  );
}
