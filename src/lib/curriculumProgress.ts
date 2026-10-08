import { AdelanteEHR } from "./ehr";
import { resolvePopulation } from "./population";
import { recoveryJourneyVisible } from "./seeking";
import { liveCurricula, type Curriculum, type CurriculumStep } from "./curriculumTypes";
import { getEngagement } from "./engagement";
import { liveRecoveryLessons } from "./contentCatalog";
import { autoAddedJourneyIds } from "./flagJourneys";
export function curriculumStepDone(patientId: string, step: CurriculumStep) {
  const e = getEngagement(patientId); if (!e) return false;
  if (step.type === "exercise") return e.completedExercises.includes(step.id);
  if (step.type === "library_lesson") return e.completedLibraryItems.includes(step.id);
  if (step.type === "recovery_lesson") return e.completedRecoveryLessons.includes(step.id);
  const lessons = liveRecoveryLessons().filter((l) => l.moduleId === step.id);
  return lessons.length > 0 && lessons.every((l) => e.completedRecoveryLessons.includes(l.id));
}
export function curriculumProgress(patientId: string, journey: Curriculum) {
  const states = journey.steps.map((step, i) => ({ ...step, done: curriculumStepDone(patientId, step), locked: journey.unlock === "sequential" && journey.steps.slice(0, i).some((s) => s.required && !curriculumStepDone(patientId, s)) }));
  const required = states.filter((s) => s.required);
  return { steps: states, complete: required.length > 0 && required.every((s) => s.done), next: states.find((s) => !s.done && !s.locked) };
}
export function patientCurriculum(id: string) { return liveCurricula().find((j) => j.id === id); }

export function curriculumVisible(patientId: string, j: Curriculum) {
  const p = AdelanteEHR.getPatient(patientId); if (!p) return false;
  // §Group 1 C2 — a journey auto-added to the patient's own plan is theirs to see.
  if (autoAddedJourneyIds(patientId).includes(j.id)) return true;
  if ((j.part2Sensitive || j.meta?.part2) && !recoveryJourneyVisible(p)) return false;
  if (j.justiceInvolved && !(p.coverage?.justiceInvolvement === "yes")) return false;
  if (j.positiveSignal && !((p.needs as unknown as Record<string, unknown> | undefined)?.[j.positiveSignal])) return false;
  const track = resolvePopulation(patientId).track;
  return !j.populations?.length || j.populations.includes(track);
}
