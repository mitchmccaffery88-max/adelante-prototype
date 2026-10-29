// 26 Oct evening (Mitch) — every care manager (primary OR additional role)
// has working hours and a bookable calendar. The calendar record id is the
// staff id, so `calendarOwnerFor` / `staffForClinician` already resolve it and
// the staff member never gains a primary-clinician link or chart access.
// Default hours are Draft — pending clinical sign-off.
import { AdelanteEHR, type ServiceType } from "./ehr";
import { AdelanteEHRExt } from "./ehr-ext";
import { hasRoleAssignment, STAFF_ROSTER, type StaffMember, type StaffRole } from "./roles";

export const CARE_MANAGER_HOURS_DRAFT = "Draft — pending clinical sign-off";
const SERVICES_BY_ROLE: Partial<Record<StaffRole, ServiceType[]>> = {
  ecm_provider: ["case_management"],
  cf_care_manager: ["case_management"],
  peer_specialist: ["peer_support"],
  // 30 Oct (Draft): CHWs keep their own calendar for CHW visits.
  community_health_worker: ["chw_visit"],
};
export const CARE_MANAGER_CALENDAR_ROLES = Object.keys(SERVICES_BY_ROLE) as StaffRole[];
/** Draft default week: Monday–Friday 9:00–17:00, in person or by video/phone. */
export const DEFAULT_CARE_MANAGER_HOURS = ([1, 2, 3, 4, 5] as const).map((weekday) => ({ weekday, start: "09:00", end: "17:00" }));
const DEFAULT_LOCATION = "loc-visalia";

export function isCareManager(s: StaffMember): boolean {
  return CARE_MANAGER_CALENDAR_ROLES.some((r) => hasRoleAssignment(s, r));
}
function servicesFor(s: StaffMember): ServiceType[] {
  return [...new Set(CARE_MANAGER_CALENDAR_ROLES.filter((r) => hasRoleAssignment(s, r)).flatMap((r) => SERVICES_BY_ROLE[r] ?? []))];
}
/** The bookable calendar id for a staff member, if any. */
export function calendarIdFor(s: StaffMember): string | undefined {
  return s.clinicianId ?? (AdelanteEHR.getClinician(s.id) ? s.id : undefined);
}

/** Give a care manager a calendar and the Draft default week when they have none. Returns the calendar id. */
export function ensureCareManagerCalendar(s: StaffMember): string | undefined {
  if (!isCareManager(s) || s.active === false) return undefined;
  const services = servicesFor(s);
  let id = calendarIdFor(s);
  if (!id) {
    AdelanteEHR.registerClinician({ id: s.id, name: s.name, credential: s.credential ?? "Care manager", mediCalCredentialed: false, mediCalStatus: "pending", services, locationIds: [DEFAULT_LOCATION] });
    id = s.id;
  }
  if (AdelanteEHRExt.availabilityBlocksForClinician(id).length === 0) {
    for (const h of DEFAULT_CARE_MANAGER_HOURS) {
      AdelanteEHRExt.upsertAvailabilityBlock({ clinicianId: id, weekday: h.weekday, start: h.start, end: h.end, modality: "hybrid", locationId: DEFAULT_LOCATION, careTypes: services });
    }
  }
  return id;
}

export function seedCareManagerCalendars(): void {
  for (const s of STAFF_ROSTER) ensureCareManagerCalendar(s);
}
// Demo seed ids come from a local deterministic sequence so this seed never
// shifts the shared Math.random stream other seeded fixtures rely on.
function withLocalIds(fn: () => void) {
  const shared = Math.random; let k = 1;
  Math.random = () => ((k++ * 0.6180339887498949) % 1);
  try { fn(); } finally { Math.random = shared; }
}
try { withLocalIds(seedCareManagerCalendars); } catch { /* best-effort demo seed */ }
