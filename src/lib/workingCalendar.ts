// §Calendars L1–L3 — the ONE working-day service.
//
// Location calendars (per provider-reference Site: time zone, weekly open
// hours, closed days) plus each staff member's own calendar, which EXTENDS the
// Batch G availability model in ehr-ext (weekly AvailabilityBlocks carry the
// site; AvailabilityExceptions of kind "off" are time off with a type and a
// date range). No other code counts Mon–Fri on its own.
//
// History rule: every closed day / time-off row carries addedAt (and
// removedAt when withdrawn). Signed or closed work reads the calendar "as of"
// its own close time, so a later calendar change only moves OPEN items.
//
// In-memory like the rest of the prototype; server-side calendars are in
// docs/sculptsoft-calendar-handoff.md.
import { AdelanteEHR, isVisitCancelled, type Appointment } from "./ehr";
import { AdelanteEHRExt, ehrBus, type AvailabilityBlock, type AvailabilityException, type TimeOffType } from "./ehr-ext";
import { DEFAULT_FACILITY_TZ, facilityDateKey, fromFacilityWallClock, toFacilityParts } from "./facilityTime";
import { listSites, type Site } from "./providerReference";
import { getStaffMember, STAFF_ROSTER, type StaffRole } from "./roles";

export const HOLIDAY_DRAFT_LABEL = "Draft — Premier to confirm";
export const WORKING_DAY_DRAFT_LABEL = "Draft — pending clinical sign-off";
export const NOTE_CLOCK_TOOLTIP = (n: number) => `Due in ${n} working day${n === 1 ? "" : "s"} — skips clinic holidays and your time off (Draft)`;

export type ClosedDayKind = "holiday" | "closure";
export interface ClosedDay {
  id: string;
  date: string; // YYYY-MM-DD, facility-local
  name: string;
  /** Spanish name for patient-facing display (holidays only; Draft). */
  nameEs?: string;
  kind: ClosedDayKind;
  reason: string;
  draft?: boolean;
  addedAt: string;
  removedAt?: string;
}
export interface OpenHours {
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  start: string;
  end: string;
}
export interface SiteCalendar {
  siteId: string;
  timezone: string;
  openHours: OpenHours[];
  closedDays: ClosedDay[];
  /** Clinic locations (ehr ClinicLocation ids) that belong to this site. */
  locationIds: string[];
  /** §L7 — for a future Google / Microsoft 365 sync (Simulated now). */
  externalCalendarId?: string;
}
export interface DefaultHoliday {
  date: string;
  name: string;
  nameEs: string;
}
export interface CalendarChange {
  id: string;
  at: string;
  actorRole: StaffRole;
  actorId?: string;
  kind: string;
  target: string;
  reason: string;
}
export interface RescheduleItem {
  id: string;
  apptId: string;
  patientId: string;
  clinicianId: string;
  start: string;
  cause: "site_closed" | "staff_out";
  createdAt: string;
  status: "open" | "done";
  doneAt?: string;
}

// ---------------------------------------------------------------------------
// Holidays (US federal + Cesar Chavez Day + day after Thanksgiving), weekend
// observance: Saturday → Friday, Sunday → Monday. Draft — Premier to confirm.
// ---------------------------------------------------------------------------
const pad = (n: number) => String(n).padStart(2, "0");
const key = (y: number, m: number, d: number) => {
  const t = new Date(Date.UTC(y, m - 1, d));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
};
const keyDate = (k: string) => new Date(`${k}T12:00:00Z`);
const weekdayOf = (k: string) => keyDate(k).getUTCDay();
export function shiftKey(k: string, days: number): string {
  const t = keyDate(k);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}
function nthWeekday(y: number, m: number, weekday: number, n: number): string {
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  return key(y, m, 1 + ((weekday - first + 7) % 7) + (n - 1) * 7);
}
function lastWeekday(y: number, m: number, weekday: number): string {
  const lastDay = new Date(Date.UTC(y, m, 0));
  const back = (lastDay.getUTCDay() - weekday + 7) % 7;
  return key(y, m, lastDay.getUTCDate() - back);
}
/** Saturday → Friday, Sunday → Monday. */
export function observed(k: string): string {
  const w = weekdayOf(k);
  return w === 6 ? shiftKey(k, -1) : w === 0 ? shiftKey(k, 1) : k;
}

