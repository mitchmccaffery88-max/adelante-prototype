// §Batch D — thin call-site helpers over runAction for screens that already
// hold the store arguments. The acting person comes from the top-bar
// switcher; "View as" is recorded through setViewingStaff.
import { AdelanteEHR, type Patient } from "@/lib/ehr";
import { getActingRole, getActingStaff } from "@/lib/roles";
import { runAction, type RunActor } from "@/lib/actions/runAction";

let viewingStaffId: string | undefined;
/** The clinician workspace sets this while a coordinator uses "View as". */
export function setViewingStaff(id: string | undefined): void {
  viewingStaffId = id;
}

export function currentRunActor(): RunActor {
  const s = getActingStaff();
  return {
    role: getActingRole(),
    staffId: s?.id,
    staffName: s?.name,
    clinicianId: s?.clinicianId,
    viewingStaffId,
  };
}

/** Finds the patient from the first store argument (an id, or an object with patientId). */
function patientFromArgs(args: unknown[]): Patient | undefined {
  const a = args[0];
  if (typeof a === "string") return AdelanteEHR.getPatient(a);
  if (a && typeof a === "object" && "patientId" in a) {
    const id = (a as { patientId?: unknown }).patientId;
    return typeof id === "string" ? AdelanteEHR.getPatient(id) : undefined;
  }
  return undefined;
}

/**
 * Runs a registry action through runAction and returns the store value.
 * Throws the refusal reason (blocked or store-refused) so existing
 * try/catch + toast call sites keep working.
 */
export function act<T = unknown>(actionId: string, via: string, ...args: unknown[]): T {
  const r = runAction<T>(actionId, currentRunActor(), patientFromArgs(args), { via, args });
  if (!r.ok) throw new Error(r.reason);
  return r.value;
}

/** Same as `act`, with an explicit patient (first arg isn't the patient). */
export function actFor<T = unknown>(actionId: string, via: string, patientId: string | undefined, ...args: unknown[]): T {
  const r = runAction<T>(actionId, currentRunActor(), patientId ? AdelanteEHR.getPatient(patientId) : undefined, { via, args });
  if (!r.ok) throw new Error(r.reason);
  return r.value;
}

/**
 * For stores that return `{ ok: false, error }` instead of throwing (billing):
 * returns the store's own result, or an `{ ok: false, error }` when runAction
 * blocked the call before it ran.
 */
export function actResult<T>(actionId: string, via: string, patientId: string | undefined, ...args: unknown[]): T | { ok: false; error: string } {
  const r = runAction<T>(actionId, currentRunActor(), patientId ? AdelanteEHR.getPatient(patientId) : undefined, { via, args });
  if (r.ok) return r.value;
  return (r.value as T | undefined) ?? { ok: false, error: r.reason };
}
