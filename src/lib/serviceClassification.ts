// §Batch A4 — funding source + care continuum category on every service.
//
// Every service record (visit, group attendance, case management contact,
// peer contact, AFBI field outreach) gets BOTH fields set BY RULE the first
// time the platform sees it (the store sweep runs on every store change, so
// in practice that is the moment of creation). A rule stamp never changes on
// its own afterwards; only a billing or clinical coordinator can override,
// with a required reason, and every override is kept in history.
//
// The category list and the derivation rules are DRAFT pending clinical and
// fiscal sign-off.
import { AdelanteEHR, type FundingLane, type Patient, type ServiceType } from "@/lib/ehr";
import { mediCalStatusApplies } from "@/lib/coverageStatus";
import { listContacts } from "@/lib/caseloadReview";
import { canAccess, type StaffRole } from "@/lib/roles";
import type { CoverageType } from "@/lib/frontDoor";

export const DRAFT_RULE_LABEL = "Draft — pending clinical sign-off";

export const CARE_CONTINUUM = [
  { id: "outreach_engagement", label: "Outreach & engagement" },
  { id: "outpatient", label: "Outpatient" },
  { id: "intensive_outpatient", label: "Intensive outpatient" },
  { id: "mat", label: "Medications for addiction treatment" },
  { id: "crisis", label: "Crisis services" },
  { id: "recovery_support", label: "Recovery support" },
  { id: "case_management", label: "Case management / care coordination" },
  { id: "prevention", label: "Prevention & early intervention" },
] as const;
export type CareContinuum = (typeof CARE_CONTINUUM)[number]["id"];

export const FUNDING_LABEL: Record<FundingLane, string> = {
  medi_cal_ffs: "Medi-Cal (FFS)",
  dmc_ods: "DMC-ODS",
  ecm: "ECM",
  private_pay: "Private pay",
  isl_non_medi_cal: "ISL (non-Medi-Cal)",
  bhsa: "BHSA",
  non_billable: "Non-billable",
};
/** Lanes that can end up on a Medi-Cal claim. */
export const MEDI_CAL_LANES: readonly FundingLane[] = ["medi_cal_ffs", "dmc_ods", "ecm"];

/** Categories that reveal SUD treatment (42 CFR Part 2). */
const PART2_CONTINUUM: readonly CareContinuum[] = ["mat"];

export type ServiceKind = "appointment" | "group_attendance" | "case_contact" | "peer_contact" | "afbi_contact";
export const SERVICE_KINDS: readonly ServiceKind[] = ["appointment", "group_attendance", "case_contact", "peer_contact", "afbi_contact"];
export const SERVICE_KIND_LABEL: Record<ServiceKind, string> = {
  appointment: "Visit",
  group_attendance: "Group",
  case_contact: "Case management contact",
  peer_contact: "Peer contact",
  afbi_contact: "Field outreach",
};

export interface ServiceRef {
  kind: ServiceKind;
  id: string;
}
export interface ClassificationChange {
  fundingSource: FundingLane;
  careContinuum: CareContinuum;
  source: "rule" | "override";
  by?: string;
  role?: StaffRole;
  reason?: string;
  at: string;
}
export interface ServiceClassification {
  ref: ServiceRef;
  patientId?: string;
  serviceDate: string;
  fundingSource: FundingLane;
  careContinuum: CareContinuum;
  source: "rule" | "override";
  /** Plain-language rule that produced the rule stamp (Part 2-safe). */
  basis: string;
  setAt: string;
  history: ClassificationChange[];
}

const key = (r: ServiceRef) => `${r.kind}:${r.id}`;
const store = new Map<string, ServiceClassification>();

// ------------------------------------------------------------------ rules
export interface RuleInput {
  kind: ServiceKind;
  patient?: Patient;
  serviceType?: ServiceType;
  fundingLane?: FundingLane;
}

