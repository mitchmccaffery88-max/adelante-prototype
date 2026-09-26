import { describe, it, expect } from "vitest";
import { AdelanteEHR, demoScenarioPatientId, DEMO_PRE_RELEASE_PERSONA } from "@/lib/ehr";
import { RESOURCE_CATEGORIES } from "@/lib/communityResources";
import { OPTIONAL_TOPICS, HRSN_DOMAIN_CATEGORY, shouldSkipCoreQuestions, recentHrsn, patientSafeNeedLabel } from "@/lib/whatWouldHelp";
import { matchResourcesForNeed } from "@/lib/sdohResourceMatch";

const ids = new Set(RESOURCE_CATEGORIES.map((c) => c.id));

describe("What would help you — step 1", () => {
  it("every optional topic and HRSN domain maps to a real directory category", () => {
    for (const t of OPTIONAL_TOPICS) expect(ids.has(t.categoryId)).toBe(true);
    for (const c of Object.values(HRSN_DOMAIN_CATEGORY)) expect(ids.has(c)).toBe(true);
  });
  it("Tomás's pre-release needs mean the core questions are confirmed, not re-asked", () => {
    const t = AdelanteEHR.listPatients().find((p) => p.firstName === DEMO_PRE_RELEASE_PERSONA.firstName && p.lastName === DEMO_PRE_RELEASE_PERSONA.lastName)!;
    expect(shouldSkipCoreQuestions(t)).toBe(true);
    const safety = t.sdohPlan!.items.find((i) => i.safetySensitive)!;
    expect(patientSafeNeedLabel(safety)).toBeNull();
  });
  it("a recent AHC-HRSN result (draft 30 days) skips; an old one does not", () => {
    const p = { screeners: { "ahc-hrsn": { completedAt: "2026-09-01T00:00:00Z" } } } as never;
    expect(recentHrsn(p, new Date("2026-09-20T00:00:00Z"))).toBe(true);
    expect(recentHrsn(p, new Date("2026-11-20T00:00:00Z"))).toBe(false);
  });
  it("applyIntakeNeeds stores category, provenance and urgency, and merges without erasing", () => {
    const p = AdelanteEHR.createPatient({ firstName: "Needs", lastName: "Step" } as never) as { id: string };
    AdelanteEHR.applyIntakeNeeds(p.id, { confirmed: [], selfReported: [
      { need: "Legal help", categoryId: "legal", urgency: "today" },
      { need: "Interpersonal safety", categoryId: "legal", safetySensitive: true },
    ] });
    let items = AdelanteEHR.getPatient(p.id)!.sdohPlan!.items;
    const legal = items.find((i) => i.need === "Legal help")!;
    expect(legal).toMatchObject({ source: "intake_self_report", categoryId: "legal", urgency: "today" });
    expect(matchResourcesForNeed(legal)?.categoryIds).toEqual(["legal"]);
    expect(items.find((i) => i.safetySensitive)!.visibleToPatient).toBe(false);
    AdelanteEHR.applyIntakeNeeds(p.id, { confirmed: [], selfReported: [{ need: "Legal help" }] });
    items = AdelanteEHR.getPatient(p.id)!.sdohPlan!.items;
    expect(items.filter((i) => i.need === "Legal help")).toHaveLength(1);
    expect(items.find((i) => i.need === "Legal help")!.urgency).toBe("today");
  });
  it("Victor has an optional topic marked today", () => {
    const v = AdelanteEHR.getPatient(demoScenarioPatientId("ji_self_report")!)!;
    expect(v.sdohPlan!.items.some((i) => i.need === "ID and documents" && i.urgency === "today")).toBe(true);
  });
});
