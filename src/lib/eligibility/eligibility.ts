// §Phase 8c — the prototype's honest electronic eligibility entry point.
// No clearinghouse is connected, so this never pretends to check: it returns
// "not_connected", writes an audit entry recording who asked, and writes NO
// verification record (nothing was verified). Same pattern as SMS
// "not configured".
import { AdelanteEHR } from "@/lib/ehr";
import { getActingRole, getActingStaff } from "@/lib/roles";

export const ELIGIBILITY_NOT_CONNECTED =
  "Electronic eligibility isn't connected yet — record a manual check instead.";

export type CheckEligibilityResult =
  | { status: "not_connected"; detail: string }
  | { status: "error"; detail: string };

export function checkEligibility(patientId: string): CheckEligibilityResult {
  if (!AdelanteEHR.getPatient(patientId)) return { status: "error", detail: "Patient not found." };
  const role = getActingRole();
  const s = getActingStaff();
  AdelanteEHR.recordBillingAudit({
    action: "eligibility_check_attempted",
    actorId: s?.id ?? role,
    actorRole: role,
    patientId,
    detail: { outcome: "not_connected", actorName: s?.name ?? role },
  });
  return { status: "not_connected", detail: ELIGIBILITY_NOT_CONNECTED };
}
