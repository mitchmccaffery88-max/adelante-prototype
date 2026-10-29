// Order lifecycle transitions: reason gating, terminality, audit rigor.
import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";

function newSignedOrder() {
  const patientId = AdelanteEHR.listPatients()[0].id;
  const draft = AdelanteEHR.addDraftOrder(patientId, {
    drugName: "sertraline 50 MG Oral Tablet",
    createdBy: "Dr. R. Sample",
  });
  AdelanteEHR.signOrders(patientId, [draft.id], "Dr. R. Sample");
  return { patientId, orderId: draft.id };
}

const find = (patientId: string, orderId: string) =>
  AdelanteEHR.listOrders(patientId).find((o) => o.id === orderId)!;

describe("order lifecycle", () => {
  it("requires a reason to hold, and records who/when", () => {
    const { patientId, orderId } = newSignedOrder();
    expect(() => AdelanteEHR.holdOrder(patientId, orderId, "Dr. R. Sample", "   ")).toThrow(
      /reason is required/i,
    );
    expect(find(patientId, orderId).status).toBe("signed");
    AdelanteEHR.holdOrder(patientId, orderId, "Dr. R. Sample", "pending LFTs");
    const held = find(patientId, orderId);
    expect(held.status).toBe("held");
    expect(held.statusReason).toBe("pending LFTs");
    expect(held.statusChangedBy).toBe("Dr. R. Sample");
    expect(held.statusChangedAt).toBeTruthy();
  });

  it("resumes a held order without a reason", () => {
    const { patientId, orderId } = newSignedOrder();
    AdelanteEHR.holdOrder(patientId, orderId, "Dr. R. Sample", "pending LFTs");
    AdelanteEHR.resumeOrder(patientId, orderId, "Dr. R. Sample");
    expect(find(patientId, orderId).status).toBe("signed");
    expect(find(patientId, orderId).statusReason).toBeUndefined();
  });

  it("makes discontinue terminal — no path back to signed", () => {
    const { patientId, orderId } = newSignedOrder();
    expect(() => AdelanteEHR.discontinueOrder(patientId, orderId, "Dr. R. Sample", "")).toThrow(
      /reason is required/i,
    );
    AdelanteEHR.discontinueOrder(patientId, orderId, "Dr. R. Sample", "rash");
    expect(find(patientId, orderId).status).toBe("discontinued");
    expect(() => AdelanteEHR.resumeOrder(patientId, orderId, "Dr. R. Sample")).toThrow();
    expect(() => AdelanteEHR.holdOrder(patientId, orderId, "Dr. R. Sample", "x")).toThrow();
    expect(() => AdelanteEHR.completeOrder(patientId, orderId, "Dr. R. Sample")).toThrow();
  });

  it("completes without a reason and is terminal", () => {
    const { patientId, orderId } = newSignedOrder();
    AdelanteEHR.completeOrder(patientId, orderId, "Dr. R. Sample");
    expect(find(patientId, orderId).status).toBe("completed");
    expect(() => AdelanteEHR.resumeOrder(patientId, orderId, "Dr. R. Sample")).toThrow();
  });

  it("writes an audit event for every transition", () => {
    const { patientId, orderId } = newSignedOrder();
    AdelanteEHR.holdOrder(patientId, orderId, "Dr. R. Sample", "pending LFTs");
    AdelanteEHR.discontinueOrder(patientId, orderId, "Dr. R. Sample", "no longer indicated");
    const actions = AdelanteEHR.listAuditEvents({ patientId })
      .filter((e) => JSON.stringify(e.detail ?? {}).includes(orderId))
      .map((e) => e.action);
    expect(actions).toContain("order_held");
    expect(actions).toContain("order_discontinued");
  });

  it("cannot hold a draft order", () => {
    const patientId = AdelanteEHR.listPatients()[0].id;
    const draft = AdelanteEHR.addDraftOrder(patientId, { drugName: "ibuprofen 200 MG" });
    expect(() => AdelanteEHR.holdOrder(patientId, draft.id, "Dr. R. Sample", "x")).toThrow();
  });
});
