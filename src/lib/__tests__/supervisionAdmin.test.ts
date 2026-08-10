// §Quality pass Group A — supervision visibility + administration.
import { describe, it, expect, afterEach } from "vitest";
import {
  assignSupervisor,
  canAccess,
  isBillableStaff,
  supervisedStaff,
  supervisionStatus,
  supervisorCandidates,
  type StaffRole,
} from "../roles";
import { STAFF_NAV, visibleNav } from "../navSections";

const TRAINEE = "s-tr1";

afterEach(() => {
  // Restore the seeded link so tests stay independent.
  assignSupervisor(TRAINEE, "s-th1");
});

describe("assignSupervisor reuses the LPHA rule", () => {
  it("assign → satisfied and billable", () => {
    expect(assignSupervisor(TRAINEE, "s-np1").ok).toBe(true);
    expect(supervisionStatus(TRAINEE).supervisor?.id).toBe("s-np1");
    expect(isBillableStaff(TRAINEE)).toBe(true);
  });

  it("clear → unsatisfied, not billable, explained", () => {
    expect(assignSupervisor(TRAINEE, null).ok).toBe(true);
    const s = supervisionStatus(TRAINEE);
    expect(s.satisfied).toBe(false);
    expect(s.reason).toMatch(/incomplete/i);
    expect(isBillableStaff(TRAINEE)).toBe(false);
  });

  it("rejects a non-LPHA supervisor with a clear reason and no write", () => {
    const before = supervisionStatus(TRAINEE).supervisor?.id;
    const r = assignSupervisor(TRAINEE, "s-peer1");
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/not an LPHA-tier supervisor/i);
    expect(supervisionStatus(TRAINEE).supervisor?.id).toBe(before);
  });

  it("refuses self-supervision and unsupervised roles", () => {
    expect(assignSupervisor(TRAINEE, TRAINEE).ok).toBe(false);
    expect(assignSupervisor("s-cm1", "s-th1").ok).toBe(false);
  });

  it("offers only LPHA-tier candidates and supervision-required staff", () => {
    expect(supervisorCandidates().every((s) => ["therapist", "pmhnp"].includes(s.role))).toBe(true);
    expect(supervisedStaff().map((s) => s.role).sort()).toEqual(
      ["clinical_trainee", "community_health_worker", "medical_assistant"].sort(),
    );
  });
});

describe("RBAC + nav discoverability", () => {
  it("write for sys_admin and clinical_coordinator only", () => {
    expect(canAccess("sys_admin", "staff_supervision").level).toBe("write");
    expect(canAccess("clinical_coordinator", "staff_supervision").level).toBe("write");
    for (const r of ["ecm_provider", "billing", "peer_specialist"] as StaffRole[])
      expect(canAccess(r, "staff_supervision").level).toBe("none");
    expect(canAccess("therapist", "staff_supervision").level).toBe("read");
  });

  it("is registered in the nav and gated there too", () => {
    const entry = STAFF_NAV.find((e) => e.id === "admin-supervision")!;
    expect(entry.to).toBe("/admin-supervision");
    const ids = (role: StaffRole) => visibleNav(role).map((e) => e.id);
    expect(ids("sys_admin")).toContain("admin-supervision");
    expect(ids("billing")).not.toContain("admin-supervision");
  });
});