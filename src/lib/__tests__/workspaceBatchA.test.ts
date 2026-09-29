import { describe, expect, it } from "vitest";
import { AdelanteEHR, refillNeedsCures } from "@/lib/ehr";
import { AdelanteEHRExt } from "@/lib/ehr-ext";
import { getStaffMember } from "@/lib/roles";
import { bucketWorkspaceVisits, canViewAs, resolveWorkspaceActor, viewAsOptions } from "@/lib/workspaceIdentity";
import { demoBusinessTime, demoLocalHour, demoLocalDayAt } from "@/lib/demoTime";
import { requiresCuresCheck } from "@/lib/orderSafety";

const actor = (id: string) => {
  const m = getStaffMember(id)!;
  return { role: m.role, staffId: m.id, staffName: m.name, clinicianId: m.clinicianId, caseManagerId: m.caseManagerId };
};
const reyes = { name: "Marisol Reyes", role: "therapist" as const, id: "s-th1" };
const clin = () => AdelanteEHR.listClinicians().find((c) => AdelanteEHR.canBook(c.id).ok)!;
const book = (pid: string, hoursFromNow: number) => {
  const d = new Date(Date.now() + hoursFromNow * 3600000);
  d.setMinutes(Math.floor(Math.random() * 59), 0, 0);
  return AdelanteEHR.bookAppointment({ patientId: pid, clinicianId: clin().id, start: d.toISOString(), durationMin: 30, serviceType: "therapy_individual", modality: "video", allowPatientOverlap: true });
};

describe("workspace identity", () => {
  it("a clinician sees only their own workspace and has no View-as picker", () => {
    const anita = actor("s-th3");
    expect(viewAsOptions(anita)).toHaveLength(0);
    const ws = resolveWorkspaceActor(anita, "s-th1");
    expect(ws.staffId).toBe("s-th3");
    expect(ws.clinicianId).toBe("c3");
    expect(ws.viewingAs).toBe(false);
  });
  it("a coordinator can View as a clinician; every widget reads that one person", () => {
    const priya = actor("s-cc1");
    expect(canViewAs(priya, "s-th1")).toBe(true);
    const ws = resolveWorkspaceActor(priya, "s-th1");
    expect(ws).toMatchObject({ staffId: "s-th1", staffName: "Marisol Reyes", viewingAs: true });
    AdelanteEHR.recordWorkspaceViewAs({ id: priya.staffId, name: priya.staffName, role: priya.role }, { id: ws.staffId, name: ws.staffName });
    expect(AdelanteEHR.listAuditEvents().some((e) => e.action === "workspace_view_as")).toBe(true);
  });
});

describe("today and needs closing", () => {
  it("today is local midnight to midnight; past open visits go to Needs closing", () => {
    const now = new Date(2026, 8, 29, 12, 0).getTime();
    const at = (d: number, h: number) => new Date(2026, 8, 29 + d, h).toISOString();
    const rows = [
      { id: "old-open", start: at(-2, 10), durationMin: 30, status: "scheduled" },
      { id: "old-noted", start: at(-2, 11), durationMin: 30, status: "attended" },
      { id: "old-unnoted", start: at(-1, 11), durationMin: 30, status: "attended" },
      { id: "today-later", start: at(0, 15), durationMin: 30, status: "scheduled" },
      { id: "tomorrow", start: at(1, 9), durationMin: 30, status: "scheduled" },
    ];
    const b = bucketWorkspaceVisits(rows, (a) => a.id === "old-noted", now);
    expect(b.today.map((a) => a.id)).toEqual(["today-later"]);
    expect(b.needsClosing.map((a) => a.id)).toEqual(["old-open", "old-unnoted"]);
    expect(b.week.map((a) => a.id)).toContain("tomorrow");
  });
  it("seeded demo visit times land in 8 AM–6 PM Pacific", () => {
    for (const a of AdelanteEHR.listAppointments()) {
      const h = demoLocalHour(a.start);
      expect(h).toBeGreaterThanOrEqual(8);
      expect(h + a.durationMin / 60).toBeLessThanOrEqual(18.01);
    }
    expect(demoLocalHour(demoBusinessTime(demoLocalDayAt(0, 2)))).toBe(9);
  });
});

describe("visit statuses", () => {
  it("check in then attended, through the store with role check and audit", () => {
    const a = book("p1", 0.01);
    expect(() => AdelanteEHR.checkInAppointment(a.id, { name: "x", role: "billing" })).toThrow();
    AdelanteEHR.checkInAppointment(a.id, reyes, +new Date(a.start));
    expect(a.status).toBe("checked_in");
    expect(() => AdelanteEHRExt.upsertClaimFromEncounter(a.id)).toThrow();
    expect(() => AdelanteEHR.markAppointmentAttended(a.id, { name: "x", role: "billing" })).toThrow();
    AdelanteEHR.markAppointmentAttended(a.id, reyes);
    expect(a.status).toBe("attended");
    const log = AdelanteEHR.listAuditEvents();
    expect(log.some((e) => e.action === "appointment_checked_in")).toBe(true);
    expect(log.some((e) => e.action === "appointment_attended")).toBe(true);
  });
  it("a cancel inside 24h is recorded as late_cancel and cannot bill", () => {
    const a = book("p1", 5);
    AdelanteEHR.staffCancelAppointment(a.id, { reason: "clinician_unavailable", actor: reyes });
    expect(a.status).toBe("late_cancel");
    expect(() => AdelanteEHRExt.upsertClaimFromEncounter(a.id)).toThrow();
  });
  it("reschedule marks the old visit and links to the new one; old can't bill", () => {
    const a = book("p1", 24 * 6);
    const n = AdelanteEHR.staffRescheduleAppointment(a.id, new Date(Date.now() + 24 * 8 * 3600000).toISOString(), reyes);
    expect(a.status).toBe("rescheduled");
    expect(a.rescheduledToId).toBe(n.id);
    expect(n.rescheduledFromId).toBe(a.id);
    expect(n.status).toBe("scheduled");
    expect(() => AdelanteEHRExt.upsertClaimFromEncounter(a.id)).toThrow();
  });
});

describe("CURES only for controlled substances", () => {
  it("naltrexone/acamprosate/disulfiram don't need CURES; buprenorphine and benzos do", () => {
    for (const n of ["Naltrexone", "Acamprosate", "Disulfiram"]) expect(refillNeedsCures({ medicationName: n })).toBe(false);
    expect(refillNeedsCures({ medicationName: "Buprenorphine-naloxone" })).toBe(true);
    expect(requiresCuresCheck({ drugName: "Clonazepam 0.5 MG" })).toBe(true);
  });
});
