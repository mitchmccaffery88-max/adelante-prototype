import { beforeEach, describe, expect, it } from "vitest";
import { AdelanteEHR } from "../ehr";
import { STAFF_ROLES, STAFF_ROSTER, staffForRole } from "../roles";
import { chartEntryFor, searchablePatientsFor, openChartWithReason, _resetChartAccessForTests, CHART_ENTRY_ROLES, setRecordRestricted } from "../chartAccess";
import { endOfSiteDay, intakeWindowActive, evaluateChartEntry, type EntryFacts } from "../chartAccessRules";
import { resolveChartRouteAccess } from "../navGuard";
import { runAction } from "../actions/runAction";
import { saveCoverageAssignment, _resetChartRelationships } from "../chartRelationships";
const base: EntryFacts = { eligible: true, exists: true, team: false, oversight: false, onCall: false, coverage: false, supervisor: false, restricted: false, restrictedOpen: false, reasonOpen: false };
beforeEach(() => { _resetChartAccessForTests(); _resetChartRelationships(); });
describe("27 Oct access rules — Draft mirrored acceptance", () => {
  it.each(["team", "onCall", "coverage", "supervisor", "oversight"] as const)("%s is direct; off-team is a gate", key => {
    expect(evaluateChartEntry({ ...base, [key]: true }).ok).toBe(true);
    expect(evaluateChartEntry(base).ok).toBe(false);
    expect(evaluateChartEntry({ ...base, reasonOpen: true }).ok).toBe(true);
  });
  it("restricted flag stays stricter than ordinary grants and crisis reason", () => {
    expect(evaluateChartEntry({ ...base, restricted: true, reasonOpen: true }).ok).toBe(false);
    expect(evaluateChartEntry({ ...base, restricted: true, team: true }).ok).toBe(true);
    expect(evaluateChartEntry({ ...base, restricted: true, restrictedOpen: true, reasonOpen: true }).ok).toBe(true);
  });
  it("no-chart roles never gain entry from a relationship or reason", () => {
    expect(evaluateChartEntry({ ...base, eligible: false, team: true, reasonOpen: true }).ok).toBe(false);
  });
  it("end of site day uses Pacific midnight and handles DST", () => {
    expect(endOfSiteDay(new Date("2026-10-28T23:00:00Z"), "America/Los_Angeles")).toBe("2026-10-29T07:00:00.000Z");
    expect(endOfSiteDay(new Date("2026-11-01T07:10:00Z"), "America/Los_Angeles")).toBe("2026-11-02T08:00:00.000Z");
  });
  it("Intake day 60 reads, day 61 denies, future handoff denies", () => {
    const handoff = "2026-08-30T18:00:00Z";
    expect(intakeWindowActive(handoff, new Date("2026-10-28T18:00:00Z"), "America/Los_Angeles")).toBe(true);
    expect(intakeWindowActive(handoff, new Date("2026-10-29T07:00:00Z"), "America/Los_Angeles")).toBe(false);
    expect(intakeWindowActive(handoff, new Date("2026-08-29T18:00:00Z"), "America/Los_Angeles")).toBe(false);
  });
  it("all 18 roles: search, direct link and print use one eligibility boundary", () => {
    const p = AdelanteEHR.listPatients()[0]; if (!p) throw new Error("Fixture missing");
    for (const { key: role } of STAFF_ROLES) {
      const s = staffForRole(role)[0]; if (!s) throw new Error(`Missing ${role}`);
      const entry = chartEntryFor(role, s.id, p.id);
      const chart = resolveChartRouteAccess(role,s.id,`/record/${p.id}`);
      const print = resolveChartRouteAccess(role,s.id,`/print/patient-records/${p.id}`);
      expect(chart?.status, role).toBe(print?.status);
      expect(entry.ok || entry.entryEligible === true,role).toBe(CHART_ENTRY_ROLES.includes(role));
      expect(searchablePatientsFor(role,s.id).some(r => r.id===p.id),role).toBe(CHART_ENTRY_ROLES.includes(role));
    }
  });
  it("Other requires a note; one neutral registry audit; expiry and role switch relock", () => {
    const s=STAFF_ROSTER.find(s=>s.role==="peer_specialist"); const p=AdelanteEHR.listPatients().find(p=>s && !chartEntryFor(s.role,s.id,p.id).ok);
    if(!s || !p) throw new Error("Off-team fixture missing");
    const actor={role:s.role,staffId:s.id};
    expect(()=>openChartWithReason({patientId:p.id,reasonCode:"other",actor})).toThrow();
    const before=AdelanteEHR.listAuditEvents().length;
    const r=runAction("chart_reason_open",actor,p,{args:[{patientId:p.id,reasonCode:"other",note:"PRIVATE NOTE NOT IN AUDIT",actor}]});
    expect(r.ok).toBe(true); expect(AdelanteEHR.listAuditEvents().length-before).toBe(1);
    expect(JSON.stringify(r.event)).not.toContain("PRIVATE NOTE");
    expect(chartEntryFor(s.role,s.id,p.id).ok).toBe(true);
    expect(chartEntryFor("billing",s.id,p.id).ok).toBe(false);
    const grant=openChartWithReason({patientId:p.id,reasonCode:"crisis_safety",actor,at:new Date("2026-10-27T18:00:00Z")});
    expect(grant.expiresAt).toBe("2026-10-28T07:00:00.000Z");
    _resetChartAccessForTests();
    openChartWithReason({patientId:p.id,reasonCode:"crisis_safety",actor,at:new Date("2026-10-27T18:00:00Z")});
    expect(chartEntryFor(s.role,s.id,p.id,new Date("2026-10-28T07:00:00Z")).ok).toBe(false);
  });
  it("off-team search carries only identifiers, not clinical or program details",()=>{
    const s=STAFF_ROSTER.find(s=>s.role==="peer_specialist"); if(!s) throw new Error("Fixture missing");
    const p=searchablePatientsFor(s.role,s.id).find(p=>!chartEntryFor(s.role,s.id,p.id).ok); if(!p) throw new Error("Off-team row missing");
    expect(Object.keys(p).sort()).toEqual(["dob","enrolledSiteId","firstName","id","lastName"]);
  });
  it("coverage dates constrain entry and unrelated patients do not inherit it",()=>{
    const cover=STAFF_ROSTER.find(s=>s.role==="sud_counselor"), covered=STAFF_ROSTER.find(s=>s.role==="therapist");
    const p=AdelanteEHR.listPatients()[0]; if(!cover||!covered||!p) throw new Error("Fixture missing");
    const previous=p.primaryClinicianId; p.primaryClinicianId=covered.clinicianId;
    try {
      saveCoverageAssignment({role:"clinical_coordinator",staffId:"s-cc1"},{coveringStaffId:cover.id,coveredStaffId:covered.id,start:"2026-10-27T00:00:00Z",end:"2026-10-29T00:00:00Z"});
      expect(chartEntryFor(cover.role,cover.id,p.id,new Date("2026-10-28T18:00:00Z")).ok).toBe(true);
      expect(chartEntryFor(cover.role,cover.id,p.id,new Date("2026-10-29T00:00:00Z")).ok).toBe(false);
    } finally { p.primaryClinicianId=previous; }
  });
});