import { describe, it, expect } from "vitest";
import "@/lib/ehr-ext";
import "@/lib/nursing";
import "@/lib/careManagerCalendar";
import {
  AdelanteEHR,
  GROUP_CAPACITY_MAX,
  OPEN_GROUP_CAPACITY_DEFAULT_DRAFT,
  OPEN_GROUP_CAPACITY_DRAFT_LABEL,
  groupCapacityRule,
  type Clinician,
} from "@/lib/ehr";
import { AdelanteEHRExt } from "@/lib/ehr-ext";
import { eligibleClinicians } from "@/lib/bookingFlow";
import { patientFeeNotice } from "@/lib/patientBooking";
import { scheduleCopy } from "@/lib/scheduleCopy";

const ADMIN = { kind: "staff", role: "sys_admin" } as never;

describe("30 Oct (c) CHW and nurse calendars", () => {
  it("the demo CHW has a CHW-visit calendar with Draft default hours", () => {
    const cal = AdelanteEHR.getClinician("s-chw1");
    expect(cal?.services).toEqual(["chw_visit"]);
    expect(AdelanteEHRExt.availabilityBlocksForClinician("s-chw1").length).toBe(5);
  });

  it("the demo RN calendar offers nurse visits; the LVN offers nothing", () => {
    expect(AdelanteEHR.getClinician("c-rn1")?.services).toEqual(["nurse_visit"]);
    expect(AdelanteEHRExt.availabilityBlocksForClinician("c-rn1").length).toBe(5);
    expect(AdelanteEHR.getClinician("c-lvn1")?.services).toEqual([]);
  });

  it("a calendar with no services list is offered for no visit type", () => {
    AdelanteEHR.registerClinician({ id: "c-noservices", name: "Test No Services", credential: "LCSW", mediCalCredentialed: true, mediCalStatus: "active", licenseExpiresOn: "2030-01-01" } as Clinician);
    for (const s of AdelanteEHR.listServiceTypes()) {
      expect(AdelanteEHR.cliniciansForService(s.id).map((c) => c.id)).not.toContain("c-noservices");
      expect(eligibleClinicians(s.id, undefined, ADMIN).map((c) => c.clinician.id)).not.toContain("c-noservices");
    }
  });
});

describe("30 Oct (d) group capacity by category", () => {
  const base = { topic: "Test", serviceType: "therapy_group", facilitatorId: "c1", start: new Date(Date.now() + 864e5).toISOString(), durationMin: 60, modality: "in_person", recurrence: { kind: "one_off" }, createdBy: "s-th1" } as never as Parameters<typeof AdelanteEHR.createGroupSession>[0];

  it("billable groups keep 2–12", () => {
    expect(() => AdelanteEHR.createGroupSession({ ...base, capacity: 13, category: "sud_clinical_preauth" })).toThrow(/12/);
    expect(() => AdelanteEHR.createGroupSession({ ...base, capacity: 1, category: "skills_education" })).toThrow();
    expect(AdelanteEHR.createGroupSession({ ...base, capacity: 12, category: "skills_education" }).capacity).toBe(12);
  });

  it("open psychoeducational groups take a facilitator-set capacity above 12", () => {
    const g = AdelanteEHR.createGroupSession({ ...base, capacity: 30, category: "open_psychoeducational" });
    expect(g.capacity).toBe(30);
    expect(() => AdelanteEHR.createGroupSession({ ...base, capacity: 0, category: "open_psychoeducational" })).toThrow();
    // switching that group to a billable category re-applies 2–12
    expect(() => AdelanteEHR.updateGroupSession(g.id, { category: "skills_education" }, "s-th1")).toThrow(new RegExp(String(GROUP_CAPACITY_MAX)));
  });

  it("the open-group default is labelled Draft", () => {
    expect(groupCapacityRule("open_psychoeducational")).toEqual({ min: 1, defaultCapacity: OPEN_GROUP_CAPACITY_DEFAULT_DRAFT, draft: true });
    expect(OPEN_GROUP_CAPACITY_DRAFT_LABEL).toMatch(/^Draft/);
  });
});

describe("30 Oct patient fee notice", () => {
  it("private pay shows the sliding-scale notice; copy carries the Draft label", () => {
    const p = AdelanteEHR.listPatients().find((x) => !AdelanteEHR.listCoveragePlans?.(x.id)?.length) ?? AdelanteEHR.listPatients()[0];
    AdelanteEHR._setPaymentArrangement(p.id, "self_pay", { id: "s-bill1", name: "Test", role: "billing", at: new Date().toISOString() });
    const n = patientFeeNotice(p.id, "therapy_individual");
    expect(n).toBe("sliding_scale");
    expect(scheduleCopy("en").feeSlidingScale).toBe("Fee: per sliding scale (Draft — tiers pending)");
    expect(scheduleCopy("en").coverageReview).toBe("Coverage being reviewed");
  });

  it("no service picked shows nothing", () => {
    expect(patientFeeNotice(AdelanteEHR.listPatients()[0].id, "")).toBeUndefined();
  });
});
