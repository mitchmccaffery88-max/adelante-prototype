// §EHR audit Phase 1g — "assigned to me" is a DEFAULT VIEW, not an access
// boundary. These tests pin the matching rules and the honest empty behaviour.
import { describe, expect, it } from "vitest";
import {
  assignmentIdentityFor,
  hasAssignmentIdentity,
  isAssignedTo,
  scopeCaseload,
  CASELOAD_SCOPE_NOTE,
} from "../caseloadScope";
import { getStaffMember } from "../roles";

const patients = [
  { id: "a", caseManagerId: "cm1" },
  { id: "b", caseManagerId: "cm2" },
  { id: "c", primaryClinicianId: "c1" },
  { id: "d" },
];

describe("caseload scope", () => {
  it("matches on case-manager assignment", () => {
    expect(isAssignedTo(patients[0]!, { caseManagerId: "cm1" })).toBe(true);
    expect(isAssignedTo(patients[1]!, { caseManagerId: "cm1" })).toBe(false);
  });

  it("matches on primary-clinician assignment", () => {
    expect(isAssignedTo(patients[2]!, { clinicianId: "c1" })).toBe(true);
    expect(isAssignedTo(patients[2]!, { clinicianId: "c2" })).toBe(false);
  });

  it("never matches an unassigned patient", () => {
    expect(isAssignedTo(patients[3]!, { caseManagerId: "cm1", clinicianId: "c1" })).toBe(false);
  });

  it("scopes to the assigned subset, and returns everything for 'all'", () => {
    const mine = scopeCaseload(patients, { caseManagerId: "cm1", clinicianId: "c1" }, "mine");
    expect(mine.map((p) => p.id)).toEqual(["a", "c"]);
    expect(scopeCaseload(patients, { caseManagerId: "cm1" }, "all")).toHaveLength(4);
  });

  it("returns empty — never everyone — for staff with no assignment identity", () => {
    const identity = assignmentIdentityFor({});
    expect(hasAssignmentIdentity(identity)).toBe(false);
    expect(scopeCaseload(patients, identity, "mine")).toEqual([]);
  });

  it("resolves a real roster identity to its caseload link", () => {
    expect(getStaffMember("s-cm2")?.caseManagerId).toBe("cm1");
    expect(getStaffMember("s-peer2")?.caseManagerId).toBe("cm2");
    expect(getStaffMember("s-th1")?.clinicianId).toBe("c1");
  });

  it("labels itself as a view, not a restriction", () => {
    expect(CASELOAD_SCOPE_NOTE).toMatch(/not what you're allowed to open/);
  });
});
