import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { AdelanteEHRExt } from "@/lib/ehr-ext";
import {
  _resetWorkingCalendars, addSiteClosedDay, addTimeOff, addWorkingDays, createSiteCalendarFromDefaults, defaultSiteId, holidaysForYear,
  isSiteWorkingDay, isWorkingDay, listCalendarChanges, listRescheduleItems, observed, saveStaffHours, siteClosedDay, sitesFor, timeOffView,
} from "@/lib/workingCalendar";
import { authorOutItems, noteClock, noteOnTimeRate, standardNoteDue } from "@/lib/noteClock";
import { availableSlots } from "@/lib/clinicianAvailability";
import { saveSite, listOrganizations } from "@/lib/providerReference";
import { runAction } from "@/lib/actions/runAction";
import { calendarSync } from "@/lib/vendors/calendarSync";
import { facilityDateKey } from "@/lib/facilityTime";
import { workspaceActionRows } from "@/lib/clinicianWorkspace";

const NOW = "2026-11-20T17:00:00.000Z"; // Fri Nov 20 2026, 9 AM Pacific
const ADMIN = { role: "sys_admin" as const, staffId: "s-admin1" };
const COORD = { role: "clinical_coordinator" as const, staffId: "s-cc1" };
const MARISOL = { role: "therapist" as const, staffId: "s-th1", clinicianId: "c1" };
const PEER = { role: "peer_specialist" as const, staffId: "s-peer2" };
const V = () => defaultSiteId()!;

beforeAll(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(NOW)); _resetWorkingCalendars(); });
afterAll(() => vi.useRealTimers());
afterEach(() => {
  for (const id of ["c1", "c3"]) for (const e of AdelanteEHRExt.availabilityExceptionsForClinician(id)) if (e.timeOffType) AdelanteEHRExt.removeAvailabilityException(e.id);
  _resetWorkingCalendars();
});
const patient = () => AdelanteEHR.listPatients()[0]!;
const note = (date: string, extra: Record<string, unknown> = {}) =>
  AdelanteEHR.addProgressNote(patient().id, { clinicianId: "c1", date, sessionType: "individual", subjective: "", objective: "", assessment: "", plan: "", ...extra } as never) as { id: string; date: string; clinicianId: string };

describe("holiday list (Draft — Premier to confirm)", () => {
  it("includes federal holidays, Cesar Chavez Day and the day after Thanksgiving", () => {
    const h = holidaysForYear(2026).map((x) => `${x.date} ${x.name}`);
    expect(h).toContain("2026-11-26 Thanksgiving Day");
    expect(h).toContain("2026-11-27 Day after Thanksgiving");
    expect(h).toContain("2026-03-31 Cesar Chavez Day");
    expect(h.length).toBe(13);
  });
  it("weekend holidays shift: Saturday → Friday, Sunday → Monday", () => {
    expect(observed("2026-07-04")).toBe("2026-07-03"); // Sat
    expect(observed("2027-07-04")).toBe("2027-07-05"); // Sun
    expect(holidaysForYear(2027).find((x) => x.name === "Christmas Day")!.date).toBe("2027-12-24");
    expect(holidaysForYear(2027).find((x) => x.name === "Juneteenth")!.date).toBe("2027-06-18");
  });
});

