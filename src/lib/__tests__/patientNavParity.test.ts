import { describe, it, expect } from "vitest";
import { PATIENT_NAV, PATIENT_ROUTES } from "@/lib/navSections";

describe("patient nav registry", () => {
  it("contains exactly the patient shell's routes", () => {
    // §Adelante Journey Phase 5 added /library as a first-class patient route.
    expect(PATIENT_NAV.map((e) => e.to)).toEqual([
      "/home",
      "/intake",
      "/schedule",
      "/library",
    ]);
  });

  it("exposes PATIENT_ROUTES derived from the same registry", () => {
    expect(PATIENT_ROUTES).toEqual(PATIENT_NAV.map((e) => e.to));
  });
});
