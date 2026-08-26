import { describe, it, expect } from "vitest";
import {
  PATIENT_NAV,
  PATIENT_MOBILE_NAV,
  PATIENT_MORE_NAV,
  PATIENT_ROUTES,
} from "@/lib/navSections";

describe("patient nav registry", () => {
  it("matches the real source nav order", () => {
    expect(PATIENT_NAV.map((e) => e.id)).toEqual([
      "home",
      "adel",
      "library",
      "resources",
      "recovery-journey",
      "journey",
      "obligations",
      "peer-navigator",
      "appointments",
      "medication",
      "profile",
      "documents",
      "weekly-recap",
      "intake",
    ]);
  });

  it("has exactly the five real mobile tabs", () => {
    expect(PATIENT_MOBILE_NAV.map((e) => e.to)).toEqual([
      "/home",
      "/adel",
      "/library",
      "/resources",
      "/recovery-journey",
    ]);
  });

  it("puts every non-mobile entry in the More sheet", () => {
    expect(PATIENT_MORE_NAV.every((e) => !e.mobile)).toBe(true);
    expect(PATIENT_MOBILE_NAV.length + PATIENT_MORE_NAV.length).toBe(PATIENT_NAV.length);
  });

  it("derives deduped PATIENT_ROUTES from the same registry", () => {
    expect(PATIENT_ROUTES).toEqual([
      "/home",
      "/adel",
      "/library",
      "/resources",
      "/recovery-journey",
      // §Standalone route items — the existing Peer Specialist nav entry now
      // points at the focused view of the same care-team thread.
      "/peer",
      "/schedule",
      // §P1 My Care de-clutter — real routes, no longer /home hash anchors.
      "/medications",
      "/profile",
      "/documents",
      "/weekly-recap",
      "/intake",
      // §Tier 1 Build A — patient-shell routes that are not nav entries.
      "/crisis",
      "/safety-plan",
      "/naloxone",
      // §Tier 1 Build B — private tools + the saved-resources view.
      "/craving",
      "/slip",
      "/checkin",
      "/toolkit",
      "/resources/saved",
    ]);
  });
});