export function holidaysForYear(y: number): DefaultHoliday[] {
  const thanksgiving = nthWeekday(y, 11, 4, 4);
  const fixed: [string, string, string][] = [
    [key(y, 1, 1), "New Year's Day", "Año Nuevo"],
    [key(y, 3, 31), "Cesar Chavez Day", "Día de César Chávez"],
    [key(y, 6, 19), "Juneteenth", "Juneteenth"],
    [key(y, 7, 4), "Independence Day", "Día de la Independencia"],
    [key(y, 11, 11), "Veterans Day", "Día de los Veteranos"],
    [key(y, 12, 25), "Christmas Day", "Navidad"],
  ];
  const floating: [string, string, string][] = [
    [nthWeekday(y, 1, 1, 3), "Martin Luther King Jr. Day", "Día de Martin Luther King Jr."],
    [nthWeekday(y, 2, 1, 3), "Presidents' Day", "Día de los Presidentes"],
    [lastWeekday(y, 5, 1), "Memorial Day", "Día de los Caídos"],
    [nthWeekday(y, 9, 1, 1), "Labor Day", "Día del Trabajo"],
    [nthWeekday(y, 10, 1, 2), "Columbus Day / Indigenous Peoples' Day", "Día de los Pueblos Indígenas"],
    [thanksgiving, "Thanksgiving Day", "Día de Acción de Gracias"],
    [shiftKey(thanksgiving, 1), "Day after Thanksgiving", "Día después de Acción de Gracias"],
  ];
  return [...fixed.map(([d, n, e]) => ({ date: observed(d), name: n, nameEs: e })), ...floating.map(([date, name, nameEs]) => ({ date, name, nameEs }))].sort((a, b) => a.date.localeCompare(b.date));
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
const calendars = new Map<string, SiteCalendar>();
let orgDefaults: DefaultHoliday[] = [];
const changes: CalendarChange[] = [];
const reschedules: RescheduleItem[] = [];
const staffExternalIds = new Map<string, string>();
let seq = 0;
const nid = (p: string) => `${p}-${++seq}-${Math.random().toString(36).slice(2, 6)}`;
const nowIso = () => new Date().toISOString();
let calVersion = 0;
function changed(ownerId = "calendar") {
  calVersion++;
  ehrBus.publish({ type: "availability.updated", clinicianId: ownerId });
}
export const calendarVersion = () => calVersion;

export const SITE_CALENDAR_EDIT_ROLES: readonly StaffRole[] = ["sys_admin"];
export const SITE_CALENDAR_READ_ROLES: readonly StaffRole[] = ["sys_admin", "clinical_coordinator"];
export const STAFF_CALENDAR_MANAGER_ROLES: readonly StaffRole[] = ["clinical_coordinator", "sys_admin"];
export const canEditSiteCalendar = (r: StaffRole) => SITE_CALENDAR_EDIT_ROLES.includes(r);
export const canReadSiteCalendar = (r: StaffRole) => SITE_CALENDAR_READ_ROLES.includes(r);
export const canManageStaffCalendars = (r: StaffRole) => STAFF_CALENDAR_MANAGER_ROLES.includes(r);

export interface CalendarActor {
  role: StaffRole;
  staffId?: string;
  clinicianId?: string;
}

function log(actor: CalendarActor, kind: string, target: string, reason: string) {
  const row: CalendarChange = { id: nid("calchg"), at: nowIso(), actorRole: actor.role, actorId: actor.staffId, kind, target, reason };
  changes.unshift(row);
  // Store-level audit. Never the time-off type (sick stays private).
  AdelanteEHR.recordActionEvent({ action: `calendar.${kind}`, actorRole: actor.role, actorId: actor.staffId, detail: { target, reason, at: row.at } });
}
export const listCalendarChanges = () => changes.slice();

/** Org-level default holiday list a new site copies, then edits. */
export function orgDefaultHolidays(): DefaultHoliday[] {
  return orgDefaults.slice();
}
function buildDefaults(now = new Date()) {
  const y = now.getUTCFullYear();
  orgDefaults = [y - 1, y, y + 1, y + 2].flatMap(holidaysForYear);
}

/** Creates the site's calendar from the org default list (idempotent). */
export function ensureSiteCalendar(siteId: string, opts: { locationIds?: string[]; timezone?: string } = {}): SiteCalendar {
  const existing = calendars.get(siteId);
  if (existing) return existing;
  if (!orgDefaults.length) buildDefaults();
  const cal: SiteCalendar = {
    siteId,
    timezone: opts.timezone ?? DEFAULT_FACILITY_TZ,
    openHours: ([1, 2, 3, 4, 5] as const).map((weekday) => ({ weekday, start: "08:00", end: "17:00" })),
    closedDays: orgDefaults.map((h) => ({ id: nid("cd"), date: h.date, name: h.name, nameEs: h.nameEs, kind: "holiday" as const, reason: "Org default holiday list", draft: true, addedAt: "1970-01-01T00:00:00.000Z" })),
    locationIds: opts.locationIds ?? [],
  };
  calendars.set(siteId, cal);
  return cal;
}
export function getSiteCalendar(siteId: string): SiteCalendar | undefined {
  return calendars.get(siteId);
}
export function listSiteCalendars(): { site: Site; calendar?: SiteCalendar }[] {
  return listSites().map((site) => ({ site, calendar: calendars.get(site.id) }));
}
/** The org's first site — fallback for unmapped locations / staff without hours. */
export function defaultSiteId(): string | undefined {
  return listSites()[0]?.id;
}
export function siteForLocation(locationId?: string): string | undefined {
  if (!locationId) return undefined;
  for (const [id, c] of calendars) if (c.locationIds.includes(locationId)) return id;
  return undefined;
}
export function siteForBlock(b: Pick<AvailabilityBlock, "siteId" | "locationId">): string | undefined {
  return b.siteId ?? siteForLocation(b.locationId) ?? defaultSiteId();
}
export function siteForAppointment(a: Pick<Appointment, "locationId" | "clinicianId">): string | undefined {
  return siteForLocation(a.locationId) ?? primarySiteFor(a.clinicianId);
}
export function siteName(siteId?: string): string {
  return listSites().find((s) => s.id === siteId)?.name ?? "Clinic";
}

const live = (asOf?: string) => (r: { addedAt?: string; removedAt?: string }) => {
  if (!asOf) return !r.removedAt;
  if (r.addedAt && r.addedAt > asOf) return false;
  return !r.removedAt || r.removedAt > asOf;
};

// ---------------------------------------------------------------------------
// L3 — the one service
// ---------------------------------------------------------------------------
export function siteTimezone(siteId?: string): string {
  return (siteId && calendars.get(siteId)?.timezone) || DEFAULT_FACILITY_TZ;
}
/** Closed-day row for a site on a facility-local date, if any. */
export function siteClosedDay(siteId: string | undefined, dateKey: string, asOf?: string): ClosedDay | undefined {
  const cal = siteId ? calendars.get(siteId) : undefined;
  return cal?.closedDays.filter(live(asOf)).find((d) => d.date === dateKey);
}
/** Is the site open that day (weekly hours, not a closed day)? */
export function isSiteWorkingDay(siteId: string | undefined, dateKey: string, asOf?: string): boolean {
  const cal = siteId ? calendars.get(siteId) : undefined;
  const wd = weekdayOf(dateKey);
  if (!cal) return wd !== 0 && wd !== 6;
  if (!cal.openHours.some((h) => h.weekday === wd)) return false;
  return !siteClosedDay(siteId, dateKey, asOf);
}
export function isSiteWorkingHour(siteId: string | undefined, instant: Date): boolean {
  const tz = siteTimezone(siteId);
  const dk = facilityDateKey(instant, tz);
  if (!isSiteWorkingDay(siteId, dk)) return false;
  const cal = siteId ? calendars.get(siteId) : undefined;
  const p = toFacilityParts(instant, tz);
  const m = p.hour * 60 + p.minute;
  const hours = cal ? cal.openHours.filter((h) => h.weekday === weekdayOf(dk)) : [{ start: "08:00", end: "17:00" }];
  return hours.some((h) => m >= toMin(h.start) && m < toMin(h.end));
}
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Calendar owner id for a staff member: their clinician id, else the staff id. */
export function calendarOwnerFor(staffId?: string): string | undefined {
  if (!staffId) return undefined;
  const m = getStaffMember(staffId);
  return m?.clinicianId ?? staffId;
}
/** Staff member for a calendar owner id (reverse of calendarOwnerFor). */
export function staffForOwner(ownerId: string) {
  return STAFF_ROSTER.find((s) => s.clinicianId === ownerId) ?? getStaffMember(ownerId);
}
/** Sites a person works at (from their weekly hours). */
export function sitesFor(ownerId: string): string[] {
  const ids = AdelanteEHRExt.availabilityBlocksForClinician(ownerId).map((b) => siteForBlock(b)).filter((x): x is string => !!x);
  return [...new Set(ids)];
}
/** The site whose calendar governs a person's working days (most hours; else the org default). */
export function primarySiteFor(ownerId?: string): string | undefined {
  if (!ownerId) return defaultSiteId();
  const blocks = AdelanteEHRExt.availabilityBlocksForClinician(ownerId);
  const minutes = new Map<string, number>();
  for (const b of blocks) {
    const s = siteForBlock(b);
    if (s) minutes.set(s, (minutes.get(s) ?? 0) + toMin(b.end) - toMin(b.start));
  }
  const best = [...minutes.entries()].sort((a, b) => b[1] - a[1])[0];
  return best?.[0] ?? defaultSiteId();
}

const offRows = (ownerId: string, asOf?: string): AvailabilityException[] =>
  (asOf ? AdelanteEHRExt.allAvailabilityExceptionsForClinician(ownerId) : AdelanteEHRExt.availabilityExceptionsForClinician(ownerId)).filter((e) => e.kind === "off").filter(live(asOf));
/** The person's time-off row covering a date, if any (type is private — see timeOffView). */
export function staffTimeOffOn(ownerId: string | undefined, dateKey: string, asOf?: string): AvailabilityException | undefined {
  if (!ownerId) return undefined;
  return offRows(ownerId, asOf).find((e) => e.date <= dateKey && (e.endDate ?? e.date) >= dateKey);
}

export interface WorkingOpts {
  siteId?: string;
  ownerId?: string;
  asOf?: string;
}
/**
 * Is this a working day — for a site, or for a person at a site? A person's
 * working day = their site is open AND they are not on time off. (Weekly hours
 * decide bookable slots, not the note clock.)
 */
export function isWorkingDay(dateKey: string, opts: WorkingOpts = {}): boolean {
  const siteId = opts.siteId ?? primarySiteFor(opts.ownerId);
  if (!isSiteWorkingDay(siteId, dateKey, opts.asOf)) return false;
  return !staffTimeOffOn(opts.ownerId, dateKey, opts.asOf);
}
/** Is a person working at this instant: working day + inside their own hours at that site. */
export function isWorkingHour(instant: Date, opts: { ownerId: string; siteId?: string }): boolean {
  const tz = siteTimezone(opts.siteId ?? primarySiteFor(opts.ownerId));
  const dk = facilityDateKey(instant, tz);
  const wd = weekdayOf(dk);
  const p = toFacilityParts(instant, tz);
  const m = p.hour * 60 + p.minute;
  return AdelanteEHRExt.availabilityBlocksForClinician(opts.ownerId).some((b) => {
    const s = siteForBlock(b);
    if (opts.siteId && s !== opts.siteId) return false;
    return b.weekday === wd && m >= toMin(b.start) && m < toMin(b.end) && isWorkingDay(dk, { siteId: s, ownerId: opts.ownerId });
  });
}
/** Add N working days after `fromKey` (the from-day itself never counts). */
export function addWorkingDays(fromKey: string, n: number, opts: WorkingOpts = {}): string {
  let d = fromKey;
  let left = n;
  let guard = 0;
  while (left > 0 && guard++ < 730) {
    d = shiftKey(d, 1);
    if (isWorkingDay(d, opts)) left--;
  }
  return d;
}
/** Working days strictly after fromKey up to and including toKey. */
export function workingDaysBetween(fromKey: string, toKey: string, opts: WorkingOpts = {}): number {
  let n = 0;
  let d = fromKey;
  let guard = 0;
  while (d < toKey && guard++ < 730) {
    d = shiftKey(d, 1);
    if (isWorkingDay(d, opts)) n++;
  }
  return n;
}
/** Facility-local end of a date (23:59:59.999). */
export function endOfDateKey(dateKey: string, tz?: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(+fromFacilityWallClock({ year: y, month: m, day: d + 1 }, tz) - 1);
}
export function nextClosedDays(siteId: string, count = 3, from = new Date()): ClosedDay[] {
  const today = facilityDateKey(from, siteTimezone(siteId));
  return (calendars.get(siteId)?.closedDays ?? []).filter(live()).filter((d) => d.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, count);
}

// ---------------------------------------------------------------------------
// Time-off visibility (L2): type visible only to the person and managers.
// ---------------------------------------------------------------------------
export const TIME_OFF_LABEL: Record<TimeOffType, string> = { vacation: "Vacation", sick: "Sick", training: "Training" };
export function canSeeTimeOffType(viewer: CalendarActor, ownerId: string): boolean {
  return canManageStaffCalendars(viewer.role) || calendarOwnerFor(viewer.staffId) === ownerId;
}
export interface TimeOffView {
  id: string;
  date: string;
  endDate: string;
  label: string;
  note?: string;
}
export function timeOffView(viewer: CalendarActor, ownerId: string): TimeOffView[] {
  const full = canSeeTimeOffType(viewer, ownerId);
  return offRows(ownerId).map((e) => ({
    id: e.id,
    date: e.date,
    endDate: e.endDate ?? e.date,
    label: full ? (e.timeOffType ? TIME_OFF_LABEL[e.timeOffType] : "Time off") : "Out",
    ...(full && e.note ? { note: e.note } : {}),
  }));
}
/** "Out" / "Available" only — what any staff member may see about another. */
export function availabilityStatus(ownerId: string, dateKey: string): "Out" | "Available" {
  return isWorkingDay(dateKey, { ownerId }) ? "Available" : "Out";
}

// ---------------------------------------------------------------------------
// Mutations (registry + runAction only — see chartActions "calendar_*")
// ---------------------------------------------------------------------------
const needReason = (r?: string) => {
  if (!r || !r.trim()) throw new Error("A reason is required.");
  return r.trim();
};
const dateOk = (d: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error("Pick a date.");
  return d;
};
function assertSiteEdit(actor: CalendarActor) {
  if (!canEditSiteCalendar(actor.role)) throw new Error("Only a system administrator can change a location calendar.");
}
function assertStaffEdit(actor: CalendarActor, ownerId: string, what: "hours" | "time_off") {
  if (canManageStaffCalendars(actor.role)) return;
  const self = calendarOwnerFor(actor.staffId) === ownerId || actor.clinicianId === ownerId;
  if (self) return;
  throw new Error(what === "time_off" ? "You can enter time off only on your own calendar." : "You can change only your own hours.");
}

export function saveSiteHours(actor: CalendarActor, input: { siteId: string; openHours: OpenHours[]; timezone?: string; reason: string }): SiteCalendar {
  assertSiteEdit(actor);
  const reason = needReason(input.reason);
  const cal = ensureSiteCalendar(input.siteId);
  cal.openHours = input.openHours.map((h) => ({ ...h }));
  if (input.timezone) cal.timezone = input.timezone;
  log(actor, "site_hours_saved", input.siteId, reason);
  changed();
  return cal;
}
export function addSiteClosedDay(actor: CalendarActor, input: { siteId: string; date: string; name: string; kind?: ClosedDayKind; reason: string }): { closedDay: ClosedDay; reschedule: RescheduleItem[] } {
  assertSiteEdit(actor);
  const reason = needReason(input.reason);
  const date = dateOk(input.date);
  if (!input.name.trim()) throw new Error("Name the closed day.");
  const cal = ensureSiteCalendar(input.siteId);
  if (cal.closedDays.some((d) => d.date === date && !d.removedAt)) throw new Error("That day is already closed.");
  const closedDay: ClosedDay = { id: nid("cd"), date, name: input.name.trim(), kind: input.kind ?? "closure", reason, addedAt: nowIso() };
  cal.closedDays.push(closedDay);
  log(actor, "site_closed_day_added", `${input.siteId}:${date}`, reason);
  const reschedule = flagBookedVisits({ siteId: input.siteId, from: date, to: date, cause: "site_closed" });
  changed();
  return { closedDay, reschedule };
}
export function removeSiteClosedDay(actor: CalendarActor, input: { siteId: string; closedDayId: string; reason: string }): ClosedDay {
  assertSiteEdit(actor);
  const reason = needReason(input.reason);
  const d = calendars.get(input.siteId)?.closedDays.find((x) => x.id === input.closedDayId && !x.removedAt);
  if (!d) throw new Error("Closed day not found.");
  d.removedAt = nowIso();
  log(actor, "site_closed_day_removed", `${input.siteId}:${d.date}`, reason);
  changed();
  return d;
}
/** New site: copy the org default holiday list, then edit. */
export function createSiteCalendarFromDefaults(actor: CalendarActor, input: { siteId: string; locationIds?: string[]; timezone?: string; reason: string }): SiteCalendar {
  assertSiteEdit(actor);
  const reason = needReason(input.reason);
  if (calendars.has(input.siteId)) throw new Error("This site already has a calendar.");
  const cal = ensureSiteCalendar(input.siteId, input);
  log(actor, "site_calendar_created", input.siteId, reason);
  changed();
  return cal;
}

export function saveStaffHours(actor: CalendarActor, input: Omit<AvailabilityBlock, "id"> & { id?: string; reason: string }): void {
  assertStaffEdit(actor, input.clinicianId, "hours");
  const reason = needReason(input.reason);
  const { reason: _r, ...block } = input;
  void _r;
  AdelanteEHRExt.upsertAvailabilityBlock(block);
  log(actor, "staff_hours_saved", input.clinicianId, reason);
  changed(input.clinicianId);
}
export function removeStaffHours(actor: CalendarActor, input: { ownerId: string; blockId: string; reason: string }): void {
  assertStaffEdit(actor, input.ownerId, "hours");
  const reason = needReason(input.reason);
  AdelanteEHRExt.removeAvailabilityBlock(input.blockId);
  log(actor, "staff_hours_removed", input.ownerId, reason);
  changed(input.ownerId);
}
export function addTimeOff(actor: CalendarActor, input: { ownerId: string; start: string; end?: string; type: TimeOffType; note?: string; reason?: string }): { timeOff: AvailabilityException; reschedule: RescheduleItem[] } {
  assertStaffEdit(actor, input.ownerId, "time_off");
  const start = dateOk(input.start);
  const end = dateOk(input.end || input.start);
  if (end < start) throw new Error("The last day can't be before the first day.");
  if (!["vacation", "sick", "training"].includes(input.type)) throw new Error("Pick a type.");
  const timeOff = AdelanteEHRExt.addAvailabilityException({ clinicianId: input.ownerId, date: start, endDate: end, kind: "off", timeOffType: input.type, note: input.note?.trim() || undefined }) as AvailabilityException;
  // Audit never carries the type.
  log(actor, "time_off_added", input.ownerId, input.reason?.trim() || "Time off entered");
  const reschedule = flagBookedVisits({ ownerId: input.ownerId, from: start, to: end, cause: "staff_out" });
  changed(input.ownerId);
  return { timeOff, reschedule };
}
export function removeTimeOff(actor: CalendarActor, input: { ownerId: string; timeOffId: string; reason?: string }): void {
  assertStaffEdit(actor, input.ownerId, "time_off");
  AdelanteEHRExt.removeAvailabilityException(input.timeOffId);
  log(actor, "time_off_removed", input.ownerId, input.reason?.trim() || "Time off withdrawn");
  changed(input.ownerId);
}
export function setExternalCalendarId(actor: CalendarActor, input: { scope: "site" | "staff"; id: string; externalCalendarId: string; reason: string }): void {
  const reason = needReason(input.reason);
  if (input.scope === "site") {
    assertSiteEdit(actor);
    ensureSiteCalendar(input.id).externalCalendarId = input.externalCalendarId.trim() || undefined;
  } else {
    assertStaffEdit(actor, input.id, "hours");
    if (input.externalCalendarId.trim()) staffExternalIds.set(input.id, input.externalCalendarId.trim());
    else staffExternalIds.delete(input.id);
  }
  log(actor, "external_calendar_id_set", `${input.scope}:${input.id}`, reason);
  changed();
}
export const staffExternalCalendarId = (ownerId: string) => staffExternalIds.get(ownerId);

// ---------------------------------------------------------------------------
// L5 — booked visits hit by a new closed day / time off → "Reschedule needed"
// for the coordinator. Never auto-cancels, never notifies the patient.
// ---------------------------------------------------------------------------
const OPEN_VISIT = (a: Appointment) => !isVisitCancelled(a.status) && a.status !== "attended" && a.status !== "no_show";
function flagBookedVisits(input: { siteId?: string; ownerId?: string; from: string; to: string; cause: RescheduleItem["cause"] }): RescheduleItem[] {
  const out: RescheduleItem[] = [];
  const now = Date.now();
  for (const a of AdelanteEHR.listAppointments()) {
    if (!OPEN_VISIT(a) || +new Date(a.start) < now) continue;
    if (input.ownerId && a.clinicianId !== input.ownerId) continue;
    const site = siteForAppointment(a);
    if (input.siteId && site !== input.siteId) continue;
    const dk = facilityDateKey(new Date(a.start), siteTimezone(site));
    if (dk < input.from || dk > input.to) continue;
    if (reschedules.some((r) => r.apptId === a.id && r.status === "open")) continue;
    const item: RescheduleItem = { id: nid("resched"), apptId: a.id, patientId: a.patientId, clinicianId: a.clinicianId, start: a.start, cause: input.cause, createdAt: nowIso(), status: "open" };
    reschedules.push(item);
    out.push(item);
  }
  return out;
}
export function listRescheduleItems(status: RescheduleItem["status"] | "all" = "open"): RescheduleItem[] {
  return reschedules.filter((r) => status === "all" || r.status === status);
}
export function markRescheduleHandled(actor: CalendarActor, input: { itemId: string; reason?: string }): RescheduleItem {
  if (!canManageStaffCalendars(actor.role)) throw new Error("Only a coordinator can close a reschedule item.");
  const r = reschedules.find((x) => x.id === input.itemId && x.status === "open");
  if (!r) throw new Error("Item not found.");
  r.status = "done";
  r.doneAt = nowIso();
  log(actor, "reschedule_item_done", r.id, input.reason?.trim() || "Handled");
  changed();
  return r;
}

// ---------------------------------------------------------------------------
// Team view (L8): who's out this week, by site — "Out" only for non-managers.
// ---------------------------------------------------------------------------
export function weekKeys(from = new Date(), tz = DEFAULT_FACILITY_TZ): string[] {
  const today = facilityDateKey(from, tz);
  const monday = shiftKey(today, -((weekdayOf(today) + 6) % 7));
  return [0, 1, 2, 3, 4].map((i) => shiftKey(monday, i));
}
export function teamOutThisWeek(viewer: CalendarActor, from = new Date()) {
  const days = weekKeys(from);
  const owners = new Set<string>();
  for (const s of STAFF_ROSTER) owners.add(s.clinicianId ?? s.id);
  const bySite = new Map<string, { ownerId: string; name: string; days: { date: string; out: boolean; label?: string }[] }[]>();
  for (const ownerId of owners) {
    const views = timeOffView(viewer, ownerId);
    const rowDays = days.map((date) => {
      const v = views.find((t) => t.date <= date && t.endDate >= date);
      return { date, out: !!v, label: v?.label };
    });
    if (!rowDays.some((d) => d.out)) continue;
    const site = primarySiteFor(ownerId) ?? "none";
    const list = bySite.get(site) ?? [];
    list.push({ ownerId, name: staffForOwner(ownerId)?.name ?? AdelanteEHR.getClinician(ownerId)?.name ?? ownerId, days: rowDays });
    bySite.set(site, list);
  }
  return { days, bySite: [...bySite.entries()].map(([siteId, people]) => ({ siteId, siteName: siteName(siteId), people })) };
}

// ---------------------------------------------------------------------------
// Seed (real store functions, as sys_admin): Premier Visalia calendar.
// ---------------------------------------------------------------------------
let seeded = false;
export function seedWorkingCalendars(): void {
  if (seeded) return;
  seeded = true;
  buildDefaults();
  const visalia = listSites().find((s) => s.name === "Premier Visalia");
  if (visalia && !calendars.has(visalia.id))
    createSiteCalendarFromDefaults({ role: "sys_admin", staffId: "system" }, { siteId: visalia.id, locationIds: ["loc-visalia"], reason: "Demo seed — Premier Visalia (holidays Draft — Premier to confirm)" });
}
seedWorkingCalendars();

/** Test hook. */
export function _resetWorkingCalendars(): void {
  calendars.clear();
  changes.length = 0;
  reschedules.length = 0;
  staffExternalIds.clear();
  seeded = false;
  seedWorkingCalendars();
}
