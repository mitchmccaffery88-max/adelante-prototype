import { describe, it, expect } from "vitest";
import { AdelanteEHR, SELF_BOOKING_REFUSED, type ServiceType } from "@/lib/ehr";
import { runAction } from "@/lib/actions/runAction";
import { STAFF_ROLES } from "@/lib/roles";
import { PATIENT_ACTOR_ROLE, patientBookableClinicians, patientRequestVisit, patientSelfBook, patientServiceMenu } from "@/lib/patientBooking";
import { availableSlots } from "@/lib/clinicianAvailability";
import { bookableServiceTypes, eligibleClinicians, visitTypeLabel } from "@/lib/bookingFlow";

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

describe("29 Oct new service types (Draft)", () => {
  const svc = (id: ServiceType) => AdelanteEHR.getServiceType(id)!;
  it("installs the five types with the Draft patientAccess from the table", () => {
    expect(svc("psychiatric_evaluation").patientAccess).toBe("request");
    expect(svc("sud_assessment").patientAccess).toBe("staff_only");
    expect(svc("sud_assessment").sud).toBe(true);
    expect(svc("chw_visit").patientAccess).toBe("book");
    expect(svc("family_collateral").patientAccess).toBe("request");
    expect(svc("nurse_visit").patientAccess).toBe("staff_only");
  });
  it("only prescribers take psychiatric evaluations; only SUD-offering calendars take ASAM assessments", () => {
    const p = AdelanteEHR.listPatients()[0]!;
    const actor = { role: "clinical_coordinator", staffId: "s-cc" } as never;
    const pe = eligibleClinicians("psychiatric_evaluation", p, actor).map((s) => s.clinician.credential);
    expect(pe.length).toBeGreaterThan(0);
    expect(pe.every((c) => /PMHNP|M\.?D|D\.?O/.test(c))).toBe(true);
    expect(eligibleClinicians("sud_assessment", p, actor).map((s) => s.clinician.id)).toEqual(["c7"]);
    expect(eligibleClinicians("nurse_visit", p, actor)).toEqual([]);
  });
  it("roles without SUD visit access never see the ASAM assessment type", () => {
    expect(bookableServiceTypes("peer_specialist").map((s) => s.id)).not.toContain("sud_assessment");
    expect(visitTypeLabel("sud_assessment", "peer_specialist")).toBe("Clinical visit");
  });
});

describe("29 Oct one booking rule for patients and staff (Draft)", () => {
  const slotFor = (c: string, s: ServiceType) => availableSlots(c, { serviceType: s, modality: "in_person" })[0]!;
  it("the store refuses self-scheduled group, staff_only and request types for any caller", () => {
    const p = fresh();
    for (const serviceType of ["therapy_group", "intake", "nurse_visit", "psychiatric_evaluation", "family_collateral"] as ServiceType[]) {
      expect(() => AdelanteEHR.bookAppointment({ patientId: p.id, clinicianId: "c3", start: slotFor("c3", "med_management"), durationMin: 30, serviceType, modality: "in_person", locationId: "loc-visalia", source: "self_scheduled", bookedBy: { id: p.id, role: "patient" } })).toThrow(SELF_BOOKING_REFUSED);
    }
  });
  it("self-booking gets the same clinician-fit check as staff booking", () => {
    const p = fresh();
    // c1 (LCSW) does not prescribe: refused for patients exactly as for staff.
    expect(() => AdelanteEHR.bookAppointment({ patientId: p.id, clinicianId: "c1", start: slotFor("c1", "therapy_individual"), durationMin: 30, serviceType: "med_management", modality: "in_person", locationId: "loc-visalia", source: "self_scheduled", bookedBy: { id: p.id, role: "patient" } })).toThrow(/doesn't offer|physician or PMHNP/);
  });
  it("the picker drops a clinician who isn't credentialed for the resolved funding source", async () => {
    const cred = await import("@/lib/credentialing");
    const p = fresh();
    p.primaryClinicianId = "c1";
    const before = patientBookableClinicians(p, "therapy_individual", "in_person").map((o) => o.clinician.id);
    expect(before).toContain("c1");
    const spy = (await import("vitest")).vi.spyOn(cred, "credentialedForService").mockReturnValue({ ok: false, reasons: ["license_expired"] } as never);
    try {
      const blocked = AdelanteEHR.bookAppointment.length >= 0 && patientBookableClinicians(p, "therapy_individual", "in_person").map((o) => o.clinician.id);
      // Only applies when the funding source is billable; non-billable work is never blocked.
      const funding = (await import("@/lib/fundingSource")).resolveFundingSource(p.id, "therapy_individual", new Date().toISOString());
      if (funding.source && funding.source !== "non_billable") expect(blocked).not.toContain("c1");
      else expect(blocked).toContain("c1");
    } finally {
      spy.mockRestore();
    }
  });
});
