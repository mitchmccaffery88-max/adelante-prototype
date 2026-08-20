// §Recovery start date — two things must hold: the math is honest, and the
// field is PATIENT-PRIVATE. It is deliberately NOT in the clinical record
// (pending clinical validation), so there is no Part 2 gate to test: there is
// no staff or advocate read path at all, under any role or consent state.
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { AdelanteEHR } from "@/lib/ehr";
import {
  __resetSelfTracking,
  recoveryStartDate,
  setRecoveryStartDate,
} from "@/lib/selfTracking";
import { daysSober, daysSoberLabel, passedMilestone } from "@/lib/recoveryStartDate";

describe("daysSober", () => {
  const now = new Date(2026, 4, 20);
  it("counts whole local days", () => {
    expect(daysSober("2026-05-20", now)).toBe(0);
    expect(daysSober("2026-04-20", now)).toBe(30);
  });
  it("refuses a future date rather than showing a negative", () => {
    expect(daysSober("2026-06-01", now)).toBeNull();
  });
  it("labels without shame language", () => {
    expect(daysSoberLabel(null)).toBe("Set your date");
    expect(daysSoberLabel(0)).toMatch(/day one/i);
    expect(daysSoberLabel(45)).toBe("45 days");
    expect(passedMilestone(95)).toBe(90);
  });
});

describe("the date is patient-private self-tracking", () => {
  const patientId = AdelanteEHR.listPatients()[0]!.id;
  const DATE = "2026-01-01";
  beforeEach(() => {
    __resetSelfTracking();
    setRecoveryStartDate(patientId, DATE);
  });

  it("stores and clears, scoped to one patient", () => {
    expect(recoveryStartDate(patientId)).toBe(DATE);
    expect(recoveryStartDate("someone_else")).toBeUndefined();
    setRecoveryStartDate(patientId, null);
    expect(recoveryStartDate(patientId)).toBeUndefined();
  });

  it("never appears on the EHR patient record, under any consent state", () => {
    for (const consent of [true, false]) {
      AdelanteEHR.setConsent(patientId, "part2Sud", consent);
      const record = AdelanteEHR.listPatients().find((p) => p.id === patientId)!;
      expect(JSON.stringify(record)).not.toContain(DATE);
      expect("recoveryStartDate" in (record as Record<string, unknown>)).toBe(false);
    }
  });

  it("never appears in the audit stream", () => {
    setRecoveryStartDate(patientId, "2026-02-02");
    setRecoveryStartDate(patientId, null);
    const events = AdelanteEHR.listAuditEvents({ patientId });
    expect(events.some((e) => e.action.startsWith("recovery_start_date"))).toBe(false);
    expect(JSON.stringify(events)).not.toContain(DATE);
  });

  it("has no staff- or advocate-facing accessor left on the EHR at all", () => {
    const api = AdelanteEHR as unknown as Record<string, unknown>;
    for (const name of [
      "recoveryStartDateAccess",
      "getRecoveryStartDate",
      "viewRecoveryStartDate",
      "setRecoveryStartDate",
    ]) {
      expect(api[name], name).toBeUndefined();
    }
    expect(readFileSync("src/lib/ehr.ts", "utf8")).not.toMatch(/recoveryStartDate\??:/);
  });
});
