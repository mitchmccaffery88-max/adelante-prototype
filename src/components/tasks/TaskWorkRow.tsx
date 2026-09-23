// §Dashboard Standardization Phase 5c — the one expandable task row.
//
// Built on the SAME `CaseTask` rows and the SAME mutations `/worklist` uses
// (`setWorklistStatus`, `createCaseTask`) plus the Phase 5c attributed edit
// APIs. Care Coordination's "My tasks" card and the patient record's Tasks
// section both render this, so the two can never drift apart.
//
// Assignment is deliberately NOT editable here: reassignment is a caseload
// decision handled by the real assignment path, which writes provider-switch
// and audit records. This row shows the assignee and claim state instead.
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  AdelanteEHR,
  taskPriority,
  worklistStatusFor,
  type CaseTask,
  type TaskPriority,
  type WorklistStatus,
} from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AutoCreatedFromNote } from "@/components/clinical/AutomationTrace";
import { ClientDate } from "@/components/ClientDate";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Clock } from "lucide-react";

export const PRIORITY_TONE: Record<TaskPriority, string> = {
  stat: "bg-destructive/15 text-destructive border-0",
  urgent: "bg-gold/25 text-navy border-0",
  routine: "bg-muted text-muted-foreground border-0",
};

export const STATUS_LABEL: Record<WorklistStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
  missed: "Missed",
};

const STATUS_CHOICES: WorklistStatus[] = [
  "pending",
  "in_progress",
  "completed",
  "missed",
  "cancelled",
];

