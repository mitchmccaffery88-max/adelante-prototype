// 26 Oct evening (Mitch) — Draft on-call duty schedule for licensed clinician
// roles. `resolveCrisisOwner` (ehr.ts) asks this schedule through
// onCallBoundary when a patient has no active assigned clinician; with no
// on-call clinician it falls back to the clinical coordinator pool and the
// row shows ON_CALL_GAP. Writes run through runAction ("on_call_shift_add" /
// "on_call_shift_remove"), which records the one audit event (IDs only).
// Owner TBD — Draft, pending clinical sign-off.
import { AdelanteEHR } from "./ehr";
import { hasRoleAssignment, STAFF_ROSTER, getStaffMember, type StaffMember, type StaffRole } from "./roles";
import { registerOnCallLookup, registerOnCallSiteLookup } from "./onCallBoundary";
import { primarySiteFor } from "./workingCalendar";

export const ON_CALL_DRAFT = "Draft — pending clinical sign-off";
/** Licensed clinician roles that can carry on-call duty (Draft). */
export const ON_CALL_ROLES: readonly StaffRole[] = ["therapist", "pmhnp", "physician"];
export const ON_CALL_ADMIN_ROLES: readonly StaffRole[] = ["clinical_coordinator", "sys_admin"];
export const ON_CALL_DUTY_DESCRIPTION =
  "On call: you receive new crisis escalations for patients with no active assigned clinician. Acknowledge right away, write the crisis note on the existing one-calendar-day clock, and hand off with a reason to the assigned clinician or the clinical coordinator when your shift ends.";

export interface OnCallShift { id: string; staffId: string; siteId?: string; start: string; end: string; createdById?: string; createdAt: string }
type Actor = { role: StaffRole; staffId?: string };
const shifts: OnCallShift[] = [];
let seq = 0;

export const canManageOnCall = (role: StaffRole) => ON_CALL_ADMIN_ROLES.includes(role);
export const canCarryOnCall = (s: StaffMember | undefined) => !!s && s.active !== false && ON_CALL_ROLES.some((r) => hasRoleAssignment(s, r));
export const onCallEligibleStaff = () => STAFF_ROSTER.filter(canCarryOnCall);

function assertManager(actor: Actor) {
  if (!canManageOnCall(actor.role)) throw new Error("Only the clinical coordinator or a system admin can change the on-call schedule.");
}
function needReason(reason: string) {
  if ((reason ?? "").trim().length < 3) throw new Error("Give a short reason.");
}

export function listOnCallShifts(): OnCallShift[] {
  return [...shifts].sort((a, b) => a.start.localeCompare(b.start)).map((s) => ({ ...s }));
}

export function addOnCallShift(actor: Actor, input: { staffId: string; siteId?: string; start: string; end: string }, reason: string): OnCallShift {
  assertManager(actor);
  needReason(reason);
  const s = getStaffMember(input.staffId);
  if (!canCarryOnCall(s)) throw new Error("On-call duty needs an active licensed clinician.");
  const start = Date.parse(input.start), end = Date.parse(input.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error("Pick a start and an end after it.");
  if (end - start > 7 * 86_400_000) throw new Error("A shift can be at most 7 days.");
  const row: OnCallShift = { id: `oncall_${Date.now().toString(36)}_${(seq++).toString(36)}`, staffId: input.staffId, siteId: input.siteId ?? primarySiteFor(s?.clinicianId), start: new Date(start).toISOString(), end: new Date(end).toISOString(), createdById: actor.staffId, createdAt: new Date().toISOString() };
  shifts.push(row);
  AdelanteEHR._emit();
  return { ...row };
}

export function removeOnCallShift(actor: Actor, shiftId: string, reason: string): { shiftId: string } {
  assertManager(actor);
  needReason(reason);
  const i = shifts.findIndex((s) => s.id === shiftId);
  if (i < 0) throw new Error("Shift not found.");
  shifts.splice(i, 1);
  AdelanteEHR._emit();
  return { shiftId };
}

/** The on-call clinician at an instant: first covering shift whose person is still active and licensed. */
export function onCallAt(at: Date = new Date()): StaffMember | undefined {
  const t = +at;
  for (const s of listOnCallShifts()) {
    if (Date.parse(s.start) <= t && t < Date.parse(s.end)) {
      const m = getStaffMember(s.staffId);
      if (canCarryOnCall(m)) return m;
    }
  }
  return undefined;
}

/** Test helper. */
export function _resetOnCall() { shifts.length = 0; }

registerOnCallLookup(onCallAt);
registerOnCallSiteLookup((staffId, siteId, at) => canCarryOnCall(getStaffMember(staffId)) && shifts.some(s => s.staffId === staffId && s.siteId === siteId && Date.parse(s.start) <= +at && +at < Date.parse(s.end)));
