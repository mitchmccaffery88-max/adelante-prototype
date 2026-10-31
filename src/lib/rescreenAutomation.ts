// R53 Draft — pending clinical sign-off. Reuses the existing active-browser
// reminder sweep; NOT a background service. Persistence remains OFF.
import { AdelanteEHR } from "./ehr";
import { runActionOrThrow } from "./actions/runAction";
import { screenerFollowupActor } from "./screenerFollowup";

export function runRescreenCadenceSweep(now = new Date()) {
  for (const p of AdelanteEHR.listPatients()) {
    for (const operation of AdelanteEHR.automaticRescreenOperations(p.id, now.getTime())) {
      runActionOrThrow("screener_item9_followup", screenerFollowupActor, p, {
        via: "runAutomaticRescreenStep", args: [p.id, operation, now.toISOString(), screenerFollowupActor],
        auditReason: "Scheduled screening follow-up",
      });
    }
  }
}