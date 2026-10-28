import { afterEach, describe, expect, it } from "vitest";
import { AdelanteEHR } from "../ehr";
import { canAccess, setActingStaff } from "../roles";
import { _resetChartAccessForTests, chartEntryFor, openChartWithReason } from "../chartAccess";
import { _resetChartRelationships, saveAdditionalTeamAssignment } from "../chartRelationships";

afterEach(() => { _resetChartAccessForTests(); _resetChartRelationships(); });
describe("28 Oct Part 2 direct versus reasoned entry — Draft pending counsel", () => {
  it("physician matrix read survives direct assignment; a reason-only open does not unlock it", () => {
    setActingStaff("s-np1", "physician");
    const p = AdelanteEHR.listPatients().find(p => !chartEntryFor("physician", "s-np1", p.id).ok);
    if (!p) throw new Error("Off-team physician fixture required");
    const actor = { role: "physician" as const, staffId: "s-np1" };
    openChartWithReason({ actor, patientId: p.id, reasonCode: "crisis_safety" });
    expect(canAccess("physician", "screeners_sud", p).locked).toBe(true);
    saveAdditionalTeamAssignment({ role: "clinical_coordinator", staffId: "s-cc1" }, { staffId: "s-np1", patientId: p.id, start: "2026-01-01T00:00:00Z" });
    expect(canAccess("physician", "screeners_sud", p)).toEqual({ level: "read", locked: false });
    expect(canAccess("physician", "psychotherapy_notes", p).level).toBe("none");
  });
});