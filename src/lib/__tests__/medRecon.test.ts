// §Medication reconciliation — model tests.
import { describe, it, expect } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { isOrderActive } from "@/lib/orders";

const NURSE = "Rosa T., LVN";
const PMHNP = "Dr. R. Bagga, PMHNP-BC";

function newPatient(last: string) {
  return AdelanteEHR.createPatient({
    firstName: "Recon",
    lastName: last,
    dob: "1990-01-01",
    phone: "+15595550000",
  } as Parameters<typeof AdelanteEHR.createPatient>[0]).id;
}

function signedOrder(pid: string, drugName: string) {
  const draft = AdelanteEHR.addDraftOrder(pid, {
    drugName,
    dose: "50 mg",
    frequency: "Twice daily",
    route: "PO",
    createdBy: PMHNP,
  } as Parameters<typeof AdelanteEHR.addDraftOrder>[1]);
  AdelanteEHR.signOrders(pid, [draft.id], PMHNP);
  return AdelanteEHR.listOrders(pid).find((o) => o.id === draft.id)!;
}

describe("med reconciliation", () => {
  it("seeds exactly the currently-active orders", () => {
    const pid = newPatient("Seed");
    const keep = signedOrder(pid, "Sertraline");
    const held = signedOrder(pid, "Trazodone");
    AdelanteEHR.holdOrder(pid, held.id, PMHNP, "Pending labs");
    const stopped = signedOrder(pid, "Naproxen");
    AdelanteEHR.discontinueOrder(pid, stopped.id, PMHNP, "GI upset");
    AdelanteEHR.addDraftOrder(pid, {
      drugName: "Ibuprofen",
      createdBy: PMHNP,
    } as Parameters<typeof AdelanteEHR.addDraftOrder>[1]);

    const recon = AdelanteEHR.startMedReconciliation(pid, "intake", "From county jail", NURSE);
    const items = AdelanteEHR.listReconItems(pid, recon.id);
    expect(items.map((i) => i.drugName).sort()).toEqual(["Sertraline", "Trazodone"]);
    expect(items.every((i) => i.source === "active_order" && i.decision === "not_reviewed")).toBe(
      true,
    );
    // Seeding predicate agrees with the shared orders-layer definition.
    expect(AdelanteEHR.listOrders(pid).filter(isOrderActive).map((o) => o.id).sort()).toEqual(
      [keep.id, held.id].sort(),
    );
    expect(() => AdelanteEHR.startMedReconciliation(pid, "intake", undefined, NURSE)).toThrow(
      /already in progress/i,
    );
  });

  it("blocks completion while an active med is not reviewed", () => {
    const pid = newPatient("Block");
    signedOrder(pid, "Sertraline");
    signedOrder(pid, "Metformin");
    const recon = AdelanteEHR.startMedReconciliation(pid, "transfer", undefined, NURSE);
    const [first] = AdelanteEHR.listReconItems(pid, recon.id);
    AdelanteEHR.updateReconItem(pid, recon.id, first!.id, { decision: "continue" }, NURSE);
    expect(AdelanteEHR.unreviewedReconItems(pid, recon.id)).toHaveLength(1);
    expect(() => AdelanteEHR.completeMedReconciliation(pid, recon.id, PMHNP)).toThrow(
      /still need a decision/i,
    );
  });

  it("discontinues stop/modify orders on completion with the decision note as the reason", () => {
    const pid = newPatient("Cascade");
    const keep = signedOrder(pid, "Sertraline");
    const stop = signedOrder(pid, "Trazodone");
    const modify = signedOrder(pid, "Metformin");
    const recon = AdelanteEHR.startMedReconciliation(pid, "release", undefined, NURSE);
    const items = AdelanteEHR.listReconItems(pid, recon.id);
    const byDrug = (n: string) => items.find((i) => i.drugName === n)!;
    AdelanteEHR.updateReconItem(pid, recon.id, byDrug("Sertraline").id, { decision: "continue" }, NURSE);
    AdelanteEHR.updateReconItem(
      pid,
      recon.id,
      byDrug("Trazodone").id,
      { decision: "stop", decisionNote: "No longer indicated" },
      NURSE,
    );
    AdelanteEHR.updateReconItem(
      pid,
      recon.id,
      byDrug("Metformin").id,
      { decision: "modify", newDose: "1000 mg" },
      NURSE,
    );

    const res = AdelanteEHR.completeMedReconciliation(pid, recon.id, PMHNP);
    expect(res.reconciliation.status).toBe("completed");
    expect(res.reconciliation.completedAt).toBeTruthy();
    expect(res.discontinuedOrderIds.sort()).toEqual([stop.id, modify.id].sort());

    const orders = AdelanteEHR.listOrders(pid);
    const find = (id: string) => orders.find((o) => o.id === id)!;
    expect(find(keep.id).status).toBe("signed");
    expect(find(stop.id).status).toBe("discontinued");
    expect(find(stop.id).statusReason).toBe("No longer indicated");
    expect(find(stop.id).statusChangedBy).toBe(PMHNP);
    // No note given on the modify row → generic fallback reason.
    expect(find(modify.id).status).toBe("discontinued");
    expect(find(modify.id).statusReason).toMatch(/medication reconciliation/i);
    expect(() => AdelanteEHR.completeMedReconciliation(pid, recon.id, PMHNP)).toThrow(
      /already closed/i,
    );
  });

  it("leaves every order untouched when discarded", () => {
    const pid = newPatient("Discard");
    const a = signedOrder(pid, "Sertraline");
    const recon = AdelanteEHR.startMedReconciliation(pid, "intake", undefined, NURSE);
    const [item] = AdelanteEHR.listReconItems(pid, recon.id);
    AdelanteEHR.updateReconItem(pid, recon.id, item!.id, { decision: "stop" }, NURSE);
    AdelanteEHR.cancelMedReconciliation(pid, recon.id, NURSE);
    expect(AdelanteEHR.listOrders(pid).find((o) => o.id === a.id)!.status).toBe("signed");
    expect(AdelanteEHR.activeMedReconciliation(pid)).toBeUndefined();
    expect(AdelanteEHR.listMedReconciliations(pid)[0]!.status).toBe("canceled");
  });

  it("keeps home meds informational and only lets home rows be removed", () => {
    const pid = newPatient("Home");
    signedOrder(pid, "Sertraline");
    const recon = AdelanteEHR.startMedReconciliation(pid, "intake", undefined, NURSE);
    const before = AdelanteEHR.listOrders(pid).length;
    const home = AdelanteEHR.addHomeReconItem(
      pid,
      recon.id,
      { drugName: "Lisinopril", dose: "10 mg", frequency: "Daily", route: "PO" },
      NURSE,
    );
    expect(home.source).toBe("home");
    expect(home.orderId).toBeUndefined();
    expect(AdelanteEHR.listOrders(pid)).toHaveLength(before);

    const seeded = AdelanteEHR.listReconItems(pid, recon.id).find((i) => i.source === "active_order")!;
    expect(() => AdelanteEHR.removeReconItem(pid, recon.id, seeded.id, NURSE)).toThrow(
      /must be decided/i,
    );
    AdelanteEHR.removeReconItem(pid, recon.id, home.id, NURSE);
    expect(AdelanteEHR.listReconItems(pid, recon.id).some((i) => i.id === home.id)).toBe(false);

    // A home row never blocks completion.
    AdelanteEHR.updateReconItem(pid, recon.id, seeded.id, { decision: "continue" }, NURSE);
    AdelanteEHR.addHomeReconItem(pid, recon.id, { drugName: "Vitamin D" }, NURSE);
    expect(() => AdelanteEHR.completeMedReconciliation(pid, recon.id, PMHNP)).not.toThrow();
  });

  it("reports history with per-decision counts and refuses edits once closed", () => {
    const pid = newPatient("History");
    signedOrder(pid, "Sertraline");
    const r1 = AdelanteEHR.startMedReconciliation(pid, "intake", "first", NURSE);
    const [i1] = AdelanteEHR.listReconItems(pid, r1.id);
    AdelanteEHR.updateReconItem(pid, r1.id, i1!.id, { decision: "continue" }, NURSE);
    AdelanteEHR.completeMedReconciliation(pid, r1.id, PMHNP);

    const r2 = AdelanteEHR.startMedReconciliation(pid, "release", undefined, NURSE);
    AdelanteEHR.cancelMedReconciliation(pid, r2.id, NURSE);

    const history = AdelanteEHR.listMedReconciliations(pid);
    expect(history.map((r) => r.status)).toEqual(["canceled", "completed"]);
    const counts = AdelanteEHR.listReconItems(pid, r1.id).filter((i) => i.decision === "continue");
    expect(counts).toHaveLength(1);
    expect(() =>
      AdelanteEHR.updateReconItem(pid, r1.id, i1!.id, { decision: "stop" }, NURSE),
    ).toThrow(/closed/i);
  });
});
