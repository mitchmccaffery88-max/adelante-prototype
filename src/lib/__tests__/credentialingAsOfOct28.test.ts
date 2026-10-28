// 28 Oct fix (Mitch, Draft): exclusion screening is judged as of `asOf`
// (booking = now); end-dated items stay on the date of service; billing
// readiness keeps the date-of-service mode.
import { describe, expect, it } from "vitest";
import { AdelanteEHR, bookingCredentialingBlock } from "../ehr";
import "../ehr-ext";
import {
  CREDENTIALING_NEUTRAL_LABEL,
  credentialingReviewFlags,
  evaluateCredentialing,
  exclusionChecksDue,
  type ClinicianCredentialing,
} from "../credentialing";

const DAY = 86400_000;
const at = (n: number) => new Date(Date.now() + n * DAY).toISOString();
const NOW = at(0);

function record(checkedDaysAgo: number, patch: Partial<ClinicianCredentialing> = {}): ClinicianCredentialing {
  const checkedAt = at(-checkedDaysAgo);
  return {
    staffId: "s-fixture",
    clinicianId: "c-fixture",
    license: { licenseType: "LCSW", number: "DEMO-LIC-9", state: "CA", expiresAt: at(400), verificationSource: "bbs", verifiedAt: at(-30), verifiedBy: "s-cred1", method: "manual" },
    exclusionChecks: (["oig", "sam_gov", "medi_cal_suspended"] as const).map((list) => ({ list, result: "clear" as const, checkedAt, nextDueAt: new Date(+new Date(checkedAt) + 30 * DAY).toISOString() })),
    enrollments: [{ payer: "Medi-Cal FFS", serviceType: "*", status: "active", effectiveAt: at(-500) }],
    documentStatus: "simulated_unavailable",
    ...patch,
  } as ClinicianCredentialing;
}
const input = (dos: string, asOf?: string) => ({ payer: "Medi-Cal FFS", serviceType: "therapy_individual", dateOfService: dos, asOf });

describe("booking judges exclusion screening as of now", () => {
  it.each([45, 90, 180])("checked 8 days ago: bookable %i days out", (days) => {
    expect(evaluateCredentialing(record(8), input(at(days), NOW)).ok).toBe(true);
  });

  it("staff and self-scheduled bookings 45/90/180 days out succeed for a credentialed clinician", () => {
    const p = AdelanteEHR.createPatient({ firstName: "AsOf", lastName: "Fixture", dob: "1990-01-01" } as Parameters<typeof AdelanteEHR.createPatient>[0]);
    AdelanteEHR.addCoveragePlan(p.id, { payer: "Medi-Cal FFS", from: at(-400).slice(0, 10) } as Parameters<typeof AdelanteEHR.addCoveragePlan>[1]);
    for (const days of [45, 90, 180]) {
      expect(bookingCredentialingBlock("c1", "therapy_individual", p.id, at(days))).toBeUndefined();
      const d = new Date(at(days));
      d.setHours(11, 0, 0, 0);
      while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
      for (const source of ["staff_scheduled", "self_scheduled"] as const) {
        const start = new Date(+d + (source === "self_scheduled" ? 2 * 3600_000 : 0)).toISOString();
        const appt = AdelanteEHR.bookAppointment({
          patientId: p.id, clinicianId: "c1", start, durationMin: 50, serviceType: "therapy_individual",
          modality: "in_person", locationId: "loc-visalia", source,
          bookedBy: source === "staff_scheduled" ? { id: "Priya Raman", role: "clinical_coordinator" } : { id: p.id, role: "patient" },
          allowPatientOverlap: true,
        } as Parameters<typeof AdelanteEHR.bookAppointment>[0]);
        expect(appt.id).toBeTruthy();
      }
    }
  });

  it("an overdue check as of today blocks", () => {
    const res = evaluateCredentialing(record(45), input(at(10), NOW));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reasons).toContain("exclusion_check_overdue");
  });

  it("the demo c5 (overdue) stays blocked at booking", () => {
    const p = AdelanteEHR.createPatient({ firstName: "AsOf", lastName: "C5", dob: "1990-01-01" } as Parameters<typeof AdelanteEHR.createPatient>[0]);
    AdelanteEHR.addCoveragePlan(p.id, { payer: "Medi-Cal FFS", from: at(-400).slice(0, 10) } as Parameters<typeof AdelanteEHR.addCoveragePlan>[1]);
    expect(bookingCredentialingBlock("c5", "med_management", p.id, at(5))).toBe("This clinician can't be booked for this service right now.");
  });

  it("an exclusion hit blocks", () => {
    const r = record(2);
    r.exclusionChecks = [...r.exclusionChecks, { list: "oig", result: "hit", checkedAt: at(-1), nextDueAt: at(29) }];
    const res = evaluateCredentialing(r, input(at(60), NOW));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reasons).toContain("exclusion_hit");
  });

  it("a license expiring before the date of service blocks that booking only", () => {
    const r = record(8, { license: { ...record(8).license!, expiresAt: at(30) } });
    expect(evaluateCredentialing(r, input(at(20), NOW)).ok).toBe(true);
    const later = evaluateCredentialing(r, input(at(45), NOW));
    expect(later.ok).toBe(false);
    if (!later.ok) expect(later.reasons).toEqual(["license_expired"]);
  });
});

