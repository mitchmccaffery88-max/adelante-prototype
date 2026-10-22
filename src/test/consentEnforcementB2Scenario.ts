// §B2-4 matrix scenario — uses only APIs that ALSO exist at rollback 0089ca4f,
// so the same file runs on the rollback archive (fixture) and on the current
// tree. Seeded patient x role x surface, in the default seed, after the
// billing lifecycle QA scenario, after capturing typed records with EXTERNAL
// recipients, and through every coordinator emergency-grant state.
// Requires Date pinned and Math.random seeded before any store import.
import { AdelanteEHR, type ConsentCategory, type Referral } from "@/lib/ehr";
import { canAccess, STAFF_ROSTER, type StaffRole } from "@/lib/roles";
import { asamAccessMode, coordinatorConsentedPatients, roleSeesAsam, roleSeesAsamSection } from "@/lib/asamReporting";
import { coordinatorEmergencyFor, coordinatorSudCanRead, endCoordinatorEmergencyGrant, saveCoordinatorEmergencyGrant, COORDINATOR_SUD_ITEMS, type CoordinatorSudItem } from "@/lib/coordinatorSudAccess";
import { part2ConsentFor, type DisclosureRecipient } from "@/lib/part2Disclosure";
import { referrerDecisionFor } from "@/lib/referrerUpdateGate";
import { patientSudProgramVisible } from "@/lib/sudProgramVisibility";
import { runAction } from "@/lib/actions/runAction";
import { PART2_ELEMENT_KEYS } from "@/lib/consentRecordModel";
import { buildBillingLifecycleScenario } from "@/lib/billingLifecycleScenario";

const ROLES = [...new Set(STAFF_ROSTER.map((s) => s.role))].sort() as StaffRole[];
const CATS = [
  "sud_treatment", "mental_health", "case_coordination", "billing", "group_confidentiality_ack", "pre_release_services",
  "telehealth_services", "information_sharing_disclosure", "roi_collateral", "advocate_sud_disclosure", "legal_disclosure",
  "po_voluntary_coordination", "ai_recording",
] as ConsentCategory[];
const RECIPIENTS: DisclosureRecipient[] = [
  { name: "Adelante team", type: "internal" }, { name: "Outside Clinic", type: "provider" }, { name: "Tulare County", type: "county" },
  { name: "Helper", type: "advocate" }, { name: "Public Defender", type: "legal" }, { name: "Valley HIE", type: "hie" }, { name: "Aunt Rosa", type: "other" },
] as DisclosureRecipient[];
const ITEMS: CoordinatorSudItem[] = [...COORDINATOR_SUD_ITEMS, "counseling_notes"];
const coordinator = STAFF_ROSTER.find((s) => s.role === "clinical_coordinator");
const viewer = { role: "clinical_coordinator" as StaffRole, staffId: coordinator?.id ?? "s-coord", name: coordinator?.name };

function surfaces(label: string) {
  const patients = AdelanteEHR.listPatients();
  return {
    label,
    asamCohort: coordinatorConsentedPatients().map((p) => p.id),
    asamMode: ROLES.map((r) => [r, asamAccessMode(r)]),
    patients: patients.map((p) => ({
      id: p.id,
      cats: CATS.map((c) => (AdelanteEHR.isConsentCategoryAuthorized(p.id, c) ? 1 : 0)).join(""),
      state: AdelanteEHR.getConsentState(p.id),
      coordinator: ITEMS.map((i) => (coordinatorSudCanRead(viewer, p, i) ? 1 : 0)).join(""),
      disclosure: RECIPIENTS.map((r) => { const d = part2ConsentFor(p.id, r, "Treatment"); return d.ok ? d.ref : `no:${d.reason}`; }),
      roles: ROLES.map((r) => {
        const a = canAccess(r, "screeners_sud", p);
        return `${r}:${a.level}${a.locked ? "L" : ""}:${roleSeesAsam(r, p) ? 1 : 0}${roleSeesAsamSection(r, p) ? 1 : 0}${patientSudProgramVisible(r, p) ? 1 : 0}`;
      }),
    })),
    referrals: (AdelanteEHR.listReferrals() as Referral[]).map((r) => ({
      id: r.id,
      d: (["received", "contacted", "enrolled", "declined"] as const).map((e) => JSON.stringify(referrerDecisionFor(r, e))),
    })),
  };
}

