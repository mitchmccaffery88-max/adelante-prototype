// §Dashboard Cleanup Phase 6a — refill review attribution + assignment scope.
import { describe, it, expect } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { isAssignedTo } from "@/lib/caseloadScope";

function firstPatientWithMeds() {
  return AdelanteEHR.listPatients().find((p) => AdelanteEHR.listMedications(p.id).length > 0);
}

describe("refill review attribution", () => {
  it("records the reviewer and raises a provider switch on a second reviewer", () => {
    const patient = firstPatientWithMeds();
    expect(patient).toBeDefined();
    const med = AdelanteEHR.listMedications(patient!.id)[0]!;

    const first = AdelanteEHR.requestRefill({
      patientId: patient!.id,
      medicationId: med.id,
      requestedBy: "patient",
    });
    expect(first).toBeDefined();
    const reviewedFirst = AdelanteEHR.reviewRefill({
      id: first!.id,
      decision: "approved",
      clinicianId: "clin_a",
    });
    expect(reviewedFirst?.reviewedBy).toBe("clin_a");
    expect(reviewedFirst?.status).toBe("sent_to_pharmacy");

    const second = AdelanteEHR.requestRefill({
      patientId: patient!.id,
      medicationId: med.id,
      requestedBy: "patient",
    });
    const reviewedSecond = AdelanteEHR.reviewRefill({
      id: second!.id,
      decision: "approved",
      clinicianId: "clin_b",
    });
    expect(reviewedSecond?.reviewedBy).toBe("clin_b");

    const switches = AdelanteEHR.listProviderSwitches({ patientId: patient!.id });
    expect(
      switches.some(
        (s) =>
          s.reason === "refill_review" &&
          s.fromClinicianId === "clin_a" &&
          s.toClinicianId === "clin_b",
      ),
    ).toBe(true);
  });

  it("scopes pending refills to patients assigned to the acting clinician", () => {
    const patient = firstPatientWithMeds();
    const med = AdelanteEHR.listMedications(patient!.id)[0]!;
    AdelanteEHR.requestRefill({
      patientId: patient!.id,
      medicationId: med.id,
      requestedBy: "clinician",
    });
    const identity = { clinicianId: patient!.primaryClinicianId };
    const pending = AdelanteEHR.listRefillRequests({ status: "pending" });
    const mine = pending.filter((r) => {
      const p = AdelanteEHR.listPatients().find((x) => x.id === r.patientId);
      return p ? isAssignedTo(p, identity) : false;
    });
    if (patient!.primaryClinicianId) {
      expect(mine.length).toBeGreaterThan(0);
      expect(mine.every((r) => r.patientId === patient!.id)).toBe(true);
    }
    const nobody = pending.filter((r) => {
      const p = AdelanteEHR.listPatients().find((x) => x.id === r.patientId);
      return p ? isAssignedTo(p, { clinicianId: "nobody" }) : false;
    });
    expect(nobody).toHaveLength(0);
  });
});
