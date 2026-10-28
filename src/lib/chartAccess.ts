// §Access batch A1 — who may enter a chart. Draft — pending exec RBAC review.
//
// One rule, used by the route guard, patient search, notification deep links
// and tests:
//   1. the role must be a clinical delivery / coordination role (CHART_ENTRY_ROLES);
//   2. the patient must be enrolled at a site where the person works (staff
//      calendar sites — weekly hours; Premier Visalia / the org default when
//      none). Care-team membership never grants entry across sites; profile
//      "secondary locations" with no hours yet don't either;
//   3. a "Restricted record" is hidden from search for everyone off the care
//      team, and opening it asks for a reason, is logged and raises a
//      compliance item.
// Nothing here loosens anything INSIDE the chart: sections keep the record-
// class matrix, live Part 2 consent and role limits.
import { AdelanteEHR, type Patient } from "./ehr";
import { getStaffMember, STAFF_ROSTER, getSupervisor, type StaffRole } from "./roles";
import { defaultSiteId, primarySiteFor, sitesFor, calendarOwnerFor, siteName } from "./workingCalendar";
import { isAssignedTo, assignmentIdentityFor } from "./caseloadScope";
import { markEmergencyReviewed } from "./part2Disclosure";
import { activeAt, CHART_ACCESS_DRAFT, endOfSiteDay, evaluateChartEntry, isOpenReason, type OpenReason } from "./chartAccessRules";
import { additionalTeamFor, coveringStaffFor, validAccessActor, type AccessActor } from "./chartRelationships";
import { onCallForSite } from "./onCallBoundary";

export const ACCESS_MODEL_DRAFT_LABEL = CHART_ACCESS_DRAFT;
export const CHART_DENIED_MESSAGE = "This chart isn't available for your role";

export const CHART_ENTRY_ROLES: readonly StaffRole[] = [
  "physician", "pmhnp", "nurse_rn", "lvn", "therapist", "sud_counselor", "clinical_trainee",
  "medical_assistant", "ecm_provider", "cf_care_manager", "peer_specialist", "community_health_worker",
  "clinical_coordinator",
  "sys_admin",
];
/** Roles that may set / clear the Restricted record flag. */
export const RESTRICT_ROLES: readonly StaffRole[] = ["sys_admin", "clinical_coordinator"];
/** Compliance monitoring viewers (Quality & compliance). */
export { COMPLIANCE_ROLES } from "./complianceRoles";
import { COMPLIANCE_ROLES } from "./complianceRoles";
/** Draft — distinct charts per person per day before "Unusual volume". */
export const UNUSUAL_VOLUME_DRAFT = 30;

export const roleHasChartEntry = (role: StaffRole) => CHART_ENTRY_ROLES.includes(role);

/** Sites a staff member works at (from their staff calendar); org default when none. */
export function staffSiteIds(staffId?: string): string[] {
  const owner = calendarOwnerFor(staffId);
  const s = owner ? sitesFor(owner) : [];
  if (s.length) return s;
  const d = defaultSiteId();
  return d ? [d] : [];
}
/** Site the patient is enrolled at: explicit, else their primary clinician's site, else org default. */
export function patientSiteId(p: Pick<Patient, "primaryClinicianId"> & { enrolledSiteId?: string }): string | undefined {
  return p.enrolledSiteId ?? (p.primaryClinicianId ? primarySiteFor(p.primaryClinicianId) : undefined) ?? defaultSiteId();
}
export const patientSiteName = (p: Patient) => siteName(patientSiteId(p));

export function onCareTeam(staffId: string | undefined, p: Patient, at = new Date()): boolean {
  const m = getStaffMember(staffId);
  if (!m) return false;
  return m.active !== false && (isAssignedTo(p, assignmentIdentityFor({ caseManagerId: m.caseManagerId, clinicianId: m.clinicianId, staffId: m.id })) || additionalTeamFor(m.id, p.id, at));
}

export type ChartEntry =
  | { ok: true; restricted: boolean; careTeam: boolean; outsideCaseload: boolean; entryEligible: true; reasonGrant?: ReasonGrant }
  | { ok: false; reason: "role" | "site" | "missing" | "reason" | "restricted"; message: string; entryEligible?: boolean; restricted?: boolean; careTeam?: boolean };

