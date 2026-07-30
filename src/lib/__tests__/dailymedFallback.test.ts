// Parser + ordering coverage for the strength-resolution chain:
//   RxNav -> (units axis | topical) -> DailyMed SPL -> manual entry
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { needsDailyMedFallback, strengthProvenanceFor } from "@/lib/orders";
import { lookupDailyMedStrength, normalizeDailyMedStrength } from "@/lib/dailymed.server";
import type { MedOrder } from "@/lib/ehr";

const order = (o: Partial<MedOrder>): MedOrder => ({
  id: "o1",
  patientId: "p1",
  drugName: o.productName ?? "test",
  status: "draft",
  ...o,
});

describe("DailyMed fallback gating", () => {
  it("is skipped when RxNav already parses a mg strength", () => {
    expect(
      needsDailyMedFallback({ name: "lisinopril 10 MG Oral Tablet", strength: "10 MG" }),
    ).toBe(false);
  });

  it("is skipped for unit-dosed products (units axis, not a data gap)", () => {
    expect(
      needsDailyMedFallback({
        name: "insulin glargine 100 UNT/ML Pen Injector",
        strength: "100 UNT/ML",
      }),
    ).toBe(false);
  });

  it("is skipped for topicals even when the dose form property is missing", () => {
    expect(
      needsDailyMedFallback({ name: "hydrocortisone Topical Cream", strength: undefined }),
    ).toBe(false);
    expect(needsDailyMedFallback({ name: "mupirocin ointment", strength: "" })).toBe(false);
  });

  it("is used only for a genuine gap: not unit-dosed, not topical, unparseable", () => {
    expect(
      needsDailyMedFallback({ name: "Compounded mystery capsule", strength: "as directed" }),
    ).toBe(true);
  });
});

describe("DailyMed strength normalization", () => {
  it("handles the label phrasings DailyMed actually returns", () => {
    expect(normalizeDailyMedStrength("300 U in 1 mL")).toBe("300 UNT/ML");
    expect(normalizeDailyMedStrength("50 mg in 1 1")).toBe("50 MG");
    expect(normalizeDailyMedStrength("10 mg in 1 mL")).toBe("10 MG/ML");
    expect(normalizeDailyMedStrength("qs ad")).toBeUndefined();
  });
});

describe("lookupDailyMedStrength", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const json = (body: unknown) => ({ ok: true, json: async () => body });

  it("resolves strength from the SPL packaging payload", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ data: [{ setid: "set-1", title: "MYSTERY CAPSULE" }] }))
      .mockResolvedValueOnce(
        json({ data: { products: [{ active_ingredients: [{ strength: "250 mg in 1 1" }] }] } }),
      );
    const hit = await lookupDailyMedStrength({ rxcui: "12345" });
    expect(hit).toEqual({ strength: "250 MG", setid: "set-1", title: "MYSTERY CAPSULE" });
    expect(String(fetchMock.mock.calls[0][0])).toContain("spls.json?rxcui=12345");
  });

  it("prefers the SPL product whose ingredient count matches RxNav", async () => {
    fetchMock.mockResolvedValueOnce(json({ data: [{ setid: "set-2", title: "COMBO" }] })).mockResolvedValueOnce(
      json({
        data: {
          products: [
            { active_ingredients: [{ strength: "500 mg in 1 1" }] },
            {
              active_ingredients: [
                { strength: "5 mg in 1 1" },
                { strength: "325 mg in 1 1" },
              ],
            },
          ],
        },
      }),
    );
    const hit = await lookupDailyMedStrength({ rxcui: "999", expectedIngredients: 2 });
    expect(hit?.strength).toBe("5 MG / 325 MG");
  });

  it("returns undefined when DailyMed is also empty — the manual-entry case", async () => {
    fetchMock.mockResolvedValue(json({ data: [] }));
    expect(await lookupDailyMedStrength({ rxcui: "0", name: "nothing" })).toBeUndefined();
  });
});

describe("strength provenance recorded for the audit log", () => {
  it("labels a units-parsed ingredient", () => {
    const p = strengthProvenanceFor(
      order({ productName: "insulin glargine 100 UNT/ML Pen Injector", strengthText: "100 UNT/ML" }),
    );
    expect(p[0].source).toBe("units_parsed");
    expect(p[0].unitsPerMl).toBe(100);
  });

  it("labels a DailyMed-resolved strength", () => {
    const p = strengthProvenanceFor(
      order({
        productName: "mystery capsule",
        strengthText: "250 MG",
        strengthSource: "dailymed",
      }),
    );
    expect(p[0].source).toBe("dailymed");
  });

  it("labels an RxNav-resolved strength", () => {
    const p = strengthProvenanceFor(
      order({ productName: "lisinopril 10 MG Oral Tablet", strengthText: "10 MG" }),
    );
    expect(p[0].source).toBe("rxnav");
  });

  it("labels a manually entered dose", () => {
    const p = strengthProvenanceFor(
      order({ productName: "Compounded mystery suspension", strengthText: "as directed", manualDose: "1 tablet" }),
    );
    expect(p[0].source).toBe("manual");
  });
});
