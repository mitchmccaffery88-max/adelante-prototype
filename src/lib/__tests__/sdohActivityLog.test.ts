// §SDOH Referral Thread Phase 5d-3 — activity log, follow-up tasks, aging.
import { describe, expect, it } from "vitest";
import { AdelanteEHR, type SdohPlanItem, type ResourceReferral } from "@/lib/ehr";
import { listPatientOpenItems } from "@/lib/patientOpenItems";
import {
  SDOH_AGING_DRAFT,
  referralAgingState,
  sdohNeedAging,
  sdohNeedLastActionAt,
} from "@/lib/sdohAging";

const actor = { staffName: "Test Coordinator", role: "clinical_coordinator" as const };
const patientId = "p1";

function newNeed(label: string): SdohPlanItem {
  AdelanteEHR.addSdohItem(patientId, { need: label }, actor);
  const item = AdelanteEHR.getPatient(patientId)!.sdohPlan!.items.find((i) => i.need === label)!;
  return item;
}

const readNeed = (id: string) =>
  AdelanteEHR.getPatient(patientId)!.sdohPlan!.items.find((i) => i.id === id)!;

describe("activity log", () => {
  it("appends attributed entries and keeps them in order", () => {
    const need = newNeed(`Log need ${Math.random()}`);
    AdelanteEHR.appendSdohNeedLog(
      patientId,
      need.id,
      { text: "Called the shelter", entryType: "contact_attempt", contactMethod: "phone" },
      actor,
    );
    AdelanteEHR.appendSdohNeedLog(
      patientId,
      need.id,
      { text: "They called back", entryType: "org_update" },
      actor,
    );
    const log = readNeed(need.id).log ?? [];
    expect(log).toHaveLength(2);
    expect(log[0].text).toBe("Called the shelter");
    expect(log[0].authorName).toBe(actor.staffName);
    expect(log[0].authorRole).toBe(actor.role);
    expect(log[0].at).toBeTruthy();
  });

  it("persists structured fields", () => {
    const need = newNeed(`Structured ${Math.random()}`);
    AdelanteEHR.appendSdohNeedLog(
      patientId,
      need.id,
      {
        text: "Blocked on paperwork",
        entryType: "barrier",
        barriers: ["id_documents", "transportation"],
        documentsNeeded: ["ID", "Proof of income"],
        nextStep: "Order a replacement ID",
        nextStepDueDate: "2026-10-01",
      },
      actor,
    );
    const e = readNeed(need.id).log![0];
    expect(e.barriers).toEqual(["id_documents", "transportation"]);
    expect(e.documentsNeeded).toEqual(["ID", "Proof of income"]);
    expect(e.nextStepDueDate).toBe("2026-10-01");
  });

  it("is append-only — there is no edit or delete API", () => {
    const api = AdelanteEHR as unknown as Record<string, unknown>;
    expect(api["editSdohNeedLog"]).toBeUndefined();
    expect(api["removeSdohNeedLog"]).toBeUndefined();
    expect(api["editReferralLog"]).toBeUndefined();
    expect(api["removeReferralLog"]).toBeUndefined();
  });

  it("logs on a referral and never leaks to a patient-facing selector", () => {
    const need = newNeed(`Referral log need ${Math.random()}`);
    const ref = AdelanteEHR.addResourceReferral(
      patientId,
      { category: "housing", provider: "Hope House", sdohItemId: need.id },
      actor,
    )!;
    AdelanteEHR.appendReferralLog(
      patientId,
      ref.id,
      { text: "Intake scheduled", entryType: "org_update" },
      actor,
    );
    const stored = AdelanteEHR.getPatient(patientId)!.resourceReferrals!.find(
      (r) => r.id === ref.id,
    )!;
    expect(stored.log).toHaveLength(1);
    // The Phase 5c rollup renders for any staff viewer, so it must never carry
    // log content or a provider name.
    const rollup = JSON.stringify(listPatientOpenItems(patientId));
    expect(rollup).not.toContain("Intake scheduled");
    expect(rollup).not.toContain("Hope House");
  });

  it("keeps a safety need's log staff-only and out of the advocate view", () => {
    AdelanteEHR.addSdohItem(
      patientId,
      { need: `Safety ${Math.random()}`, safetySensitive: true },
      actor,
    );
    const item = AdelanteEHR.getPatient(patientId)!.sdohPlan!.items[0];
    expect(item.visibleToPatient).toBe(false);
    AdelanteEHR.appendSdohNeedLog(
      patientId,
      item.id,
      { text: "Safety planning conversation", entryType: "client_update" },
      actor,
    );
    const links = AdelanteEHR.listAdvocateLinks?.() ?? [];
    for (const link of links) {
      const view = JSON.stringify(AdelanteEHR.advocateCoordination(link.id) ?? {});
      expect(view).not.toContain("Safety planning conversation");
    }
  });
});