describe("billing readiness keeps the date of service", () => {
  it("a visit after the check fell due fails readiness when judged on the DOS", () => {
    const res = evaluateCredentialing(record(8), input(at(45), at(45)));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reasons).toContain("exclusion_check_overdue");
  });
  it("omitting asOf is the historical date-of-service mode", () => {
    expect(evaluateCredentialing(record(8), input(at(45))).ok).toBe(false);
    expect(evaluateCredentialing(record(8), input(at(10))).ok).toBe(true);
  });
});

describe("between booking and the visit", () => {
  it("booked visits after the check's due date appear on the coordinator tile", () => {
    const p = AdelanteEHR.createPatient({ firstName: "AsOf", lastName: "Tile", dob: "1990-01-01" } as Parameters<typeof AdelanteEHR.createPatient>[0]);
    AdelanteEHR.addCoveragePlan(p.id, { payer: "Medi-Cal FFS", from: at(-400).slice(0, 10) } as Parameters<typeof AdelanteEHR.addCoveragePlan>[1]);
    const d = new Date(at(70));
    d.setHours(15, 0, 0, 0);
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
    AdelanteEHR.bookAppointment({
      patientId: p.id, clinicianId: "c1", start: d.toISOString(), durationMin: 50, serviceType: "therapy_individual",
      modality: "in_person", locationId: "loc-visalia", source: "staff_scheduled",
      bookedBy: { id: "Priya Raman", role: "clinical_coordinator" }, allowPatientOverlap: true,
    } as Parameters<typeof AdelanteEHR.bookAppointment>[0]);
    const rows = exclusionChecksDue().filter((r) => r.staffId === "s-th1");
    expect(rows.length).toBe(3);
    expect(rows.every((r) => r.state === "before_visits" && (r.visitsAfterDue ?? 0) >= 1)).toBe(true);
  });

  it("an overdue check on the visit day flags the visit and never cancels it", () => {
    // Visit day = today (DOS passed into asOf); c5 is overdue as of today.
    const appt = { id: "a-fixture", clinicianId: "c5", patientId: "p-x", start: at(-0.01), status: "scheduled", serviceType: "med_management" };
    const before = JSON.stringify(appt);
    const flags = credentialingReviewFlags([appt], [], () => "Medi-Cal FFS");
    expect(flags.map((f) => f.id)).toEqual(["a-fixture"]);
    expect(flags[0].reasons).toContain("exclusion_check_overdue");
    expect(JSON.stringify(appt)).toBe(before);
  });

  it("a future visit is not flagged just because a future check hasn't happened yet", () => {
    const appt = { id: "a-future", clinicianId: "c1", patientId: "p-x", start: at(90), status: "scheduled", serviceType: "therapy_individual" };
    expect(credentialingReviewFlags([appt], [], () => "Medi-Cal FFS")).toEqual([]);
  });

  it("other roles still see only the neutral label", () => {
    expect(CREDENTIALING_NEUTRAL_LABEL).toBeTruthy();
    expect(CREDENTIALING_NEUTRAL_LABEL).not.toMatch(/exclusion|license|OIG|SAM/i);
  });
});
