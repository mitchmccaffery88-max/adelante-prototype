// §Recovery start date — the two things that must hold: the math is honest,
// and the field is Part 2-gated exactly like SUD screener content.
import { describe, it, expect, beforeEach } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
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

describe("Part 2 gating of the recovery start date", () => {
  const patientId = AdelanteEHR.listPatients()[0]!.id;
  beforeEach(() => {
    AdelanteEHR.setRecoveryStartDate(patientId, "2026-01-01", { kind: "patient" });
  });

  it("lets the patient read their own date", () => {
    expect(
      AdelanteEHR.viewRecoveryStartDate(patientId, { kind: "patient", patientId }).date,
    ).toBe("2026-01-01");
  });

  it("masks it from a consent-gated staff role without Part 2 consent", () => {
    AdelanteEHR.setConsent(patientId, "part2Sud", false);
    const view = AdelanteEHR.viewRecoveryStartDate(patientId, {
      kind: "staff",
      role: "case_manager",
    });
    expect(view.masked).toBe(true);
    expect(view.date).toBeUndefined();
    expect(() =>
      AdelanteEHR.getRecoveryStartDate(patientId, { kind: "staff", role: "case_manager" }),
    ).toThrow();
  });

  it("unmasks for a treating clinician and for a consented gated role", () => {
    AdelanteEHR.setConsent(patientId, "part2Sud", false);
    expect(
      AdelanteEHR.viewRecoveryStartDate(patientId, { kind: "staff", role: "therapist" }).masked,
    ).toBe(false);
    AdelanteEHR.setConsent(patientId, "part2Sud", true);
    expect(
      AdelanteEHR.viewRecoveryStartDate(patientId, { kind: "staff", role: "case_manager" }).masked,
    ).toBe(false);
  });

  it("never lets a billing role read it", () => {
    AdelanteEHR.setConsent(patientId, "part2Sud", true);
    expect(
      AdelanteEHR.viewRecoveryStartDate(patientId, { kind: "staff", role: "billing" }).masked,
    ).toBe(true);
  });

  it("writes an audit entry on every change, including a clear", () => {
    AdelanteEHR.setRecoveryStartDate(patientId, "2026-02-02", { kind: "patient" });
    AdelanteEHR.setRecoveryStartDate(patientId, null, { kind: "patient" });
    const events = AdelanteEHR.listAuditEvents({ patientId }).filter((e) =>
      e.action.startsWith("recovery_start_date"),
    );
    expect(events[0]?.action).toBe("recovery_start_date_cleared");
    expect(events.some((e) => e.action === "recovery_start_date_set")).toBe(true);
  });
});