import { describe, it, expect } from "vitest";
import { OUTSIDE_CRISIS_COPY, countyCrisisLines } from "@/lib/outsideCrisisResources";
import { crisisCopy } from "@/lib/crisisCopy";

describe("In crisis now", () => {
  it("labels EN/ES and lists outside resources", () => {
    expect(OUTSIDE_CRISIS_COPY.en.button).toBe("In crisis now");
    expect(OUTSIDE_CRISIS_COPY.es.button).toBe("En crisis ahora");
    expect(OUTSIDE_CRISIS_COPY.en.call911).toMatch(/911/);
  });
  it("shows the patient's county line, or both counties when unknown", () => {
    expect(countyCrisisLines("Kings").map((l) => l.display)).toEqual(["(559) 582-4481", "1-800-655-2553"]);
    expect(countyCrisisLines("Tulare County").map((l) => l.display)).toEqual(["1-800-320-1616", "1-866-732-4114"]);
    expect(countyCrisisLines(undefined)).toHaveLength(4);
  });
  it("crisis copy uses the new label", () => {
    expect(JSON.stringify([crisisCopy("en"), crisisCopy("es")])).not.toMatch(/I need help now|Necesito ayuda ahora/);
  });
});
