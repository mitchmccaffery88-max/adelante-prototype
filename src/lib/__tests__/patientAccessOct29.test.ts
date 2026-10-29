import { describe, it, expect } from "vitest";
import { AdelanteEHR, type ServiceType } from "@/lib/ehr";
import { runAction } from "@/lib/actions/runAction";
import { STAFF_ROLES } from "@/lib/roles";
import { PATIENT_ACTOR_ROLE, patientBookableClinicians, patientRequestVisit, patientSelfBook, patientServiceMenu } from "@/lib/patientBooking";
import { availableSlots } from "@/lib/clinicianAvailability";

// 29 Oct (Draft — pending Christi): patientAccess on the one catalog.
const fresh = () => {
  const p = AdelanteEHR.listPatients().find((x) => AdelanteEHR.appointmentsForPatient(x.id).length === 0 && !(x.appointmentRequests ?? []).length)!;
  return p;
};

describe("patientAccess menu", () => {
  it("staff_only types are never offered to any patient", () => {
    const staffOnly: ServiceType[] = ["intake", "therapy_group", "sud_group_odf", "sud_group_iot"];
    for (const p of AdelanteEHR.listPatients()) {
      const ids = patientServiceMenu(p).map((o) => o.service.id);
      for (const s of staffOnly) expect(ids).not.toContain(s);
    }
  });

  it("every catalog entry declares patientAccess", () => {
    for (const s of AdelanteEHR.listServiceTypes()) expect(["book", "request", "staff_only"]).toContain(s.patientAccess);
  });

  it("therapy with no established clinician is Ask my team; with one, only that calendar books", () => {
    const p = fresh();
    p.primaryClinicianId = undefined;
    expect(patientServiceMenu(p).find((o) => o.service.id === "therapy_individual")?.mode).toBe("request");
    expect(patientBookableClinicians(p, "therapy_individual", "in_person")).toEqual([]);
    p.primaryClinicianId = "c1";
    const opt = patientServiceMenu(p).find((o) => o.service.id === "therapy_individual");
    expect(opt?.mode).toBe("book");
    expect(patientBookableClinicians(p, "therapy_individual", "in_person").map((o) => o.clinician.id)).toEqual(["c1"]);
  });

  it("SUD counseling is hidden without a signed ASAM placement", () => {
    const p = fresh();
    p.asamAssessments = [];
    expect(patientServiceMenu(p).map((o) => o.service.id)).not.toContain("sud_counseling");
    p.asamAssessments = [{ id: "asam-t", version: 1, status: "signed", dimensions: [], actualLevel: "1.0", diagnosisCodes: [], authoredBy: { staffId: "s", name: "S", role: "sud_counselor" }, authoredAt: new Date().toISOString(), triggerReasons: [], signedAt: new Date().toISOString() } as never];
    expect(patientServiceMenu(p).find((o) => o.service.id === "sud_counseling")?.mode).toBe("book");
    p.asamAssessments = [];
  });

  it("Ask my team uses the existing request flow once, then reports the duplicate", () => {
    const p = fresh();
    p.primaryClinicianId = undefined;
    const actor = { role: PATIENT_ACTOR_ROLE, staffId: p.id, staffName: "Patient (self)" };
    const r1 = runAction("patient_request_visit", actor, p, { args: [{ patientId: p.id, serviceType: "therapy_individual" }] });
    expect(r1.ok).toBe(true);
    expect((r1 as { value: { outcome: string } }).value.outcome).toBe("requested");
    expect((p.appointmentRequests ?? []).filter((r) => r.kind === "therapy" && r.status === "requested")).toHaveLength(1);
    const r2 = runAction("patient_request_visit", actor, p, { args: [{ patientId: p.id, serviceType: "therapy_individual" }] });
    expect((r2 as { value: { outcome: string } }).value.outcome).toBe("already_requested");
  });

  it("a request-mode or staff_only type can't be self-booked, and a book type can't be requested", () => {
    const p = fresh();
    p.primaryClinicianId = undefined;
    const slot = availableSlots("c1", { serviceType: "therapy_individual", modality: "in_person" })[0]!;
    expect(() => patientSelfBook({ patientId: p.id, clinicianId: "c1", start: slot, serviceType: "therapy_individual", modality: "in_person", locationId: "loc-visalia" })).toThrow();
    expect(() => patientSelfBook({ patientId: p.id, clinicianId: "c1", start: slot, serviceType: "intake", modality: "in_person", locationId: "loc-visalia" })).toThrow();
    expect(() => patientRequestVisit({ patientId: p.id, serviceType: "peer_support" })).toThrow();
  });

  it("staff roles can't use the patient request action", () => {
    const p = fresh();
    for (const { key } of STAFF_ROLES) expect(runAction("patient_request_visit", { role: key, staffId: "s-x" }, p, { args: [{ patientId: p.id, serviceType: "therapy_individual" }] }).ok).toBe(false);
  });
});
