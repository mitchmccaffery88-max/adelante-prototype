import { AdelanteEHR } from "@/lib/ehr";
import { PATIENT_ACTOR_ROLE } from "@/lib/patientBooking";
import { runActionOrThrow } from "@/lib/actions/runAction";
import { recordDailyCheckIn, postponeDailyCheckIn, type EmotionId, type CheckInReasonId } from "@/lib/selfTracking";

export type PrivateUpdate = { kind: "save"; emotions: EmotionId[]; reasonId?: CheckInReasonId } | { kind: "postpone" };
/** Registry writer: no answer is returned into the clinical/audit record. */
export function updatePrivateSelfTracking(patientId: string, input: PrivateUpdate): void {
  if (patientId !== AdelanteEHR.getCurrentPatientId() || !AdelanteEHR.getPatient(patientId)) throw new Error("Not available for this person.");
  if (input.kind === "postpone") postponeDailyCheckIn(patientId);
  else recordDailyCheckIn(patientId, { emotions: input.emotions, reasonId: input.reasonId });
}
export function applyPrivateUpdate(patientId: string, input: PrivateUpdate): void {
  runActionOrThrow("patient_private_update", { role: PATIENT_ACTOR_ROLE }, AdelanteEHR.getPatient(patientId), { args: [patientId, input] });
}