import { describe, expect, it } from "vitest";
import { staffNavForRole } from "@/lib/navSections";

describe("claims worklist is in the menu", () => {
  for (const role of ["billing", "billing_coordinator", "sys_admin"] as const)
    it(role, () => {
      expect(staffNavForRole(role as never).some((e) => e.to === "/admin-claims")).toBe(true);
    });
});