export function TaskWorkRow({
  task,
  canWrite = true,
  patientSlot,
  className,
}: {
  task: CaseTask;
  canWrite?: boolean;
  /** Optional patient link/label — the caseload card shows it, the record doesn't. */
  patientSlot?: ReactNode;
  className?: string;
}) {
  const { role, staffName } = useActingStaff();
  const [open, setOpen] = useState(false);
  const [due, setDue] = useState(task.dueDate.slice(0, 10));
  const [priority, setPriority] = useState<TaskPriority>(taskPriority(task));
  const [note, setNote] = useState("");
  const [followUp, setFollowUp] = useState<string | null>(null);
  const [followUpDue, setFollowUpDue] = useState(() => new Date().toISOString().slice(0, 10));

  const status = worklistStatusFor(task);
  const today = new Date().toISOString().slice(0, 10);
  const overdue =
    status !== "completed" && status !== "cancelled" && task.dueDate.slice(0, 10) < today;

  function saveField(patch: Parameters<typeof AdelanteEHR.updateCaseTaskFields>[1], label: string) {
    if (AdelanteEHR.updateCaseTaskFields(task.id, patch, staffName, role)) {
      toast.success(`${label} updated.`, { description: `Recorded as ${staffName}.` });
    }
  }

  return (
    <li
      className={cn(
        "rounded-lg border p-3 text-sm",
        overdue && "border-destructive/40 bg-destructive/5",
        className,
      )}
      data-testid="task-work-row"
    >
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
        >
          {open ? (
            <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-navy">{task.title}</span>
              <Badge className={cn("text-[10px] capitalize", PRIORITY_TONE[taskPriority(task)])}>
                {taskPriority(task)}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {STATUS_LABEL[status]}
              </Badge>
            </span>
            {task.detail && (
              <span className="mt-0.5 block text-xs text-muted-foreground">{task.detail}</span>
            )}
            <span className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" /> Due {task.dueDate.slice(0, 10)}
              </span>
              <span className="capitalize">{task.origin.replace(/_/g, " ")}</span>
              {task.claimedBy && <span>Claimed by {task.claimedBy}</span>}
            </span>
          </span>
        </button>
        <div className="shrink-0 text-right">{patientSlot}</div>
      </div>

      {open && (
        <div className="mt-3 space-y-3 border-t pt-3">
          <div className="grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
            <div>Assigned to {task.assignedTo}</div>
            {task.taskType && <div>Type: {task.taskType}</div>}
            <div>
              Created <ClientDate value={task.createdAt} />
            </div>
            {task.lastEditedBy && (
              <div>
                Last edited by {task.lastEditedBy} · <ClientDate value={task.lastEditedAt!} />
              </div>
            )}
          </div>
          <AutoCreatedFromNote task={task} />

          {canWrite && (
            <>
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Status</Label>
                  <Select
                    value={status}
                    onValueChange={(v) => {
                      if (AdelanteEHR.setWorklistStatus(task.id, v as WorklistStatus, staffName, role))
                        toast.success(`Status set to ${STATUS_LABEL[v as WorklistStatus]}.`, {
                          description: `Recorded as ${staffName}.`,
                        });
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_CHOICES.map((s) => (
                        <SelectItem key={s} value={s} className="text-xs">
                          {STATUS_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Due date</Label>
                  <Input
                    type="date"
                    value={due}
                    className="h-9 text-xs"
                    onChange={(e) => setDue(e.target.value)}
                    onBlur={() => due && due !== task.dueDate.slice(0, 10) && saveField({ dueDate: due }, "Due date")}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Priority</Label>
                  <Select
                    value={priority}
                    onValueChange={(v) => {
                      setPriority(v as TaskPriority);
                      saveField({ priority: v as TaskPriority }, "Priority");
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["routine", "urgent", "stat"] as TaskPriority[]).map((p) => (
                        <SelectItem key={p} value={p} className="text-xs capitalize">
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Add a note</Label>
                <Textarea
                  rows={2}
                  value={note}
                  placeholder="What happened on this task?"
                  onChange={(e) => setNote(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 text-xs"
                    onClick={() => {
                      if (!AdelanteEHR.addCaseTaskNote(task.id, note, staffName, role)) {
                        toast.error("Write a note first.");
                        return;
                      }
                      setNote("");
                      toast.success("Note added.", { description: `Recorded as ${staffName}.` });
                    }}
                  >
                    Save note
                  </Button>
                  {status !== "completed" && (
                    <Button
                      size="sm"
                      className="h-9 text-xs"
                      onClick={() => setFollowUp(`Follow-up: ${task.title}`)}
                    >
                      Complete and schedule follow-up
                    </Button>
                  )}
                </div>
              </div>

              {followUp !== null && (
                <div className="space-y-2 rounded-lg border bg-secondary/40 p-2.5">
                  <Label className="text-[10px] text-muted-foreground">Next step</Label>
                  <Input
                    value={followUp}
                    className="h-9 text-xs"
                    onChange={(e) => setFollowUp(e.target.value)}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      type="date"
                      value={followUpDue}
                      className="h-9 w-[160px] text-xs"
                      onChange={(e) => setFollowUpDue(e.target.value)}
                    />
                    <Button
                      size="sm"
                      className="h-9 text-xs"
                      onClick={() => {
                        if (!followUp.trim()) {
                          toast.error("Give the next step a title.");
                          return;
                        }
                        AdelanteEHR.createCaseTask({
                          patientId: task.patientId,
                          assignedTo: task.assignedTo,
                          title: followUp.trim(),
                          dueDate: followUpDue,
                          origin: "manual",
                          priority: taskPriority(task),
                        });
                        AdelanteEHR.setWorklistStatus(task.id, "completed", staffName, role);
                        AdelanteEHR.addCaseTaskNote(
                          task.id,
                          `Completed; next step scheduled: ${followUp.trim()} (due ${followUpDue}).`,
                          staffName,
                          role,
                        );
                        setFollowUp(null);
                        toast.success("Task completed and next step created.", {
                          description: `Recorded as ${staffName}.`,
                        });
                      }}
                    >
                      Create
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 text-xs"
                      onClick={() => setFollowUp(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {(task.notes?.length ?? 0) > 0 && (
            <ul className="space-y-1.5">
              {task.notes!.map((n) => (
                <li key={n.id} className="rounded border bg-card p-2 text-xs">
                  <div className="text-foreground">{n.text}</div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    {n.authorName} · {n.authorRole.replace(/_/g, " ")} · <ClientDate value={n.at} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
