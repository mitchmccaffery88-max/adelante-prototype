// §P1 — the "outside standard hours" booking warning reads the SITE's clock
// (Premier Visalia, Pacific) and the clinician's hours at that site, never the
// device's zone. The device here is pinned to America/Chicago.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { SchedulingConstraints } from "@/lib/scheduling";
import "@/lib/clinicianAvailability"; // seeds demo weekly hours
import { fitsStaffHours, siteForLocation } from "@/lib/workingCalendar";

const prevTz = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "America/Chicago";
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-20T17:00:00.000Z"));
});
afterAll(() => {
  vi.useRealTimers();
  process.env.TZ = prevTz;
});

// c7 works Mondays 09:00–16:00 at Visalia (demo seed). Mon Nov 23 2026, PST = UTC-8.
const at = (pt: string) => `2026-11-23T${pt}:00.000-08:00`;
const outside = (start: string) =>
  SchedulingConstraints.evaluate({
    clinicianId: "c7", start, durationMin: 30, serviceType: "therapy_individual", modality: "in_person", locationId: "loc-visalia",
  }).warnings.some((w) => w.code === "outside_availability_window");

describe("booking warning follows the site clock", () => {
  it("device really is in Chicago", () => {
    expect(new Date(at("15:00")).getHours()).toBe(17);
  });
  it("3:00 PM Pacific (5 PM Chicago) is inside the clinician's 9–4 Pacific hours — no warning", () => {
    expect(outside(at("15:00"))).toBe(false);
  });
  it("8:30 AM Pacific (10:30 AM Chicago) is before the clinician's hours — warns", () => {
    expect(outside(at("08:30"))).toBe(true);
  });
  it("uses the clinician's hours AT that site", () => {
    const site = siteForLocation("loc-visalia");
    expect(fitsStaffHours(new Date(at("09:00")), 60, { ownerId: "c7", siteId: site })).toEqual({ hasHours: true, fits: true });
    expect(fitsStaffHours(new Date(at("15:30")), 60, { ownerId: "c7", siteId: site }).fits).toBe(false);
  });
});
