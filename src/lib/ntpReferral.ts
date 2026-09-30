// §Batch F1 — the path offered when outpatient methadone is blocked:
// "Refer to an NTP" (clinical referral → Part 2 disclose() on send → care
// plan goal) and, for people already dosing at an outside NTP, a
// reconciliation entry that is never an order. Draft — pending clinical sign-off.
import { AdelanteEHR, type Patient } from "@/lib/ehr";
import type { StaffRole } from "@/lib/roles";
import { roleSeesAsamSection } from "@/lib/asamReporting";
import { createHlocReferral, type HlocReferral } from "@/lib/outpatientCare";
import { addStructuredGoal, canEditPlan } from "@/lib/structuredCarePlan";
import { DEMO_NTP_ID, partnerOrg } from "@/lib/carePartners";

export { METHADONE_NTP_MESSAGE, METHADONE_GUARD_DRAFT } from "@/lib/methadoneGuard";

type Actor = { role: StaffRole | string; staffId?: string; name: string };

export const NTP_REFERRAL_ROLES = ["physician", "pmhnp", "sud_counselor", "therapist"];
export const NTP_RECON_ROLES = ["physician", "pmhnp", "nurse_rn", "sud_counselor"];
export const canReferToNtp = (role: string) => NTP_REFERRAL_ROLES.includes(role);
export const canRecordExternalNtp = (role: string) => NTP_RECON_ROLES.includes(role);

export interface ExternalNtpMedication {
  id: string;
  patientId: string;
  ntpName: string;
  dailyDose: string;
  lastDoseDate?: string;
  recordedBy: string;
  recordedAt: string;
  /** Always true — a reconciliation entry, never an order or a prescription. */
  reconciliationOnly: true;
}
const external: ExternalNtpMedication[] = [];
const uid = () => Math.random().toString(36).slice(2, 10);

function patientOf(id: string): Patient {
  const p = AdelanteEHR.getPatient(id);
  if (!p) throw new Error("Patient not found.");
  return p;
}

export function referToNtp(input: { patientId: string; reason: string; partnerOrgId?: string; actor: Actor }): { referral: HlocReferral; goalId?: string } {
  if (!canReferToNtp(input.actor.role)) throw new Error("Your role can't refer to an NTP.");
  const p = patientOf(input.patientId);
  if (!roleSeesAsamSection(input.actor.role as StaffRole, p)) throw new Error("Not available for your role.");
  const org = partnerOrg(input.partnerOrgId ?? DEMO_NTP_ID);
  const referral = createHlocReferral({
    patientId: p.id,
    target: "ntp",
    reason: input.reason,
    urgency: "urgent",
    destination: org?.name ?? "Narcotic Treatment Program",
    outsideSudProvider: true,
    actor: { name: input.actor.name, role: input.actor.role },
  });
  let goalId: string | undefined;
  if (canEditPlan(input.actor.role)) {
    const g = addStructuredGoal({
      patientId: p.id,
      owner: "clinician" as never,
      measure: "First NTP intake attended",
      clinicalText: "Connect with a certified Narcotic Treatment Program for medication treatment.",
      patientText: { en: "Get connected with a treatment program for medication.", es: "Conectarse con un programa de tratamiento para medicamentos. (Borrador)" },
      actor: { name: input.actor.name, role: input.actor.role } as never,
    });
    goalId = g.id;
  }
  AdelanteEHR._recordAudit({ category: "clinical", action: "ntp_referral_started", patientId: p.id, actorId: input.actor.staffId ?? input.actor.name, actorRole: input.actor.role, detail: { referralId: referral.id } });
  AdelanteEHR._emit();
  return { referral, goalId };
}

export function recordExternalNtpMedication(input: { patientId: string; ntpName: string; dailyDose: string; lastDoseDate?: string; actor: Actor }): ExternalNtpMedication {
  if (!canRecordExternalNtp(input.actor.role)) throw new Error("Your role can't record outside medications.");
  const p = patientOf(input.patientId);
  if (!roleSeesAsamSection(input.actor.role as StaffRole, p)) throw new Error("Not available for your role.");
  if (input.ntpName.trim().length < 2) throw new Error("Name the NTP that dispenses it.");
  if (!input.dailyDose.trim()) throw new Error("Enter the daily dose the NTP reports.");
  const e: ExternalNtpMedication = {
    id: uid(), patientId: p.id, ntpName: input.ntpName.trim(), dailyDose: input.dailyDose.trim(), lastDoseDate: input.lastDoseDate,
    recordedBy: input.actor.name, recordedAt: new Date().toISOString(), reconciliationOnly: true,
  };
  external.push(e);
  AdelanteEHR._recordAudit({ category: "clinical", action: "external_ntp_med_reconciled", patientId: p.id, actorId: input.actor.staffId ?? input.actor.name, actorRole: input.actor.role, detail: { entryId: e.id } });
  AdelanteEHR._emit();
  return e;
}
export function listExternalNtpMeds(patientId: string, role: string): ExternalNtpMedication[] {
  const p = AdelanteEHR.getPatient(patientId);
  if (!p || !roleSeesAsamSection(role as StaffRole, p)) return [];
  return external.filter((e) => e.patientId === patientId);
}
