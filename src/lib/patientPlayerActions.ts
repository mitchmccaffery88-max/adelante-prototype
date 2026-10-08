import { AdelanteEHR } from "@/lib/ehr";
import { PATIENT_ACTOR_ROLE } from "@/lib/patientBooking";
import { runActionOrThrow } from "@/lib/actions/runAction";
import { liveLibraryItem, liveRecoveryLesson } from "@/lib/contentCatalog";
import { playerEn, playerEs } from "@/lib/i18n.player";
import { lessonResponse } from "@/lib/engagement";
import type { LessonResponsePatch, LessonSurface } from "@/lib/engagement";

export function savePlayerResponse(patientId: string, surface: LessonSurface, id: string, patch: LessonResponsePatch) {
  return runActionOrThrow("patient_lesson_response", { role: PATIENT_ACTOR_ROLE }, AdelanteEHR.getPatient(patientId), { args: [patientId, surface, id, patch] });
}
export function savePlayerToolkit(patientId: string, id: string, label: string, from: "library" | "exercise") {
  return runActionOrThrow("patient_toolkit_save", { role: PATIENT_ACTOR_ROLE }, AdelanteEHR.getPatient(patientId), { args: [patientId, { id, label, from }] });
}
export function completePlayerLesson(patientId: string, id: string, surface: "library" | "recovery", selections?: { warningSigns: string[]; supportPeople: string[]; todayAction?: string }, lang: "en" | "es" = "en") {
  const result = runActionOrThrow<{ completed: boolean; alreadyComplete: boolean }>("patient_lesson_complete", { role: PATIENT_ACTOR_ROLE }, AdelanteEHR.getPatient(patientId), { via: surface === "library" ? "completeLibraryItem" : "completeRecoveryLesson", args: surface === "library" ? [patientId, id] : [patientId, id, selections ?? {}] });
  if (result.completed) {
    const response = lessonResponse(patientId, surface, id);
    if (response) {
      const copy = lang === "es" ? playerEs : playerEn;
      const tool = surface === "library" ? liveLibraryItem(id)?.toolkitLabel : liveRecoveryLesson(id)?.toolkitLabel;
      const reminder = response.text?.reminder ? copy[response.text.reminder as keyof typeof copy] : undefined;
      savePlayerToolkit(patientId, id, response.text?.toolkitPreview || [tool, response.todayAction, reminder, response.text?.support, ...(selections?.supportPeople ?? [])].filter(Boolean).join(" · ") || copy.playerResponses, "library");
    }
  }
  return result;
}
export function completePlayerExercise(patientId: string, id: string) { return runActionOrThrow("patient_lesson_complete", { role: PATIENT_ACTOR_ROLE }, AdelanteEHR.getPatient(patientId), { via: "completeExercise", args: [patientId, id, { saveToolkit: false }] }); }
