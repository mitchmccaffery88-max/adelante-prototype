// §Custody tracking + shift count — model tests.
import { describe, it, expect } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";

const CM = "Luz Herrera";
const NURSE = "Rosa T., LVN";
const PMHNP = "Dr. R. Bagga, PMHNP-BC";

function newPatient(last: string) {
  const p = AdelanteEHR.createPatient({
    firstName: "Test",
    lastName: last,
    dob: "1990-01-01",
    phone: "+15595550000",
  } as Parameters<typeof AdelanteEHR.createPatient>[0]);
  return p.id;
}

describe("bookings", () => {
  it("closes a booking, flips status, and reports current booking state", () => {
    const pid = newPatient("Booker");
    const b = AdelanteEHR.addBooking(
      pid,
      { bookingNumber: "BK-1", facilityName: "Main Jail", bookedAt: "2026-01-02T08:00:00.000Z" },
      CM,
    );
    expect(AdelanteEHR.isCurrentlyBooked(pid)).toBe(true);
    expect(b.releasedAt).toBeUndefined();

    const closed = AdelanteEHR.closeBooking(b.id, "2026-01-20T14:00:00.000Z", CM);
    expect(closed.releasedAt).toBe("2026-01-20T14:00:00.000Z");
    expect(AdelanteEHR.isCurrentlyBooked(pid)).toBe(false);
    expect(() => AdelanteEHR.closeBooking(b.id, "2026-01-21T00:00:00.000Z", CM)).toThrow(
      /already released/i,
    );
  });

  it("records housing moves against a booking and reports the current unit", () => {
    const pid = newPatient("Mover");
    const b = AdelanteEHR.addBooking(
      pid,
      { bookingNumber: "BK-2", facilityName: "Main Jail", bookedAt: "2026-02-01T08:00:00.000Z" },
      CM,
    );
    AdelanteEHR.addHousingMove(
      pid,
      { bookingId: b.id, movedAt: "2026-02-01T09:00:00.000Z", facilityName: "Main Jail", housingUnit: "3B" },
      CM,
    );
    AdelanteEHR.addHousingMove(
      pid,
      { bookingId: b.id, movedAt: "2026-02-09T09:00:00.000Z", facilityName: "Main Jail", housingUnit: "Med Obs" },
      CM,
    );
    expect(AdelanteEHR.listHousingMoves(pid)).toHaveLength(2);
    expect(AdelanteEHR.currentHousingUnit(pid)).toBe("Med Obs");
    expect(() =>
      AdelanteEHR.addHousingMove(
        pid,
        { bookingId: "nope", movedAt: "2026-02-09T09:00:00.000Z", facilityName: "x", housingUnit: "y" },
        CM,
      ),
    ).toThrow(/booking/i);
  });
});

describe("released patient search", () => {
  it("includes a release later in the day on the range's boundary date", () => {
    const pid = newPatient("Boundary");
    const b = AdelanteEHR.addBooking(
      pid,
      { bookingNumber: "BK-3", facilityName: "North Annex", bookedAt: "2026-03-01T08:00:00.000Z" },
      CM,
    );
    // 14:00 on the boundary date — a naive timestamp `<= to` compare drops it.
    AdelanteEHR.closeBooking(b.id, "2026-03-15T14:00:00.000Z", CM);

    const hits = AdelanteEHR.searchReleasedPatients({
      lastName: "Boundary",
      releasedFrom: "2026-03-15",
      releasedTo: "2026-03-15",
    });
    expect(hits).toHaveLength(1);
    expect(hits[0].facilityName).toBe("North Annex");
    expect(hits[0].bookingCount).toBe(1);

    expect(
      AdelanteEHR.searchReleasedPatients({ lastName: "Boundary", releasedTo: "2026-03-14" }),
    ).toHaveLength(0);
  });

  it("excludes currently booked patients and finds them in the active roster", () => {
    const pid = newPatient("StillIn");
    AdelanteEHR.addBooking(
      pid,
      { bookingNumber: "BK-4", facilityName: "Main Jail", bookedAt: "2026-04-01T08:00:00.000Z" },
      CM,
    );
    expect(AdelanteEHR.searchReleasedPatients({ lastName: "StillIn" })).toHaveLength(0);
    expect(AdelanteEHR.searchBookedPatients({ lastName: "StillIn" })).toHaveLength(1);
  });
});

