// §Group A #4 — display-only scrubbing for audit detail text. Reuses the
// existing `auditSafeReason` rule (Part 2 terms incl. SUD medications, ICD
// codes, the patient's own name). Stored audit events are never changed.
import { AdelanteEHR } from "@/lib/ehr";
import { auditSafeReason } from "@/lib/actions/runAction";

export function displayAuditDetail(value: unknown, patientId?: string): string {
  if (value === undefined || value === null) return "";
  const patient = patientId ? AdelanteEHR.getPatient(patientId) : undefined;
  return auditSafeReason(String(value), patient) ?? "";
}
