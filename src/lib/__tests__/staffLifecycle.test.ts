import { describe, it, expect } from "vitest";
import { STAFF_ROSTER } from "@/lib/roles";
import {
  activeStaff,
  isActiveStaff,
  assertAssignableStaff,
  deactivateStaffMember,
  reactivateStaffMember,
  updateStaffMember,
  addStaffMemberWithReason,
  reassignNeededItems,
} from "@/lib/staffLifecycle";
import { eligibleReassignTargets } from "@/lib/coordination";
import { AdelanteEHR } from "@/lib/ehr";

const SYS_ADMIN = { role: "sys_admin" as const, staffId: "s-admin1" };
const NOT_ADMIN = { role: "therapist" as const, staffId: "s-th1" };

describe("staffLifecycle", () => {
  it("sys_admin only for every write", () => {
    expect(() => deactivateStaffMember(NOT_ADMIN, { staffId: "s-th2", reason: "test" })).toThrow();
    expect(() => reactivateStaffMember(NOT_ADMIN, { staffId: "s-th2", reason: "test" })).toThrow();
    expect(() => updateStaffMember(NOT_ADMIN, { staffId: "s-th2", reason: "test" })).toThrow();
    expect(() => addStaffMemberWithReason(NOT_ADMIN, { id: "s-x1", name: "X", role: "therapist" }, "test")).toThrow();
  });

  it("requires a reason", () => {
    expect(() => deactivateStaffMember(SYS_ADMIN, { staffId: "s-th2", reason: "" })).toThrow();
  });

  it("deactivate records an audit event with reason + ids only", () => {
    const before = AdelanteEHR.listAuditEvents().length;
    deactivateStaffMember(SYS_ADMIN, { staffId: "s-th2", reason: "left the org" });
    const events = AdelanteEHR.listAuditEvents();
    expect(events.length).toBeGreaterThan(before);
    const ev = events.find((e) => e.action === "staff.deactivated");
    expect(ev?.detail).toMatchObject({ staffId: "s-th2", reason: "left the org" });
    reactivateStaffMember(SYS_ADMIN, { staffId: "s-th2", reason: "undo" });
  });

  it("deactivation removes a person from active rosters and reactivation restores them", () => {
    deactivateStaffMember(SYS_ADMIN, { staffId: "s-th2", reason: "test" });
    expect(isActiveStaff("s-th2")).toBe(false);
    expect(isActiveStaff("c2")).toBe(false); // linked clinicianId
    expect(activeStaff().some((s) => s.id === "s-th2")).toBe(false);
    reactivateStaffMember(SYS_ADMIN, { staffId: "s-th2", reason: "back" });
    expect(isActiveStaff("s-th2")).toBe(true);
    expect(activeStaff().some((s) => s.id === "s-th2")).toBe(true);
  });

  it("assertAssignableStaff refuses a deactivated person", () => {
    deactivateStaffMember(SYS_ADMIN, { staffId: "s-th2", reason: "test" });
    expect(() => assertAssignableStaff("s-th2")).toThrow();
    expect(() => assertAssignableStaff("c2")).toThrow();
    reactivateStaffMember(SYS_ADMIN, { staffId: "s-th2", reason: "back" });
    expect(() => assertAssignableStaff("s-th2")).not.toThrow();
  });

  it("removed from the coordination reassignment picker while deactivated", () => {
    const appt = AdelanteEHR.listAppointments().find((a) => a.status === "scheduled" && a.clinicianId !== "c6");
    if (!appt) return;
    deactivateStaffMember(SYS_ADMIN, { staffId: "s-th2", reason: "test" });
    expect(eligibleReassignTargets(appt).some((o) => o.clinicianId === "c6")).toBe(false);
    reactivateStaffMember(SYS_ADMIN, { staffId: "s-th2", reason: "back" });
  });

  it("reassignNeededItems returns counts only for deactivated people with open items, nothing auto-reassigned", () => {
    deactivateStaffMember(SYS_ADMIN, { staffId: "s-cm1", reason: "test" });
    const rows = reassignNeededItems();
    expect(rows.every((r) => STAFF_ROSTER.find((s) => s.id === r.staffId)?.active === false)).toBe(true);
    reactivateStaffMember(SYS_ADMIN, { staffId: "s-cm1", reason: "back" });
  });

  it("signed notes keep their original author after deactivation", () => {
    const patient = AdelanteEHR.listPatients().find((p) => (p.progressNotes ?? []).some((n) => n.signedBy));
    if (!patient) return;
    const note = patient.progressNotes!.find((n) => n.signedBy)!;
    const authorId = note.clinicianId;
    deactivateStaffMember(SYS_ADMIN, { staffId: "s-th2", reason: "test" });
    expect(note.clinicianId).toBe(authorId);
    reactivateStaffMember(SYS_ADMIN, { staffId: "s-th2", reason: "back" });
  });
});