describe("follow-up tasks", () => {
  it("creates a real task assigned to the case manager", () => {
    const p = AdelanteEHR.getPatient(patientId)!;
    expect(p.caseManagerId).toBeTruthy();
    const res = AdelanteEHR.createSdohFollowUpTask({
      patientId,
      dueDate: "2026-11-05",
      nextStep: "Check the waitlist",
    });
    expect(res.created).toBe(true);
    if (res.created) {
      expect(res.task.assignedTo).toBe(p.caseManagerId);
      expect(res.task.origin).toBe("sdoh_follow_up");
      // 42 CFR Part 2 — no category or organization in a shared queue title.
      expect(res.task.title).toBe("Social-needs follow-up");
    }
  });

  it("says plainly when there is no case manager instead of creating nothing", () => {
    const p = AdelanteEHR.getPatient(patientId)!;
    const original = p.caseManagerId;
    p.caseManagerId = undefined;
    const res = AdelanteEHR.createSdohFollowUpTask({ patientId, dueDate: "2026-11-06" });
    expect(res.created).toBe(false);
    if (!res.created) expect(res.reason).toMatch(/no case manager/i);
    p.caseManagerId = original;
  });
});

describe("aging", () => {
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

  it("ages an identified need that was never referred", () => {
    const item = {
      id: "x",
      need: "Housing",
      source: "staff_assessed",
      status: "identified",
      createdAt: daysAgo(20),
      updatedAt: daysAgo(20),
    } as SdohPlanItem;
    expect(sdohNeedAging(item, 0).state).toBe("overdue");
    const younger = { ...item, createdAt: daysAgo(6), updatedAt: daysAgo(6) };
    expect(sdohNeedAging(younger, 0).state).toBe("due");
    // A referral exists — the referral carries the clock, not the need.
    expect(sdohNeedAging(item, 1).state).toBe("fresh");
  });

  it("resets the clock on a new log entry", () => {
    const item = {
      id: "x",
      need: "Housing",
      source: "staff_assessed",
      status: "identified",
      createdAt: daysAgo(20),
      updatedAt: daysAgo(20),
      log: [
        {
          id: "l1",
          text: "Called today",
          entryType: "contact_attempt",
          authorName: "A",
          authorRole: "ecm_provider",
          at: new Date().toISOString(),
        },
      ],
    } as SdohPlanItem;
    expect(sdohNeedLastActionAt(item)).toBe(item.log![0].at);
    expect(sdohNeedAging(item, 0).state).toBe("fresh");
  });

  it("uses the slower waitlist band and closes out closed outcomes", () => {
    const base = { id: "r", category: "housing", provider: "X", createdAt: daysAgo(40) };
    expect(referralAgingState({ ...base, status: "waitlisted" } as ResourceReferral).state).toBe(
      "due",
    );
    expect(referralAgingState({ ...base, status: "pending" } as ResourceReferral).state).toBe(
      "overdue",
    );
    expect(referralAgingState({ ...base, status: "closed" } as ResourceReferral).state).toBe(
      "closed",
    );
    expect(SDOH_AGING_DRAFT.label).toMatch(/draft/i);
  });

  it("includes open referrals in the per-patient open-items summary", () => {
    const need = newNeed(`Rollup need ${Math.random()}`);
    AdelanteEHR.addResourceReferral(
      patientId,
      { category: "food", provider: "Food Bank", sdohItemId: need.id },
      actor,
    );
    const items = listPatientOpenItems(patientId);
    expect(items.some((i) => i.kind === "resource_referral")).toBe(true);
    expect(items.find((i) => i.kind === "sdoh_need")?.agingLabel).toBeTruthy();
  });
});
