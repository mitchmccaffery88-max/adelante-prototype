import { describe, it, expect } from "vitest";
import { AdelanteEHR } from "../ehr";
import { dueLabel, myTodayVisits, myPendingRefills, myCaseload, myContactsDue } from "../myWork";
import { ensureCaseloadOwners, seedCaseloadDemo } from "../caseloadReview";

describe("My work start-of-day", () => {
  it("says Due today instead of 0d overdue", () => {
    const now = new Date();
    expect(dueLabel(now.toISOString().slice(0, 10), now)).toBe("Due today");
    expect(dueLabel(new Date(+now - 3 * 86400000).toISOString().slice(0, 10), now)).toBe("3d overdue");
  });
  it("gives prescribers today's visits and their own pending refills", () => {
    const bagga = { staffId: "s-np1", staffName: "Dr. M. Bagga", clinicianId: "c5" };
    const brooks = { staffId: "s-th3", staffName: "Anita Brooks", clinicianId: "c3" };
    // Time-independent: "today" is the day of one of each clinician's own visits.
    const dayOf = (cid: string) => new Date(AdelanteEHR.listAppointments().find((a) => a.clinicianId === cid && a.status !== "cancelled" && a.status !== "no_show")!.start);
    expect(myTodayVisits(bagga, dayOf("c5")).length).toBeGreaterThan(0);
    expect(myTodayVisits(brooks, dayOf("c3")).length).toBeGreaterThan(0);
    const ids = new Set(myCaseload(brooks).map((p) => p.id));
    const r = myPendingRefills({ ...brooks, role: "pmhnp" });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((x) => ids.has(x.patientId))).toBe(true);
    expect(myPendingRefills({ staffId: "s-th1", staffName: "Marisol Reyes", clinicianId: "c1", role: "therapist" })).toHaveLength(0);
  });
  it("uses the caseload-review assignment for Darnell", () => {
    ensureCaseloadOwners();
    seedCaseloadDemo();
    const darnell = { staffId: "s-cf2", staffName: "Darnell Pope (facility contract)" };
    expect(myCaseload(darnell).length).toBeGreaterThan(0);
    expect(Array.isArray(myContactsDue("s-cf2"))).toBe(true);
  });
  it("never duplicates an open provider-switch task", () => {
    const p = AdelanteEHR.listPatients()[0]!;
    const a = AdelanteEHR.createCaseTask({ patientId: p.id, assignedTo: "cm1", title: "Coordinate provider switch: X", dueDate: "2026-01-01", origin: "provider_switch", dedupeKey: "k1" });
    const b = AdelanteEHR.createCaseTask({ patientId: p.id, assignedTo: "cm1", title: "Coordinate provider switch: X", dueDate: "2026-01-01", origin: "provider_switch", dedupeKey: "k2" });
    expect(b?.id).toBe(a?.id);
  });
  it("Rosa's PHQ-9 history ends at the care-plan score", () => {
    const rosa = AdelanteEHR.getPatient("p2")!;
    const phq = (rosa.screenerHistory ?? []).filter((h) => h.key === "phq-9");
    expect(phq.length).toBeGreaterThanOrEqual(2);
    const latest = [...phq].sort((a, b) => +new Date(b.completedAt) - +new Date(a.completedAt))[0]!;
    expect(latest.score).toBe(8);
  });
});
