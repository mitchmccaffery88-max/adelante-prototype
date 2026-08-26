// §Standalone route items — MY TOOLKIT, a read-only aggregation.
//
// This module creates NO new store. Everything it returns already exists:
//   • `recoveryToolFlows[lessonId]` — the Part B "Create my toolkit" picks
//     (warning signs, support people, one action for today), written by
//     `completeRecoveryLesson` in src/lib/engagement.ts.
//   • `savedToolkitItems` — the one-line takeaway auto-saved when a Library
//     lesson, Recovery lesson or Exercise is completed.
// Saved community resources are deliberately NOT folded in: they live on
// `/resources/saved` and are a directory bookmark list, not something the
// patient built inside a lesson.
//
// Access follows the existing engagement rule exactly — these reads are
// patient-scoped through the same `AdelanteEHR` facade every other engagement
// read uses, and nothing here is added to the advocate DTO, the cohort read
// (`engagementRecords` strips responses) or any clinical export. No new access
// rule is invented; 42 CFR Part 2 handling is unchanged because toolkit picks
// are engagement data, not clinical documentation.
import { AdelanteEHR } from "@/lib/ehr";
import { liveRecoveryLesson, liveRecoveryModule } from "@/lib/contentCatalog";
import type { SavedToolkitItem } from "@/lib/library";

/** One tool the patient picked, with the lesson it came from. */
export interface ToolkitPick {
  value: string;
  lessonId: string;
  lessonTitle: string;
  moduleName: string;
  updatedAt: string;
}

export interface PatientToolkit {
  warningSigns: ToolkitPick[];
  supportPeople: ToolkitPick[];
  todayActions: ToolkitPick[];
  /** Auto-saved takeaways (Library lessons, Recovery lessons, Exercises). */
  takeaways: SavedToolkitItem[];
  /** True when there is genuinely nothing to show. */
  isEmpty: boolean;
}

export function patientToolkit(patientId: string): PatientToolkit {
  const warningSigns: ToolkitPick[] = [];
  const supportPeople: ToolkitPick[] = [];
  const todayActions: ToolkitPick[] = [];

  for (const lessonId of AdelanteEHR.completedRecoveryLessons(patientId)) {
    const flow = AdelanteEHR.recoveryToolFlow(patientId, lessonId);
    if (!flow) continue;
    const lesson = liveRecoveryLesson(lessonId);
    const moduleName = lesson ? (liveRecoveryModule(lesson.moduleId)?.name ?? "") : "";
    const meta = {
      lessonId,
      lessonTitle: lesson?.title ?? lessonId,
      moduleName,
      updatedAt: flow.updatedAt,
    };
    for (const value of flow.warningSigns) warningSigns.push({ value, ...meta });
    for (const value of flow.supportPeople) supportPeople.push({ value, ...meta });
    if (flow.todayAction) todayActions.push({ value: flow.todayAction, ...meta });
  }

  const byRecency = (a: ToolkitPick, b: ToolkitPick) => b.updatedAt.localeCompare(a.updatedAt);
  warningSigns.sort(byRecency);
  supportPeople.sort(byRecency);
  todayActions.sort(byRecency);

  const takeaways = [...AdelanteEHR.savedToolkitItems(patientId)].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  return {
    warningSigns,
    supportPeople,
    todayActions,
    takeaways,
    isEmpty:
      warningSigns.length === 0 &&
      supportPeople.length === 0 &&
      todayActions.length === 0 &&
      takeaways.length === 0,
  };
}
