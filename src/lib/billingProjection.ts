// Billing-only read boundary. Full records never leave these selectors for billing roles.
import { AdelanteEHR, type Patient, type Appointment } from "./ehr";
import { AdelanteEHRExt, type Claim } from "./ehr-ext";
import { getActingRole, getActingStaff, type StaffRole } from "./roles";
import { staffPatientLabel, viewerCanOpenChart } from "./staffPatientLabel";
import { gateMessageFor } from "./dmcOdsReadiness";
import { laneFor as originalLaneFor } from "./billingLane";
import { billingWorkspace, claimBlockLabel } from "./billingWorkspace";
import { coverageWorklistRows, type CoverageWorklistRow } from "./coverageWorklist";

export const billingAudience = (role: StaffRole) => role === "billing" || role === "billing_coordinator";
export const CLAIM_KEYS = ["id", "encounterId", "patientId", "clinicianId", "state", "updatedAt", "serviceDate", "serviceCode", "program", "programSource", "codeSource", "unitsSource", "units", "minutes", "rateId", "rateCentsPerUnit", "rateStatus", "chargeCents", "noRateReason", "denialReason", "taxonomy", "supervisingStaffId", "arrangementMissing", "payerId", "copayCents", "deductibleCents", "coinsuranceBps", "payerPortionCents", "patientPortionCents", "patientPaidCents", "patientBalanceCents", "overpaidReview", "voidBlocked"] as const;
export const PAYMENT_KEYS = ["id", "amountCents", "receivedOn", "method", "reference", "recordedById", "recordedByName", "recordedByRole", "recordedAt", "voidedAt", "voidedById", "voidedByName", "voidReason"] as const;
export const APPOINTMENT_KEYS = ["id", "patientId", "clinicianId", "start", "durationMin", "status", "fundingLane", "serviceType", "modality", "locationId", "chargeCents", "islReason"] as const;
export const PLAN_KEYS = ["id", "payer", "plan", "memberId", "from", "to", "source", "managedCarePlanId", "managedCarePlanName", "aidCode", "shareOfCostCents", "planNotOnList"] as const;
export const COVERAGE_KEYS = ["status", "verified", "coverageType", "otherPlanName"] as const;
function pick<T, K extends keyof T>(value: T, keys: readonly K[]): Pick<T, K> {
  return Object.fromEntries(keys.map(key => [key, value[key]])) as Pick<T, K>;
}
export type BillingSignature = "seed" | "unsigned" | { cosign: boolean; signerName: string; signedAt: string };
export type BillingClaim = Omit<Claim, "reviewFlag"> & {
  billingSignature: BillingSignature;
  billingReviewFlag?: Omit<NonNullable<Claim["reviewFlag"]>, "noteId">;
  documentationBlock: string | null;
  billingBlock: string | null;
};
export type BillingPatient = Pick<Patient, "id" | "programId" | "firstName" | "lastName" | "paymentArrangement"> & { coverage?: Pick<NonNullable<Patient["coverage"]>, typeof COVERAGE_KEYS[number]> & { plans?: Pick<NonNullable<NonNullable<Patient["coverage"]>["plans"]>[number], typeof PLAN_KEYS[number]>[] } };
export type BillingAppointment = Pick<Appointment, typeof APPOINTMENT_KEYS[number]>;
export function projectBillingPatient(p: Patient, viewer = { role: getActingRole(), staffId: getActingStaff().id }): BillingPatient {
  const named = viewerCanOpenChart(viewer, p.id);
  return { id: p.id, programId: p.programId, firstName: named ? p.firstName : "", lastName: named ? p.lastName : "", paymentArrangement: p.paymentArrangement,
    ...(p.coverage ? { coverage: { ...pick(p.coverage, COVERAGE_KEYS), plans: p.coverage.plans?.map(plan => pick(plan, PLAN_KEYS)) } } : {}) };
}
export function projectBillingAppointment(a: Appointment): BillingAppointment { return pick(a, APPOINTMENT_KEYS); }
export function projectBillingClaim(c: Claim, role: StaffRole): BillingClaim {
  const sig = AdelanteEHRExt.claimSignature(c);
  return { ...pick(c, CLAIM_KEYS), history: c.history.map(h => pick(h, ["at", "state"])),
    duplicateReview: c.duplicateReview ? pick(c.duplicateReview, ["mergeId", "otherClaimId", "flaggedAt"]) : undefined,
    patientPayments: c.patientPayments?.map(p => pick(p, PAYMENT_KEYS)),
    billingReviewFlag: c.reviewFlag ? pick(c.reviewFlag, ["kind", "label", "at"]) : undefined,
    billingSignature: sig === "seed" ? "seed" : sig ? pick(sig, ["cosign", "signerName", "signedAt"]) : "unsigned",
    documentationBlock: gateMessageFor(role, c), billingBlock: claimBlockLabel(c, role) };
}
export function billingPatients() { const patients = AdelanteEHR.listPatients(); return billingAudience(getActingRole()) ? patients.map(p => projectBillingPatient(p)) : patients; }
export function billingAppointments() { const appts = AdelanteEHR.listAppointments(); return billingAudience(getActingRole()) ? appts.map(projectBillingAppointment) : appts; }
export function billingClaims() { const claims = AdelanteEHRExt.listClaims(); return billingAudience(getActingRole()) ? claims.map(c => projectBillingClaim(c, getActingRole())) : claims; }
export function billingClaimInput(c: Claim) { return billingAudience(getActingRole()) && !("billingSignature" in c) ? projectBillingClaim(c, getActingRole()) : c; }
export function billingDocumentationBlock(role: StaffRole, c: Claim) { return "documentationBlock" in c ? (c as BillingClaim).documentationBlock : gateMessageFor(role, c); }
export function billingClaimBlock(c: Claim, role: StaffRole) { return "billingBlock" in c ? (c as BillingClaim).billingBlock : claimBlockLabel(c, role); }
export function billingOpsWorkspace(role: StaffRole, claims: Claim[]) {
  if (!billingAudience(role)) return billingWorkspace(role, claims);
  return billingWorkspace(role, claims, billingCoverageRows());
}
export function billingCoverageRows(): CoverageWorklistRow[] {
  // Derive and sort through the original worklist, then strip task/report graphs.
  // Masking names after sorting preserves every existing list's order and IDs.
  return coverageWorklistRows().map(row => ({
    ...pick(row, ["patientId", "programId", "county", "coverageStatus", "verified", "cinOnFile", "activePlanPayer", "daysSinceCheck", "state"]),
    name: billingPatientLabel(row.patientId), openFollowUps: [],
  }));
}
export function billingPatientLabel(id: string) { return staffPatientLabel({ role: getActingRole(), staffId: getActingStaff().id }, id); }
export function billingBlockedAttempts() {
  const records = AdelanteEHR.listAuditEvents({ category: "clinical" }).filter(e => e.action === "community_billing_blocked");
  return billingAudience(getActingRole()) ? records.map(e => ({ id: e.id, patientId: e.patientId, detail: { service: e.detail?.service, reasonCode: e.detail?.reasonCode, reason: e.detail?.reason } })) : records;
}
export function billingArrangement(patientId: string) { return AdelanteEHR.getPatient(patientId)?.paymentArrangement; }

export function billingLaneFor(input: { claim?: Claim; appt?: Appointment | BillingAppointment; patient?: Patient | BillingPatient }) { return originalLaneFor(input as Parameters<typeof originalLaneFor>[0]); }