describe("one working-day service", () => {
  it("holiday next to a weekend: Fri day-after-Thanksgiving + weekend are all skipped", () => {
    expect(isSiteWorkingDay(V(), "2026-11-27")).toBe(false);
    expect(addWorkingDays("2026-11-25", 1, { siteId: V() })).toBe("2026-11-30");
  });
  it("two sites with different holidays; a new site copies the org defaults", () => {
    const org = listOrganizations()[0]!;
    const s2 = saveSite(ADMIN, { orgId: org.id, name: "Second site (test)", address: "x", county: "Kings", dmcCertNumber: "", dmcCertExpires: "", calomsProviderNumber: "", datarProviderId: "", npiType2: "", mediCalProviderNumber: "", programsOffered: [] });
    createSiteCalendarFromDefaults(ADMIN, { siteId: s2.id, reason: "test" });
    expect(siteClosedDay(s2.id, "2026-11-26")?.name).toBe("Thanksgiving Day");
    addSiteClosedDay(ADMIN, { siteId: s2.id, date: "2026-12-08", name: "County holiday", reason: "Kings local" });
    expect(isSiteWorkingDay(s2.id, "2026-12-08")).toBe(false);
    expect(isSiteWorkingDay(V(), "2026-12-08")).toBe(true);
    // Clinician working at two sites: Tuesday hours at the second site.
    saveStaffHours(COORD, { clinicianId: "c3", weekday: 2, start: "09:00", end: "12:00", modality: "in_person", siteId: s2.id, careTypes: [], reason: "test" });
    expect(sitesFor("c3")).toEqual(expect.arrayContaining([V(), s2.id]));
    expect(isWorkingDay("2026-12-08", { ownerId: "c3", siteId: s2.id })).toBe(false);
    expect(isWorkingDay("2026-12-08", { ownerId: "c3", siteId: V() })).toBe(true);
    // Visalia hours that day stay bookable.
    expect(availableSlots("c3", { days: 21 }).some((s) => facilityDateKey(new Date(s)) === "2026-12-08")).toBe(true);
  });
});

describe("note signing clock", () => {
  it("Thanksgiving: visit Wed Nov 25 at Premier Visalia is due Wed Dec 2", () => {
    const n = note("2026-11-25T18:00:00.000Z");
    expect(facilityDateKey(standardNoteDue(n))).toBe("2026-12-02");
    expect(noteClock(n).tooltip).toMatch(/skips clinic holidays and your time off \(Draft\)/);
  });
  it("author time off pauses the clock and raises 'Author out' for the coordinator", () => {
    const n = note("2026-11-25T18:00:00.000Z");
    addTimeOff(MARISOL, { ownerId: "c1", start: "2026-11-30", end: "2026-12-01", type: "vacation" });
    expect(facilityDateKey(standardNoteDue(n))).toBe("2026-12-04");
    const items = authorOutItems(AdelanteEHR.listPatients());
    expect(items.find((i) => i.authorId === "c1")).toBeTruthy();
    const rows = workspaceActionRows({ actor: { ...COORD, staffName: "Priya Raman" } as never, needsClosing: [] });
    expect(rows.some((r) => r.kind === "author_out" && r.label.startsWith("Author out — notes waiting"))).toBe(true);
    expect(rows.find((r) => r.kind === "author_out")!.label).not.toMatch(/vacation|sick|training/i);
  });
  it("crisis notes keep the 24-hour calendar clock over holidays and time off", () => {
    addTimeOff(MARISOL, { ownerId: "c1", start: "2026-11-25", end: "2026-11-27", type: "sick" });
    const n = note("2026-11-25T18:00:00.000Z", { serviceType: "crisis_intervention" });
    const c = noteClock(n);
    expect(c.kind).toBe("crisis");
    expect(c.dueAt).toBe("2026-11-26T18:00:00.000Z");
  });
  it("calendar changes recalculate open notes only; signed history keeps its deadline", () => {
    const open = note("2026-11-18T18:00:00.000Z");
    const signed = { ...note("2026-11-18T18:00:00.000Z"), signedAt: "2026-11-19T20:00:00.000Z" };
    const before = standardNoteDue(signed, signed.signedAt).toISOString();
    addTimeOff(MARISOL, { ownerId: "c1", start: "2026-11-23", end: "2026-11-23", type: "training" });
    expect(standardNoteDue(signed, signed.signedAt).toISOString()).toBe(before);
    expect(standardNoteDue(open).toISOString()).not.toBe(before);
  });
  it("on-time rate is cohort-guarded at 11", () => {
    expect(noteOnTimeRate([]).rate).toBeNull();
    expect(noteOnTimeRate([]).minimumCohortSize).toBe(11);
  });
});

