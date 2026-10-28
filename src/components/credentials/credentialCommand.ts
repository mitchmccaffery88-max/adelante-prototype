// 28 Oct credentialing reconciliation: registry once, ids-only metadata.
import { getActingRole, getActingStaff } from "@/lib/roles";
import { runActionOrThrow } from "@/lib/actions/runAction";
export function credentialCommand(command: "add" | "edit" | "verify" | "followup" | "clear" | "enrollment", payload: Record<string, unknown>) {
  const actor = { role: getActingRole(), staffId: getActingStaff().id };
  return runActionOrThrow(command === "enrollment" ? "credential_enrollment_set" : "credential_verify", actor, undefined, { via: "credentialRecordCommand", args: [actor, command, payload] });
}
