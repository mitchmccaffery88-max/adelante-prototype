// §MAR Phase 1 — due-dose derivation + charting/claim/void state machines.
import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { deriveMarDay, deferralReasonFor } from "@/lib/mar";
import { facilityDateKey } from "@/lib/facilityTime";

const patientId = () => AdelanteEHR.listPatients()[0].id;

function signedOrder(extra: Record<string, unknown> = {}) {
  const pid = patientId();
  const draft = AdelanteEHR.addDraftOrder(pid, {
    drugName: "sertraline 50 MG Oral Tablet",
    frequencyCode: "BID",
    createdBy: "N. Ramirez",
    ...extra,
  } as never);
  AdelanteEHR.signOrders(pid, [draft.id], "N. Ramirez");
  return { pid, orderId: draft.id };
}

const today = () => facilityDateKey(new Date(), undefined);
const marFor = (pid: string) => deriveMarDay(AdelanteEHR.getPatient(pid)!, today());

describe("MAR due-dose derivation", () => {
  it("projects scheduled doses from an active order's frequency", () => {
    const { pid, orderId } = signedOrder();
    const slots = marFor(pid).slots.filter((s) => s.order.id === orderId);
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((s) => s.facilityDate === today())).toBe(true);
  });

  // §MAR Phase 2 — PRN / KOP / controlled are now actionable, each in its own
  // lane. Nothing remains in the read-only "deferred" section.
  it("routes PRN to the PRN lane, KOP to the supply lane, and controlled to the scheduled queue", () => {
    const prn = signedOrder({ frequencyCode: "Q6H_PRN" });
    const kop = signedOrder({ isKop: true });
    const ctrl = signedOrder({ isControlled: true, deaSchedule: "CII" });
    const day = marFor(prn.pid);
    expect(day.prn.map((s) => s.order.id)).toContain(prn.orderId);
    expect(day.kop.map((s) => s.order.id)).toContain(kop.orderId);
    expect(day.slots.some((s) => s.order.id === ctrl.orderId)).toBe(true);
    expect(day.deferred).toHaveLength(0);
    expect(
      deferralReasonFor(AdelanteEHR.listOrders(prn.pid).find((o) => o.id === prn.orderId)!),
    ).toBeUndefined();
  });

  it("drops doses once the order is discontinued", () => {
    const { pid, orderId } = signedOrder();
    AdelanteEHR.discontinueOrder(pid, orderId, "N. Ramirez", "therapy complete");
    expect(marFor(pid).slots.some((s) => s.order.id === orderId)).toBe(false);
  });
});

describe("charting doses", () => {
  it("blocks refused/held without a reason and records who/when when given", () => {
    const { pid, orderId } = signedOrder();
    const slot = marFor(pid).slots.find((s) => s.order.id === orderId)!;
    expect(() =>
      AdelanteEHR.chartDose(pid, orderId, slot.scheduledAt, "refused", "  ", "N. Ramirez", "b1"),
    ).toThrow(/reason is required/i);
    const row = AdelanteEHR.chartDose(
      pid,
      orderId,
      slot.scheduledAt,
      "given",
      undefined,
      "N. Ramirez",
      "b1",
      "charted late if needed",
    );
    expect(row.chartedBy).toBe("N. Ramirez");
    expect(row.action).toBe("given");
  });

  it("requires a late-entry reason beyond 4 hours past due", () => {
    const { pid, orderId } = signedOrder();
    const long = new Date(Date.now() - 9 * 3600_000).toISOString();
    expect(() =>
      AdelanteEHR.chartDose(pid, orderId, long, "given", undefined, "N. Ramirez", "b2"),
    ).toThrow(/late-entry reason/i);
    const ok = AdelanteEHR.chartDose(
      pid,
      orderId,
      long,
      "given",
      undefined,
      "N. Ramirez",
      "b2",
      "cart offline",
    );
    expect(ok.lateEntryReason).toBe("cart offline");
  });
});

describe("claim state machine", () => {
  it("claims, blocks a foreign release, and requires a reason for takeover", () => {
    const { pid, orderId } = signedOrder();
    const at = new Date().toISOString();
    AdelanteEHR.claimDose(pid, orderId, at, "Nurse A");
    expect(() => AdelanteEHR.claimDose(pid, orderId, at, "Nurse B")).toThrow(/already claimed/i);
    expect(() => AdelanteEHR.releaseDose(pid, orderId, at, "Nurse B")).toThrow(/takeover/i);
    expect(() => AdelanteEHR.takeoverDose(pid, orderId, at, "Nurse B", " ")).toThrow(
      /reason is required/i,
    );
    const claim = AdelanteEHR.takeoverDose(pid, orderId, at, "Nurse B", "Nurse A off shift");
    expect(claim.claimedBy).toBe("Nurse B");
    AdelanteEHR.releaseDose(pid, orderId, at, "Nurse B");
    expect(
      AdelanteEHR.listDoseClaims(pid).some((c) => c.orderId === orderId && c.scheduledAt === at),
    ).toBe(false);
  });
});

describe("void batch", () => {
  it("requires a 3+ char reason and retains the original entries", () => {
    const { pid, orderId } = signedOrder();
    const at = new Date().toISOString();
    const batchId = `b_${Math.random().toString(36).slice(2)}`;
    AdelanteEHR.chartDose(pid, orderId, at, "given", undefined, "N. Ramirez", batchId);
    expect(() => AdelanteEHR.voidBatch(pid, batchId, "N. Ramirez", "no")).toThrow(/3 characters/i);
    AdelanteEHR.voidBatch(pid, batchId, "N. Ramirez", "wrong patient row");
    const rows = AdelanteEHR.listAdministrations(pid, { orderId });
    expect(rows.length).toBeGreaterThan(0);
    const voided = rows.find((r) => r.batchId === batchId)!;
    expect(voided.voided).toBe(true);
    expect(voided.voidReason).toBe("wrong patient row");
    expect(voided.voidedBy).toBe("N. Ramirez");
  });
});
