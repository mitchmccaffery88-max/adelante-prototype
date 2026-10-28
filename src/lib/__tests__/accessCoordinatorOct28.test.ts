import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "../ehr";
import { STAFF_ROLES, STAFF_ROSTER } from "../roles";
import { careTeamRequests, weeklyReasonedOpens, chartEntryFor } from "../chartAccess";
import { canManageCoverage, listCoverageAssignments } from "../chartRelationships";
import { runAction } from "../actions/runAction";

describe("coordinator access work uses existing gates", () => {
  it.each(STAFF_ROLES)("$key sees only their allowed access work", ({ key }) => {
    const staff = STAFF_ROSTER.find(s => s.role === key);
    const actor = { role: key, staffId: staff?.id };
    expect(canManageCoverage(actor)).toBe(key === "clinical_coordinator" && !!staff);
    if (key !== "clinical_coordinator") {
      expect(careTeamRequests(actor)).toEqual([]);
      expect(weeklyReasonedOpens(actor)).toEqual([]);
      const before = listCoverageAssignments().length;
      expect(runAction("chart_coverage_set", actor, undefined, { args: [actor, { coveringStaffId: "s-th1", coveredStaffId: "s-th2", start: new Date().toISOString(), end: new Date(Date.now() + 3600000).toISOString() }] }).ok).toBe(false);
      expect(listCoverageAssignments().length).toBe(before);
    }
  });

  it("request readback and coordinator assignment give only the requested team relationship", () => {
    const p = AdelanteEHR.createPatient({ firstName: "Coordinator", lastName: "Request", dob: "1990-01-01" } as Parameters<typeof AdelanteEHR.createPatient>[0]);
    const cm = { role: "ecm_provider" as const, staffId: "s-cf2" };
    const cc = { role: "clinical_coordinator" as const, staffId: "s-cc1" };
    expect(chartEntryFor(cm.role, cm.staffId, p.id).ok).toBe(false);
    expect(runAction("chart_team_request", cm, p, { args: [{ patientId: p.id, actor: cm }] }).ok).toBe(true);
    const request = careTeamRequests(cc).find(r => r.patientId === p.id);
    expect(request?.staffId).toBe(cm.staffId);
    const before = AdelanteEHR.listAuditEvents({}).length;
    expect(runAction("chart_team_assignment", cc, p, { args: [cc, { patientId: p.id, staffId: cm.staffId, start: new Date().toISOString() }], auditReason: "care_team_request_review" }).ok).toBe(true);
    expect(AdelanteEHR.listAuditEvents({}).length - before).toBe(1);
    expect(chartEntryFor(cm.role, cm.staffId, p.id).ok).toBe(true);
  });

  it("weekly review returns reason codes and dates, not opening notes", () => {
    const p = AdelanteEHR.createPatient({ firstName: "Coordinator", lastName: "Review", dob: "1990-01-01" } as Parameters<typeof AdelanteEHR.createPatient>[0]);
    const cm = { role: "ecm_provider" as const, staffId: "s-cf2" };
    const cc = { role: "clinical_coordinator" as const, staffId: "s-cc1" };
    expect(runAction("chart_reason_open", cm, p, { args: [{ patientId: p.id, reasonCode: "other", note: "private fixture note", actor: cm }] }).ok).toBe(true);
    const row = weeklyReasonedOpens(cc).find(r => r.patientId === p.id);
    expect(row?.reasonCode).toBe("other");
    expect(row?.at).toBeTruthy();
    expect(row?.expiresAt).toBeTruthy();
    expect(JSON.stringify(row)).not.toContain("private fixture note");
    expect(weeklyReasonedOpens(cc, new Date(Date.now() + 8 * 86400000)).some(r => r.patientId === p.id)).toBe(false);
  });
});