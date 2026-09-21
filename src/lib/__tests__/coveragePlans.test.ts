// §Phase 3b — one coverage model, and two CalAIM answers that stay separate.
import { describe, expect, it } from "vitest";
import { AdelanteEHR, type Patient } from "@/lib/ehr";
import { calaimComputedForPatient } from "@/lib/calaim";

const actor = { actorId: "Tester", actorRole: "ecm_provider" as const };

describe("coverage plan spans live on Patient.coverage", () => {
  it("migrated seed spans are readable through the one model", () => {
    const plans = AdelanteEHR.listCoveragePlans("p1");
    expect(plans.length).toBeGreaterThan(0);
    expect(plans[0]!.payer).toBe("Medi-Cal FFS");
    // No seed may claim an electronic 270/271 verification.
    expect(plans.every((p) => p.source !== ("verified_270_271" as never))).toBe(true);
  });

  it("adds an attributed plan without touching coverage status", () => {
    const before = AdelanteEHR.getPatient("p2")?.coverage?.status;
    const res = AdelanteEHR.addCoveragePlan("p2", {
      payer: "CalViva Health",
      from: "2026-01-01",
      source: "front_desk",
      ...actor,
    });
    expect(res.ok).toBe(true);
    const added = AdelanteEHR.listCoveragePlans("p2")[0]!;
    expect(added.payer).toBe("CalViva Health");
    expect(added.recordedBy).toBe("Tester");
    expect(AdelanteEHR.getPatient("p2")?.coverage?.status).toBe(before);
  });

  it("rejects an end date before the start date", () => {
    const plan = AdelanteEHR.listCoveragePlans("p1")[0]!;
    expect(AdelanteEHR.endCoveragePlan("p1", plan.id, "2000-01-01", actor).ok).toBe(false);
  });

  it("activeCoveragePlan respects the span dates", () => {
    expect(AdelanteEHR.activeCoveragePlan("p1", "2024-01-01T00:00:00.000Z")).toBeUndefined();
    expect(AdelanteEHR.activeCoveragePlan("p1", "2026-01-01T00:00:00.000Z")?.payer).toBe(
      "Medi-Cal FFS",
    );
  });
});

describe("the two CalAIM answers stay separate", () => {
  it("computing clinical eligibility never changes the staff-set ECM flag", () => {
    const p = AdelanteEHR.getPatient("p1") as Patient;
    const ecmBefore = Boolean(p.coverage?.ecmEligible);
    const computed = calaimComputedForPatient(p);
    expect(typeof computed.qualifies).toBe("boolean");
    expect(Boolean(AdelanteEHR.getPatient("p1")?.coverage?.ecmEligible)).toBe(ecmBefore);
  });

  it("reports honestly that nothing can be computed with no qualifying codes", () => {
    const p = AdelanteEHR.getPatient("p1") as Patient;
    const computed = calaimComputedForPatient(p, []);
    expect(computed).toEqual({ configured: false, qualifies: false, rows: [] });
  });
});
