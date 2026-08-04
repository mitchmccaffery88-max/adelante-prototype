// §Scheduling rule engine — admin registry.
//
// Rules are MANUALLY run from /worklist ("Run rules now"); nothing here
// schedules itself. Conditions are two structured AND-matchers over real
// data (active Problem category, active Order frequency code) — deliberately
// not a general expression language.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AdelanteEHR, useEhr, type SchedulingRule, type TaskPriority } from "@/lib/ehr";
import { listFrequencies } from "@/lib/frequencies";
import { canAccess, useActingStaff, STAFF_ROLES, type StaffRole } from "@/lib/roles";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/EmptyState";
import { ArrowLeft, Ban, Lock, Pencil, Plus, RotateCcw, Workflow } from "lucide-react";

export const Route = createFileRoute("/admin-scheduling-rules")({
  head: () => ({
    meta: [
      { title: "Scheduling rules — Adelante Admin" },
      {
        name: "description",
        content:
          "Author the scheduling rules that generate worklist tasks from active problems and active medication orders, then run them on demand.",
      },
      { property: "og:title", content: "Scheduling rules — Adelante Admin" },
      {
        property: "og:description",
        content: "Admin registry for manually-run worklist task generation rules.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SchedulingRulesPage,
});

const NONE = "__none";
const PRIORITIES: TaskPriority[] = ["stat", "urgent", "routine"];

const BLANK = {
  id: undefined as string | undefined,
  key: "",
  label: "",
  description: "",
  taskType: "",
  activeProblemCategory: NONE,
  activeOrderFrequencyCode: NONE,
  cadenceMinutes: "1440",
  priority: "routine" as TaskPriority,
  allowedRoles: [] as StaffRole[],
};

function cadenceLabel(min: number) {
  if (min % 1440 === 0) return `${min / 1440}d`;
  if (min % 60 === 0) return `${min / 60}h`;
  return `${min}m`;
}

function SchedulingRulesPage() {
  const { role, staffName } = useActingStaff();
  const access = canAccess(role, "scheduling_rules");
  const canWrite = access.level === "write";

  const rules = useEhr(() => AdelanteEHR.listSchedulingRules(true));
  const patients = useEhr(() => AdelanteEHR.listPatients());
  const taskTypes = useEhr(() => AdelanteEHR.worklistTaskTypes());
  const frequencies = listFrequencies();

  // Real data sources, not hardcoded lists.
  const problemCategories = useMemo(() => {
    const set = new Set<string>();
    for (const p of patients)
      for (const pr of AdelanteEHR.listProblems(p.id))
        if (pr.status === "active" && pr.category) set.add(pr.category);
    return [...set].sort();
  }, [patients]);

  const [form, setForm] = useState({ ...BLANK });
  const [open, setOpen] = useState(false);
  const [deactivating, setDeactivating] = useState<SchedulingRule | null>(null);
  const [reason, setReason] = useState("");

  if (access.level === "none") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Card className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Lock className="h-4 w-4" /> Your role can&apos;t view scheduling rules.
        </Card>
      </div>
    );
  }

  const startNew = () => {
    setForm({ ...BLANK });
    setOpen(true);
  };
  const startEdit = (r: SchedulingRule) => {
    setForm({
      id: r.id,
      key: r.key,
      label: r.label,
      description: r.description ?? "",
      taskType: r.taskType,
      activeProblemCategory: r.match.activeProblemCategory ?? NONE,
      activeOrderFrequencyCode: r.match.activeOrderFrequencyCode ?? NONE,
      cadenceMinutes: String(r.cadenceMinutes),
      priority: r.priority,
      allowedRoles: r.allowedRoles ?? [],
    });
    setOpen(true);
  };

  const save = () => {
    try {
      AdelanteEHR.saveSchedulingRule(
        {
          id: form.id,
          key: form.key,
          label: form.label,
          description: form.description,
          taskType: form.taskType,
          match: {
            activeProblemCategory:
              form.activeProblemCategory === NONE ? undefined : form.activeProblemCategory,
            activeOrderFrequencyCode:
              form.activeOrderFrequencyCode === NONE ? undefined : form.activeOrderFrequencyCode,
          },
          cadenceMinutes: Number(form.cadenceMinutes),
          priority: form.priority,
          allowedRoles: form.allowedRoles,
        },
        staffName,
        role,
      );
      toast.success(form.id ? "Rule updated." : "Rule created.");
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const confirmDeactivate = () => {
    if (!deactivating) return;
    try {
      AdelanteEHR.deactivateSchedulingRule(deactivating.id, staffName, reason, role);
      toast.success("Rule deactivated.");
      setDeactivating(null);
      setReason("");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link to="/admin">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to admin
        </Link>
      </Button>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl text-navy">
            <Workflow className="h-5 w-5 text-teal" /> Scheduling rules
          </h1>
          <p className="text-sm text-muted-foreground">
            Rules generate worklist tasks when a supervisor runs them from the worklist. Nothing
            here runs on its own.
          </p>
        </div>
        {canWrite && (
          <Button onClick={startNew}>
            <Plus className="h-4 w-4" /> New rule
          </Button>
        )}
      </header>

      <Card className="p-3">
        {rules.length === 0 ? (
          <EmptyState title="No rules yet" description="Create a rule to generate worklist tasks." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Task type</TableHead>
                <TableHead>Cadence</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Matches now</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((r) => (
                <TableRow key={r.id} className={r.active ? "" : "opacity-60"}>
                  <TableCell>
                    <p className="font-medium text-navy">{r.label}</p>
                    <p className="text-xs text-muted-foreground">{r.key}</p>
                    {!r.active && (
                      <p className="text-xs text-muted-foreground">
                        Deactivated — {r.deactivationReason}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.match.activeProblemCategory && (
                      <div>Active problem: {r.match.activeProblemCategory}</div>
                    )}
                    {r.match.activeOrderFrequencyCode && (
                      <div>Active order freq: {r.match.activeOrderFrequencyCode}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{r.taskType}</TableCell>
                  <TableCell className="text-xs">{cadenceLabel(r.cadenceMinutes)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{r.priority}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {AdelanteEHR.patientsMatchingRule(r).length}
                  </TableCell>
                  <TableCell className="text-right">
                    {canWrite && (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => startEdit(r)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {r.active ? (
                          <Button size="sm" variant="ghost" onClick={() => setDeactivating(r)}>
                            <Ban className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              AdelanteEHR.reactivateSchedulingRule(r.id, staffName, role);
                              toast.success("Rule reactivated.");
                            }}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit rule" : "New rule"}</DialogTitle>
            <DialogDescription>
              A rule needs at least one condition. Cadence doubles as the idempotency window: a
              patient gets at most one task per rule per cadence.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="sr-key">Key</Label>
                <Input
                  id="sr-key"
                  value={form.key}
                  onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
                  placeholder="mh_weekly_checkin"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sr-label">Label</Label>
                <Input
                  id="sr-label"
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sr-desc">Description</Label>
              <Textarea
                id="sr-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Active problem category</Label>
                <Select
                  value={form.activeProblemCategory}
                  onValueChange={(v) => setForm((f) => ({ ...f, activeProblemCategory: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Any</SelectItem>
                    {problemCategories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Active order frequency</Label>
                <Select
                  value={form.activeOrderFrequencyCode}
                  onValueChange={(v) => setForm((f) => ({ ...f, activeOrderFrequencyCode: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Any</SelectItem>
                    {frequencies.map((fq) => (
                      <SelectItem key={fq.code} value={fq.code}>
                        {fq.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sr-type">Task type</Label>
                <Input
                  id="sr-type"
                  list="sr-task-types"
                  value={form.taskType}
                  onChange={(e) => setForm((f) => ({ ...f, taskType: e.target.value }))}
                  placeholder="coordination"
                />
                <datalist id="sr-task-types">
                  {taskTypes.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sr-cad">Cadence (minutes)</Label>
                <Input
                  id="sr-cad"
                  inputMode="numeric"
                  value={form.cadenceMinutes}
                  onChange={(e) => setForm((f) => ({ ...f, cadenceMinutes: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) => setForm((f) => ({ ...f, priority: v as TaskPriority }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Visible to roles (none checked = all disciplines)</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {STAFF_ROLES.map((r) => (
                  <label key={r.key} className="flex items-center gap-2 text-xs">
                    <Checkbox
                      checked={form.allowedRoles.includes(r.key)}
                      onCheckedChange={(c) =>
                        setForm((f) => ({
                          ...f,
                          allowedRoles: c
                            ? [...f.allowedRoles, r.key]
                            : f.allowedRoles.filter((x) => x !== r.key),
                        }))
                      }
                    />
                    {r.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>Save rule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deactivating)} onOpenChange={(o) => !o && setDeactivating(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate rule</DialogTitle>
            <DialogDescription>
              Rules are never deleted — already-generated tasks must stay explainable.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="sr-reason">Reason</Label>
            <Textarea
              id="sr-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeactivating(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeactivate}>
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
