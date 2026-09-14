// §Crisis Escalation Redesign Phase 1 — data model + workflow regression tests.
import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { scanTextForCrisis } from "@/lib/crisisTextDetection";
import { canAccess, canFlagCrisis } from "@/lib/roles";

function newPatient(last = "Phase1") {
  return AdelanteEHR.createPatient({ firstName: "Crisis", lastName: last } as never).id;
}

describe("draft severity / category classification", () => {
  it("defaults every trigger to the clearly-labeled draft values", () => {
    const pid = newPatient();
    const row = AdelanteEHR.flagCrisis(pid, "Dr. Test", "Observed acute distress");
    expect(row.severity).toBe("critical");
    expect(row.category).toBe("clinical");
    // Nothing is "reviewed" until Christi / Dr. Bagga sign off.
    expect(row.classificationStatus).toBe("draft");
  });

  it("accepts explicit draft values without inventing new ones", () => {
    const pid = newPatient();
    const row = AdelanteEHR.flagCrisis(pid, "Dr. Test", "Housing loss, no clinical risk", {
      severity: "routine",
      category: "sdoh",
    });
    expect(row.severity).toBe("routine");
    expect(row.category).toBe("sdoh");
    expect(row.classificationStatus).toBe("draft");
  });
});

describe("claim / unclaim", () => {
  it("claims, exposes the claimer, and releases", () => {
    const pid = newPatient();
    const row = AdelanteEHR.flagCrisis(pid, "Dr. Test", "Acute distress");
    expect(row.claimedBy).toBeUndefined();

    AdelanteEHR.claimCrisisEscalation(pid, row.id, "Coordinator A");
    const claimed = AdelanteEHR.listCrisisEscalations(pid)[0]!;
    expect(claimed.claimedBy).toBe("Coordinator A");
    expect(claimed.claimedAt).toBeTruthy();

    AdelanteEHR.unclaimCrisisEscalation(pid, row.id, "Coordinator A");
    expect(AdelanteEHR.listCrisisEscalations(pid)[0]!.claimedBy).toBeUndefined();
  });

  it("refuses to silently steal another responder's claim", () => {
    const pid = newPatient();
    const row = AdelanteEHR.flagCrisis(pid, "Dr. Test", "Acute distress");
    AdelanteEHR.claimCrisisEscalation(pid, row.id, "Coordinator A");
    expect(() => AdelanteEHR.claimCrisisEscalation(pid, row.id, "Coordinator B")).toThrow(
      /Already claimed by Coordinator A/,
    );
  });

  it("a claim never blocks resolution", () => {
    const pid = newPatient();
    const row = AdelanteEHR.flagCrisis(pid, "Dr. Test", "Acute distress");
    AdelanteEHR.claimCrisisEscalation(pid, row.id, "Coordinator A");
    const resolved = AdelanteEHR.resolveCrisisEscalation(pid, row.id, "Coordinator B", {
      disposition: "Safety plan reviewed",
    });
    expect(resolved.status).toBe("resolved");
  });
});

describe("dedupe fix — a second signal re-triggers instead of vanishing", () => {
  it("two triggers while one is open produce ONE updated record, not a dropped signal", () => {
    const pid = newPatient();
    const first = scanTextForCrisis(pid, "I want to die", { surface: "a care-team message" })!;
    const second = scanTextForCrisis(pid, "still suicidal", { surface: "a care-team message" })!;

    // Same record, not a duplicate row.
    expect(second.id).toBe(first.id);
    expect(AdelanteEHR.listCrisisEscalations(pid, { status: "open" })).toHaveLength(1);

    // The second signal is PRESERVED, not discarded.
    const row = AdelanteEHR.listCrisisEscalations(pid, { status: "open" })[0]!;
    expect(row.retriggers).toHaveLength(1);
    expect(row.retriggers![0]!.detail).toContain("suicidal");
    expect(row.lastTriggeredAt).toBeTruthy();
    expect(+new Date(row.lastTriggeredAt!)).toBeGreaterThanOrEqual(+new Date(row.triggeredAt));

    // And it is visibly re-surfaced at the top of the queue.
    const queue = AdelanteEHR.listOpenCrisisEscalations();
    expect(queue[0]!.escalation.id).toBe(row.id);
  });

  it("a third signal appends again rather than overwriting", () => {
    const pid = newPatient();
    scanTextForCrisis(pid, "I want to die", { surface: "a care-team message" });
    scanTextForCrisis(pid, "still suicidal", { surface: "a care-team message" });
    scanTextForCrisis(pid, "I keep hurting myself", { surface: "a message to Adel" });
    const row = AdelanteEHR.listCrisisEscalations(pid, { status: "open" })[0]!;
    expect(row.retriggers).toHaveLength(2);
  });

  it("re-triggered rows float above older un-retriggered ones", () => {
    const quiet = newPatient("Quiet");
    AdelanteEHR.flagCrisis(quiet, "Dr. Test", "Older, never repeated");
    const loud = newPatient("Loud");
    scanTextForCrisis(loud, "I want to die", { surface: "a care-team message" });
    scanTextForCrisis(loud, "still suicidal", { surface: "a care-team message" });

    const queue = AdelanteEHR.listOpenCrisisEscalations();
    const loudIdx = queue.findIndex((r) => r.patient.id === loud);
    const quietIdx = queue.findIndex((r) => r.patient.id === quiet);
    expect(loudIdx).toBeLessThan(quietIdx);
  });

  it("a resolved escalation does not absorb a new signal — it opens a fresh one", () => {
    const pid = newPatient();
    const first = scanTextForCrisis(pid, "I want to die", { surface: "a care-team message" })!;
    AdelanteEHR.resolveCrisisEscalation(pid, first.id, "Coordinator A", {
      disposition: "Seen same day",
    });
    const second = scanTextForCrisis(pid, "still suicidal", { surface: "a care-team message" })!;
    expect(second.id).not.toBe(first.id);
    expect(AdelanteEHR.listCrisisEscalations(pid, { status: "open" })).toHaveLength(1);
  });
});

