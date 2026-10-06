// §Batch E1 — outpatient nursing: the clinic-administered medication chain,
// specimen collection and nurse triage. Draft — pending clinical sign-off.
//
// Chain: a prescriber (physician / PMHNP) orders a clinic-administered
// medication → a nurse (RN) reviews and verifies it → an RN or LVN gives it.
// An LVN gives it under RN / physician / PMHNP supervision: the dose is
// recorded and routed to that supervisor for cosign.
//
// Outpatient only — nothing here touches the in-facility MAR or its flag.
// Every mutation is store-enforced here AND runs through the registry +
// runAction (chartActions.ts) for the standard audit event. Notification and
// audit text stays neutral: no drug names (Part 2).
import { AdelanteEHR, type MedOrder, type Patient } from "@/lib/ehr";
import { AdelanteEHRExt } from "@/lib/ehr-ext";
import { addStaffMember, getStaffMember, isPrescriberRole, STAFF_ROSTER, type StaffRole } from "@/lib/roles";
import { roleSeesAsamSection } from "@/lib/asamReporting";
import { isSudMedication } from "@/lib/sudMedClassifier";
import { labTest, listLabOrders, roleSeesLab } from "@/lib/chartOrders";

export const NURSING_DRAFT_LABEL = "Draft — pending clinical sign-off";

export type NurseActor = { role: StaffRole | string; staffId?: string; name: string };

export const NURSE_REVIEW_ROLES = ["nurse_rn"];
export const ADMINISTER_ROLES = ["nurse_rn", "lvn"];
export const SPECIMEN_ROLES = ["nurse_rn", "lvn"];
export const TRIAGE_ROLES = ["nurse_rn"];
export const REFILL_COORDINATE_ROLES = ["nurse_rn"];
/** Who may supervise / cosign an LVN dose. */
export const LVN_SUPERVISOR_ROLES = ["nurse_rn", "physician", "pmhnp"];

export const canNurseReview = (role: string) => NURSE_REVIEW_ROLES.includes(role);
export const canAdministerClinicMed = (role: string) => ADMINISTER_ROLES.includes(role);
export const canCollectSpecimen = (role: string) => SPECIMEN_ROLES.includes(role);
export const canTriage = (role: string) => TRIAGE_ROLES.includes(role);
export const canCoordinateRefill = (role: string) => REFILL_COORDINATE_ROLES.includes(role);
export const canOrderClinicMed = (role: string) => isPrescriberRole(role);
export const canCosignLvnDose = (role: string) => LVN_SUPERVISOR_ROLES.includes(role);

export interface NurseReview {
  by: string;
  byStaffId?: string;
  at: string;
  decision: "verified" | "returned";
  note?: string;
}
export interface ClinicDose {
  id: string;
  orderId: string;
  patientId: string;
  at: string;
  by: string;
  byStaffId?: string;
  role: string;
  dose: string;
  route: string;
  site?: string;
  note?: string;
  /** LVN doses: supervisor who must cosign. */
  supervisorStaffId?: string;
  cosign?: { status: "pending" | "signed"; by?: string; at?: string };
}
export interface SpecimenCollection {
  id: string;
  patientId: string;
  labOrderId: string;
  testId: string;
  specimenType: string;
  at: string;
  by: string;
  role: string;
}
export type TriageDisposition = "self_care" | "same_day_visit" | "prescriber_message" | "crisis_line";
export const TRIAGE_DISPOSITION_LABEL: Record<TriageDisposition, string> = {
  self_care: "Self-care advice given",
  same_day_visit: "Same-day visit arranged",
  prescriber_message: "Sent to prescriber",
  crisis_line: "Connected to crisis line (988)",
};
export interface TriageCall {
  id: string;
  patientId: string;
  at: string;
  by: string;
  concern: string;
  disposition: TriageDisposition;
}

const reviews = new Map<string, NurseReview>();
const doses: ClinicDose[] = [];
const specimens: SpecimenCollection[] = [];
const triage: TriageCall[] = [];
const uid = () => Math.random().toString(36).slice(2, 10);

