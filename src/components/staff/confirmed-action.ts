import { AdelanteEHR } from "@/lib/ehr";
import { currentRunActor } from "@/lib/actions/act";
import { runAction } from "@/lib/actions/runAction";

/** One registry event; domain lifecycle audits remain owned by the store. */
export function confirmedAction<T = unknown>(id: string, via: string, patientId: string | undefined, reason: string, ...args: unknown[]): T {
  const result = runAction<T>(id, currentRunActor(), patientId ? AdelanteEHR.getPatient(patientId) : undefined, { via, args, auditReason: reason });
  if (!result.ok) throw new Error(result.reason);
  return result.value;
}