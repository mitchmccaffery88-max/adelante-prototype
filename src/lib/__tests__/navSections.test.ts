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
      "/worklist",
    ]) {
      expect(registry.has(route)).toBe(true);
    }
  });

  it("§Facility & Custody — group exists, is ordered after population, and is gated", () => {
    const facility = STAFF_NAV.filter((e) => e.group === "facility").map((e) => e.id);
    expect(facility.sort()).toEqual(
      ["admin-facilities", "facility-protocols", "released-search"].sort(),
    );
    for (const e of STAFF_NAV.filter((x) => x.group === "facility")) {
      expect(e.gate).toMatchObject({ anyOf: ["custody_tracking"] });
    }
    const order = staffNavGroupsForRole("case_manager").map((g) => g.group);
    expect(order.indexOf("facility")).toBe(order.indexOf("population") + 1);
    // A role without custody_tracking gets no Facility & Custody group at all.
    expect(staffNavGroupsForRole("billing").map((g) => g.group)).not.toContain("facility");
  });

  it("§Shift count — re-gated on controlled_substance_custody with NO loss of access", () => {
    const entry = STAFF_NAV.find((e) => e.id === "shift-count")!;
    expect(entry.gate).toMatchObject({ anyOf: ["controlled_substance_custody"] });
    // Stays in Care: outpatient sites reconcile physical stock too.
    expect(entry.group).toBe("care");
    // Regression: every role's Shift-count level under the new class is
    // identical to its old `meds_erx` level, so nobody gains or loses it.
    for (const r of STAFF_ROLES.map((x) => x.key)) {
      expect([r, canAccess(r, "controlled_substance_custody").level]).toEqual([
        r,
        canAccess(r, "meds_erx").level,
      ]);
      expect([r, ids(r).includes("shift-count")]).toEqual([
        r,
        canAccess(r, "meds_erx").level !== "none",
      ]);
    }
  });

  it("§Facility protocols is a pre-filtered Worklist view, not a second page", () => {
    const entry = STAFF_NAV.find((e) => e.id === "facility-protocols")!;
    expect(entry.to).toBe("/worklist");
    expect(entry.search).toEqual({ view: "facility-protocols" });
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
