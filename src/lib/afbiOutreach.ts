// §Batch A3 — "Field outreach contact (AFBI)".
//
// Can exist before enrollment (initials + short description). Linking to a
// chart only happens through the patient-matching review queue — a staff
// member requests the link, a coordinator confirms it. Never auto-merged.
//
// Hard guards:
//  - Funding lane is always ISL (non-Medi-Cal); the claim creators refuse any
//    AFBI id (afbiGuard.ts), and a classification override can't move it to a
//    Medi-Cal lane (serviceClassification.ts).
//  - Activities are SUD content (42 CFR Part 2): never in audit text; billing
//    roles see counts only; roles without SUD access see "Details restricted".
import { AdelanteEHR, type Patient } from "@/lib/ehr";
import { canAccess, type StaffRole } from "@/lib/roles";
import { AFBI_ID_PREFIX } from "@/lib/afbiGuard";
import { canReviewMatches } from "@/lib/patientMatching";
import { cohortGuard, type CohortGuard } from "@/lib/cohortGuard";
import { stampService } from "@/lib/serviceClassification";

export const AFBI_LOCATION_TYPES = [
  { id: "street", label: "Street" },
  { id: "shelter", label: "Shelter" },
  { id: "release_gate", label: "Release gate" },
  { id: "home_visit", label: "Home visit" },
  { id: "community_site", label: "Community site" },
  { id: "other", label: "Other" },
] as const;
export type AfbiLocationType = (typeof AFBI_LOCATION_TYPES)[number]["id"];

export const AFBI_ACTIVITIES = [
  { id: "engagement", label: "Engagement" },
  { id: "naloxone", label: "Naloxone provided" },
  { id: "needs_screening", label: "Needs screening" },
  { id: "mat_referral", label: "MAT initiation referral" },
  { id: "linkage", label: "Linkage to services" },
  { id: "other", label: "Other" },
] as const;
export type AfbiActivity = (typeof AFBI_ACTIVITIES)[number]["id"];

export const AFBI_OUTCOMES = [
  { id: "engaged", label: "Engaged" },
  { id: "declined", label: "Declined" },
  { id: "not_found", label: "Couldn't find the person" },
  { id: "linked", label: "Linked to a service" },
] as const;
export type AfbiOutcome = (typeof AFBI_OUTCOMES)[number]["id"];

export const AFBI_ONLINE_ONLY_NOTE = "Field capture is currently online-only — you need a connection to save.";

/** Peer specialist, CHW, case manager / ECM provider, therapist, PMHNP, physician. */
export const AFBI_CREATE_ROLES: readonly StaffRole[] = [
  "peer_specialist",
  "community_health_worker",
  "ecm_provider",
  "therapist",
  "pmhnp",
  "physician",
];
export const canRecordAfbi = (role: StaffRole) => AFBI_CREATE_ROLES.includes(role);
const BILLING_ROLES: readonly StaffRole[] = ["billing", "billing_coordinator"];

export interface AfbiContact {
  id: string;
  at: string;
  staffId?: string;
  staffName: string;
  staffRole: StaffRole;
  locationType: AfbiLocationType;
  patientId?: string;
  initials?: string;
  description?: string;
  activities: AfbiActivity[];
  minutes: number;
  outcome: AfbiOutcome;
  nextStep?: string;
  /** Always ISL — see header. */
  fundingLane: "isl_non_medi_cal";
  createdAt: string;
}
export interface AfbiLinkRequest {
  id: string;
  contactId: string;
  patientId: string;
  requestedBy: string;
  requestedAt: string;
  status: "open" | "linked" | "declined";
  decidedBy?: string;
  decidedAt?: string;
}

const contacts: AfbiContact[] = [];
const links: AfbiLinkRequest[] = [];
let seq = 0;

export interface AfbiActor {
  role: StaffRole;
  name: string;
  staffId?: string;
}

/**
 * A clinical coordinator reassigns an AFBI contact to another outreach staff
 * member (e.g. the recorder left). Audited; the new owner may then dictate onto it.
 */
export function reassignAfbiContact(
  contactId: string,
  to: { staffId: string; name: string; role: StaffRole },
  coordinator: { role: StaffRole; name: string; staffId?: string },
  reason: string,
): AfbiContact {
  if (coordinator.role !== "clinical_coordinator" && coordinator.role !== "sys_admin") throw new Error("Only a clinical coordinator can reassign a contact.");
  if (!reason?.trim()) throw new Error("Give a reason for the reassignment.");
  if (!canRecordAfbi(to.role)) throw new Error("That person doesn't record field outreach.");
  const c = contacts.find((x) => x.id === contactId);
  if (!c) throw new Error("Contact not found.");
  const from = c.staffId;
  c.staffId = to.staffId;
  c.staffName = to.name;
  c.staffRole = to.role;
  AdelanteEHR._recordAudit({ category: "afbi", action: "afbi_contact_reassigned", patientId: c.patientId, actorId: coordinator.name, actorRole: coordinator.role, detail: { contactId, fromStaffId: from, toStaffId: to.staffId } });
  return c;
}

/** Only the contact's recorder (or whoever a coordinator reassigned it to) owns it. */
export function ownsAfbiContact(contactId: string, staffId?: string): boolean {
  const c = contacts.find((x) => x.id === contactId);
  return Boolean(c && staffId && c.staffId === staffId);
}

