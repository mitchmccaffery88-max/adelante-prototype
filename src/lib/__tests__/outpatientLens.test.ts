import { describe, it, expect } from "vitest";
import { inFacilityEnabled, isInFacilityMetric, isInFacilityTask } from "@/lib/inFacility";
import { staffNavForRole } from "@/lib/navSections";

describe("outpatient lens", () => {
  it("in-facility flag is off by default and hides facility menu items", () => {
    expect(inFacilityEnabled()).toBe(false);
    const ids = staffNavForRole("sys_admin").map((e) => e.id);
    for (const id of ["shift-count", "pre-release", "released-search", "facility-protocols", "admin-facilities"])
      expect(ids).not.toContain(id);
    expect(ids).toContain("my-work");
  });
  it("classifies facility metrics and tasks", () => {
    expect(isInFacilityMetric("mar_compliance_pct")).toBe(true);
    expect(isInFacilityMetric("unsigned_notes_count")).toBe(false);
    expect(isInFacilityTask({ protocolInstanceId: "x" })).toBe(true);
    expect(isInFacilityTask({ taskType: "caloms_admission" })).toBe(false);
  });
});
