import { describe, it, expect } from "vitest";
import { AdelanteEHR, SUD_GROUP_APPROVER_ROLES, refillNeedsCures } from "../ehr";
import { STAFF_ROSTER, STAFF_ROLES, canAccess, getStaffMember, LPHA_SUPERVISOR_ROLES, type RecordClass } from "../roles";
import { ASAM_SIGN_ROLES } from "../asam";
import { roleSeesAsamSection } from "../asamReporting";
import { myCaseload } from "../myWork";

describe("physician role mirrors PMHNP", () => {
  it("has every PMHNP record-class grant", () => {
    const classes: RecordClass[] = ["meds_erx", "screeners_sud", "sud_treatment", "therapy_notes", "controlled_substance_custody", "crisis_queue", "psychotherapy_notes"];
    for (const c of classes) expect(canAccess("physician", c).level).toBe(canAccess("pmhnp", c).level);
  });
  it("passes the role lists that name pmhnp", () => {
    expect(SUD_GROUP_APPROVER_ROLES).toContain("physician");
    expect(ASAM_SIGN_ROLES).toContain("physician");
    expect(LPHA_SUPERVISOR_ROLES).toContain("physician");
    expect(roleSeesAsamSection("physician")).toBe(roleSeesAsamSection("pmhnp"));
  });
  it("Dr. Bagga is the only physician and the only 'Dr.'", () => {
    const b = getStaffMember("s-np1")!;
    expect(b.role).toBe("physician");
    expect(b.name).toBe("Dr. M. Bagga");
    expect(b.fullName).toBe("Dr. Mandeep Bagga, M.D.");
    expect(STAFF_ROSTER.filter((s) => s.name.startsWith("Dr.")).map((s) => s.id)).toEqual(["s-np1"]);
    expect(STAFF_ROLES.some((r) => r.key === "physician")).toBe(true);
  });
  it("Anita Brooks is now the PMHNP", () => {
    const a = getStaffMember("s-th3")!;
    expect(a.role).toBe("pmhnp");
    expect(a.credential).toBe("PMHNP-BC");
  });
  it("prescribers have caseloads", () => {
    expect(myCaseload({ staffId: "s-np1", staffName: "Dr. M. Bagga" }).length).toBeGreaterThanOrEqual(3);
    expect(myCaseload({ staffId: "s-th3", staffName: "Anita Brooks", clinicianId: "c3" }).some((p) => p.prescriberStaffId === "s-th3")).toBe(true);
  });
});

describe("refill safety", () => {
  const pendingFor = (re: RegExp) =>
    AdelanteEHR.listRefillRequests({ status: "pending" }).find((r) => re.test(r.medicationName));

  it("classifies controlled and SUD medications", () => {
    expect(refillNeedsCures({ medicationName: "Buprenorphine-naloxone" })).toBe(true);
    expect(refillNeedsCures({ medicationName: "Naltrexone" })).toBe(false);
    expect(refillNeedsCures({ medicationName: "Lorazepam" })).toBe(true);
    expect(refillNeedsCures({ medicationName: "Sertraline" })).toBe(false);
  });
  it("blocks buprenorphine approval until CURES is recorded", () => {
    const r = pendingFor(/buprenorphine/i)!;
    expect(r).toBeTruthy();
    expect(() => AdelanteEHR.reviewRefill({ id: r.id, decision: "approved", clinicianId: "s-th3", actorRole: "pmhnp" })).toThrow(/CURES/);
    AdelanteEHR.recordRefillCuresCheck(r.id, { checkedAt: "2026-09-28T09:00", result: "no_concerns", by: "Anita Brooks", role: "pmhnp" });
    expect(AdelanteEHR.reviewRefill({ id: r.id, decision: "approved", clinicianId: "s-th3", actorRole: "pmhnp" })?.status).toBe("sent_to_pharmacy");
  });
  it("emergency override needs a reason; non-prescribers cannot record CURES", () => {
    const r = pendingFor(/.*/)!;
    expect(() => AdelanteEHR.recordRefillCuresCheck(r.id, { checkedAt: "2026-09-28T09:00", result: "no_concerns", emergencyOverride: true, by: "x", role: "pmhnp" })).toThrow(/reason/);
    expect(() => AdelanteEHR.recordRefillCuresCheck(r.id, { checkedAt: "2026-09-28T09:00", result: "no_concerns", by: "x", role: "therapist" })).toThrow(/prescriber/);
  });
  it("only prescribers approve, and a deny needs a reason", () => {
    const r = pendingFor(/.*/)!;
    expect(() => AdelanteEHR.reviewRefill({ id: r.id, decision: "approved", clinicianId: "c1", actorRole: "therapist" })).toThrow(/prescriber/);
    expect(() => AdelanteEHR.reviewRefill({ id: r.id, decision: "denied", denyReason: "  ", clinicianId: "s-np1", actorRole: "physician" })).toThrow(/reason/);
  });
});

import { isAssignedTo } from "../caseloadScope";
describe("prescriber of record counts as 'my patients'", () => {
  it("matches prescriberStaffId", () => {
    expect(isAssignedTo({ prescriberStaffId: "s-th3" }, { staffId: "s-th3" })).toBe(true);
    expect(isAssignedTo({ prescriberStaffId: "s-np1" }, { staffId: "s-th3" })).toBe(false);
  });
});
