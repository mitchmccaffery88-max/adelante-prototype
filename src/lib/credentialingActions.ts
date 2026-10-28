// 28 Oct credentialing reconciliation: existing ehr-ext writers, one registry audit.
import { AdelanteEHRExt, type CredentialDoc, type PayerEnrollment } from "./ehr-ext";
import { canManageCredentialing, CREDENTIALING_DENIED, type CredentialingActor } from "./credentialing";
export function credentialRecordCommand(actor: CredentialingActor, command: "add" | "edit" | "verify" | "followup" | "clear" | "enrollment", payload: Record<string, unknown>) {
  if (!canManageCredentialing(actor.role)) throw new Error(CREDENTIALING_DENIED);
  const by = actor.staffId ?? actor.role;
  const id = String(payload.id ?? "");
  switch (command) {
    case "add": AdelanteEHRExt.addCredential(payload as unknown as Omit<CredentialDoc, "id" | "uploadedAt">); break;
    case "edit": AdelanteEHRExt.updateCredential(id, payload.patch as Parameters<typeof AdelanteEHRExt.updateCredential>[1], by, String(payload.reason ?? "")); break;
    case "verify": AdelanteEHRExt.verifyCredential(id, by); break;
    case "followup": AdelanteEHRExt.requestCredentialFollowUp(id, by, String(payload.note ?? "")); break;
    case "clear": AdelanteEHRExt.clearCredentialFollowUp(id); break;
    case "enrollment": AdelanteEHRExt.upsertEnrollment(payload as unknown as Omit<PayerEnrollment, "id">); break;
  }
  return { id };
}
