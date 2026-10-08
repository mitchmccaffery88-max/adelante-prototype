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
import { getStaffMember, type StaffRole } from "./roles";
import { defaultSiteId, primarySiteFor, sitesFor, calendarOwnerFor, siteName } from "./workingCalendar";
import { isAssignedTo, assignmentIdentityFor } from "./caseloadScope";

export const ACCESS_MODEL_DRAFT_LABEL = "Draft — pending exec RBAC review";
export const CHART_DENIED_MESSAGE = "This chart isn't available for your role";

export const CHART_ENTRY_ROLES: readonly StaffRole[] = [
  "physician", "pmhnp", "nurse_rn", "lvn", "therapist", "sud_counselor", "clinical_trainee",
  "medical_assistant", "ecm_provider", "cf_care_manager", "peer_specialist", "community_health_worker",
  "clinical_coordinator",
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

export function onCareTeam(staffId: string | undefined, p: Patient): boolean {
  const m = getStaffMember(staffId);
  if (!m) return false;
  return isAssignedTo(p, assignmentIdentityFor({ caseManagerId: m.caseManagerId, clinicianId: m.clinicianId, staffId: m.id }));
}

export type ChartEntry =
  | { ok: true; restricted: boolean; careTeam: boolean; outsideCaseload: boolean }
  | { ok: false; reason: "role" | "site" | "missing"; message: string };

export function chartEntryFor(role: StaffRole, staffId: string | undefined, patientId: string): ChartEntry {
  if (!roleHasChartEntry(role)) return { ok: false, reason: "role", message: CHART_DENIED_MESSAGE };
  const p = AdelanteEHR.getPatient(patientId);
  if (!p) return { ok: false, reason: "missing", message: CHART_DENIED_MESSAGE };
  const careTeam = onCareTeam(staffId, p);
  const site = patientSiteId(p);
  // Site rule only: care-team membership never grants entry across sites.
  if (!(site && staffSiteIds(staffId).includes(site)))
    return { ok: false, reason: "site", message: "This chart isn't available — the client is enrolled at a site where you don't work" };
  return { ok: true, restricted: isRestricted(p.id), careTeam, outsideCaseload: !careTeam };
}
export const canEnterChart = (role: StaffRole, staffId: string | undefined, patientId: string) => chartEntryFor(role, staffId, patientId).ok;

/** Patients the role may find in search: entry rule, minus restricted records off the care team. */
export function searchablePatientsFor(role: StaffRole, staffId: string | undefined): Patient[] {
  if (!roleHasChartEntry(role)) return [];
  return AdelanteEHR.listPatients().filter((p) => {
    const e = chartEntryFor(role, staffId, p.id);
    return e.ok && (!e.restricted || e.careTeam);
  });
}

// ---------------------------------------------------------------------------
// Restricted record
// ---------------------------------------------------------------------------
export interface RestrictionRow { patientId: string; reason: string; byStaffId: string; byName: string; at: string }
export interface RestrictedOpenItem { id: string; patientId: string; actorId: string; actorName: string; role: string; at: string; acknowledgedAt?: string; acknowledgedBy?: string }
const restrictions = new Map<string, RestrictionRow>();
const openedItems: RestrictedOpenItem[] = [];
/** Charts this session already unlocked with a reason (per person + patient). */
const unlocked = new Set<string>();
let seq = 0;

export const isRestricted = (patientId: string) => restrictions.has(patientId);
export const restrictionFor = (patientId: string) => restrictions.get(patientId);
export const listRestrictedOpenItems = (open = true) => openedItems.filter((i) => !open || !i.acknowledgedAt);
export const isChartUnlocked = (staffId: string | undefined, patientId: string) => unlocked.has(`${staffId}|${patientId}`);

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
  if (!entry.ok) throw new Error(entry.message);
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
  item.acknowledgedAt = new Date().toISOString();
  item.acknowledgedBy = input.actor.name;
  AdelanteEHR._recordAudit({ category: "access", action: "record.restricted_open_reviewed", patientId: item.patientId, actorId: input.actor.staffId, actorRole: input.actor.role, detail: { itemId: item.id, note: input.note.trim() } });
  AdelanteEHR._emit();
  return item;
}

export function _resetChartAccessForTests() { restrictions.clear(); openedItems.length = 0; unlocked.clear(); }
