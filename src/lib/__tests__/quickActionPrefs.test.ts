// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { CHART_ACTIONS, type ChartActor } from "@/lib/chartActions";
import { AdelanteEHR } from "@/lib/ehr";
import { type StaffMember } from "@/lib/roles";
import { addPersonalAction, personalActionOptions, personalMenuActions, readPersonalActions, sanitizePersonalActions, writePersonalActions } from "@/lib/quickActionPrefs";
import { quickActionsFor } from "@/lib/quickActions";

const member: StaffMember = { id: "pref-test", name: "Test staff", role: "therapist", roleAssignments: [{ role: "therapist" }, { role: "clinical_coordinator" }] };
afterEach(() => localStorage.clear());
it("offers only registry actions permitted for the person's own role assignments", () => {
  const options = personalActionOptions(member);
  expect(options.some((x) => x.action.id === "consent_form_author")).toBe(true);
  expect(options.some((x) => x.action.id === "feature_flag_set")).toBe(false);
  for (const option of options) for (const role of option.roles) {
    expect(member.roleAssignments?.some((a) => a.role === role)).toBe(true);
    expect(option.action.allowed({ role, staffId: member.id }).state).not.toBe("hidden");
  }
});
it("caps personal lists at eight and refuses a ninth choice", () => {
  const ids = personalActionOptions(member).map((x) => x.action.id);
  expect(ids.length).toBeGreaterThan(8);
  expect(sanitizePersonalActions(ids, member)).toHaveLength(8);
  expect(() => addPersonalAction(ids.slice(0, 8), ids[8], member)).toThrow("Choose up to 8");
});
it("reset removes the personal setting and restores the approved role defaults", () => {
  writePersonalActions(member.id, ["consent_form_author"]);
  expect(readPersonalActions(member.id)).toEqual(["consent_form_author"]);
  writePersonalActions(member.id, null);
  expect(readPersonalActions(member.id)).toBeNull();
  expect(quickActionsFor({ role: "therapist", staffId: member.id }).map((a) => a.id)).toEqual(["progress_note", "dashboard_book", "message_patient", "screener_request", "task"]);
});
it("cross-role selections are disabled until the actor uses their permitted role", () => {
  const therapist: ChartActor = { role: "therapist", staffId: member.id };
  const rows = personalMenuActions(["consent_form_author"], member, therapist, []);
  expect(rows).toHaveLength(1);
  expect(rows[0]?.switchRole).toBe("clinical_coordinator");
  expect(rows[0]?.answer.state).toBe("hidden");
  const switched = personalMenuActions(["consent_form_author"], member, { ...therapist, role: "clinical_coordinator" }, ["consent_form_author"]);
  expect(switched[0]?.switchRole).toBeUndefined();
  expect(switched[0]?.answer.state).toBe("allowed");
});
it("stored ids cannot grant permissions or bypass identity and launcher gates", () => {
  expect(sanitizePersonalActions(["feature_flag_set", "missing"], member)).toEqual([]);
  expect(personalMenuActions(["consent_form_author"], member, { role: "sys_admin", staffId: member.id }, ["consent_form_author"])).toEqual([]);
  expect(personalMenuActions(["consent_form_author"], member, { role: "clinical_coordinator", staffId: "someone-else" }, ["consent_form_author"])).toEqual([]);
  expect(personalMenuActions(["consent_form_author"], member, { role: "clinical_coordinator", staffId: member.id }, [])).toEqual([]);
});
it("pending nursing actions cannot be selected even when registry gates permit them", () => {
  const nurse: StaffMember = { id: "pref-nurse", name: "Nurse", role: "nurse_rn" };
  const ids = personalActionOptions(nurse).map((x) => x.action.id);
  expect(ids).not.toContain("clinic_dose_give");
  expect(ids).not.toContain("refill_coordinate");
  expect(() => addPersonalAction([], "clinic_dose_give", nurse)).toThrow();
  expect(() => addPersonalAction([], "refill_coordinate", nurse)).toThrow();
});
it("device saves are per identity and create no audit events", () => {
  const before = AdelanteEHR.listAuditEvents({ category: "action" }).length;
  writePersonalActions(member.id, ["task"]);
  expect(readPersonalActions("someone-else")).toBeNull();
  expect(AdelanteEHR.listAuditEvents({ category: "action" }).length).toBe(before);
  expect(CHART_ACTIONS.find((a) => a.id === "feature_flag_set")?.allowed({ role: "therapist" }).state).toBe("hidden");
});