export function chartEntryFor(role: StaffRole, staffId: string | undefined, patientId: string, at = new Date()): ChartEntry {
  if (!roleHasChartEntry(role) || !validAccessActor({ role, staffId })) return { ok: false, reason: "role", message: CHART_DENIED_MESSAGE };
  const p = AdelanteEHR.getPatient(patientId);
  if (!p) return { ok: false, reason: "missing", message: CHART_DENIED_MESSAGE };
  const careTeam = onCareTeam(staffId, p, at);
  const site = patientSiteId(p);
  const reasonGrant = reasonGrantFor(role, staffId, patientId, at);
  const supervisor = ["physician", "pmhnp", "therapist"].includes(role) && STAFF_ROSTER.some(s => s.active !== false && s.role === "clinical_trainee" && getSupervisor(s.id)?.id === staffId && onCareTeam(s.id, p, at));
  const coverage = !!staffId && coveringStaffFor(staffId, at).some(id => onCareTeam(id, p, at));
  const facts = evaluateChartEntry({ eligible: true, exists: true, team: careTeam, oversight: role === "clinical_coordinator" || role === "sys_admin", onCall: !!staffId && !!site && onCallForSite(staffId, site, at), coverage, supervisor, restricted: isRestricted(p.id), restrictedOpen: isChartUnlocked(staffId, patientId), reasonOpen: !!reasonGrant });
  if (!facts.ok) return { ok: false, reason: facts.reason ?? "reason", entryEligible: true, careTeam, restricted: isRestricted(p.id), message: facts.reason === "restricted" ? "Restricted record — reason required" : "Reason needed" };
  return { ok: true, restricted: isRestricted(p.id), careTeam, outsideCaseload: !careTeam, entryEligible: true, reasonGrant };
}
export const canEnterChart = (role: StaffRole, staffId: string | undefined, patientId: string) => chartEntryFor(role, staffId, patientId).ok;

/** Patients the role may find in search: entry rule, minus restricted records off the care team. */
export function searchablePatientsFor(role: StaffRole, staffId: string | undefined): Patient[] {
  if (!roleHasChartEntry(role) || !validAccessActor({ role, staffId })) return [];
  return AdelanteEHR.listPatients().filter((p) => {
    const e = chartEntryFor(role, staffId, p.id);
    return (e.ok || e.entryEligible) && (!isRestricted(p.id) || onCareTeam(staffId, p));
  }).map(p => {
    if (chartEntryFor(role, staffId, p.id).ok) return p;
    // Contract retains Patient typing for legacy pickers, but denied rows carry
    // only the minimal identification projection. Never rehydrate these IDs.
    return { id: p.id, firstName: p.firstName, lastName: p.lastName, dob: p.dob, enrolledSiteId: patientSiteId(p) } as Patient;
  });
}

export interface ReasonGrant { id: string; patientId: string; staffId: string; role: StaffRole; reasonCode: OpenReason; at: string; expiresAt: string }
const reasonGrants: ReasonGrant[] = [];
const teamRequests: { id: string; patientId: string; staffId: string; role: StaffRole; at: string }[] = [];
export function reasonGrantFor(role: StaffRole, staffId: string | undefined, patientId: string, at = new Date()) { return reasonGrants.find(g => g.role === role && g.staffId === staffId && g.patientId === patientId && activeAt(g.at, g.expiresAt, at)); }
export function canReasonOpen(actor: AccessActor, patientId?: string) { return !!patientId && validAccessActor(actor) && roleHasChartEntry(actor.role) && !!AdelanteEHR.getPatient(patientId); }
export function openChartWithReason(input: { patientId: string; reasonCode: string; note?: string; actor: AccessActor; at?: Date }) {
  if (!canReasonOpen(input.actor, input.patientId) || !input.actor.staffId) throw new Error(CHART_DENIED_MESSAGE);
  if (!isOpenReason(input.reasonCode) || (input.reasonCode === "other" && !input.note?.trim())) throw new Error("Choose a reason; Other needs a note.");
  if (isRestricted(input.patientId) && !onCareTeam(input.actor.staffId, AdelanteEHR.getPatient(input.patientId) as Patient) && !isChartUnlocked(input.actor.staffId, input.patientId)) throw new Error("Complete the restricted-record gate first.");
  const at = input.at ?? new Date();
  const p = AdelanteEHR.getPatient(input.patientId);
  if (!p) throw new Error(CHART_DENIED_MESSAGE);
  const row: ReasonGrant = { id: `reason-${++seq}`, patientId: p.id, staffId: input.actor.staffId, role: input.actor.role, reasonCode: input.reasonCode, at: at.toISOString(), expiresAt: endOfSiteDay(at, p.facilityTimezone ?? "America/Los_Angeles") };
  reasonGrants.unshift(row); AdelanteEHR._emit(); return { ...row };
}
export function requestCareTeamAddition(input: { patientId: string; actor: AccessActor }) {
  if (!canReasonOpen(input.actor, input.patientId) || !input.actor.staffId) throw new Error(CHART_DENIED_MESSAGE);
  const row = { id: `team-request-${++seq}`, patientId: input.patientId, staffId: input.actor.staffId, role: input.actor.role, at: new Date().toISOString() };
  teamRequests.unshift(row); AdelanteEHR._emit(); return { ...row };
}
export function careTeamRequests(actor: AccessActor) { return validAccessActor(actor) && actor.role === "clinical_coordinator" ? teamRequests.map(r => ({ ...r })) : []; }
export function weeklyReasonedOpens(actor: AccessActor, at = new Date()) { return validAccessActor(actor) && actor.role === "clinical_coordinator" ? reasonGrants.filter(g => +at - Date.parse(g.at) >= 0 && +at - Date.parse(g.at) < 7 * 86_400_000).map(g => ({ ...g })) : []; }
/** Existing group host may use this relationship, never full-chart entry. */
export function groupContextFor(staffId: string | undefined, patientId: string) {
  const s = getStaffMember(staffId);
  return !!s?.clinicianId && s.active !== false && AdelanteEHR.listGroupSessions().some(g => g.status !== "cancelled" && g.facilitatorId === s.clinicianId && AdelanteEHR.listGroupEnrollments(g.id).some(e => e.patientId === patientId));
}

