// §Admin shell — the landing page's quick links must BE the sidebar's
// Administration group, not a copy of it. If these drift, this test fails.
import { describe, expect, it } from "vitest";
import {
  staffNavForRole,
  staffNavGroupForRole,
  staffNavGroupsForRole,
} from "../navSections";
import { STAFF_ROLES, canAccess } from "../roles";

// Mirrors exactly what AdminPage computes.
const adminQuickLinks = (role: Parameters<typeof staffNavForRole>[0]) =>
  staffNavGroupForRole(role, "administration").filter((e) => e.to !== "/admin");

describe("admin quick links vs sidebar Administration group", () => {
  it("are the identical entry objects for every role", () => {
    for (const { key: role } of STAFF_ROLES) {
      const sidebar =
        staffNavGroupsForRole(role).find((g) => g.group === "administration")?.entries ?? [];
      const expected = sidebar.filter((e) => e.to !== "/admin");
      const links = adminQuickLinks(role);
      expect(links).toEqual(expected);
      // Same object identity, not merely deep-equal copies.
      links.forEach((entry, i) => expect(entry).toBe(expected[i]));
    }
  });

  it("never shows a link the role's gate refuses", () => {
    for (const { key: role } of STAFF_ROLES) {
      for (const entry of adminQuickLinks(role)) {
        if (entry.gate.kind === "open") continue;
        expect(entry.gate.anyOf.some((cls) => canAccess(role, cls).level !== "none")).toBe(true);
      }
    }
  });

  it("drops governance links for a role without those gates", () => {
    const peer = adminQuickLinks("peer_specialist").map((e) => e.id);
    expect(peer).not.toContain("admin-kpi-targets");
    expect(peer).not.toContain("admin-catalog-governance");
    expect(peer).not.toContain("admin-scheduling-rules");
    const admin = adminQuickLinks("sys_admin").map((e) => e.id);
    expect(admin).toEqual(
      expect.arrayContaining([
        "admin-kpi-targets",
        "admin-note-templates",
        "admin-scheduling-rules",
        "admin-catalog-governance",
        "admin-audit",
      ]),
    );
    expect(admin).not.toContain("admin");
  });
});

describe("/admin self-gate", () => {
  it("uses the same class the Pilot dashboard nav entry is gated on", () => {
    const entry = staffNavForRole("sys_admin").find((e) => e.to === "/admin");
    expect(entry?.gate).toMatchObject({ anyOf: ["population_health"] });
  });

  it("locks out exactly the roles the nav also hides /admin from", () => {
    for (const { key: role } of STAFF_ROLES) {
      const locked = canAccess(role, "population_health").level === "none";
      const inNav = staffNavForRole(role).some((e) => e.to === "/admin");
      expect(inNav).toBe(!locked);
    }
    expect(canAccess("peer_specialist", "population_health").level).toBe("none");
  });
});
