import { afterEach, describe, expect, it, vi } from "vitest";

// Browser triage Part 5 (Mitch, 31 Oct): Rosa's late-cancel demo visit lands
// later TODAY on c1 (s-th1) through the real booking + cancel path when c1
// has a bookable slot left; otherwise the original tomorrow visit is kept.
async function seedAt(iso: string) {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
  const { AdelanteEHR } = await import("@/lib/ehr");
  await import("@/lib/demoInboxSeed");
  const { scheduleSegments } = await import("@/lib/clinicianWorkspace");
  const { onCareTeam } = await import("@/lib/chartAccess");
  const rosa = AdelanteEHR.listPatients().find((p) => p.firstName === "Rosa")!;
  const late = AdelanteEHR.appointmentsForPatient(rosa.id).filter((a) => a.status === "late_cancel" || a.cancellation?.lateCancel);
  return { AdelanteEHR, rosa, late, scheduleSegments, onCareTeam };
}

afterEach(() => vi.useRealTimers());

describe("Part 5 late-cancel demo visit", () => {
  it("on a c1 working day it is booked later today on c1, late-cancelled and in Today/closed, patient off-team", async () => {
    // Wednesday 4 Nov 2026, 09:30 Pacific (c1 works Wed 09:00–17:00 virtual).
    const { AdelanteEHR, rosa, late, scheduleSegments, onCareTeam } = await seedAt("2026-11-04T17:30:00.000Z");
    const v = late.find((a) => a.clinicianId === "c1" && new Date(a.start).toDateString() === new Date().toDateString());
    expect(v).toBeDefined();
    expect(+new Date(v!.start)).toBeGreaterThan(Date.now());
    expect(v!.cancellation?.lateCancel).toBe(true);
    expect(scheduleSegments(AdelanteEHR.appointmentsForClinician("c1")).closed.map((a) => a.id)).toContain(v!.id);
    expect(onCareTeam("s-th1", AdelanteEHR.getPatient(rosa.id)!)).toBe(false);
  });

  it("with no c1 slot left today (Sunday) the original tomorrow-morning visit is kept and nothing lands today", async () => {
    const { late } = await seedAt("2026-11-01T17:30:00.000Z");
    expect(late.some((a) => new Date(a.start).toDateString() === new Date().toDateString())).toBe(false);
    expect(late.length).toBeGreaterThan(0);
  });
});
