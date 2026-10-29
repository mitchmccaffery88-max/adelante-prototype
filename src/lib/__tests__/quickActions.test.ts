// Quick-actions batch 2 — the defaults map to real registry actions, the
// registry's own permission check is the only gate, and the two nurse
// actions pending Dr. Bagga's sign-off are never offered.
import { describe, expect, it } from "vitest";
import { CHART_ACTIONS } from "@/lib/chartActions";
import { PENDING_SIGNOFF_IDS, QUICK_ACTION_DEFAULTS, quickActionsFor } from "@/lib/quickActions";
import { STAFF_ROLES } from "@/lib/roles";

describe("quick action defaults", () => {
  it("every approved default id exists in the registry and is built", () => {
    for (const [role, ids] of Object.entries(QUICK_ACTION_DEFAULTS)) {
      for (const id of ids) {
        const a = CHART_ACTIONS.find((x) => x.id === id);
        expect(a, `${role} → ${id}`).toBeTruthy();
        expect(a!.pending, `${role} → ${id} is pending`).toBeFalsy();
      }
    }
  });

  it("no default list contains an action pending clinical sign-off", () => {
    for (const ids of Object.values(QUICK_ACTION_DEFAULTS)) {
      for (const id of ids) expect(PENDING_SIGNOFF_IDS).not.toContain(id);
    }
  });

  it("nurse quick actions never include give clinic dose or coordinate a refill", () => {
    for (const role of ["nurse_rn", "lvn"] as const) {
      const ids = quickActionsFor({ role, staffId: "s-test" }).map((a) => a.id);
      expect(ids).not.toContain("clinic_dose_give");
      expect(ids).not.toContain("refill_coordinate");
    }
  });

  it("the registry permission check is the gate: hidden actions are never offered", () => {
    const therapist = quickActionsFor({ role: "therapist", staffId: "s-th1" }).map((a) => a.id);
    expect(therapist).toContain("progress_note");
    expect(therapist).not.toContain("med_order");

    const billing = quickActionsFor({ role: "billing", staffId: "s-b1" }).map((a) => a.id);
    expect(billing).toContain("claim_correct");
    expect(billing).toContain("eligibility_check");
    expect(billing).not.toContain("progress_note");
  });

  it("roles without defaults get no quick actions; results are deduped", () => {
    expect(quickActionsFor({ role: "clinical_trainee", staffId: "s-t1" })).toEqual([]);
    for (const { key: role } of STAFF_ROLES) {
      const ids = quickActionsFor({ role, staffId: "s-test" }).map((a) => a.id);
      expect(new Set(ids).size, role).toBe(ids.length);
    }
  });

  it("credentialing coordinator gets time off and booking freeze, nothing clinical", () => {
    const ids = quickActionsFor({ role: "credentialing_coordinator", staffId: "s-cc9" }).map((a) => a.id);
    expect(ids).toEqual(["calendar_time_off_add", "bookings_freeze"]);
  });
});