describe("chart continuity — resolved escalations are retained", () => {
  it("keeps disposition, resolver, and timestamps readable from the chart", () => {
    const pid = newPatient();
    const row = AdelanteEHR.flagCrisis(pid, "Peer Continuity", "Member disclosed intent");
    AdelanteEHR.resolveCrisisEscalation(pid, row.id, "Coordinator A", {
      contactedWhom: "On-call PMHNP",
      actionsTaken: "Warm handoff",
      disposition: "Safety plan updated, follow-up in 24h",
    });
    const resolved = AdelanteEHR.listCrisisEscalations(pid, { status: "resolved" });
    expect(resolved).toHaveLength(1);
    expect(resolved[0]!.disposition).toBe("Safety plan updated, follow-up in 24h");
    expect(resolved[0]!.resolvedBy).toBe("Coordinator A");
    expect(resolved[0]!.resolvedAt).toBeTruthy();
    expect(resolved[0]!.contactedWhom).toBe("On-call PMHNP");
  });
});

describe("peer specialist RBAC gap", () => {
  it("peers can flag but still have no cross-patient queue access", () => {
    expect(canFlagCrisis("peer_specialist")).toBe(true);
    expect(canAccess("peer_specialist", "crisis_queue").locked).toBe(true);
  });

  it("a peer sees resolution status for their OWN flags only", () => {
    const mine = newPatient("Mine");
    const theirs = newPatient("Theirs");
    const own = AdelanteEHR.flagCrisis(mine, "Peer Alex", "Member disclosed intent");
    AdelanteEHR.flagCrisis(theirs, "Dr. Other", "Unrelated clinician flag");

    const visible = AdelanteEHR.listCrisisEscalationsFlaggedBy("Peer Alex");
    expect(visible.map((r) => r.escalation.id)).toEqual([own.id]);
    expect(visible.every((r) => r.patient.id !== theirs)).toBe(true);

    AdelanteEHR.resolveCrisisEscalation(mine, own.id, "Coordinator A", {
      disposition: "Crisis line engaged",
    });
    const after = AdelanteEHR.listCrisisEscalationsFlaggedBy("Peer Alex");
    expect(after[0]!.escalation.status).toBe("resolved");
    expect(after[0]!.escalation.disposition).toBe("Crisis line engaged");
  });

  it("returns nothing for an actor who has flagged nothing", () => {
    expect(AdelanteEHR.listCrisisEscalationsFlaggedBy("Nobody At All")).toHaveLength(0);
    expect(AdelanteEHR.listCrisisEscalationsFlaggedBy("")).toHaveLength(0);
  });
});

// §Crisis Redesign Phase 1 — flag-capable roles with no cross-patient queue
// access still need a way TO the self-scoped view; nav + deep-link guard must
// agree, or the section built for them is unreachable.
describe("peer route reachability for the self-scoped crisis view", () => {
  it("gives flag-only roles a distinct nav entry and never both entries", async () => {
    const { staffNavForRole } = await import("../navSections");
    const peer = staffNavForRole("peer_specialist").map((e) => e.id);
    expect(peer).toContain("crisis-flagged-by-me");
    expect(peer).not.toContain("crisis-queue");

    const coord = staffNavForRole("clinical_coordinator").map((e) => e.id);
    expect(coord).toContain("crisis-queue");
    expect(coord).not.toContain("crisis-flagged-by-me");
  });

  it("does not redirect a peer away from /crisis-queue", async () => {
    const { resolveNavAccess } = await import("../navGuard");
    expect(resolveNavAccess("peer_specialist", "/crisis-queue").status).toBe("allowed");
    // A role that can neither flag nor read the queue is still redirected.
    expect(resolveNavAccess("billing", "/crisis-queue").status).toBe("denied");
  });
});