function assertRole(actor: NurseActor, roles: string[], what: string) {
  if (!roles.includes(actor.role)) throw new Error(`Your role can't ${what}.`);
}
function patientOf(id: string): Patient {
  const p = AdelanteEHR.getPatient(id);
  if (!p) throw new Error("Patient not found.");
  return p;
}
function orderOf(patientId: string, orderId: string): MedOrder {
  const o = AdelanteEHR.listOrders(patientId).find((x) => x.id === orderId);
  if (!o) throw new Error("Order not found.");
  if (!o.clinicAdministered) throw new Error("This order is not given in clinic.");
  return o;
}
function audit(action: string, patientId: string, actor: NurseActor, detail: Record<string, unknown>) {
  AdelanteEHR._recordAudit({ category: "clinical", action, patientId, actorId: actor.staffId ?? actor.name, actorRole: actor.role, detail });
  AdelanteEHR._emit();
}

// ------------------------------------------------------------ order chain
/** Prescriber orders a clinic-administered medication (drafted + signed). */
export function orderClinicMedication(input: {
  patientId: string;
  drugName: string;
  dose: string;
  route: string;
  actor: NurseActor;
  /** Demo seeds omit this so allergy/NKDA blockers match other seeds. */
  enforceSafety?: boolean;
}): MedOrder {
  assertRole(input.actor, ["physician", "pmhnp"], "order medications");
  patientOf(input.patientId);
  if (!input.drugName.trim()) throw new Error("Choose a medication.");
  if (!input.dose.trim() || !input.route.trim()) throw new Error("Enter the dose and route.");
  const draft = AdelanteEHR.addDraftOrder(input.patientId, {
    drugName: input.drugName.trim(),
    productName: input.drugName.trim(),
    dose: input.dose.trim(),
    route: input.route.trim(),
    frequency: "Once, in clinic",
    clinicAdministered: true,
    createdBy: input.actor.name,
  } as never);
  try {
    AdelanteEHR.signOrders(input.patientId, [draft.id], input.actor.name, input.enforceSafety === false ? undefined : { actorRole: input.actor.role });
  } catch (e) {
    AdelanteEHR.removeDraftOrder(input.patientId, draft.id, input.actor.name);
    throw e;
  }
  audit("clinic_med_ordered", input.patientId, input.actor, { orderId: draft.id });
  notifyRole("nurse_rn", input.patientId, "A clinic medication order needs nurse review.");
  return AdelanteEHR.listOrders(input.patientId).find((o) => o.id === draft.id)!;
}

/** RN reviews/verifies a signed clinic-administered order before it is given. */
export function nurseReviewOrder(input: {
  patientId: string;
  orderId: string;
  decision: "verified" | "returned";
  note?: string;
  actor: NurseActor;
}): NurseReview {
  assertRole(input.actor, NURSE_REVIEW_ROLES, "review medication orders (RN only)");
  const o = orderOf(input.patientId, input.orderId);
  if (o.status !== "signed") throw new Error("Only an active signed order can be reviewed.");
  if (reviews.get(o.id)?.decision === "verified") throw new Error("This order is already verified.");
  if (input.decision === "returned" && (input.note ?? "").trim().length < 3) throw new Error("Say why the order is returned.");
  const r: NurseReview = { by: input.actor.name, byStaffId: input.actor.staffId, at: new Date().toISOString(), decision: input.decision, note: input.note?.trim() || undefined };
  reviews.set(o.id, r);
  audit(input.decision === "verified" ? "clinic_med_verified" : "clinic_med_returned", input.patientId, input.actor, { orderId: o.id });
  if (input.decision === "verified") {
    notifyRole("nurse_rn", input.patientId, "A verified clinic medication is ready to give.");
    notifyRole("lvn", input.patientId, "A verified clinic medication is ready to give.");
  } else notifyRole("physician", input.patientId, "A clinic medication order was returned by nursing.");
  return r;
}

