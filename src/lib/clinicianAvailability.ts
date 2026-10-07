// §Batch G2 — the ONE source of bookable times: each clinician's weekly
// availability blocks + dated exceptions (clinician-availability page data,
// AdelanteEHRExt), minus calendar conflicts and past times. Used by the staff
// "Book a visit" drawer and the patient's own booking (G3). No 9–4 grid.
import { AdelanteEHR, type ServiceType } from "./ehr";
import { AdelanteEHRExt, type AvailabilityBlock } from "./ehr-ext";
import { DEFAULT_FACILITY_TZ, fromFacilityWallClock, startOfFacilityDay, toFacilityParts } from "./facilityTime";
import { isWorkingDay, siteForBlock } from "./workingCalendar";

/**
 * Weekly hours are FACILITY wall-clock (America/Los_Angeles), never the
 * device's or server's zone — otherwise a 9:00 block became 9:00 UTC (2 AM
 * Pacific) on the server and for anyone outside Pacific.
 */
export const AVAILABILITY_TZ = DEFAULT_FACILITY_TZ;

export type BookingModality = "video" | "phone" | "in_person";

export const NO_AVAILABILITY_TEXT = "No availability set";
export const NO_AVAILABILITY_NEXT = "Pick another clinician, or ask the clinician / scheduler to add weekly hours on the Availability page.";
export const NO_AVAILABILITY_FOR_TYPE = "No open times for this visit type in the next two weeks";

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const pad = (n: number) => String(n).padStart(2, "0");

function modalityFits(block: AvailabilityBlock["modality"], m?: BookingModality): boolean {
  if (!m) return true;
  if (block === "hybrid") return true;
  if (block === "virtual") return m !== "in_person";
  return m === "in_person";
}

export function hasAvailabilitySet(clinicianId: string): boolean {
  return AdelanteEHRExt.availabilityBlocksForClinician(clinicianId).length > 0 ||
    AdelanteEHRExt.availabilityExceptionsForClinician(clinicianId).some((e) => e.kind === "added");
}

export interface SlotQuery {
  /** Calendar days ahead to scan (default 14). */
  days?: number;
  now?: Date;
  serviceType?: ServiceType;
  modality?: BookingModality;
  /** Slot length in minutes (default 60, i.e. hourly starts). */
  stepMin?: number;
  excludeApptId?: string;
}

/** Open slot starts (ISO) inside the clinician's real availability; conflicts and past times skipped. */
export function availableSlots(clinicianId: string, q: SlotQuery = {}): string[] {
  const now = q.now ?? new Date();
  const days = q.days ?? 14;
  const step = q.stepMin ?? 60;
  const blocks = AdelanteEHRExt.availabilityBlocksForClinician(clinicianId);
  const exceptions = AdelanteEHRExt.availabilityExceptionsForClinician(clinicianId);
  const out: string[] = [];
  const today = toFacilityParts(now, AVAILABILITY_TZ);
  for (let i = 1; i <= days; i++) {
    const noon = new Date(Date.UTC(today.year, today.month - 1, today.day + i, 12));
    const Y = noon.getUTCFullYear(), M = noon.getUTCMonth() + 1, D = noon.getUTCDate();
    const weekday = noon.getUTCDay();
    const date = `${Y}-${pad(M)}-${pad(D)}`;
    // §Calendars L5 — the one working-day service: site closed days and the
    // clinician's time off (date ranges) remove the whole day for that site.
    const windows: { start: number; end: number }[] = [];
    for (const b of blocks) {
      if (b.weekday !== weekday) continue;
      if (!isWorkingDay(date, { siteId: siteForBlock(b), ownerId: clinicianId })) continue;
      if (!modalityFits(b.modality, q.modality)) continue;
      if (q.serviceType && b.careTypes.length && !b.careTypes.includes(q.serviceType)) continue;
      windows.push({ start: toMin(b.start), end: toMin(b.end) });
    }
    if (exceptions.some((e) => e.kind === "off" && e.date <= date && (e.endDate ?? e.date) >= date)) continue;
    for (const e of exceptions) if (e.date === date && e.kind === "added" && e.start && e.end) windows.push({ start: toMin(e.start), end: toMin(e.end) });
    const seen = new Set<number>();
    for (const w of windows) {
      for (let t = w.start; t + step <= w.end; t += step) {
        if (seen.has(t)) continue;
        seen.add(t);
        const s = fromFacilityWallClock({ year: Y, month: M, day: D, hour: Math.floor(t / 60), minute: t % 60 }, AVAILABILITY_TZ);
        if (s.getTime() <= now.getTime()) continue;
        const iso = s.toISOString();
        if (AdelanteEHR.findApptConflict(clinicianId, iso, q.excludeApptId)) continue;
        out.push(iso);
      }
    }
  }
  return out.sort();
}

/** True when `startISO` falls in the clinician's availability (used by the store re-check). */
export function isWithinAvailability(clinicianId: string, startISO: string, q: Omit<SlotQuery, "now" | "days"> = {}): boolean {
  if (!hasAvailabilitySet(clinicianId)) return false;
  const t = new Date(startISO);
  const dayBefore = new Date(+startOfFacilityDay(t, AVAILABILITY_TZ) - 60_000);
  return availableSlots(clinicianId, { ...q, now: dayBefore, days: 1 }).includes(t.toISOString());
}

// Demo seed (real store function): weekly hours for clinicians that had none,
// so every calendar-holding demo clinician is bookable except Owen Tran (c6),
// kept empty to show the "No availability set" state.
let seeded = false;
export function seedDemoAvailability(): void {
  if (seeded) return;
  seeded = true;
  const add = (b: Omit<AvailabilityBlock, "id">) => {
    if (AdelanteEHRExt.availabilityBlocksForClinician(b.clinicianId).some((x) => x.weekday === b.weekday && x.start === b.start)) return;
    AdelanteEHRExt.upsertAvailabilityBlock(b);
  };
  add({ clinicianId: "c4", weekday: 2, start: "09:00", end: "15:00", modality: "hybrid", locationId: "loc-visalia", careTypes: ["therapy_individual", "case_management"] });
  add({ clinicianId: "c4", weekday: 4, start: "09:00", end: "15:00", modality: "virtual", careTypes: ["therapy_individual", "case_management"] });
  add({ clinicianId: "c5", weekday: 3, start: "13:00", end: "17:00", modality: "hybrid", locationId: "loc-visalia", careTypes: ["med_management", "intake"] });
  add({ clinicianId: "c7", weekday: 1, start: "09:00", end: "16:00", modality: "hybrid", locationId: "loc-visalia", careTypes: [] });
  add({ clinicianId: "c7", weekday: 3, start: "09:00", end: "16:00", modality: "hybrid", locationId: "loc-visalia", careTypes: [] });
  add({ clinicianId: "c7", weekday: 5, start: "09:00", end: "12:00", modality: "virtual", careTypes: [] });
  // c1 also sees intake + care coordination on Wednesdays; c2 adds a therapy afternoon; c3 adds med visits.
  add({ clinicianId: "c2", weekday: 3, start: "13:00", end: "17:00", modality: "hybrid", locationId: "loc-visalia", careTypes: ["therapy_individual", "intake"] });
  add({ clinicianId: "c3", weekday: 2, start: "09:00", end: "13:00", modality: "hybrid", locationId: "loc-visalia", careTypes: ["med_management", "intake", "therapy_individual"] });
}
seedDemoAvailability();