const allElements = Object.fromEntries(PART2_ELEMENT_KEYS.map((k) => [k, true]));
/** Typed records naming EXTERNAL recipients only (no program recipient). */
export const EXTERNAL_DRAFTS = [
  { consentType: "part2_tpo_single", recipients: [{ kind: "org", name: "Valley Clinic" }], purpose: "treatment", purposeCode: "treatment" },
  { consentType: "part2_specific_written", recipients: [{ kind: "org", name: "Valley Clinic" }], purpose: "care_coordination", purposeCode: "care_coordination" },
  { consentType: "counseling_notes_release", recipients: [{ kind: "org", name: "Valley Clinic" }], purpose: "care_coordination", purposeCode: "care_coordination" },
  { consentType: "telehealth", recipients: [{ kind: "org", name: "Valley Clinic" }], purpose: "telehealth", purposeCode: "telehealth" },
  { consentType: "group_confidentiality", recipients: [{ kind: "org", name: "Valley Clinic" }], purpose: "group_confidentiality", purposeCode: "group_confidentiality" },
] as const;
export function captureExternal(pid: string): boolean[] {
  const staff = { role: "ecm_provider" as const, staffId: "s-ecm", staffName: "ECM Matrix" };
  const actor = { role: "ecm_provider" as const, staffId: "s-ecm", name: "ECM Matrix" };
  const p = AdelanteEHR.getPatient(pid);
  return EXTERNAL_DRAFTS.map((d) => runAction("consent_record_capture", staff, p, {
    args: [{ draft: { patientId: pid, ...d, recipients: d.recipients.map((x) => ({ ...x })), items: ["diagnoses", "SUD treatment notes"], expiresOn: "2027-10-21", part2Elements: allElements },
      method: "e_sign", signer: "Matrix Signer", relationship: "patient", attested: true, actor }],
  }).ok);
}

function emergencyStates(pid: string) {
  const p = AdelanteEHR.getPatient(pid)!;
  const read = () => ({ grant: coordinatorEmergencyFor(viewer, pid) ?? null, items: ITEMS.map((i) => (coordinatorSudCanRead(viewer, p, i) ? 1 : 0)).join("") });
  const now = Date.now();
  const none = read();
  saveCoordinatorEmergencyGrant({ patientId: pid, staffId: viewer.staffId, reason: "medical_emergency", detail: "Matrix", start: new Date(now - 60_000).toISOString(), end: new Date(now + 3_600_000).toISOString(), disclosureId: "dl-matrix" });
  const active = read();
  saveCoordinatorEmergencyGrant({ patientId: pid, staffId: viewer.staffId, reason: "medical_emergency", detail: "Matrix", start: new Date(now - 7_200_000).toISOString(), end: new Date(now - 60_000).toISOString(), disclosureId: "dl-matrix" });
  const expired = read();
  saveCoordinatorEmergencyGrant({ patientId: pid, staffId: viewer.staffId, reason: "audit_evaluation", detail: "Matrix", reference: "A-1", start: new Date(now - 60_000).toISOString(), end: new Date(now + 3_600_000).toISOString(), disclosureId: "dl-matrix" });
  const ended = endCoordinatorEmergencyGrant(viewer.staffId, pid);
  const afterEnd = read();
  return { pid, none, active, expired, ended: ended ?? null, afterEnd };
}

export function enforcementMatrix() {
  const seed = surfaces("default seed");
  let billing: unknown = null;
  try { billing = Object.keys(buildBillingLifecycleScenario({ complete: true })); } catch (e) { billing = `error: ${(e as Error).message}`; }
  const afterBilling = surfaces("billing lifecycle QA scenario");
  const pids = AdelanteEHR.listPatients().map((p) => p.id);
  const captured = pids.map((pid) => ({ pid, ok: captureExternal(pid) }));
  const afterExternal = surfaces("external-recipient typed records");
  const emergency = pids.map(emergencyStates);
  return { seed, billing, afterBilling, captured, afterExternal, emergency };
}
