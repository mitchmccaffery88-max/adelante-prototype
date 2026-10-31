import { describe, expect, it } from "vitest";
import { estimateLabel } from "../screenerCompleteness";

describe("Mitch approved estimate label singular/plural — Spanish Draft", () => {
  it("uses singular for one missing item in English", () => {
    expect(estimateLabel({ estimated: true, missingItems: [0] })).toBe("Estimated (1 item missing)");
  });
  it("uses plural for two missing items in English", () => {
    expect(estimateLabel({ estimated: true, missingItems: [0, 1] })).toBe("Estimated (2 items missing)");
  });
  it("uses singular for one missing item in Draft Spanish", () => {
    expect(estimateLabel({ estimated: true, missingItems: [0] }, "es")).toBe("Estimado (1 ítem faltante)");
  });
  it("uses plural for two missing items in Draft Spanish", () => {
    expect(estimateLabel({ estimated: true, missingItems: [0, 1] }, "es")).toBe("Estimado (2 ítems faltantes)");
  });
});