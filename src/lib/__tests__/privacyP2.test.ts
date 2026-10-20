import { afterEach, describe, expect, it, vi } from "vitest";
import { AdelanteEHR, type Patient } from "@/lib/ehr";
import { STAFF_ROLES, STAFF_ROSTER, canAccess } from "@/lib/roles";
import { chartEntryFor, listRestrictedOpenItems, _resetChartAccessForTests } from "@/lib/chartAccess";
import { runAction } from "@/lib/actions/runAction";
import { listDisclosureLog } from "@/lib/part2Disclosure";
import { COORDINATOR_SUD_ITEMS, coordinatorSudCanRead, coordinatorNoteCanRead, coordinatorEmergencyFor, validateCoordinatorEmergency, _resetCoordinatorEmergencyForTests } from "@/lib/coordinatorSudAccess";
import { coordinatorSudView } from "@/lib/coordinatorSudView";

const coord = { role: "clinical_coordinator" as const, staffId: "p2-actor" };
const first = () => {
  const p = AdelanteEHR.listPatients()[0];
  if (!p) throw new Error("Expected a real demo record.");
  return p;
};
const patient = (consent?: "tpo" | "specific_written", release?: boolean): Patient => ({ ...first(), sudCoordinationConsent: consent, sudCounselingNotesRelease: release });
afterEach(() => { vi.useRealTimers(); _resetCoordinatorEmergencyForTests(); _resetChartAccessForTests(); });

describe("Privacy P2 — minimum-necessary consent and release", () => {
  it.each(["tpo", "specific_written"] as const)("%s permits exactly each B item", (consent) => {
    for (const item of COORDINATOR_SUD_ITEMS) expect(coordinatorSudCanRead(coord, patient(consent), item)).toBe(true);
    expect(coordinatorSudCanRead(coord, patient(consent), "counseling_notes")).toBe(false);
    expect(canAccess(coord.role, "screeners_sud", patient(consent)).level).toBe("none");
    expect(canAccess(coord.role, "group_notes", patient(consent))).toEqual(canAccess(coord.role, "group_notes", patient()));
    expect(coordinatorNoteCanRead(coord, patient(consent), { category: "group" })).toBe(false);
  });
  it("no consent hides all B items", () => {
    for (const item of COORDINATOR_SUD_ITEMS) expect(coordinatorSudCanRead(coord, patient(), item)).toBe(false);
    const view = coordinatorSudView(patient(), coord);
    expect(Object.values(view).every((rows) => rows.length === 0)).toBe(true);
  });
  it("counseling is blocked without its separate release, and allowed with it", () => {
    const n = { restrictedTier: "psychotherapy_notes" as const };
    expect(coordinatorNoteCanRead(coord, patient("tpo"), n)).toBe(false);
    expect(coordinatorNoteCanRead(coord, patient("specific_written", false), n)).toBe(false);
    expect(coordinatorNoteCanRead(coord, patient(undefined, true), n)).toBe(true);
    expect(canAccess(coord.role, "psychotherapy_notes", patient(undefined, true)).level).toBe("read");
  });
  it("never opens group narrative or ordinary non-SUD notes", () => {
    expect(coordinatorNoteCanRead(coord, patient("tpo"), { category: "group" })).toBe(false);
    expect(coordinatorNoteCanRead(coord, patient("tpo"), { category: "medical" })).toBe(false);
    expect(coordinatorNoteCanRead(coord, patient("tpo"), { category: "sud" })).toBe(true);
  });
  it("other roles get no new item-policy or counseling grant", () => {
    const before = STAFF_ROLES.map(({ key }) => [key, canAccess(key, "screeners_sud", patient()).level, canAccess(key, "psychotherapy_notes", patient()).level]);
    const after = STAFF_ROLES.map(({ key }) => [key, canAccess(key, "screeners_sud", patient("tpo", true)).level, canAccess(key, "psychotherapy_notes", patient("tpo", true)).level]);
    expect(after.filter((row, i) => JSON.stringify(row) !== JSON.stringify(before[i])).map((row) => row[0])).toEqual(["clinical_coordinator"]);
    for (const { key } of STAFF_ROLES.filter((r) => r.key !== "clinical_coordinator")) {
      expect(coordinatorSudCanRead({ role: key }, patient("tpo", true), "diagnoses")).toBe(false);
    }
  });
});

describe("Privacy P2 — required emergency evidence and four-hour scope", () => {
  it("requires an allowed pick and free-text detail", () => {
    expect(() => validateCoordinatorEmergency({ reason: "other", detail: "Evidence" })).toThrow();
    expect(() => validateCoordinatorEmergency({ reason: "medical_emergency", detail: " " })).toThrow();
    expect(() => validateCoordinatorEmergency({ reason: "medical_emergency", detail: "Evidence" })).not.toThrow();
  });
  it.each(["audit_evaluation", "court_order"])("%s requires a reference", (reason) => {
    expect(() => validateCoordinatorEmergency({ reason, detail: "Evidence" })).toThrow();
    expect(() => validateCoordinatorEmergency({ reason, detail: "Evidence", reference: "REF-1" })).not.toThrow();
  });
  it("registry unlock writes exactly one audit, disclosure review and medical follow-up; expires at four hours", () => {
    const staff = STAFF_ROSTER.find((s) => s.role === "clinical_coordinator");
    if (!staff) throw new Error("Coordinator fixture missing.");
    const p = AdelanteEHR.listPatients().find((p) => chartEntryFor(staff.role, staff.id, p.id).ok);
    if (!p) throw new Error("Site-eligible patient fixture missing.");
    const actor = { role: staff.role, staffId: staff.id, name: staff.name };
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-20T02:00:00Z"));
    const count = AdelanteEHR.listAuditEvents().length;
    const result = runAction("coordinator_emergency_unlock", { ...actor, staffName: staff.name }, p, { args: [{ patientId: p.id, actor, reason: "medical_emergency", detail: "Immediate intervention required" }] });
    expect(result.ok).toBe(true);
    expect(AdelanteEHR.listAuditEvents().length - count).toBe(1);
    const entry = listDisclosureLog({ patientId: p.id, emergencyOnly: true })[0];
    expect(entry.emergencyReason).toBe("medical_emergency");
    expect(entry.complianceReview).toBe("pending");
    expect(entry.accessEnd).toBe("2026-10-20T06:00:00.000Z");
    expect(listRestrictedOpenItems().some((i) => i.disclosureId === entry.id && i.medicalFollowUp)).toBe(true);
    const noConsent = { ...p, sudCoordinationConsent: undefined, sudCounselingNotesRelease: false };
    expect(coordinatorSudCanRead(actor, noConsent, "diagnoses")).toBe(true);
    expect(coordinatorSudCanRead(actor, noConsent, "counseling_notes")).toBe(false);
    expect(coordinatorSudCanRead({ ...actor, staffId: "different" }, noConsent, "diagnoses")).toBe(false);
    expect(coordinatorEmergencyFor(actor, "another-patient")).toBeUndefined();
    vi.advanceTimersByTime(4 * 60 * 60 * 1000 - 1);
    expect(coordinatorSudCanRead(actor, noConsent, "diagnoses")).toBe(true);
    vi.advanceTimersByTime(1);
    expect(coordinatorEmergencyFor(actor, p.id)).toBeUndefined();
    expect(coordinatorSudCanRead(actor, noConsent, "diagnoses")).toBe(false);
  });
});