/** RN or LVN gives a verified dose. LVN doses route to a supervisor for cosign. */
export function administerClinicDose(input: {
  patientId: string;
  orderId: string;
  dose?: string;
  route?: string;
  site?: string;
  note?: string;
  supervisorStaffId?: string;
  actor: NurseActor;
}): ClinicDose {
  assertRole(input.actor, ADMINISTER_ROLES, "give clinic medications");
  const o = orderOf(input.patientId, input.orderId);
  if (o.status !== "signed") throw new Error("The order is not active.");
  if (reviews.get(o.id)?.decision !== "verified") throw new Error("A nurse (RN) must verify this order before it is given.");
  if (doses.some((d) => d.orderId === o.id)) throw new Error("This one-time dose was already given.");
  let supervisorStaffId: string | undefined;
  if (input.actor.role === "lvn") {
    const me = getStaffMember(input.actor.staffId);
    supervisorStaffId = input.supervisorStaffId ?? me?.supervisedBy;
    const sup = getStaffMember(supervisorStaffId);
    if (!sup || !LVN_SUPERVISOR_ROLES.includes(sup.role))
      throw new Error("An LVN gives medications under RN, physician or PMHNP supervision — pick a supervisor.");
  }
  const d: ClinicDose = {
    id: uid(),
    orderId: o.id,
    patientId: input.patientId,
    at: new Date().toISOString(),
    by: input.actor.name,
    byStaffId: input.actor.staffId,
    role: input.actor.role,
    dose: (input.dose ?? o.dose ?? "").trim() || "As ordered",
    route: (input.route ?? o.route ?? "").trim() || "As ordered",
    site: input.site?.trim() || undefined,
    note: input.note?.trim() || undefined,
    supervisorStaffId,
    cosign: supervisorStaffId ? { status: "pending" } : undefined,
  };
  doses.push(d);
  audit("clinic_med_given", input.patientId, input.actor, { orderId: o.id, doseId: d.id, cosignRequired: !!supervisorStaffId });
  if (supervisorStaffId) notifyRole(getStaffMember(supervisorStaffId)!.role, input.patientId, "An LVN medication dose needs your cosign.");
  return d;
}

/** Supervisor cosigns an LVN dose. */
export function cosignClinicDose(input: { doseId: string; actor: NurseActor }): ClinicDose {
  assertRole(input.actor, LVN_SUPERVISOR_ROLES, "cosign medication doses");
  const d = doses.find((x) => x.id === input.doseId);
  if (!d) throw new Error("Dose not found.");
  if (d.cosign?.status !== "pending") throw new Error("Nothing to cosign.");
  if (d.supervisorStaffId && input.actor.staffId && d.supervisorStaffId !== input.actor.staffId)
    throw new Error("Only the named supervisor can cosign this dose.");
  d.cosign = { status: "signed", by: input.actor.name, at: new Date().toISOString() };
  audit("clinic_med_cosigned", d.patientId, input.actor, { doseId: d.id });
  return d;
}

export const nurseReviewFor = (orderId: string) => reviews.get(orderId);
export const dosesFor = (orderId: string) => doses.filter((d) => d.orderId === orderId);
export const listClinicDoses = (patientId: string) => doses.filter((d) => d.patientId === patientId);

/** Clinic-administered orders on this patient the role may see (SUD meds Part 2-filtered). */
export function clinicOrders(patientId: string, role: StaffRole): MedOrder[] {
  const p = AdelanteEHR.getPatient(patientId);
  return AdelanteEHR.listOrders(patientId).filter(
    (o) => o.clinicAdministered && o.status !== "draft" && (!isSudMedication(o) || (!!p && roleSeesAsamSection(role, p))),
  );
}

// -------------------------------------------------------------- specimens
export function collectSpecimen(input: { patientId: string; labOrderId: string; specimenType: string; actor: NurseActor }): SpecimenCollection {
  assertRole(input.actor, SPECIMEN_ROLES, "collect specimens");
  const p = patientOf(input.patientId);
  const lab = listLabOrders(input.patientId, input.actor.role).find((l) => l.id === input.labOrderId);
  if (!lab) throw new Error("Lab order not found.");
  if (!roleSeesLab(input.actor.role, p, lab.testId)) throw new Error("Not available for your role.");
  if (lab.status !== "pending") throw new Error("This lab already has a result.");
  if (specimens.some((s) => s.labOrderId === lab.id)) throw new Error("A specimen was already collected for this lab.");
  if (!input.specimenType.trim()) throw new Error("Choose the specimen type.");
  const s: SpecimenCollection = {
    id: uid(), patientId: p.id, labOrderId: lab.id, testId: lab.testId, specimenType: input.specimenType.trim(),
    at: new Date().toISOString(), by: input.actor.name, role: input.actor.role,
  };
  specimens.push(s);
  audit("specimen_collected", p.id, input.actor, { labOrderId: lab.id });
  return s;
}
export function listSpecimens(patientId: string, role: string): SpecimenCollection[] {
  const p = AdelanteEHR.getPatient(patientId);
  return specimens.filter((s) => s.patientId === patientId && roleSeesLab(role, p, s.testId));
}
export const specimenLabel = (s: SpecimenCollection) => `${labTest(s.testId)?.label ?? "Lab"} — ${s.specimenType}`;

