// §Intake/SDOH Redesign Phase 3 — reconciliation of prior SDOH data at intake.
import { describe, expect, it } from "vitest";
import { AdelanteEHR, type SdohPlanItem } from "@/lib/ehr";
import { buildIntakeNeedsPlan, hasPriorSdohEvidence } from "@/lib/intakeNeedsReconcile";

const item = (over: Partial<SdohPlanItem>): SdohPlanItem => ({
  id: over.id ?? "i1",
  need: over.need ?? "Stable housing",
  source: over.source ?? "staff_assessed",
  status: over.status ?? "identified",
  visibleToPatient: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

describe("intake needs plan", () => {
  it("asks all four categories when there is no prior data", () => {
    const plan = buildIntakeNeedsPlan({});
    expect(plan.capture).toEqual(["housing", "food", "employment", "transport"]);
    expect(plan.known).toHaveLength(0);
    expect(plan.onFileOnly).toHaveLength(0);
    expect(hasPriorSdohEvidence(plan)).toBe(false);
  });

  it("confirms mapped positive HRSN domains instead of re-asking them", () => {
    const plan = buildIntakeNeedsPlan({
      domains: [
        { key: "housing", label: "Housing instability & quality", positive: true },
        { key: "food", label: "Food insecurity", positive: true },
        { key: "transportation", label: "Transportation", positive: false },
      ],
    });
    expect(plan.known.map((k) => k.intakeKey)).toEqual(["housing", "food"]);
    expect(plan.known.every((k) => k.source === "pre_release_hrsn")).toBe(true);
    // Employment always stays a capture question — HRSN does not screen for it.
    expect(plan.capture).toEqual(["employment", "transport"]);
  });

  it("never runs utilities or interpersonal safety through confirm/deny", () => {
    const plan = buildIntakeNeedsPlan({
      domains: [
        { key: "utilities", label: "Utility needs", positive: true },
        { key: "safety", label: "Interpersonal safety", positive: true },
      ],
    });
    expect(plan.known).toHaveLength(0);
    expect(plan.onFileOnly.map((d) => d.domainKey)).toEqual(["utilities", "safety"]);
    expect(plan.capture).toEqual(["housing", "food", "employment", "transport"]);
  });

  it("preserves the source of an existing item rather than re-sourcing it", () => {
    const plan = buildIntakeNeedsPlan({
      domains: [{ key: "housing", label: "Housing instability & quality", positive: true }],
      items: [item({ id: "h1", need: "Housing instability & quality", source: "pre_release_hrsn" })],
    });
    expect(plan.known[0]).toMatchObject({
      intakeKey: "housing",
      source: "pre_release_hrsn",
      existingItemId: "h1",
    });
  });

  it("surfaces staff- and advocate-raised items as known needs too", () => {
    const plan = buildIntakeNeedsPlan({
      items: [
        item({ id: "a1", need: "Transportation", source: "advocate_reported" }),
        item({ id: "s1", need: "Food / CalFresh", source: "staff_assessed" }),
        // Closed items are history, not a live need to confirm.
        item({ id: "c1", need: "Stable housing", status: "completed" }),
      ],
    });
    expect(plan.known.map((k) => k.intakeKey).sort()).toEqual(["food", "transport"]);
    expect(plan.capture).toContain("housing");
  });
});

describe("applyIntakeNeeds", () => {
  const patientId = () => AdelanteEHR.listPatients()[0]!.id;

  it("creates provenance-tagged rows and never duplicates or re-sources", () => {
    const id = patientId();
    const before = AdelanteEHR.getPatient(id)!.sdohPlan?.items.length ?? 0;

    AdelanteEHR.applyIntakeNeeds(id, {
      confirmed: [{ need: "Housing instability & quality", source: "pre_release_hrsn" }],
      selfReported: [{ need: "Employment / job training" }],
    });
    const items = AdelanteEHR.getPatient(id)!.sdohPlan!.items;
    expect(items.length).toBe(before + 2);
    expect(items.find((i) => i.need === "Housing instability & quality")!.source).toBe(
      "pre_release_hrsn",
    );
    expect(items.find((i) => i.need === "Employment / job training")!.source).toBe(
      "intake_self_report",
    );

    // A second pass touches, never duplicates, and never rewrites provenance.
    const res = AdelanteEHR.applyIntakeNeeds(id, {
      confirmed: [{ need: "Housing instability & quality", source: "intake_self_report" }],
      selfReported: [{ need: "Employment / job training" }],
    });
    expect(res.created).toBe(0);
    expect(res.touched).toBe(1);
    const after = AdelanteEHR.getPatient(id)!.sdohPlan!.items;
    expect(after.length).toBe(before + 2);
    expect(after.find((i) => i.need === "Housing instability & quality")!.source).toBe(
      "pre_release_hrsn",
    );
  });
});
