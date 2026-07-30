// @vitest-environment jsdom
//
// UI coverage for the three non-mg dosing paths. These assert the AXIS the
// clinician is offered — the whole point of the units/topical work is that the
// wrong axis never appears, so an axis regression must fail a test, not a demo.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MedicationDoseSection } from "@/components/orders/MedicationDoseSection";
import type { MedOrder } from "@/lib/ehr";
import type { OrderFieldKey } from "@/lib/orders";

afterEach(cleanup);

const draft = (o: Partial<MedOrder>): MedOrder => ({
  id: "o1",
  patientId: "p1",
  drugName: o.productName ?? "test",
  status: "draft",
  ...o,
});

function renderDose(order: MedOrder, blocked: OrderFieldKey[] = []) {
  const onPatch = vi.fn();
  render(
    <MedicationDoseSection order={order} blocked={new Set(blocked)} onPatch={onPatch} />,
  );
  return { onPatch };
}

describe("insulin — UNT/ML units axis", () => {
  const insulin = draft({
    productName: "3 ML insulin glargine 100 UNT/ML Pen Injector",
    strengthText: "100 UNT/ML",
    doseForm: "Pen Injector",
    ingredientNames: ["insulin glargine"],
  });

  it("offers the units axis and never a mg field", () => {
    renderDose(insulin);
    expect(screen.getByLabelText("Dose in units")).toBeDefined();
    expect(screen.getByText("Dose (units) *")).toBeDefined();
    expect(screen.queryByText("Dose (mg) *")).toBeNull();
    expect(screen.getByText("Unit-dosed product")).toBeDefined();
  });

  it("shows the pen fill volume once a unit count is entered", () => {
    renderDose({ ...insulin, doseTargetUnits: 18 });
    // 18 units at 100 units/mL = 0.18 mL of pen fill.
    expect(screen.getByText(/0\.18\s*mL/)).toBeDefined();
  });

  it("still gates signing on the units field when it is blocked", () => {
    renderDose(insulin, ["dose"]);
    expect(screen.getByLabelText("Dose in units").className).toContain("border-amber-500");
  });
});

describe("hydrocortisone cream — topical apply-amount flow", () => {
  // RxNav frequently omits DOSE_FORM, so the product NAME must be enough.
  const cream = draft({
    productName: "hydrocortisone acetate 10 MG/ML Topical Cream",
    strengthText: "10 MG/ML",
    ingredientNames: ["hydrocortisone acetate"],
  });

  it("skips mg reconciliation in favour of apply amount / site", () => {
    renderDose(cream);
    expect(screen.getByText("Apply amount / site *")).toBeDefined();
    expect(screen.queryByText("Dose (mg) *")).toBeNull();
    expect(screen.queryByLabelText("Dose in units")).toBeNull();
    expect(screen.getByText("Topical — dosed by application")).toBeDefined();
  });

  it("feeds the application text straight into the Sig line", () => {
    renderDose({
      ...cream,
      applicationInstruction: "thin layer to affected area",
      frequencyCode: "BID",
    });
    expect(screen.getByText(/thin layer to affected area/i)).toBeDefined();
  });
});

describe("exhausted reconciliation — manual entry governance", () => {
  const unparseable = draft({
    productName: "Compounded mystery suspension",
    strengthText: "as directed",
  });

  it("exposes the manual dose path with a required justification", () => {
    renderDose(unparseable, ["dose", "manualDoseJustification"]);
    expect(screen.getByText("Dose (manual) *")).toBeDefined();
    expect(screen.getByLabelText("Manual dose justification")).toBeDefined();
    // Copy must state DailyMed was already tried, so nobody re-files it as a gap.
    expect(screen.getByText(/DailyMed label/i)).toBeDefined();
  });

  it("flags a manually dosed order wherever it renders", () => {
    renderDose({ ...unparseable, manualDose: "1 tablet" });
    expect(screen.getByText("Manual dose")).toBeDefined();
  });
});
