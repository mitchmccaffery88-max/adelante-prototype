import { describe, expect, it } from "vitest";
import { addBusinessDays, businessDaysBetween, isCrisisNote, noteClock, overdueCrisisNotes } from "@/lib/noteClock";
import { AdelanteEHR, resolveCrisisOwner } from "@/lib/ehr";
import { STAFF_ROSTER } from "@/lib/roles";


const local = (y: number, m: number, d: number, h = 10) => new Date(y, m - 1, d, h);

describe("C3 business-day math", () => {
  it("skips weekends when adding", () => {
    // Thu 2026-10-01 + 3 business days = Tue 2026-10-06
    expect(addBusinessDays(local(2026, 10, 1), 3).getDate()).toBe(6);
    // Fri + 1 = Mon
    expect(addBusinessDays(local(2026, 10, 2), 1).getDay()).toBe(1);
    // Sat + 1 = Mon
    expect(addBusinessDays(local(2026, 10, 3), 1).getDate()).toBe(5);
  });
  it("counts business days between across a weekend", () => {
    expect(businessDaysBetween(local(2026, 10, 2), local(2026, 10, 5))).toBe(1);
    expect(businessDaysBetween(local(2026, 10, 5), local(2026, 10, 5))).toBe(0);
  });
  it("labels due in N / due today / overdue", () => {
    const n = { date: local(2026, 10, 1).toISOString() };
    expect(noteClock(n, local(2026, 10, 2)).label).toBe("Due in 2 business days");
    expect(noteClock(n, local(2026, 10, 5)).label).toBe("Due in 1 business day");
    expect(noteClock(n, local(2026, 10, 6, 15)).label).toBe("Due today");
    expect(noteClock(n, local(2026, 10, 7)).state).toBe("overdue");
    expect(noteClock(n, local(2026, 10, 2)).draftLabel).toMatch(/Draft — pending clinical sign-off/);
  });
});

describe("C3 crisis notes", () => {
  it("detects by escalation link or crisis-intervention service type", () => {
    expect(isCrisisNote({ crisisEscalationId: "e1" })).toBe(true);
    expect(isCrisisNote({ serviceType: "crisis_intervention" })).toBe(true);
    expect(isCrisisNote({})).toBe(false);
  });
  it("uses a 1-calendar-day clock, even over a weekend", () => {
    const n = { date: local(2026, 10, 2, 10).toISOString(), serviceType: "crisis_intervention" as const };
    expect(noteClock(n, local(2026, 10, 3, 9)).kind).toBe("crisis");
    expect(noteClock(n, local(2026, 10, 3, 9)).state).toBe("due_today");
    expect(noteClock(n, local(2026, 10, 3, 11)).state).toBe("overdue");
  });
  it("overdue crisis drafts are listed for the coordinator pool", () => {
    const p = AdelanteEHR.listPatients()[0];
    AdelanteEHR.addProgressNote(p.id, { clinicianId: "c1", date: new Date(Date.now() - 3 * 86400000).toISOString(), sessionType: "individual", subjective: "", objective: "", assessment: "", plan: "", serviceType: "crisis_intervention" });
    expect(overdueCrisisNotes(AdelanteEHR.listPatients()).some((r) => r.patient.id === p.id)).toBe(true);
  });
});

describe("C4 crisis named owner", () => {
  const withClinician = () => AdelanteEHR.listPatients().find((p) => p.primaryClinicianId && STAFF_ROSTER.some((m) => m.clinicianId === p.primaryClinicianId))!;
  it("clinical crisis goes to the primary clinician", () => {
    const p = withClinician();
    const e = AdelanteEHR.flagCrisis(p.id, "Tester", "test clinical crisis");
    expect(e.ownerLane).toBe("named");
    expect(STAFF_ROSTER.find((m) => m.id === e.ownerStaffId)?.clinicianId).toBe(p.primaryClinicianId);
  });
  it("social-needs crisis goes to the care manager, else the pool", () => {
    const p = AdelanteEHR.listPatients().find((x) => x.caseManagerId && STAFF_ROSTER.some((m) => m.caseManagerId === x.caseManagerId));
    if (p) expect(resolveCrisisOwner(p, "sdoh")?.caseManagerId).toBe(p.caseManagerId);
    const none = { ...withClinician(), caseManagerId: undefined };
    expect(resolveCrisisOwner(none, "sdoh")).toBeUndefined();
  });
  it("inactive owner falls back to the pool", () => {
    const p = withClinician();
    const m = STAFF_ROSTER.find((x) => x.clinicianId === p.primaryClinicianId)!;
    const prev = m.active;
    m.active = false;
    try {
      expect(resolveCrisisOwner(p, "clinical")).toBeUndefined();
      const e = AdelanteEHR.flagCrisis(p.id, "Tester", "inactive owner test");
      expect(e.ownerLane).toBe("pool");
    } finally { m.active = prev; }
  });
  it("handoff needs owner or coordinator, requires a reason and is audited", () => {
    const p = withClinician();
    const e = AdelanteEHR.flagCrisis(p.id, "Tester", "handoff test");
    const firstOwner = e.ownerStaffId!;
    const other = STAFF_ROSTER.find((m) => m.id !== e.ownerStaffId && m.role === "therapist")!;
    expect(() => AdelanteEHR.handOffCrisisEscalation(p.id, e.id, { toStaffId: other.id, reason: "x", byStaffId: e.ownerStaffId!, byName: "Owner", byRole: "therapist" })).toThrow(/reason/);
    expect(() => AdelanteEHR.handOffCrisisEscalation(p.id, e.id, { toStaffId: other.id, reason: "going on leave", byStaffId: "nobody", byName: "X", byRole: "therapist" })).toThrow(/owner or a clinical coordinator/);
    const r = AdelanteEHR.handOffCrisisEscalation(p.id, e.id, { toStaffId: other.id, reason: "going on leave", byStaffId: firstOwner, byName: "Owner", byRole: "therapist" });
    expect(r.ownerStaffId).toBe(other.id);
    expect(AdelanteEHR.listAuditEvents({}).some((a: any) => a.action === "crisis_owner_handoff" && a.detail?.escalationId === e.id && a.detail?.reason === "going on leave")).toBe(true);
    const r2 = AdelanteEHR.handOffCrisisEscalation(p.id, e.id, { toStaffId: firstOwner, reason: "coordinator reassign", byStaffId: "coord", byName: "Coord", byRole: "clinical_coordinator" });
    expect(r2.handoffs?.length).toBe(2);
  });
  it("owner notification is Part 2-neutral", () => {
    const p = withClinician();
    const e = AdelanteEHR.flagCrisis(p.id, "Tester", "opioid relapse detail");
    const n = AdelanteEHR.listNotifications?.().find((x: any) => x.dedupeKey === `crisis-owner:${e.id}:${e.ownerStaffId}`);
    if (n) expect(`${n.subject} ${n.body}`).not.toMatch(/opioid|relapse/i);
  });
});