// ---------------------------------------------------------------------------
// Restricted record
// ---------------------------------------------------------------------------
export interface RestrictionRow { patientId: string; reason: string; byStaffId: string; byName: string; at: string }
export interface RestrictedOpenItem { id: string; patientId: string; actorId: string; actorName: string; role: string; at: string; acknowledgedAt?: string; acknowledgedBy?: string; disclosureId?: string; medicalFollowUp?: boolean }
const restrictions = new Map<string, RestrictionRow>();
const openedItems: RestrictedOpenItem[] = [];
/** Charts this session already unlocked with a reason (per person + patient). */
const unlocked = new Set<string>();
let seq = 0;

export const isRestricted = (patientId: string) => restrictions.has(patientId);
export const restrictionFor = (patientId: string) => restrictions.get(patientId);
export const listRestrictedOpenItems = (open = true) => openedItems.filter((i) => !open || !i.acknowledgedAt);
export const isChartUnlocked = (staffId: string | undefined, patientId: string) => unlocked.has(`${staffId}|${patientId}`);
/** P2 adds review work, never a chart-unlock or another unlock audit. */
export function registerEmergencyReviewItem(input: Omit<RestrictedOpenItem, "id">): RestrictedOpenItem {
  const item = { ...input, id: `rro-${++seq}` };
  openedItems.unshift(item);
  return item;
}

type Actor = { staffId: string; name: string; role: StaffRole };
function need(reason: string) { if (!reason?.trim()) throw new Error("A reason is required."); }

export function setRecordRestricted(input: { patientId: string; restricted: boolean; reason: string; actor: Actor }): RestrictionRow | undefined {
  if (!RESTRICT_ROLES.includes(input.actor.role)) throw new Error("Only sys_admin or the clinical coordinator can change this.");
  need(input.reason);
  if (!AdelanteEHR.getPatient(input.patientId)) throw new Error("Client not found.");
  const at = new Date().toISOString();
  if (input.restricted) restrictions.set(input.patientId, { patientId: input.patientId, reason: input.reason.trim(), byStaffId: input.actor.staffId, byName: input.actor.name, at });
  else restrictions.delete(input.patientId);
  AdelanteEHR._recordAudit({ category: "access", action: input.restricted ? "record.restricted_set" : "record.restricted_cleared", patientId: input.patientId, actorId: input.actor.staffId, actorRole: input.actor.role, detail: { reason: input.reason.trim(), draft: ACCESS_MODEL_DRAFT_LABEL } });
  AdelanteEHR._emit();
  return restrictions.get(input.patientId);
}

/** Opening a restricted chart off the care team: reason required, logged, compliance item raised. */
export function openRestrictedChart(input: { patientId: string; reason: string; actor: Actor }): RestrictedOpenItem {
  need(input.reason);
  const entry = chartEntryFor(input.actor.role, input.actor.staffId, input.patientId);
  if (!entry.ok && !entry.entryEligible) throw new Error(entry.message);
  const at = new Date().toISOString();
  const item: RestrictedOpenItem = { id: `rro-${++seq}`, patientId: input.patientId, actorId: input.actor.staffId, actorName: input.actor.name, role: input.actor.role, at };
  openedItems.unshift(item);
  unlocked.add(`${input.actor.staffId}|${input.patientId}`);
  AdelanteEHR._recordAudit({ category: "access", action: "record.restricted_opened", patientId: input.patientId, actorId: input.actor.staffId, actorRole: input.actor.role, detail: { reason: input.reason.trim(), actorName: input.actor.name, complianceItemId: item.id } });
  AdelanteEHR._emit();
  return item;
}

export function acknowledgeRestrictedOpen(input: { id: string; note: string; actor: Actor }): RestrictedOpenItem {
  if (!COMPLIANCE_ROLES.includes(input.actor.role)) throw new Error("Compliance review only.");
  need(input.note);
  const item = openedItems.find((i) => i.id === input.id);
  if (!item) throw new Error("Item not found.");
  if (item.disclosureId) markEmergencyReviewed(item.disclosureId, input.actor);
  item.acknowledgedAt = new Date().toISOString();
  item.acknowledgedBy = input.actor.name;
  AdelanteEHR._recordAudit({ category: "access", action: "record.restricted_open_reviewed", patientId: item.patientId, actorId: input.actor.staffId, actorRole: input.actor.role, detail: { itemId: item.id, note: input.note.trim() } });
  AdelanteEHR._emit();
  return item;
}

export function _resetChartAccessForTests() { restrictions.clear(); openedItems.length = 0; unlocked.clear(); reasonGrants.length = 0; teamRequests.length = 0; }
