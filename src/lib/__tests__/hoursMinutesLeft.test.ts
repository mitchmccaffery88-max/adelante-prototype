import { describe, it, expect } from "vitest";
import { hoursMinutesLeft } from "../escalations";

describe("hoursMinutesLeft", () => {
  it("rolls 59.5+ minutes into the next hour, never 60m", () => {
    expect(hoursMinutesLeft(1 * 3600000 + 59.7 * 60000)).toEqual({ h: 2, m: 0 });
    expect(hoursMinutesLeft(59.6 * 60000)).toEqual({ h: 1, m: 0 });
  });
  it("keeps ordinary values and floors at zero", () => {
    expect(hoursMinutesLeft(1 * 3600000 + 58 * 60000)).toEqual({ h: 1, m: 58 });
    expect(hoursMinutesLeft(-5000)).toEqual({ h: 0, m: 0 });
  });
});
