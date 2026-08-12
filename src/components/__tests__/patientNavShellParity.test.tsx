import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { PATIENT_NAV, PATIENT_MOBILE_NAV, PATIENT_MORE_NAV } from "@/lib/navSections";

// Identity-based parity (same pattern as adminNavParity): both shells must map
// over the SAME registry object, not a copy of its contents.
const appShell = readFileSync("src/components/AppShell.tsx", "utf8");
const mobileNav = readFileSync("src/components/MobileNav.tsx", "utf8");
const moreSheet = readFileSync("src/components/patient/PatientMoreSheet.tsx", "utf8");

describe("desktop and mobile patient nav parity", () => {
  it("both shells read PATIENT_NAV from the registry", () => {
    expect(appShell).toMatch(/patientNav = PATIENT_NAV/);
    expect(mobileNav).toContain('PATIENT_MOBILE_NAV.map(');
    expect(moreSheet).toContain('PATIENT_MORE_NAV.map(');
    expect(PATIENT_MOBILE_NAV.length).toBe(5);
    expect(PATIENT_MORE_NAV.length).toBeGreaterThan(0);
  });

  it("neither shell hardcodes a patient route list", () => {
    for (const src of [appShell, mobileNav, moreSheet]) {
      expect(src).not.toMatch(/\{ to: "\/home"/);
    }
  });

  it("registry entries are complete", () => {
    for (const e of PATIENT_NAV) {
      expect(e.id).toBeTruthy();
      expect(e.labelKey).toBeTruthy();
      expect(typeof e.icon).not.toBe("undefined");
    }
  });
});