describe("booking follows the calendars", () => {
  it("no slots on closed days, during time off, or outside hours", () => {
    addTimeOff(MARISOL, { ownerId: "c1", start: "2026-11-30", type: "vacation" });
    const days = new Set(availableSlots("c1", { days: 14 }).map((s) => facilityDateKey(new Date(s))));
    expect(days.has("2026-11-27")).toBe(false); // day after Thanksgiving (Fri block)
    expect(days.has("2026-11-30")).toBe(false); // time off (Mon block)
    expect(days.has("2026-12-01")).toBe(false); // Tue — no hours
    expect(days.has("2026-12-02")).toBe(true);
    expect(isWorkingDay("2026-11-30", { ownerId: "c1" })).toBe(false);
  });
  it("closing a day with booked visits creates 'Reschedule needed' — no cancel", () => {
    const slot = availableSlots("c1", { days: 14 }).find((s) => facilityDateKey(new Date(s)) === "2026-12-04")!;
    const appt = AdelanteEHR.bookAppointment({ patientId: patient().id, clinicianId: "c1", start: slot, durationMin: 50, serviceType: "therapy_individual", modality: "in_person", locationId: "loc-visalia", bookedBy: { id: "s-cc1", role: "clinical_coordinator" } } as never) as { id: string };
    const r = addSiteClosedDay(ADMIN, { siteId: V(), date: "2026-12-04", name: "Emergency closure", reason: "Power outage" });
    expect(r.reschedule.map((x) => x.apptId)).toContain(appt.id);
    expect(listRescheduleItems().some((x) => x.apptId === appt.id)).toBe(true);
    expect(AdelanteEHR.listAppointments().find((a) => a.id === appt.id)!.status).not.toMatch(/cancel/);
  });
});

describe("privacy, role gates and audit", () => {
  it("time-off type is hidden from other staff", () => {
    addTimeOff(MARISOL, { ownerId: "c1", start: "2026-12-07", type: "sick" });
    expect(timeOffView(PEER, "c1")[0]!.label).toBe("Out");
    expect(timeOffView(MARISOL, "c1")[0]!.label).toBe("Sick");
    expect(timeOffView(COORD, "c1")[0]!.label).toBe("Sick");
  });
  it("only sys_admin edits site calendars; staff enter only their own time off; all audited with a reason", () => {
    expect(runAction("calendar_site_closed_add", COORD, undefined, { args: [COORD, { siteId: V(), date: "2026-12-09", name: "x", reason: "y" }] }).ok).toBe(false);
    expect(() => addSiteClosedDay(ADMIN, { siteId: V(), date: "2026-12-09", name: "Training day", reason: "" })).toThrow(/reason/);
    const ok = runAction("calendar_site_closed_add", ADMIN, undefined, { args: [ADMIN, { siteId: V(), date: "2026-12-09", name: "Training day", reason: "All-staff training" }] });
    expect(ok.ok).toBe(true);
    expect(listCalendarChanges()[0]).toMatchObject({ kind: "site_closed_day_added", reason: "All-staff training" });
    const peer = runAction("calendar_time_off_add", PEER, undefined, { args: [PEER, { ownerId: "c1", start: "2026-12-10", type: "vacation" }] });
    expect(peer.ok).toBe(false);
    const own = runAction("calendar_time_off_add", MARISOL, undefined, { args: [MARISOL, { ownerId: "c1", start: "2026-12-10", type: "sick" }] });
    expect(own.ok).toBe(true);
    expect(JSON.stringify(AdelanteEHR.listAuditEvents({}).slice(-3))).not.toMatch(/sick/i);
  });
  it("calendar sync is Simulated", () => {
    expect(calendarSync.sync({ provider: "google", externalCalendarId: "cal-1" }).simulated).toBe(true);
    const r = runAction("calendar_sync_run", COORD, undefined, { args: [{ provider: "m365", externalCalendarId: "cal-2" }] });
    expect(r.ok && r.event.detail).toMatchObject({ simulated: true });
  });
});
