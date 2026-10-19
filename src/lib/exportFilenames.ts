// Mitch Oct 19 2026: download file names carry the program ID, never a
// patient's name or DOB. File contents are unchanged.
import { AdelanteEHR } from "./ehr";

export function disclosureCsvFilename(patientId: string, today = new Date()): string {
  const p = AdelanteEHR.listPatients().find((x) => x.id === patientId);
  return `disclosures-${p?.programId ?? "unknown"}-${today.toISOString().slice(0, 10)}.csv`;
}
