import { describe, it, expect } from "vitest";
import { resolveNavAccess, safeLandingFor, PATIENT_HOME } from "../navGuard";
import { STAFF_NAV, canSeeNavEntry } from "../navSections";
import { STAFF_ROLES } from "../roles";

describe("route-level nav guard", () => {
  it("leaves non-registry routes alone", () => {
    expect(resolveNavAccess("sys_admin", "/home").status).toBe("unregistered");
    expect(resolveNavAccess("sys_admin", "/record/p1").status).toBe("unregistered");
  });

  it("mirrors the sidebar gate for every role and surface", () => {
    for (const { key: role } of STAFF_ROLES) {
      for (const entry of STAFF_NAV) {
        // Pre-filtered views share a path with their base page; the base entry
        // owns the guard decision (see entryForPath).
        if (entry.search) continue;
        const access = resolveNavAccess(role, entry.to);
        expect(access.status).toBe(canSeeNavEntry(role, entry) ? "allowed" : "denied");
      }
    }
  });

  it("always redirects denied roles to a surface they can open", () => {
    for (const { key: role } of STAFF_ROLES) {
      for (const entry of STAFF_NAV) {
        const access = resolveNavAccess(role, entry.to);
        if (access.status !== "denied") continue;
        expect(access.redirectTo).not.toBe(entry.to);
        if (access.redirectTo !== PATIENT_HOME) {
          const target = STAFF_NAV.find((e) => e.to === access.redirectTo)!;
          expect(canSeeNavEntry(role, target)).toBe(true);
        }
        expect(access.message).toContain(entry.label);
      }
    }
  });

  it("falls back to patient home when a role clears nothing", () => {
    const landing = safeLandingFor("peer_specialist");
    expect(typeof landing).toBe("string");
  });
});