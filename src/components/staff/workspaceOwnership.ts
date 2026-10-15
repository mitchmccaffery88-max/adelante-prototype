import { AdelanteEHR } from "@/lib/ehr";
import { staffAliases } from "@/lib/myWork";
import type { WorkspaceActionRow } from "@/lib/clinicianWorkspace";
import type { WorkspaceActor } from "@/lib/workspaceIdentity";

/** Called only on already-visible rows. No gate, status or action is changed. */
export function waitingOnOthers(row: WorkspaceActionRow, actor: WorkspaceActor): boolean {
  if (row.kind === "lab") return true;
  if (row.kind === "screener") return row.action === "Open chart";
  if (row.kind === "task") {
    const task = AdelanteEHR.listCaseTasks().find(t => t.id === row.sourceId);
    if (!task?.assignedTo) return false;
    return !staffAliases(actor).has(task.assignedTo);
  }
  // Reassign/review queues belong to the coordinator/reviewer even when an
  // underlying record names somebody else; never infer turn from its label.
  return false;
}