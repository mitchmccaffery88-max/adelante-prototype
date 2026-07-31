import { describe, expect, it } from "vitest";
import { AdelanteEHR, type CalaimQualifyingCode, type Patient } from "@/lib/ehr";
import {
  calaimEligibleDischarges,
  calaimEligiblePatients,
  distinctPatients,
  matchQualifyingCode,
} from "@/lib/calaim";

const code = (c: string): CalaimQualifyingCode => ({
  id: `q-${c}`,
  codeSystem: "icd10",
  code: c,
  active: true,
  createdBy: "test",
  createdAt: new Date().toISOString(),
});

function patient(over: Partial<Patient>): Patient {
  return {
    id: "px",
    firstName: "Test",
    lastName: "Patient",
    ...over,
  } as Patient;
}

describe("qualifying code matching", () => {
  it("matches exact codes with or without the dot", () => {
    expect(matchQualifyingCode("F10.20", code("F10.20"))).toBe("exact");
    expect(matchQualifyingCode("f1020", code("F10.20"))).toBe("exact");
  });
  it("matches category prefixes", () => {
    expect(matchQualifyingCode("F10.20", code("F10"))).toBe("prefix");
  });
  it("does not match unrelated codes", () => {
    expect(matchQualifyingCode("F33.1", code("F10"))).toBeNull();
    expect(matchQualifyingCode(undefined, code("F10"))).toBeNull();
  });
});

describe("calaimEligiblePatients", () => {
  const codes = [code("F10"), code("F11.20")];
  const p = patient({
    id: "pa",
    firstName: "Ana",
    lastName: "Reyes",
    problems: [
      {
        id: "pr1",
        patientId: "pa",
        icd10Code: "F10.20",
        description: "Alcohol use disorder",
        status: "active",
        enteredBy: "t",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "pr2",
        patientId: "pa",
        icd10Code: "F11.20",
        description: "Opioid use disorder",
        status: "resolved",
        enteredBy: "t",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "pr3",
        patientId: "pa",
        icd10Code: "I10",
        description: "Hypertension",
        status: "active",
        enteredBy: "t",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  });

  it("returns only clinically-active matching problems with the matched code", () => {
    const rows = calaimEligiblePatients([p], codes);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.matchedCode).toBe("F10");
    expect(rows[0]!.matchKind).toBe("prefix");
    expect(distinctPatients(rows)).toBe(1);
  });

  it("returns nothing when no codes are configured", () => {
    expect(calaimEligiblePatients([p], [])).toEqual([]);
  });
});

describe("calaimEligibleDischarges", () => {
  const codes = [code("F10")];
  const now = new Date("2026-07-31T12:00:00.000Z");
  const p = patient({
    id: "pb",
    firstName: "Luis",
    lastName: "Ortiz",
    problems: [
      {
        id: "pr1",
        patientId: "pb",
        icd10Code: "F10.20",
        description: "Alcohol use disorder",
        // Resolved on purpose: the handoff signal is "ever had".
        status: "resolved",
        enteredBy: "t",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    bookings: [
      {
        id: "b1",
        patientId: "pb",
        bookingNumber: "BK-1",
        facilityId: "f1",
        facilityName: "County Jail",
        bookedAt: "2026-07-01T00:00:00.000Z",
        releasedAt: "2026-07-31T03:00:00.000Z",
        createdBy: "t",
        createdAt: "2026-07-01T00:00:00.000Z",
      },
      {
        id: "b2",
        patientId: "pb",
        bookingNumber: "BK-0",
        facilityId: "f1",
        facilityName: "County Jail",
        bookedAt: "2026-05-01T00:00:00.000Z",
        releasedAt: "2026-05-10T00:00:00.000Z",
        createdBy: "t",
        createdAt: "2026-05-01T00:00:00.000Z",
      },
    ],
  });

  it("includes a release inside the window even when the problem is resolved", () => {
    const rows = calaimEligibleDischarges(24, [p], codes, now);
    expect(rows.map((r) => r.bookingNumber)).toEqual(["BK-1"]);
    expect(rows[0]!.matchedCode).toBe("F10");
  });
});

describe("qualifying code registry", () => {
  it("rejects exact duplicates and requires a reason to deactivate", () => {
    const before = AdelanteEHR.listQualifyingCodes(true).length;
    const row = AdelanteEHR.addQualifyingCode(
      { code: "z99.8", description: "Test code" },
      "Tester",
    );
    expect(row.code).toBe("Z99.8");
    expect(() => AdelanteEHR.addQualifyingCode({ code: "Z99.8" }, "Tester")).toThrow();
    expect(() => AdelanteEHR.deactivateQualifyingCode(row.id, "Tester", "  ")).toThrow();
    const off = AdelanteEHR.deactivateQualifyingCode(row.id, "Tester", "Not in the contract");
    expect(off.active).toBe(false);
    expect(AdelanteEHR.listQualifyingCodes().some((c) => c.id === row.id)).toBe(false);
    expect(AdelanteEHR.listQualifyingCodes(true).length).toBe(before + 1);
    const audits = AdelanteEHR.listAuditEvents?.() ?? [];
    if (audits.length)
      expect(
        audits.some((a: { action: string }) => a.action === "calaim_qualifying_code_deactivated"),
      ).toBe(true);
  });
});
