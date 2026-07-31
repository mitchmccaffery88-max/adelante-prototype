// §MAR — minimum-interval (minGapMinutes) enforcement on PRN charting.
// The gap rule shares `blocked` with the maxPerDay ceiling; `blockedBy` only
// distinguishes which rule fired.
import { describe, expect, it, beforeEach } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { resetFrequencyCatalog, frequencyByCode } from "@/lib/frequencies";
import { waitLabel } from "@/lib/facilityTime";

const NURSE = "N. Ramirez";
const at = () => new Date().toISOString();

function prnOrder(frequencyCode: string) {
  const pid = AdelanteEHR.listPatients()[0].id;
  const draft = AdelanteEHR.addDraftOrder(pid, {
    drugName: "ibuprofen 400 MG Oral Tablet",
    frequencyCode,
    createdBy: NURSE,
  } as never);
  AdelanteEHR.signOrders(pid, [draft.id], NURSE);
  return { pid, orderId: draft.id };
}

describe("PRN minimum-interval enforcement", () => {
  beforeEach(() => resetFrequencyCatalog());

  it("blocks a second dose inside the gap and allows it once elapsed", () => {
    AdelanteEHR.saveFrequency(
      {
        code: "GAP_PRN",
        label: "GAP PRN",
        sigLabel: "as needed",
        isPrn: true,
        adminTimes: [],
        maxPerDay: 6,
        minGapMinutes: 60,
      },
      "Christi Ruiz",
    );
    const { pid, orderId } = prnOrder("GAP_PRN");

    AdelanteEHR.chartDose(pid, orderId, at(), "given", "Pain", NURSE, "g1");

    // Immediately after: under the maxPerDay ceiling, but inside the gap.
    const now = new Date();
    const blocked = AdelanteEHR.prnEligibility(pid, orderId, now);
    expect(blocked.given).toBe(1);
    expect(blocked.blocked).toBe(true);
    expect(blocked.blockedBy).toBe("gap");
    expect(blocked.minGapMinutes).toBe(60);
    expect(blocked.waitMs).toBeGreaterThan(0);
    expect(blocked.waitMs).toBeLessThanOrEqual(60 * 60_000);
    expect(() =>
      AdelanteEHR.chartDose(pid, orderId, at(), "given", "Pain", NURSE, "g2"),
    ).toThrow(/minimum interval not met/i);

    // Halfway through: still blocked, and the label matches the real remainder.
    const half = new Date(now.getTime() + 30 * 60_000);
    const mid = AdelanteEHR.prnEligibility(pid, orderId, half);
    expect(mid.blockedBy).toBe("gap");
    expect(waitLabel(mid.waitMs)).toBe("30m");

    // After the gap: eligible again, nothing else changed.
    const after = new Date(now.getTime() + 61 * 60_000);
    const clear = AdelanteEHR.prnEligibility(pid, orderId, after);
    expect(clear.blocked).toBe(false);
    expect(clear.blockedBy).toBeUndefined();
    expect(clear.waitMs).toBe(0);
  });

  it("reports the gap boundary exactly — eligible at the instant it elapses", () => {
    AdelanteEHR.saveFrequency(
      {
        code: "GAP15",
        label: "GAP15",
        sigLabel: "as needed",
        isPrn: true,
        adminTimes: [],
        minGapMinutes: 15,
      },
      "Christi Ruiz",
    );
    const { pid, orderId } = prnOrder("GAP15");
    const given = AdelanteEHR.chartDose(pid, orderId, at(), "given", "Pain", NURSE, "b1");
    const clearsAt = new Date(new Date(given.chartedAt).getTime() + 15 * 60_000);

    const one = AdelanteEHR.prnEligibility(pid, orderId, new Date(clearsAt.getTime() - 1));
    expect(one.blocked).toBe(true);
    expect(one.eligibleAt).toBe(clearsAt.toISOString());

    expect(AdelanteEHR.prnEligibility(pid, orderId, clearsAt).blocked).toBe(false);
  });

  it("leaves a frequency without minGapMinutes completely unaffected", () => {
    // Q6H_PRN ships with maxPerDay 4 and no gap.
    expect(frequencyByCode("Q6H_PRN")?.minGapMinutes).toBeUndefined();
    const { pid, orderId } = prnOrder("Q6H_PRN");
    AdelanteEHR.chartDose(pid, orderId, at(), "given", "Pain", NURSE, "n1");
    const elig = AdelanteEHR.prnEligibility(pid, orderId);
    expect(elig.blocked).toBe(false);
    expect(elig.minGapMinutes).toBeUndefined();
    expect(elig.eligibleAt).toBeUndefined();
    expect(elig.waitMs).toBe(0);
    // Back-to-back charting still works exactly as before.
    expect(() =>
      AdelanteEHR.chartDose(pid, orderId, at(), "given", "Pain", NURSE, "n2"),
    ).not.toThrow();
  });

  it("keeps the maxPerDay ceiling as the reported blocker when both would fire", () => {
    AdelanteEHR.saveFrequency(
      {
        code: "ONEADAY_PRN",
        label: "ONEADAY PRN",
        sigLabel: "as needed",
        isPrn: true,
        adminTimes: [],
        maxPerDay: 1,
        minGapMinutes: 30,
      },
      "Christi Ruiz",
    );
    const { pid, orderId } = prnOrder("ONEADAY_PRN");
    AdelanteEHR.chartDose(pid, orderId, at(), "given", "Pain", NURSE, "m1");
    const elig = AdelanteEHR.prnEligibility(pid, orderId);
    expect(elig.blockedBy).toBe("max");
    expect(() =>
      AdelanteEHR.chartDose(pid, orderId, at(), "given", "Pain", NURSE, "m2"),
    ).toThrow(/PRN limit reached/i);
  });

  it("ignores voided and non-given rows when measuring the gap", () => {
    AdelanteEHR.saveFrequency(
      {
        code: "GAP_VOID",
        label: "GAP VOID",
        sigLabel: "as needed",
        isPrn: true,
        adminTimes: [],
        minGapMinutes: 120,
      },
      "Christi Ruiz",
    );
    const { pid, orderId } = prnOrder("GAP_VOID");
    // A refusal is not an administration — the gap must not start.
    AdelanteEHR.chartDose(pid, orderId, at(), "refused", "declined", NURSE, "v1");
    expect(AdelanteEHR.prnEligibility(pid, orderId).blocked).toBe(false);

    const row = AdelanteEHR.chartDose(pid, orderId, at(), "given", "Pain", NURSE, "v2");
    expect(AdelanteEHR.prnEligibility(pid, orderId).blockedBy).toBe("gap");
    AdelanteEHR.voidBatch(pid, row.batchId, NURSE, "charted on the wrong patient");
    expect(AdelanteEHR.prnEligibility(pid, orderId).blocked).toBe(false);
  });

  it("rejects a sub-minute gap at the admin registry", () => {
    expect(() =>
      AdelanteEHR.saveFrequency(
        {
          code: "BADGAP",
          label: "BADGAP",
          sigLabel: "as needed",
          isPrn: true,
          adminTimes: [],
          minGapMinutes: 0.5,
        },
        "Christi Ruiz",
      ),
    ).toThrow(/at least 1 minute/i);
  });
});