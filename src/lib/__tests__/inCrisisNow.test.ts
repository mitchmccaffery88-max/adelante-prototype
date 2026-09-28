import { describe, it, expect } from "vitest";
import { OUTSIDE_CRISIS_COPY, COUNTY_CRISIS_LINE } from "@/lib/outsideCrisisResources";
import { crisisCopy } from "@/lib/crisisCopy";

describe("In crisis now", () => {
  it("labels EN/ES and lists outside resources", () => {
    expect(OUTSIDE_CRISIS_COPY.en.button).toBe("In crisis now");
    expect(OUTSIDE_CRISIS_COPY.es.button).toBe("En crisis ahora");
    expect(OUTSIDE_CRISIS_COPY.en.call911).toMatch(/911/);
    expect(COUNTY_CRISIS_LINE.verified).toBe(false);
  });
  it("crisis copy uses the new label", () => {
    expect(JSON.stringify([crisisCopy("en"), crisisCopy("es")])).not.toMatch(/I need help now|Necesito ayuda ahora/);
  });
});