function controlledOrder(pid: string, schedule: "CII" | "CIV") {
  const draft = AdelanteEHR.addDraftOrder(pid, {
    drugName: "Lorazepam",
    productName: "Lorazepam 1 MG Oral Tablet",
    strengthText: "1 MG",
    doseForm: "Oral Tablet",
    doseAxis: "mg",
    doseTargetMg: 1,
    unitsPerAdmin: 1,
    route: "PO",
    frequency: "twice daily",
    frequencyCode: "BID",
    durationValue: 7,
    durationUnit: "days",
    quantity: 14,
    daysSupply: 7,
    sig: "Take 1 tablet by mouth twice daily",
    dispenseRoute: "pharmacy",
    isControlled: true,
    deaSchedule: schedule,
    startDate: new Date().toISOString().slice(0, 10),
    createdBy: PMHNP,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  AdelanteEHR.signOrders(pid, [draft.id], PMHNP);
  return draft.id;
}

describe("shift count", () => {
  it("aggregates controlled MAR data across patients and locks an immutable record", () => {
    const a = newPatient("CountA");
    const b = newPatient("CountB");
    const now = Date.now();
    const oa = controlledOrder(a, "CIV");
    const ob = controlledOrder(b, "CIV");
    AdelanteEHR.chartDose(
      a,
      oa,
      new Date(now).toISOString(),
      "given",
      undefined,
      NURSE,
      "b1",
    );
    AdelanteEHR.chartDose(
      b,
      ob,
      new Date(now).toISOString(),
      "refused",
      "Patient declined.",
      NURSE,
      "b2",
    );

    const windowStart = new Date(now - 3600_000).toISOString();
    const windowEnd = new Date(now + 3600_000).toISOString();
    const lines = AdelanteEHR.aggregateShiftCount({ windowStart, windowEnd, schedule: "CIV" });
    const line = lines.find((l) => l.drugName === "Lorazepam");
    expect(line).toBeTruthy();
    expect(line!.given).toBeGreaterThanOrEqual(1);
    expect(line!.refusedOrHeld).toBeGreaterThanOrEqual(1);
    expect(line!.patients).toBeGreaterThanOrEqual(2);

    // Schedule filter excludes non-matching schedules.
    expect(
      AdelanteEHR.aggregateShiftCount({ windowStart, windowEnd, schedule: "CII" }).some(
        (l) => l.drugName === "Lorazepam",
      ),
    ).toBe(false);

    expect(() =>
      AdelanteEHR.lockShiftCount({
        windowStart,
        windowEnd,
        schedule: "CIV",
        counterName: NURSE,
        witnessName: NURSE,
      }),
    ).toThrow(/different person/i);

    const locked = AdelanteEHR.lockShiftCount({
      windowStart,
      windowEnd,
      schedule: "CIV",
      counterName: NURSE,
      witnessName: "Dr. Marisol Reyes",
      notes: "End of shift",
    });
    expect(locked.totalGiven).toBe(lines.reduce((n, l) => n + l.given, 0));
    expect(AdelanteEHR.listShiftCounts(20)[0].id).toBe(locked.id);

    // Immutability: mutating the returned copy never touches history.
    const snapshot = AdelanteEHR.listShiftCounts(20)[0];
    snapshot.lines[0].given = 999;
    snapshot.totalGiven = 999;
    expect(AdelanteEHR.listShiftCounts(20)[0].totalGiven).toBe(locked.totalGiven);

    // Charting after the lock does not change the locked snapshot.
    const c = newPatient("CountC");
    const oc = controlledOrder(c, "CIV");
    AdelanteEHR.chartDose(c, oc, new Date(now + 60_000).toISOString(), "given", undefined, NURSE, "b3");
    expect(AdelanteEHR.listShiftCounts(20)[0].totalGiven).toBe(locked.totalGiven);
  });
});
