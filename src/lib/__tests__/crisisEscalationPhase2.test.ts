// §Crisis Redesign Phase 2 — SDOH lane, structured disposition, aging/SLA.
import { beforeEach, describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { canAccess, canWorkSdohCrisisLane, STAFF_ROLES } from "@/lib/roles";
import { STAFF_NAV, canSeeNavEntry } from "@/lib/navSections";
import {
  CRISIS_DISPOSITIONS,
  CRISIS_SLA_DRAFT,
  composeDisposition,
  crisisSlaState,
  crisisSlaTarget,
  sweepCrisisSla,
} from "@/lib/crisisPolicy";

function newPatient() {
  return AdelanteEHR.createPatient({
    firstName: "Sdoh",
    lastName: "Case",
    programId: "TEST",
  } as never).id;
}

describe("SDOH-urgent lane", () => {
  let pid = "";
  let itemId = "";
  beforeEach(() => {
    pid = newPatient();
    AdelanteEHR.addSdohItem(pid, { need: "Housing", note: "", visibleToPatient: true });
    itemId = AdelanteEHR.getPatient(pid)!.sdohPlan!.items[0]!.id;
  });

  it("requires an explicit reason — urgency is never inferred", () => {
    expect(() => AdelanteEHR.flagSdohItemUrgent(pid, itemId, "CM Ada", " ")).toThrow(/reason/i);
  });

  it("creates an sdoh-category escalation linked back to the plan item", () => {
    const row = AdelanteEHR.flagSdohItemUrgent(pid, itemId, "CM Ada", "Loses bed tonight");
    expect(row.category).toBe("sdoh");
    expect(row.severity).toBe("urgent");
    expect(row.triggerSource).toBe("sdoh_urgent");
    expect(row.triggerDetail).toMatch(/Housing/);
    const item = AdelanteEHR.getPatient(pid)!.sdohPlan!.items.find((i) => i.id === itemId)!;
    expect(item.urgentEscalationId).toBe(row.id);
    expect(item.urgentFlaggedBy).toBe("CM Ada");
  });

  it("will not double-flag a need that is already open", () => {
    AdelanteEHR.flagSdohItemUrgent(pid, itemId, "CM Ada", "Loses bed tonight");
    expect(() => AdelanteEHR.flagSdohItemUrgent(pid, itemId, "CM Ada", "again")).toThrow(
      /already flagged/i,
    );
  });

  it("is filterable as its own lane", () => {
    AdelanteEHR.flagSdohItemUrgent(pid, itemId, "CM Ada", "Loses bed tonight");
    AdelanteEHR.flagCrisis(pid, "Nurse Ada", "Disclosed active plan");
    const sdoh = AdelanteEHR.listOpenCrisisEscalations({ category: "sdoh" });
    expect(sdoh.every((r) => r.escalation.category === "sdoh")).toBe(true);
    expect(sdoh.some((r) => r.patient.id === pid)).toBe(true);
  });

  it("routes to case management, not peers or the clinical-only roles", () => {
    expect(canWorkSdohCrisisLane("ecm_provider")).toBe(true);
    expect(canWorkSdohCrisisLane("peer_specialist")).toBe(false);
    expect(canWorkSdohCrisisLane("billing")).toBe(false);
    // Derived from the matrix, never a second list.
    for (const { key } of STAFF_ROLES) {
      const expected =
        canAccess(key, "sdoh").level === "write" &&
        canAccess(key, "crisis_queue").level !== "none";
      expect(canWorkSdohCrisisLane(key)).toBe(expected);
    }
  });

  it("shows the lane in nav only to roles that can work it", () => {
    const entry = STAFF_NAV.find((e) => e.id === "crisis-sdoh-lane")!;
    expect(entry.to).toBe("/crisis-queue");
    for (const { key } of STAFF_ROLES) {
      expect(canSeeNavEntry(key, entry)).toBe(canWorkSdohCrisisLane(key));
    }
  });
});

describe("structured disposition", () => {
  it("keeps a human-readable string and the picked code", () => {
    const pid = newPatient();
    const row = AdelanteEHR.flagCrisis(pid, "Nurse Ada", "Disclosed active plan");
    const resolved = AdelanteEHR.resolveCrisisEscalation(pid, row.id, "Dr. B", {
      dispositionCode: "warm_handoff",
      disposition: composeDisposition("warm_handoff", ""),
    });
    expect(resolved.dispositionCode).toBe("warm_handoff");
    expect(resolved.disposition).toBe("Warm handoff completed");
  });

  it("never loses free text that does not fit the draft list", () => {
    expect(composeDisposition("other", "Family drove him to the ER themselves")).toBe(
      "Family drove him to the ER themselves",
    );
    expect(composeDisposition("escalated", "on-call PMHNP")).toBe("Escalated to on-call PMHNP");
    expect(CRISIS_DISPOSITIONS.some((d) => d.code === "other" && d.requiresDetail)).toBe(true);
  });
});

describe("aging / SLA escalation", () => {
  it("uses the draft clinical clock for clinical rows and the day clock for sdoh", () => {
    const pid = newPatient();
    const clinical = AdelanteEHR.flagCrisis(pid, "Nurse Ada", "Disclosed active plan");
    expect(crisisSlaTarget(clinical).ms).toBe(CRISIS_SLA_DRAFT.bySeverity.critical.ms);
    AdelanteEHR.addSdohItem(pid, { need: "Housing", note: "", visibleToPatient: true });
    const item = AdelanteEHR.getPatient(pid)!.sdohPlan!.items[0]!;
    const sdoh = AdelanteEHR.flagSdohItemUrgent(pid, item.id, "CM Ada", "Loses bed tonight");
    expect(crisisSlaTarget(sdoh).ms).toBe(CRISIS_SLA_DRAFT.sdoh.ms);
  });

  it("marks an overdue row once and only once", () => {
    const pid = newPatient();
    const row = AdelanteEHR.flagCrisis(pid, "Nurse Ada", "Disclosed active plan");
    expect(crisisSlaState(row).overdue).toBe(false);
    row.triggeredAt = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    row.lastTriggeredAt = row.triggeredAt;
    expect(crisisSlaState(row).overdue).toBe(true);

    const first = sweepCrisisSla();
    expect(first).toBeGreaterThanOrEqual(1);
    const stamped = AdelanteEHR.listCrisisEscalations(pid).find((r) => r.id === row.id)!;
    expect(stamped.slaBreachAt).toBeTruthy();
    // Idempotent: a second sweep re-notifies nobody.
    const before = stamped.slaBreachAt;
    sweepCrisisSla();
    expect(
      AdelanteEHR.listCrisisEscalations(pid).find((r) => r.id === row.id)!.slaBreachAt,
    ).toBe(before);
  });

  it("claiming does not exempt a row from the clock", () => {
    const pid = newPatient();
    const row = AdelanteEHR.flagCrisis(pid, "Nurse Ada", "Disclosed active plan");
    AdelanteEHR.claimCrisisEscalation(pid, row.id, "Dr. B");
    row.triggeredAt = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    row.lastTriggeredAt = row.triggeredAt;
    expect(crisisSlaState(row).overdue).toBe(true);
  });
});
