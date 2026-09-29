import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { CHART_ACTIONS } from "@/lib/chartActions";
import { runAction, part2SafeText, recordBlockedAttempt } from "@/lib/actions/runAction";
import { permissionSnapshot } from "@/lib/actions/permissionMatrix";
import { STAFF_ROLES } from "@/lib/roles";
import { inFacilityEnabled } from "@/lib/inFacility";
import { isFeatureEnabled } from "@/lib/features";

const actionEvents = () => AdelanteEHR.listAuditEvents({ category: "action" }).length;
const patient = AdelanteEHR.listPatients()[0];

describe("runAction — one standard event per attempt", () => {
  it("role × action × outcome matrix matches the committed snapshot", () => {
    expect(permissionSnapshot()).toMatchSnapshot();
  });

  it("every registry action writes exactly one action.* event per attempt, including blocked", () => {
    for (const a of CHART_ACTIONS.filter((x) => !x.pending)) {
      for (const { key: role } of STAFF_ROLES) {
        const before = actionEvents();
        // A stub store function: we test the audit contract, not the stores.
        const orig = a.store;
        a.store = [{ name: "stub", fn: () => ({ ok: true }) }];
        try {
          runAction(a.id, { role, staffId: "s-test" }, patient);
        } finally {
          a.store = orig;
        }
        expect(actionEvents() - before, `${a.id} as ${role}`).toBe(1);
      }
    }
  });

  it("blocked attempts are logged with a reason and never call the store", () => {
    let called = false;
    const a = CHART_ACTIONS.find((x) => x.id === "med_order")!;
    const orig = a.store;
    a.store = [{ name: "stub", fn: () => { called = true; } }];
    try {
      const r = runAction("med_order", { role: "therapist", staffId: "s-th1" }, patient);
      expect(r.ok).toBe(false);
      expect(r.event.action).toBe("action.blocked");
      expect(r.event.detail?.["reason"]).toBeTruthy();
      expect(r.event.detail?.["registryVersion"]).toBeTruthy();
    } finally {
      a.store = orig;
    }
    expect(called).toBe(false);
    expect(recordBlockedAttempt("med_order", { role: "therapist", staffId: "s-th1" }, patient)).toBeTruthy();
  });

  it("store refusals and throws are recorded as action.blocked", () => {
    const a = CHART_ACTIONS.find((x) => x.id === "lab_order")!;
    const orig = a.store;
    a.store = [{ name: "stub", fn: () => { throw new Error("buprenorphine lab missing"); } }];
    try {
      const r = runAction("lab_order", { role: "pmhnp", staffId: "s-np1" }, patient);
      expect(r.ok).toBe(false);
      expect(r.event.action).toBe("action.blocked");
      expect(String(r.event.detail?.["reason"])).not.toMatch(/buprenorphine/i);
      expect(r.event.detail?.["flags"]).toEqual({ placeholder_lab: true });
    } finally {
      a.store = orig;
    }
  });

  it("scrubs Part 2 terms from audit text", () => {
    expect(part2SafeText("Naltrexone refill after AUDIT-C and ASAM, F10.20 alcohol")).not.toMatch(/naltrexone|asam|alcohol|f10/i);
    expect(part2SafeText("Only a prescriber can order medications.")).toBe("Only a prescriber can order medications.");
  });

  it("in_facility reads from the feature registry and is off by default", () => {
    expect(isFeatureEnabled("in_facility")).toBe(false);
    expect(inFacilityEnabled()).toBe(false);
  });
});

describe("simulated actions", () => {
  it("eligibility check records simulated: true, not a plain success", () => {
    const r = runAction("eligibility_check", { role: "billing", staffId: "s-b1" }, patient, { args: [patient.id] });
    expect(r.event.detail?.["simulated"]).toBe(true);
    expect(r.event.detail?.["outcome"]).toBe("simulated");
  });
});