function openEpisodes(p?: Patient) {
  return (p?.episodes ?? []).filter((e) => !e.closedAt);
}
function coverageLane(p?: Patient): FundingLane {
  const c = p?.coverage;
  if (!c || c.status !== "active") return "isl_non_medi_cal";
  const t = (c as { coverageType?: CoverageType }).coverageType;
  if (!t || mediCalStatusApplies(t)) return "medi_cal_ffs";
  return "isl_non_medi_cal";
}
function episodeLane(p?: Patient): FundingLane | undefined {
  const types = openEpisodes(p).map((e) => e.type);
  if (types.includes("sud_dmc_ods") && coverageLane(p) === "medi_cal_ffs") return "dmc_ods";
  if (types.includes("ecm") && coverageLane(p) === "medi_cal_ffs") return "ecm";
  if (types.includes("bhsa")) return "bhsa";
  return undefined;
}
function isIot(p?: Patient): boolean {
  return openEpisodes(p).some((e) => e.type === "sud_dmc_ods" && /iot|2\.1|intensive/i.test(e.state));
}
function hasSudEpisode(p?: Patient): boolean {
  return openEpisodes(p).some((e) => e.type === "sud_dmc_ods");
}

/** Pure rule. DRAFT. */
export function deriveClassification(input: RuleInput): { fundingSource: FundingLane; careContinuum: CareContinuum; basis: string } {
  const p = input.patient;
  if (input.kind === "afbi_contact")
    return { fundingSource: "isl_non_medi_cal", careContinuum: "outreach_engagement", basis: "Field outreach is always non-Medi-Cal (ISL)." };
  const fundingSource = input.fundingLane ?? episodeLane(p) ?? coverageLane(p);
  const fundingBasis = input.fundingLane ? "visit funding lane" : episodeLane(p) ? "open program episode" : "coverage on file";
  let careContinuum: CareContinuum = "outpatient";
  if (input.kind === "case_contact") careContinuum = "case_management";
  else if (input.kind === "peer_contact") careContinuum = "recovery_support";
  else if (input.serviceType === "case_management" || input.serviceType === "care_coordination") careContinuum = "case_management";
  else if (input.serviceType === "peer_support") careContinuum = "recovery_support";
  else if (input.serviceType === "med_management" && hasSudEpisode(p)) careContinuum = "mat";
  else if (isIot(p)) careContinuum = "intensive_outpatient";
  return { fundingSource, careContinuum, basis: `Funding from ${fundingBasis}; category from service type.` };
}

// ------------------------------------------------------------------ stamping
/** Sets both fields by rule if the record has none yet. Never overwrites. */
export function stampService(ref: ServiceRef, input: RuleInput & { serviceDate: string }): ServiceClassification {
  const existing = store.get(key(ref));
  if (existing) return existing;
  const d = deriveClassification(input);
  const at = new Date().toISOString();
  const row: ServiceClassification = {
    ref,
    patientId: input.patient?.id,
    serviceDate: input.serviceDate,
    ...d,
    source: "rule",
    setAt: at,
    history: [{ fundingSource: d.fundingSource, careContinuum: d.careContinuum, source: "rule", at }],
  };
  store.set(key(ref), row);
  return row;
}

/** Scans every service record in the store and stamps any without fields. */
export function sweepServiceClassification(): number {
  let n = 0;
  const stamp = (ref: ServiceRef, input: RuleInput & { serviceDate: string }) => {
    if (!store.has(key(ref))) {
      stampService(ref, input);
      n++;
    }
  };
  const patients = AdelanteEHR.listPatients();
  const byId = new Map(patients.map((p) => [p.id, p]));
  for (const a of AdelanteEHR.listAppointments())
    stamp({ kind: "appointment", id: a.id }, { kind: "appointment", patient: byId.get(a.patientId), serviceType: a.serviceType, fundingLane: a.fundingLane, serviceDate: a.start });
  for (const g of AdelanteEHR.listGroupSessions())
    for (const occ of AdelanteEHR.listGroupOccurrenceRecords(g.id))
      for (const att of occ.attendance ?? [])
        stamp({ kind: "group_attendance", id: `${occ.id}:${att.patientId}` }, { kind: "group_attendance", patient: byId.get(att.patientId), serviceType: "therapy_group", serviceDate: occ.occurrenceStart });
  for (const p of patients) {
    for (const c of listContacts(p.id)) stamp({ kind: "case_contact", id: c.id }, { kind: "case_contact", patient: p, serviceDate: c.date });
    for (const pn of p.peerNotes ?? []) stamp({ kind: "peer_contact", id: pn.id }, { kind: "peer_contact", patient: p, serviceDate: pn.date });
  }
  return n;
}