// ---------------------------------------------------------------- triage
export function recordTriageCall(input: { patientId: string; concern: string; disposition: TriageDisposition; actor: NurseActor }): TriageCall {
  assertRole(input.actor, TRIAGE_ROLES, "triage calls (RN only)");
  patientOf(input.patientId);
  const concern = input.concern.trim().slice(0, 300);
  if (concern.length < 3) throw new Error("Describe the concern briefly.");
  const t: TriageCall = { id: uid(), patientId: input.patientId, at: new Date().toISOString(), by: input.actor.name, concern, disposition: input.disposition };
  triage.push(t);
  audit("triage_call_recorded", input.patientId, input.actor, { disposition: t.disposition });
  if (input.disposition === "prescriber_message") notifyRole("physician", input.patientId, "A nurse triage call needs prescriber follow-up.");
  return t;
}
export const listTriageCalls = (patientId: string) => triage.filter((t) => t.patientId === patientId);

// --------------------------------------------------------- refill request
/** RN coordinates a refill: files the request; approval stays prescriber-only. */
export function coordinateRefill(input: { patientId: string; medicationId: string; note?: string; actor: NurseActor }) {
  assertRole(input.actor, REFILL_COORDINATE_ROLES, "coordinate refills");
  const r = AdelanteEHR.requestRefill({ patientId: input.patientId, medicationId: input.medicationId, pharmacyNote: input.note, requestedBy: "clinician" });
  if (!r) throw new Error("That medication isn't active.");
  audit("refill_coordinated", input.patientId, input.actor, { refillId: r.id });
  return r;
}

// ------------------------------------------------------ Needs my action
export interface NurseQueueRow {
  id: string;
  kind: "review" | "administer" | "cosign" | "returned";
  patientId: string;
  orderId?: string;
  doseId?: string;
  label: string;
  action: string;
}
function patientLabel(p: Patient) {
  return `${p.firstName} ${p.lastName}`;
}
/** The next person in the chain sees their step. Part 2: SUD meds only for roles that see them; labels stay generic otherwise. */
export function nurseQueue(actor: { role: StaffRole; staffId?: string }): NurseQueueRow[] {
  const rows: NurseQueueRow[] = [];
  for (const p of AdelanteEHR.listPatients()) {
    for (const o of clinicOrders(p.id, actor.role)) {
      if (o.status !== "signed") continue;
      const rv = reviews.get(o.id);
      const given = doses.some((d) => d.orderId === o.id);
      if (!rv && canNurseReview(actor.role))
        rows.push({ id: `review:${o.id}`, kind: "review", patientId: p.id, orderId: o.id, label: `${patientLabel(p)} — ${o.drugName} ${o.dose ?? ""}`.trim(), action: "Review order" });
      else if (rv?.decision === "verified" && !given && canAdministerClinicMed(actor.role))
        rows.push({ id: `give:${o.id}`, kind: "administer", patientId: p.id, orderId: o.id, label: `${patientLabel(p)} — ${o.drugName} ${o.dose ?? ""}`.trim(), action: "Give dose" });
      else if (rv?.decision === "returned" && isPrescriberRole(actor.role))
        rows.push({ id: `returned:${o.id}`, kind: "returned", patientId: p.id, orderId: o.id, label: `${patientLabel(p)} — order returned by nursing`, action: "Open chart" });
    }
  }
  for (const d of doses) {
    if (d.cosign?.status === "pending" && canCosignLvnDose(actor.role) && (!actor.staffId || d.supervisorStaffId === actor.staffId)) {
      const p = AdelanteEHR.getPatient(d.patientId);
      if (p) rows.push({ id: `cosign:${d.id}`, kind: "cosign", patientId: p.id, doseId: d.id, orderId: d.orderId, label: `${patientLabel(p)} — LVN dose`, action: "Cosign" });
    }
  }
  return rows;
}