export function recordAfbiContact(
  actor: AfbiActor,
  input: {
    at?: string;
    locationType: AfbiLocationType;
    patientId?: string;
    initials?: string;
    description?: string;
    activities: AfbiActivity[];
    minutes: number;
    outcome: AfbiOutcome;
    nextStep?: string;
  },
): AfbiContact {
  if (!canRecordAfbi(actor.role)) throw new Error("Only outreach, case management and clinical roles can record field outreach.");
  if (!AFBI_LOCATION_TYPES.some((l) => l.id === input.locationType)) throw new Error("Pick a location type.");
  if (!input.activities?.length || input.activities.some((a) => !AFBI_ACTIVITIES.some((x) => x.id === a))) throw new Error("Pick at least one activity.");
  if (!AFBI_OUTCOMES.some((o) => o.id === input.outcome)) throw new Error("Pick an outcome.");
  const minutes = Math.round(Number(input.minutes));
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 600) throw new Error("Enter minutes (1–600).");
  const patient = input.patientId ? AdelanteEHR.getPatient(input.patientId) : undefined;
  if (input.patientId && !patient) throw new Error("Patient not found.");
  const initials = input.initials?.trim().toUpperCase().slice(0, 4);
  if (!patient && !initials) throw new Error("Pick a patient, or enter the person's initials.");
  const now = new Date().toISOString();
  const row: AfbiContact = {
    id: `${AFBI_ID_PREFIX}${++seq}`,
    at: input.at ?? now,
    staffId: actor.staffId,
    staffName: actor.name,
    staffRole: actor.role,
    locationType: input.locationType,
    patientId: patient?.id,
    initials: patient ? undefined : initials,
    description: patient ? undefined : input.description?.trim().slice(0, 140) || undefined,
    activities: [...new Set(input.activities)],
    minutes,
    outcome: input.outcome,
    nextStep: input.nextStep?.trim().slice(0, 200) || undefined,
    fundingLane: "isl_non_medi_cal",
    createdAt: now,
  };
  contacts.unshift(row);
  stampService({ kind: "afbi_contact", id: row.id }, { kind: "afbi_contact", patient, serviceDate: row.at });
  return row;
}

export function getAfbiContact(id: string): AfbiContact | undefined {
  return contacts.find((c) => c.id === id);
}

/** Part 2 view. Billing roles get nothing here (counts only via afbiCounts). */
export type AfbiView = Omit<AfbiContact, "activities" | "nextStep" | "description"> & {
  activities: AfbiActivity[] | "restricted";
  nextStep?: string;
  description?: string;
};
export function roleSeesAfbiDetail(role: StaffRole, patient?: Patient): boolean {
  if (BILLING_ROLES.includes(role)) return false;
  const a = canAccess(role, "screeners_sud", patient);
  return a.level !== "none" && !a.locked;
}
export function listAfbiContactsFor(role: StaffRole, opts: { patientId?: string } = {}): AfbiView[] {
  if (BILLING_ROLES.includes(role)) return [];
  return contacts
    .filter((c) => !opts.patientId || c.patientId === opts.patientId)
    .map((c) => {
      const p = c.patientId ? AdelanteEHR.getPatient(c.patientId) : undefined;
      if (roleSeesAfbiDetail(role, p)) return { ...c };
      return { ...c, activities: "restricted" as const, nextStep: undefined, description: undefined };
    });
}
/** Counts only — what billing sees. Cohort guard on the number of people. */
export function afbiCounts(range?: { from?: string; to?: string }): { contacts: number; minutes: number; guard: CohortGuard } {
  const rows = contacts.filter((c) => (!range?.from || c.at >= range.from) && (!range?.to || c.at <= range.to));
  const people = new Set(rows.map((c) => c.patientId ?? `u:${c.id}`));
  return { contacts: rows.length, minutes: rows.reduce((s, c) => s + c.minutes, 0), guard: cohortGuard(people.size) };
}

// ------------------------------------------------------------------ linking
export function requestAfbiLink(actor: AfbiActor, contactId: string, patientId: string): AfbiLinkRequest {
  if (!canRecordAfbi(actor.role) && !canReviewMatches(actor.role)) throw new Error("Your role can't link field outreach contacts.");
  const c = getAfbiContact(contactId);
  if (!c) throw new Error("Contact not found.");
  if (c.patientId) throw new Error("This contact is already linked to a chart.");
  if (!AdelanteEHR.getPatient(patientId)) throw new Error("Patient not found.");
  if (links.some((l) => l.contactId === contactId && l.status === "open")) throw new Error("A link request is already waiting for review.");
  const row: AfbiLinkRequest = { id: `afl-${++seq}`, contactId, patientId, requestedBy: actor.name, requestedAt: new Date().toISOString(), status: "open" };
  links.unshift(row);
  return row;
}
export function listAfbiLinkRequests(status: AfbiLinkRequest["status"] | "all" = "open"): AfbiLinkRequest[] {
  return links.filter((l) => status === "all" || l.status === status);
}
/** Coordinator decision in the patient-matching queue. */
export function decideAfbiLink(actor: AfbiActor, requestId: string, accept: boolean): AfbiLinkRequest {
  if (!canReviewMatches(actor.role)) throw new Error("Only a clinical coordinator or system admin can confirm a link.");
  const l = links.find((x) => x.id === requestId);
  if (!l || l.status !== "open") throw new Error("Link request not found.");
  l.status = accept ? "linked" : "declined";
  l.decidedBy = actor.name;
  l.decidedAt = new Date().toISOString();
  if (accept) {
    const c = getAfbiContact(l.contactId)!;
    c.patientId = l.patientId;
    c.initials = undefined;
    c.description = undefined;
  }
  return l;
}

export function _resetAfbi(): void {
  contacts.length = 0;
  links.length = 0;
}
