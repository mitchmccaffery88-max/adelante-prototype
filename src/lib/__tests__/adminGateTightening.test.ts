// §Permission fix — four administration surfaces were over-permissive
// (`/admin-credentialing` and `/admin-vendors` were `open`, `/admin-audit` was
// gated on `consent_ledger`, `/admin` on `population_health` READ). These
// tests pin the new gates and the two `demographics` grants, and assert no
// other role's access moved.
import { describe, expect, it } from "vitest";
import { STAFF_NAV, staffNavForRole } from "../navSections";
import { resolveNavAccess } from "../navGuard";
import { STAFF_ROLES, canAccess, type StaffRole } from "../roles";

const gateOf = (id: string) => STAFF_NAV.find((e) => e.id === id)!.gate;
const reaches = (role: StaffRole, to: string) =>
  staffNavForRole(role).some((e) => e.to === to);

describe("tightened administration gates", () => {
  it("no administration surface is `open` any more", () => {
    for (const entry of STAFF_NAV.filter((e) => e.group === "administration")) {
      expect([entry.id, entry.gate.kind]).toEqual([entry.id, "record_class"]);
    }
  });

  it("credentialing needs staff_supervision write", () => {
    expect(gateOf("admin-credentialing")).toMatchObject({
      anyOf: ["staff_supervision"],
      minLevel: "write",
    });
    for (const role of ["peer_specialist", "medical_assistant", "clinical_trainee"] as const) {
      expect([role, reaches(role, "/admin-credentialing")]).toEqual([role, false]);
    }
    expect(reaches("sys_admin", "/admin-credentialing")).toBe(true);
    expect(reaches("clinical_coordinator", "/admin-credentialing")).toBe(true);
  });

  it("vendor status needs catalog_governance", () => {
    expect(gateOf("admin-vendors")).toMatchObject({ anyOf: ["catalog_governance"] });
    for (const role of ["peer_specialist", "medical_assistant", "billing"] as const) {
      expect([role, reaches(role, "/admin-vendors")]).toEqual([role, false]);
    }
    expect(reaches("sys_admin", "/admin-vendors")).toBe(true);
  });

  it("audit log is administration-tier, not consent-ledger-tier", () => {
    expect(gateOf("admin-audit")).toMatchObject({
      anyOf: ["catalog_governance"],
      minLevel: "write",
    });
    expect(reaches("billing", "/admin-audit")).toBe(false);
    expect(reaches("peer_specialist", "/admin-audit")).toBe(false);
    expect(reaches("sys_admin", "/admin-audit")).toBe(true);
  });

  it("the admin hub needs population_health write", () => {
    expect(gateOf("admin")).toMatchObject({
      anyOf: ["population_health"],
      minLevel: "write",
    });
    expect(reaches("billing", "/admin")).toBe(false);
    expect(reaches("billing_coordinator", "/admin")).toBe(false);
    expect(reaches("sys_admin", "/admin")).toBe(true);
    expect(reaches("clinical_coordinator", "/admin")).toBe(true);
  });

  it("deep links to the tightened routes are refused, not merely hidden", () => {
    for (const to of ["/admin", "/admin-audit", "/admin-credentialing", "/admin-vendors"]) {
      expect([to, resolveNavAccess("peer_specialist", to).status]).toEqual([to, "denied"]);
      expect([to, resolveNavAccess("sys_admin", to).status]).toEqual([to, "allowed"]);
    }
  });
});

describe("demographics grants", () => {
  it("clinical_coordinator and sys_admin can read patient identity", () => {
    expect(canAccess("clinical_coordinator", "demographics").level).toBe("read");
    expect(canAccess("sys_admin", "demographics").level).toBe("read");
  });

  it("leaves every other role's demographics level untouched", () => {
    const expected: Record<string, string> = {
      ecm_provider: "write",
      cf_care_manager: "read",
      sud_counselor: "write",
      clinical_trainee: "read",
      medical_assistant: "read",
      peer_specialist: "read",
      community_health_worker: "read",
      therapist: "read",
      pmhnp: "read",
      billing: "read",
      billing_coordinator: "none",
      credentialing_coordinator: "none",
    };
    for (const { key } of STAFF_ROLES) {
      if (key === "clinical_coordinator" || key === "sys_admin") continue;
      expect([key, canAccess(key, "demographics").level]).toEqual([key, expected[key]]);
    }
  });
});
