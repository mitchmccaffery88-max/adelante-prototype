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
import { createFileRoute, Link } from "@tanstack/react-router";
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
  canManageProtocol,
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
import { ArrowLeft, ListChecks, Lock, Play } from "lucide-react";

export const Route = createFileRoute("/worklist")({
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
  stat: "bg-destructive/15 text-destructive border-0",
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
  const [running, setRunning] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);
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
    role,
    staffName,
  ]);

  // Every card counts the SCOPED set, never raw totals.
  const stats = useMemo(() => {
    const open = scoped.filter((t) => {
      const s = worklistStatusFor(t);
      return s === "pending" || s === "in_progress";
    });
    return {
      total: scoped.length,
      open: open.length,
      unclaimed: open.filter((t) => !t.claimedBy).length,
      mine: open.filter((t) => t.claimedBy === staffName || t.assignedTo === staffName).length,
      overdue: scoped.filter((t) => isOverdue(t)).length,
      stat: scoped.filter((t) => taskPriority(t) === "stat").length,
    };
  }, [scoped, staffName]);

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

  // §Scheduling rules — manual run only, same tier as starting a protocol.
  const runRules = () => {
    setRunning(true);
    try {
      const { total, results } = AdelanteEHR.runSchedulingRulesNow(staffName, role);
      const detail = results
        .filter((r) => r.tasksCreated > 0)
        .map((r) => `${r.ruleKey}: ${r.tasksCreated}`)
        .join(", ");
      toast.success(`${total} task${total === 1 ? "" : "s"} generated`, {
        description: detail || "Every matching patient already has a task this cycle.",
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link to="/clinician">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to clinician
        </Link>
      </Button>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-navy flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-teal" /> Worklist
          </h1>
          <p className="text-sm text-muted-foreground">
            Cross-facility operational tasks. Counts below describe the filtered view.
          </p>
        </div>
        {canManageProtocol(role) && (
          <Button variant="outline" size="sm" onClick={runRules} disabled={running}>
            <Play className="h-3.5 w-3.5" /> {running ? "Running rules…" : "Run rules now"}
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
            ["Overdue", stats.overdue],
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
        </div>
      </Card>

      {scoped.length === 0 ? (
        <EmptyState icon={ListChecks} title="No tasks match these filters" />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b">
                <th className="p-2">Priority</th>
                <th className="p-2">Task</th>
                <th className="p-2">Patient</th>
                <th className="p-2">Facility / housing</th>
                <th className="p-2">Due</th>
                <th className="p-2">For roles</th>
                <th className="p-2">Status</th>
                <th className="p-2">Claim</th>
              </tr>
            </thead>
            <tbody>
              {scoped.map((t) => {
                const s = worklistStatusFor(t);
                const overdue = isOverdue(t);
                return (
                  <tr key={t.id} className="border-b last:border-0 align-top">
                    <td className="p-2">
                      <Badge className={PRIORITY_TONE[taskPriority(t)]}>
                        {taskPriority(t).toUpperCase()}
                      </Badge>
                    </td>
                    <td className="p-2 text-navy">
                      {t.title}
                      {t.taskType && (
                        <span className="block text-muted-foreground">
                          {t.taskType.replace(/_/g, " ")}
                        </span>
                      )}
                    </td>
                    <td className="p-2">
                      <Link
                        to="/record/$patientId"
                        params={{ patientId: t.patientId }}
                        className="text-navy underline-offset-2 hover:underline"
                      >
                        {nameFor(t.patientId)}
                      </Link>
                    </td>
                    <td className="p-2 text-muted-foreground">
                      {facilityName(t.facilityId) ?? "—"}
                      {t.housingUnit ? ` · ${t.housingUnit}` : ""}
                    </td>
                    <td className={`p-2 ${overdue ? "font-semibold text-destructive" : "text-navy"}`}>
                      {t.dueDate.slice(0, 10)}
                    </td>
                    <td className="p-2">
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
                    </td>
                    <td className="p-2">
                      <Badge variant="outline" className="text-[10px]">
                        {STATUS_LABEL[s]}
                      </Badge>
                    </td>
                    <td className="p-2">
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
                      ) : s === "completed" || s === "cancelled" ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => claim(t)}>
                          Claim
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
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