function notifyRole(role: string, patientId: string, body: string) {
  AdelanteEHR.notify({
    recipientRole: role as never,
    category: "task_assigned" as never,
    subject: "Nursing step waiting",
    body,
    linkRoute: "/nurse",
    patientId,
  } as never);
}

// ------------------------------------------------------------- demo seed
const ADMIN = { role: "sys_admin" as StaffRole, staffId: "s-admin1" };
let seeded = false;
/** Fictional RN + LVN through addStaffMember / registerClinician / addCredential, plus one order waiting for review. */
export function seedNursingDemo(): void {
  if (seeded) return;
  seeded = true;
  addStaffMember(ADMIN, { id: "s-rn1", name: "Marisol Ortega", role: "nurse_rn", credential: "RN", clinicianId: "c-rn1" });
  addStaffMember(ADMIN, { id: "s-lvn1", name: "Kevin Duarte", role: "lvn", credential: "LVN", clinicianId: "c-lvn1", supervisedBy: "s-rn1" });
  AdelanteEHR.registerClinician({ id: "c-rn1", name: "Marisol Ortega, RN", credential: "RN", mediCalCredentialed: true, mediCalStatus: "active", services: [], licenseExpiresOn: "2028-06-30" }, ADMIN.staffId);
  AdelanteEHR.registerClinician({ id: "c-lvn1", name: "Kevin Duarte, LVN", credential: "LVN", mediCalCredentialed: false, mediCalStatus: "pending", services: [], licenseExpiresOn: "2027-11-30" }, ADMIN.staffId);
  AdelanteEHRExt.addCredential({ clinicianId: "c-rn1", kind: "license", issuingState: "CA", number: "RN-000000 (fictional)", issuedAt: "2020-07-01", expiresAt: "2028-06-30", fileName: "rn_license_placeholder.pdf", uploadedBy: "Demo seed" } as never);
  AdelanteEHRExt.addCredential({ clinicianId: "c-lvn1", kind: "license", issuingState: "CA", number: "VN-000000 (fictional)", issuedAt: "2021-03-01", expiresAt: "2027-11-30", fileName: "lvn_license_placeholder.pdf", uploadedBy: "Demo seed" } as never);
  const doc = STAFF_ROSTER.find((s) => s.role === "physician") ?? STAFF_ROSTER.find((s) => s.role === "pmhnp");
  const patient = AdelanteEHR.listPatients()[0];
  if (doc && patient) {
    try {
      orderClinicMedication({
        patientId: patient.id,
        drugName: "Haloperidol decanoate 50 MG/ML Injectable Solution",
        dose: "50 mg",
        route: "IM",
        actor: { role: doc.role, staffId: doc.id, name: doc.name },
        enforceSafety: false,
      });
    } catch {
      /* demo only */
    }
  }
}
seedNursingDemo();

/** One line per signature on a clinic order: ordered → reviewed → given → cosigned. */
export interface OrderSignature { step: "ordered" | "reviewed" | "given" | "cosigned"; by: string; at?: string; pending?: boolean }
export function orderSignatureTrail(patientId: string, orderId: string): OrderSignature[] {
  const o = AdelanteEHR.listOrders(patientId).find((x) => x.id === orderId) as (MedOrder & { signedBy?: string; signedAt?: string; createdBy?: string }) | undefined;
  if (!o) return [];
  const out: OrderSignature[] = [{ step: "ordered", by: o.signedBy ?? o.createdBy ?? "Prescriber", at: o.signedAt }];
  const r = reviews.get(orderId);
  if (r?.decision === "verified") out.push({ step: "reviewed", by: r.by, at: r.at });
  for (const d of doses.filter((x) => x.orderId === orderId)) {
    out.push({ step: "given", by: d.by, at: d.at });
    if (d.cosign) out.push({ step: "cosigned", by: d.cosign.by ?? "Supervisor", at: d.cosign.at, pending: d.cosign.status !== "signed" });
  }
  return out;
}
