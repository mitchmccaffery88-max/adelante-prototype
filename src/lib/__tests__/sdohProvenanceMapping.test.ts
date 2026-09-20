// §Intake/SDOH Redesign Phase 2 — prerequisites for safe reconciliation.
import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { AHC_HRSN } from "@/lib/screeners";
import {
  INTAKE_NEEDS_WITHOUT_DOMAIN,
  SDOH_DOMAIN_MAPPINGS,
  intakeKeyForDomain,
  mappingCoverageGaps,
  mappingForIntakeKey,
} from "@/lib/sdohMapping";

describe("AHC-HRSN ↔ intake need mapping", () => {
  it("covers every domain the real instrument declares, with no stale rows", () => {
    const gaps = mappingCoverageGaps();
    expect(gaps.unmappedDomainKeys).toEqual([]);
    expect(gaps.staleMappingKeys).toEqual([]);
    expect(SDOH_DOMAIN_MAPPINGS).toHaveLength(AHC_HRSN.domains.length);
  });

  it("uses the real domain labels from the instrument definition", () => {
    for (const m of SDOH_DOMAIN_MAPPINGS) {
      const domain = AHC_HRSN.domains.find((d) => d.key === m.domainKey);
      expect(domain, m.domainKey).toBeDefined();
      expect(m.domainLabel).toBe(domain!.label);
    }
  });

  it("maps the three domains that have a real intake equivalent", () => {
    expect(intakeKeyForDomain("housing")).toBe("housing");
    expect(intakeKeyForDomain("food")).toBe("food");
    expect(intakeKeyForDomain("transportation")).toBe("transport");
  });

  it("reports utilities and safety as having NO intake equivalent rather than forcing one", () => {
    expect(intakeKeyForDomain("utilities")).toBeNull();
    expect(intakeKeyForDomain("safety")).toBeNull();
    for (const key of ["utilities", "safety"]) {
      expect(SDOH_DOMAIN_MAPPINGS.find((m) => m.domainKey === key)!.rationale).toMatch(/NO intake/);
    }
  });

  it("records employment as an intake category with no HRSN domain", () => {
    expect(INTAKE_NEEDS_WITHOUT_DOMAIN).toEqual(["employment"]);
    expect(mappingForIntakeKey("employment")).toBeUndefined();
  });

  it("never maps two domains onto the same intake category", () => {
    const used = SDOH_DOMAIN_MAPPINGS.map((m) => m.intakeKey).filter(Boolean);
    expect(new Set(used).size).toBe(used.length);
  });
});

describe("SdohPlanItem provenance", () => {
  it("defaults a chart-side add to staff_assessed", () => {
    const p = AdelanteEHR.listPatients()[0]!;
    AdelanteEHR.addSdohItem(p.id, { need: "Bus pass for appointments" });
    const item = AdelanteEHR.getPatient(p.id)!.sdohPlan!.items[0]!;
    expect(item.need).toBe("Bus pass for appointments");
    expect(item.source).toBe("staff_assessed");
  });

  it("stores an explicit source when the caller supplies one", () => {
    const p = AdelanteEHR.listPatients()[1]!;
    AdelanteEHR.addSdohItem(p.id, { need: "Food box", source: "intake_self_report" });
    const item = AdelanteEHR.getPatient(p.id)!.sdohPlan!.items[0]!;
    expect(item.source).toBe("intake_self_report");
  });

  it("gives every seeded item a real source", () => {
    for (const p of AdelanteEHR.listPatients()) {
      for (const i of p.sdohPlan?.items ?? []) expect(i.source).toBeTruthy();
    }
  });
});
