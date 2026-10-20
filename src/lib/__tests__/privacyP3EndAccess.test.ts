// Privacy P3 — "End access now" for coordinator emergency access.
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { STAFF_ROSTER } from "@/lib/roles";
import { chartEntryFor, listRestrictedOpenItems, _resetChartAccessForTests } from "@/lib/chartAccess";
import { runAction } from "@/lib/actions/runAction";
import { listDisclosureLog } from "@/lib/part2Disclosure";
import { coordinatorEmergencyFor, coordinatorSudCanRead, _resetCoordinatorEmergencyForTests } from "@/lib/coordinatorSudAccess";
import { permissionSnapshot } from "@/lib/actions/permissionMatrix";
import { STAFF_ROLES } from "@/lib/roles";

afterEach(() => { vi.useRealTimers(); _resetCoordinatorEmergencyForTests(); _resetChartAccessForTests(); });

function setup() {
  const staff = STAFF_ROSTER.find((s) => s.role === "clinical_coordinator");
  if (!staff) throw new Error("Coordinator fixture missing.");
  const p = AdelanteEHR.listPatients().find((x) => chartEntryFor(staff.role, staff.id, x.id).ok);
  if (!p) throw new Error("Patient fixture missing.");
  const actor = { role: staff.role, staffId: staff.id, name: staff.name };
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-20T02:00:00Z"));
  const r = runAction("coordinator_emergency_unlock", { ...actor, staffName: staff.name }, p, { args: [{ patientId: p.id, actor, reason: "medical_emergency", detail: "Immediate intervention required" }] });
  if (!r.ok) throw new Error(r.reason);
  return { staff, p, actor, noConsent: { ...p, sudCoordinationConsent: undefined, sudCounselingNotesRelease: false } };
}

describe("Privacy P3 — End access now", () => {
  it("re-locks at once, writes one audit entry and shortens the disclosure end time", () => {
    const { staff, p, actor, noConsent } = setup();
    expect(coordinatorSudCanRead(actor, noConsent, "diagnoses")).toBe(true);
    vi.setSystemTime(new Date("2026-10-20T03:15:00Z"));
    const before = AdelanteEHR.listAuditEvents().length;
    const r = runAction("coordinator_emergency_end", { ...actor, staffName: staff.name }, p, { args: [{ patientId: p.id, actor, note: "Situation resolved" }] });
    expect(r.ok).toBe(true);
    expect(AdelanteEHR.listAuditEvents().length - before).toBe(1);
    const ev = AdelanteEHR.listAuditEvents({ patientId: p.id }).find((e) => e.action === "part2_emergency_ended_early");
    expect(ev?.detail).toMatchObject({ patientId: p.id, end: "2026-10-20T03:15:00.000Z", endedEarly: true, note: "Situation resolved" });
    expect(ev?.actorId).toBe(staff.id);
    expect(coordinatorEmergencyFor(actor, p.id)).toBeUndefined();
    expect(coordinatorSudCanRead(actor, noConsent, "diagnoses")).toBe(false);
    const entry = listDisclosureLog({ patientId: p.id, emergencyOnly: true })[0];
    expect(entry.accessStart).toBe("2026-10-20T02:00:00.000Z");
    expect(entry.accessEnd).toBe("2026-10-20T03:15:00.000Z");
    expect(listRestrictedOpenItems().some((i) => i.disclosureId === entry.id)).toBe(true);
  });

  it("another coordinator cannot end someone else's window", () => {
    const { p, actor, noConsent } = setup();
    const other = STAFF_ROSTER.find((s) => s.role === "clinical_coordinator" && s.id !== actor.staffId);
    const otherActor = { role: "clinical_coordinator" as const, staffId: other?.id ?? "other-coordinator", name: other?.name ?? "Other" };
    const r = runAction("coordinator_emergency_end", { ...otherActor, staffName: otherActor.name }, p, { args: [{ patientId: p.id, actor: otherActor }] });
    expect(r.ok).toBe(false);
    expect(coordinatorSudCanRead(actor, noConsent, "diagnoses")).toBe(true);
  });

  it("counseling notes stay blocked before and after ending", () => {
    const { staff, p, actor, noConsent } = setup();
    expect(coordinatorSudCanRead(actor, noConsent, "counseling_notes")).toBe(false);
    runAction("coordinator_emergency_end", { ...actor, staffName: staff.name }, p, { args: [{ patientId: p.id, actor }] });
    expect(coordinatorSudCanRead(actor, noConsent, "counseling_notes")).toBe(false);
  });

  it("the new action key is hidden for every role in the matrix", () => {
    const snap = permissionSnapshot();
    for (const { key } of STAFF_ROLES) expect(snap[key]?.["coordinator_emergency_end"]).toBe("hidden");
  });
});
