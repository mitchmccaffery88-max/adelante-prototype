import { describe, expect, it } from "vitest";
import {
  isTopicalForm,
  isUnitDosedProduct,
  parseStrength,
  parseUnitsStrength,
  reconcileDoseByUnits,
} from "@/lib/doseReconcile";
import { doseModeFor, validateOrder, productFromOrder } from "@/lib/orders";
import { buildSigLine } from "@/lib/sigLine";
import { normalizeDailyMedStrength } from "@/lib/dailymed.server";
import type { MedOrder } from "@/lib/ehr";

const base = (o: Partial<MedOrder>): MedOrder => ({
  id: "o1",
  patientId: "p1",
  drugName: "test",
  status: "draft",
  // Phase 2: dispense routing is a required field on every order.
  dispenseRoute: "pharmacy",
  ...o,
});

describe("unit-dosed products", () => {
  it("parses UNT/ML concentration", () => {
    expect(parseUnitsStrength("300 UNT/ML")).toEqual({ unitsPerMl: 300 });
    expect(parseUnitsStrength("100 UNT")).toEqual({ strengthUnits: 100 });
    expect(parseUnitsStrength("50 MG")).toBeUndefined();
  });

  it("routes insulin to the units axis", () => {
    const order = base({
      productName: "3 ML insulin glargine 100 UNT/ML Pen Injector",
      strengthText: "100 UNT/ML",
      doseForm: "Pen Injector",
    });
    const product = productFromOrder(order);
    expect(isUnitDosedProduct(product)).toBe(true);
    expect(doseModeFor(order)).toBe("units");
  });

  it("takes the stated unit count as the instruction and computes fill volume", () => {
    const product = productFromOrder(
      base({ productName: "insulin glargine 100 UNT/ML", strengthText: "100 UNT/ML", route: "SQ" }),
    );
    const r = reconcileDoseByUnits(product, 18, { allowHalfUnits: true });
    expect(r.error).toBeUndefined();
    expect(r.unitsPerAdmin).toBe(18);
    expect(r.isUnitDose).toBe(true);
    expect(r.volumeMl).toBe(0.18);
    expect(reconcileDoseByUnits(product, 0).error?.code).toBe("invalid_target");
    expect(reconcileDoseByUnits(product, 18.25, { allowHalfUnits: true }).error?.code).toBe(
      "unit_fraction_not_allowed",
    );
  });

  it("writes a unit Sig", () => {
    const product = productFromOrder(
      base({ productName: "insulin glargine 100 UNT/ML", strengthText: "100 UNT/ML", route: "SQ" }),
    );
    const dose = reconcileDoseByUnits(product, 18);
    expect(buildSigLine({ product, dose, route: "SQ", frequencyLabel: "at bedtime" })).toBe(
      "Give 18 units (0.18 mL) by sq route at bedtime.",
    );
  });
});

describe("topical products", () => {
  it("classifies external forms", () => {
    for (const f of ["Topical Cream", "Topical Ointment", "Topical Gel", "Lotion", "Foam", "Transdermal System"])
      expect(isTopicalForm(f)).toBe(true);
    expect(isTopicalForm("Oral Tablet")).toBe(false);
  });

  it("skips mg reconciliation and gates on the apply instruction instead", () => {
    const order = base({
      productName: "hydrocortisone 10 MG/ML Topical Cream",
      strengthText: "10 MG/ML",
      doseForm: "Topical Cream",
      frequencyCode: "BID",
      quantity: 1,
      isStat: true,
      indicationText: "rash",
    });
    expect(doseModeFor(order)).toBe("topical");
    const issues = validateOrder(order, { needsAttribution: false });
    expect(issues.find((i) => i.field === "dose")?.message).toMatch(/Application amount/);
    const ok = validateOrder({ ...order, applicationInstruction: "thin layer to affected area" }, {
      needsAttribution: false,
    });
    expect(ok).toHaveLength(0);
  });

  it("builds an apply Sig", () => {
    expect(
      buildSigLine({
        applicationInstruction: "thin layer to affected area",
        frequencyLabel: "twice daily",
      }),
    ).toBe("Apply thin layer to affected area twice daily.");
  });
});

describe("manual dose path", () => {
  const order = base({
    productName: "mystery product",
    strengthText: undefined,
    doseForm: "Oral Tablet",
    frequencyCode: "QD",
    quantity: 30,
    isStat: true,
    indicationText: "x",
  });

  it("is used only when reconciliation is exhausted", () => {
    expect(doseModeFor(order)).toBe("manual");
    expect(doseModeFor({ ...order, strengthText: "50 MG" })).toBe("mg");
  });

  it("requires a justification before it can be signed", () => {
    const issues = validateOrder({ ...order, manualDose: "1 tablet" }, { needsAttribution: false });
    expect(issues.map((i) => i.field)).toContain("manualDoseJustification");
    expect(
      validateOrder(
        { ...order, manualDose: "1 tablet", manualDoseJustification: "label verified by pharmacy" },
        { needsAttribution: false },
      ),
    ).toHaveLength(0);
  });
});

describe("DailyMed strength normalisation", () => {
  it("maps SPL phrasing onto the RxNav shape", () => {
    expect(normalizeDailyMedStrength("25 mg")).toBe("25 MG");
    expect(normalizeDailyMedStrength("300 U in 1 mL")).toBe("300 UNT/ML");
    expect(normalizeDailyMedStrength("50 mg in 1 1")).toBe("50 MG");
    expect(normalizeDailyMedStrength("10 mg in 1 mL")).toBe("10 MG/ML");
    expect(normalizeDailyMedStrength("nonsense")).toBeUndefined();
  });

  it("feeds a DailyMed-resolved strength straight into the mg engine", () => {
    const strength = normalizeDailyMedStrength("25 mg")!;
    expect(parseStrength(strength, [], "sertraline 25 mg")[0].strengthMg).toBe(25);
  });
});
