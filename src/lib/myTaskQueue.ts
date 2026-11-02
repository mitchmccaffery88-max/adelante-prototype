// R57 follow-up 2 (Mitch, 2 Nov 09:28 CT) — Draft.
// Care Coordination "My tasks" = caseload-matched tasks (unchanged) plus tasks
// assigned directly to the signed-in staff ID, de-duplicated. Directly
// assigned rows only appear when the viewer can open that member's chart, so
// chart, Part 2 and restricted-record gates stay authoritative. Read-only:
// ownership and close rights are untouched.
import { AdelanteEHR, type CaseTask } from "@/lib/ehr";
import { viewerCanOpenChart } from "@/lib/staffPatientLabel";
import type { StaffRole } from "@/lib/roles";

export type MyTaskViewer = { staffId: string; role: StaffRole };

export function withDirectStaffTasks(caseloadTasks: CaseTask[], viewer?: MyTaskViewer): CaseTask[] {
  if (!viewer?.staffId || typeof AdelanteEHR.listCaseTasks !== "function") return caseloadTasks;
  const seen = new Set(caseloadTasks.map((t) => t.id));
  const out = [...caseloadTasks];
  for (const t of AdelanteEHR.listCaseTasks()) {
    if (t.assignedTo !== viewer.staffId || seen.has(t.id)) continue;
    if (!viewerCanOpenChart(viewer, t.patientId)) continue;
    seen.add(t.id);
    out.push(t);
  }
  return out;
}
