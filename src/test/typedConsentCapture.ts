// B2-5 — test-local typed consent capture through the real registry action
// (runAction("consent_record_capture")). Replaces positive flag fixtures.
import { AdelanteEHR, type ConsentRecord } from "@/lib/ehr";
import { runAction } from "@/lib/actions/runAction";
import { PART2_ELEMENT_KEYS } from "@/lib/consentRecordModel";
import type { ConsentType } from "@/lib/consentRecordModel";

const admin = { role: "sys_admin" as const, staffId: "s-admin1", staffName: "Adelante System Admin" };
const storeAdmin = { role: admin.role, staffId: admin.staffId, name: admin.staffName };

export interface TypedCaptureScope {
  type: ConsentType;
  recipient: { name: string; directoryRef?: string; kind?: string };
  purpose: string;
  items?: string[];
}
export const CARE_COORDINATION = { name: "Adelante care coordination team", directoryRef: "adelante-care-coordination" };
export const ADELANTE_PROGRAM = { name: "Adelante", directoryRef: "adelante-program" };

export function captureTypedConsent(patientId: string, s: TypedCaptureScope): ConsentRecord {
  const p = AdelanteEHR.getPatient(patientId);
  if (!p) throw new Error("capture patient missing");
  const r = runAction("consent_record_capture", admin, p, {
    via: "captureConsentRecord",
    args: [{
      draft: {
        patientId, consentType: s.type, recipients: [{ kind: s.recipient.kind ?? "org", name: s.recipient.name, directoryRef: s.recipient.directoryRef }],
        purpose: s.purpose, purposeCode: s.purpose, items: s.items ?? ["Listed information"],
        part2Elements: Object.fromEntries(PART2_ELEMENT_KEYS.map((k) => [k, true])), expiresOnEvent: "Patient revokes this consent",
      },
      method: "e_sign", signer: `${p.firstName} ${p.lastName}`, relationship: "patient", attested: true, actor: storeAdmin,
    }],
  });
  if (!r.ok) throw new Error(r.reason);
  return r.value as ConsentRecord;
}
/** Coordinator Part 2 consent (TPO or specific written) for care coordination. */
export const captureCoordination = (pid: string, type: "part2_tpo_single" | "part2_specific_written" = "part2_tpo_single", items?: string[]) =>
  captureTypedConsent(pid, { type, recipient: CARE_COORDINATION, purpose: "care_coordination", items });
export const captureCounselingRelease = (pid: string) =>
  captureTypedConsent(pid, { type: "counseling_notes_release", recipient: CARE_COORDINATION, purpose: "care_coordination", items: ["Counseling notes"] });
export const captureTreatment = (pid: string) =>
  captureTypedConsent(pid, { type: "part2_tpo_single", recipient: ADELANTE_PROGRAM, purpose: "treatment", items: ["SUD treatment information"] });
