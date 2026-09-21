import { describe, it, expect } from "vitest";
import { canAccess, type StaffRole } from "@/lib/roles";

// §EHR audit Phase 1b — the matrix gate must reproduce the hardcoded
// expression it replaced: sys_admin || clinical_coordinator || meds_erx write.
describe("clinical_text_governance", () => {
  const legacy = (role: StaffRole) =>
    role === "sys_admin" ||
    role === "clinical_coordinator" ||
    canAccess(role, "meds_erx").level === "write";

  const roles: StaffRole[] = [
    "sys_admin",
    "clinical_coordinator",
    "pmhnp",
    "therapist",
    "ecm_provider",
    "sud_counselor",
    "peer_specialist",
    "medical_assistant",
    "clinical_trainee",
    "cf_care_manager",
    "community_health_worker",
    "billing",
  ];

  it("write set matches the previous hardcoded expression exactly", () => {
    for (const role of roles) {
      expect([role, canAccess(role, "clinical_text_governance").level === "write"]).toEqual([
        role,
        legacy(role),
      ]);
    }
  });

  it("keeps sign-off narrower than patient-education authoring", () => {
    for (const role of ["peer_specialist", "community_health_worker", "sud_counselor"] as StaffRole[]) {
      expect(canAccess(role, "content_authoring").level).toBe("write");
      expect(canAccess(role, "clinical_text_governance").level).not.toBe("write");
    }
  });
});
