// §Dashboard Cleanup Phase 6a — the one task-queue card.
//
// Extracted verbatim from `/case-manager` so the Clinician Workspace and Care
// Coordination render the SAME rows from the SAME data and can never drift.
//
// THE HONEST WRINKLE: `CaseTask.assignedTo` is a caseManagerId. A clinician
// usually has no case-manager identity, so "tasks assigned to me" is empty for
// them no matter what. Rather than invent an assignment, the card takes an
// explicit source and changes its own title and note to match what it is
// actually showing.
import { useState } from "react";
import { AdelanteEHR, useEhr, type CaseTask } from "@/lib/ehr";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";
import { TaskWorkRow } from "@/components/tasks/TaskWorkRow";

export type TaskQueueSource =
  /** Tasks assigned to this case manager — the real `assignedTo` field. */
  | { kind: "case_manager"; cmId: string }
  /** Open follow-ups on the patients clinically assigned to this clinician. */
  | { kind: "clinician_patients"; patientIds: string[] }
  /** No assignment identity at all. */
  | { kind: "none" };

const NO_IDENTITY_NOTE =
  "Tasks are assigned to a case manager, and your staff profile isn't linked to one, so nothing is addressed to you here.";

export const CLINICIAN_TASK_SOURCE_NOTE =
  "Task assignment is a case-manager field, so these are open follow-ups on the patients assigned to you — not tasks addressed to you personally.";

function tasksFor(source: TaskQueueSource): CaseTask[] {
  if (source.kind === "case_manager") return AdelanteEHR.caseTasksForCM(source.cmId);
  if (source.kind === "clinician_patients") {
    const seen = new Set<string>();
    const out: CaseTask[] = [];
    for (const pid of source.patientIds) {
      for (const t of AdelanteEHR.caseTasksForPatient(pid)) {
        if (seen.has(t.id)) continue;
        seen.add(t.id);
        out.push(t);
      }
    }
    return out;
  }
  return [];
}

export function TaskQueueCard({
  source,
  onOpenPatient,
}: {
  source: TaskQueueSource;
  onOpenPatient: (id: string) => void;
}) {
  const tasks = useEhr(() => tasksFor(source));
  const patients = useEhr(() => AdelanteEHR.listPatients());
  const open = tasks.filter((t) => t.status === "open");
  const snoozed = tasks.filter((t) => t.status === "snoozed");
  const now = Date.now();
  const overdue = open.filter((t) => +new Date(t.dueDate) < now - 86400000);
  const dueToday = open.filter(
    (t) => t.dueDate.slice(0, 10) === new Date().toISOString().slice(0, 10),
  );

  const [showDone, setShowDone] = useState(false);
  const list = showDone ? tasks : open;
  const title = source.kind === "clinician_patients" ? "Follow-ups on my patients" : "My tasks";

  return (
    <Card className="p-5" data-testid="task-queue-card">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="font-display text-lg text-navy flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-teal" /> {title}
        </h2>
        {source.kind !== "none" && (
          <div className="flex items-center gap-2 text-xs">
            <Badge className="bg-destructive/15 text-destructive border-0">
              {overdue.length} overdue
            </Badge>
            <Badge className="bg-gold/25 text-navy border-0">{dueToday.length} due today</Badge>
            <Badge variant="outline">{snoozed.length} snoozed</Badge>
            <Button size="sm" variant="ghost" onClick={() => setShowDone((v) => !v)}>
              {showDone ? "Hide done" : "Show all"}
            </Button>
          </div>
        )}
      </div>
      {source.kind === "clinician_patients" && (
        <p className="mb-3 text-xs text-muted-foreground" data-testid="task-queue-source-note">
          {CLINICIAN_TASK_SOURCE_NOTE}
        </p>
      )}
      {source.kind === "none" ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          {NO_IDENTITY_NOTE}{" "}
          <Link to="/worklist" className="underline">
            Open the worklist
          </Link>{" "}
          to work the full list.
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nothing on the queue. New tasks appear here after no-shows, crisis flags, or failed
          messages.
        </div>
      ) : (
        <ul className="space-y-2">
          {list.slice(0, 12).map((t) => {
            const p = patients.find((x) => x.id === t.patientId);
            return (
              <TaskWorkRow
                key={t.id}
                task={t}
                patientSlot={
                  p ? (
                    <button
                      className="text-xs underline text-muted-foreground"
                      onClick={() => onOpenPatient(p.id)}
                    >
                      {p.firstName} {p.lastName}
                    </button>
                  ) : null
                }
              />
            );
          })}
        </ul>
      )}
    </Card>
  );
}