let subscribed = false;
/** Keeps stamps current: sweeps now and on every store change. */
export function startServiceClassification(): void {
  if (subscribed) return;
  subscribed = true;
  sweepServiceClassification();
  AdelanteEHR.subscribe(() => {
    sweepServiceClassification();
  });
}

export function getServiceClassification(ref: ServiceRef): ServiceClassification | undefined {
  if (!store.has(key(ref))) sweepServiceClassification();
  return store.get(key(ref));
}
export function listServiceClassifications(patientId?: string): ServiceClassification[] {
  sweepServiceClassification();
  return [...store.values()].filter((r) => !patientId || r.patientId === patientId).sort((a, b) => b.serviceDate.localeCompare(a.serviceDate));
}

// ------------------------------------------------------------------ override
export const CLASSIFICATION_OVERRIDE_ROLES: readonly StaffRole[] = ["billing_coordinator", "clinical_coordinator"];
export const canOverrideClassification = (role: StaffRole) => CLASSIFICATION_OVERRIDE_ROLES.includes(role);

export function overrideServiceClassification(
  actor: { role: StaffRole; name: string },
  ref: ServiceRef,
  change: { fundingSource?: FundingLane; careContinuum?: CareContinuum; reason: string },
): ServiceClassification {
  if (!canOverrideClassification(actor.role)) throw new Error("Only a billing or clinical coordinator can override funding or category.");
  const row = getServiceClassification(ref);
  if (!row) throw new Error("Service not found.");
  if (!change.reason?.trim()) throw new Error("A reason is required to override.");
  const fundingSource = change.fundingSource ?? row.fundingSource;
  const careContinuum = change.careContinuum ?? row.careContinuum;
  if (!FUNDING_LABEL[fundingSource]) throw new Error("Pick a funding source.");
  if (!CARE_CONTINUUM.some((c) => c.id === careContinuum)) throw new Error("Pick a category.");
  if (ref.kind === "afbi_contact" && MEDI_CAL_LANES.includes(fundingSource))
    throw new Error("Field outreach (AFBI) can never use a Medi-Cal funding lane.");
  const at = new Date().toISOString();
  row.fundingSource = fundingSource;
  row.careContinuum = careContinuum;
  row.source = "override";
  row.history.push({ fundingSource, careContinuum, source: "override", by: actor.name, role: actor.role, reason: change.reason.trim(), at });
  return row;
}

// ------------------------------------------------------------------ display
/** Part 2: roles without SUD access see "Restricted" for SUD-revealing values. */
export function roleSeesPart2Classification(role: StaffRole, patient?: Patient): boolean {
  const a = canAccess(role, "screeners_sud", patient);
  return a.level !== "none" && !a.locked;
}
export function classificationDisplay(row: ServiceClassification, role: StaffRole, patient?: Patient) {
  const sees = roleSeesPart2Classification(role, patient);
  const restricted = "Restricted";
  return {
    // Funding lane is billing data already shown on claims; only the SUD category is masked.
    funding: FUNDING_LABEL[row.fundingSource],
    continuum: !sees && PART2_CONTINUUM.includes(row.careContinuum) ? restricted : CARE_CONTINUUM.find((c) => c.id === row.careContinuum)!.label,
    provenance: row.source === "rule" ? "Set by rule" : "Overridden",
  };
}

export function _resetServiceClassification(): void {
  store.clear();
}
startServiceClassification();
