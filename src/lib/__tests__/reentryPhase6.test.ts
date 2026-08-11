import { beforeEach, describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import {
  DAY_ZERO_PLAN_STEPS,
  DAY_ZERO_STEPS,
  __resetDayZero,
  completeDayZeroStep,
  dayZeroAvailability,
  getDayZeroProgress,
  saveDayZeroPlan,
} from "@/lib/reentryDayZero";
import {
  RESOURCE_CATEGORIES,
  __resetResources,
  isResourceLive,
  listResources,
  patientVisibleResources,
  resourceVerificationQueue,
  updateResourceDetails,
  verifyResource,
} from "@/lib/communityResources";
import {
  __resetObligations,
  addObligation,
  listObligations,
  obligationsAvailable,
} from "@/lib/obligations";

function patient(lastName: string) {
  return AdelanteEHR.createPatient({ firstName: "Phase6", lastName }).id;
}

/** A general-population person: an explicit non-justice front-door answer. */
function generalPopulation(lastName: string) {
  const id = patient(lastName);
  AdelanteEHR.recordFrontDoorEntry(id, { existingCare: "no", heardAbout: "word_of_mouth" } as never);
  return id;
}

/** The REAL safety-net path: lookup runs, finds nothing, catch-up generated. */
function missedHandoffPatient(lastName: string) {
  const id = patient(lastName);
  AdelanteEHR.recordFrontDoorEntry(id, { existingCare: "unsure" } as never);
  AdelanteEHR.setCoverage(id, {
    status: "none_unsure",
    verified: "not_found",
    coverageType: "unknown",
    justiceInvolvement: "yes",
  } as never);
  const lookup = AdelanteEHR.runSafetyNetRecordLookup(id);
  AdelanteEHR.generateMissedHandoffCatchUp({
    patientId: id,
    ownerName: "Intake staff",
    ownerRole: "ecm_provider",
    trigger: "record_lookup_pending",
  });
  return { id, lookup };
}

beforeEach(() => {
  __resetDayZero();
  __resetResources();
  __resetObligations();
});

describe("Day-0 module triggers from the real safety-net lookup", () => {
  it("is unavailable to a general-population patient", () => {
    const id = generalPopulation("General");
    const a = dayZeroAvailability(id);
    expect(a.available).toBe(false);
    expect(a.reason).toMatch(/general_population/);
  });

  it("is unavailable to a justice-involved patient with no safety-net outcome", () => {
    const id = patient("JiNoLookup");
    AdelanteEHR.setCoverage(id, { justiceInvolvement: "yes" } as never);
    const a = dayZeroAvailability(id);
    expect(a.available).toBe(false);
    expect(a.reason).toMatch(/not generically available/);
  });

  it("becomes available once the missed-handoff catch-up is generated", () => {
    const { id, lookup } = missedHandoffPatient("Missed");
    expect(lookup.ran).toBe(true);
    expect(lookup.status).toBe("none");
    const a = dayZeroAvailability(id);
    expect(a.available).toBe(true);
    expect(a.trigger).toBe("missed_pre_release_coordination");
  });

  it("refuses writes when the module is not triggered", () => {
    const id = generalPopulation("NoWrite");
    expect(completeDayZeroStep(id, DAY_ZERO_STEPS[0]!.id)).toBe(false);
    expect(getDayZeroProgress(id)).toBeUndefined();
  });

  it("carries the verbatim ten-step sequence and a five-step 24-hour plan", () => {
    expect(DAY_ZERO_STEPS).toHaveLength(10);
    expect(DAY_ZERO_STEPS[0]!.title).toBe("Welcome — You're Not Alone");
    expect(DAY_ZERO_STEPS[8]!.subtitle).toBe("Tonight only. Not your whole life.");
    expect(DAY_ZERO_PLAN_STEPS.map((s) => s.id)).toEqual([
      "sleep",
      "meal",
      "medications",
      "person",
      "meeting",
    ]);
  });

  it("enforces each plan step's pick cap and drops unknown options", () => {
    const { id } = missedHandoffPatient("Plan");
    const meds = DAY_ZERO_PLAN_STEPS.find((s) => s.id === "medications")!;
    const plan = saveDayZeroPlan(id, {
      sleep: ["A shelter bed", "With family"],
      medications: meds.options.slice(0, 5),
      meal: ["Something invented"],
    })!;
    expect(plan.picks["sleep"]).toHaveLength(1);
    expect(plan.picks["medications"]).toHaveLength(meds.maxPicks);
    expect(plan.picks["meal"]).toBeUndefined();
  });
});

describe("Obligations are strictly justice-involved only", () => {
  it("never renders or stores for a general-population patient", () => {
    const id = generalPopulation("GeneralObl");
    expect(obligationsAvailable(id)).toBe(false);
    expect(
      addObligation({ patientId: id, kind: "po_check_in", title: "Check-in", when: new Date().toISOString() }),
    ).toBeUndefined();
    expect(listObligations(id)).toEqual([]);
  });

  it("does not open on an unconfirmed 'not sure' justice answer", () => {
    const id = patient("Unsure");
    AdelanteEHR.setCoverage(id, { justiceInvolvement: "unsure" } as never);
    expect(obligationsAvailable(id)).toBe(false);
  });

  it("stores kind/when/location/notes and completion for a JI patient", () => {
    const { id } = missedHandoffPatient("Obl");
    const when = new Date(Date.now() + 86400000).toISOString();
    const o = addObligation({
      patientId: id,
      kind: "court",
      title: "Superior Court appearance",
      when,
      location: "Dept 4",
      notes: "Bring paperwork",
    })!;
    expect(o.completed).toBe(false);
    expect(listObligations(id)).toHaveLength(1);
  });
});

describe("Community resources cannot go live without a real verification", () => {
  it("seeds one clearly-placeholder skeleton per category, none patient-visible", () => {
    expect(listResources()).toHaveLength(RESOURCE_CATEGORIES.length);
    expect(listResources().every((r) => r.placeholder && !r.verified)).toBe(true);
    expect(patientVisibleResources()).toEqual([]);
    expect(resourceVerificationQueue()).toHaveLength(RESOURCE_CATEGORIES.length);
  });

  it("refuses verification without address/phone/hours, and without all three confirmations", () => {
    const r = listResources()[0]!;
    const bare = verifyResource({
      resourceId: r.id,
      actorName: "CM",
      actorRole: "cf_care_manager",
      confirmedAddress: true,
      confirmedPhone: true,
      confirmedHours: true,
    });
    expect(bare.ok).toBe(false);

    updateResourceDetails(r.id, { address: "1 Main St", phone: "559-555-0000", hours: "9-5" });
    const partial = verifyResource({
      resourceId: r.id,
      actorName: "CM",
      actorRole: "cf_care_manager",
      confirmedAddress: true,
      confirmedPhone: true,
      confirmedHours: false,
    });
    expect(partial.ok).toBe(false);
    expect(patientVisibleResources()).toEqual([]);
  });

  it("refuses a role that may not publish", () => {
    const r = listResources()[0]!;
    updateResourceDetails(r.id, { address: "1 Main St", phone: "559-555-0000", hours: "9-5" });
    const res = verifyResource({
      resourceId: r.id,
      actorName: "Biller",
      actorRole: "billing",
      confirmedAddress: true,
      confirmedPhone: true,
      confirmedHours: true,
    });
    expect(res.ok).toBe(false);
  });

  it("goes live only after a complete staff verification, and drops out again on edit", () => {
    const r = listResources()[0]!;
    updateResourceDetails(r.id, { address: "1 Main St", phone: "559-555-0000", hours: "9-5" });
    const res = verifyResource({
      resourceId: r.id,
      actorName: "CM",
      actorRole: "cf_care_manager",
      confirmedAddress: true,
      confirmedPhone: true,
      confirmedHours: true,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(isResourceLive(res.resource)).toBe(true);
    expect(patientVisibleResources().map((x) => x.id)).toEqual([r.id]);

    // An expired verification is not live.
    expect(isResourceLive(res.resource, "2999-01-01")).toBe(false);

    updateResourceDetails(r.id, { hours: "10-4" });
    expect(patientVisibleResources()).toEqual([]);
  });
});