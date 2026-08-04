// §Platform nav — the gate is the matrix, not a hardcoded role list. These
// tests assert the nav agrees with canAccess() for every entry and role, so a
// future matrix change automatically flows into the shell.
import { describe, expect, it } from "vitest";
import {
  STAFF_NAV,
  canSeeNavEntry,
  staffNavForRole,
  staffNavGroupsForRole,
} from "../navSections";
import { STAFF_ROLES, canAccess } from "../roles";

const ids = (role: Parameters<typeof staffNavForRole>[0]) =>
  staffNavForRole(role).map((e) => e.id);

describe("nav registry integrity", () => {
  it("has unique ids and routes", () => {
    expect(new Set(STAFF_NAV.map((e) => e.id)).size).toBe(STAFF_NAV.length);
    expect(new Set(STAFF_NAV.map((e) => e.to)).size).toBe(STAFF_NAV.length);
  });

  it("surfaces every previously-missing cross-patient page", () => {
    const registry = new Set(STAFF_NAV.map((e) => e.to));
    for (const route of [
      "/worklist",
      "/inbox",
      "/crisis-queue",
      "/message-queue",
      "/dashboards",
      "/admin-scheduling-rules",
      "/admin-catalog-governance",
      "/admin-kpi-targets",
      "/admin-note-templates",
      "/admin-facilities",
    ]) {
      expect(registry.has(route)).toBe(true);
    }
  });

  it("keeps every entry from the old flat staff nav", () => {
    const registry = new Set(STAFF_NAV.map((e) => e.to));
    for (const route of [
      "/referral",
      "/case-manager",
      "/clinician",
      "/billing",
      "/consent",
      "/notes-queue",
      "/clinician-profile",
      "/clinician-availability",
      "/clinician-credentials",
      "/admin",
    ]) {
      expect(registry.has(route)).toBe(true);
    }
  });
});

describe("gating derives from the RBAC matrix", () => {
  it("matches canAccess() for every role/entry pair", () => {
    for (const { key: role } of STAFF_ROLES) {
      for (const entry of STAFF_NAV) {
        const expected =
          entry.gate.kind === "open"
            ? true
            : entry.gate.anyOf.some((cls) => {
                const level = canAccess(role, cls).level;
                if (entry.gate.kind === "open") return false;
                return entry.gate.minLevel === "write"
                  ? level === "write"
                  : level !== "none";
              });
        expect(canSeeNavEntry(role, entry)).toBe(expected);
      }
    }
  });

  it("omits — never merely disables — surfaces a role cannot reach", () => {
    const peer = ids("peer_specialist");
    // peer_specialist is `none` on these classes in the matrix.
    expect(peer).not.toContain("crisis-queue");
    expect(peer).not.toContain("dashboards");
    expect(peer).not.toContain("admin-catalog-governance");
    expect(peer).not.toContain("admin-scheduling-rules");
    expect(peer).not.toContain("admin");
    // ...but it keeps the coordination work it does own.
    expect(peer).toContain("worklist");
    expect(peer).toContain("message-queue");
    expect(peer).toContain("case-manager");
  });

  it("gives sys_admin the governance tier and billing the revenue tier", () => {
    const admin = ids("sys_admin");
    expect(admin).toEqual(
      expect.arrayContaining([
        "admin-scheduling-rules",
        "admin-catalog-governance",
        "admin-note-templates",
        "admin-kpi-targets",
        "admin-facilities",
        "admin-audit",
        "crisis-queue",
      ]),
    );
    // sys_admin has no clinical record access, so clinical surfaces stay out.
    expect(admin).not.toContain("clinician");
    expect(admin).not.toContain("notes-queue");
    expect(admin).not.toContain("shift-count");

    const billing = ids("billing");
    expect(billing).toEqual(expect.arrayContaining(["billing", "admin-claims", "consent"]));
    expect(billing).not.toContain("worklist");
    expect(billing).not.toContain("crisis-queue");
    expect(billing).not.toContain("message-queue");
  });

  it("write-only config entries need write, not read", () => {
    // population_health read (pmhnp) sees the dashboards but not KPI targets.
    expect(ids("pmhnp")).toContain("dashboards");
    expect(ids("pmhnp")).not.toContain("admin-kpi-targets");
    expect(ids("clinical_coordinator")).toContain("admin-kpi-targets");
  });

  it("differs between roles and drops empty groups", () => {
    expect(ids("pmhnp")).not.toEqual(ids("billing"));
    for (const { key: role } of STAFF_ROLES) {
      const groups = staffNavGroupsForRole(role);
      expect(groups.every((g) => g.entries.length > 0)).toBe(true);
      expect(groups.flatMap((g) => g.entries).length).toBe(ids(role).length);
      // Personal settings are always reachable, for every role.
      expect(ids(role)).toContain("clinician-profile");
    }
  });
});
