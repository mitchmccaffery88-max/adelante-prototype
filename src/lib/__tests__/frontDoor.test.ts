import { describe, expect, it } from "vitest";
import {
  coverageMessage,
  ecmQuestionApplies,
  shouldAskHeardAbout,
  type CoverageType,
} from "@/lib/frontDoor";

describe("coverage type is independent of justice involvement", () => {
  it("represents Medicare + justice-involved (impossible in the old model)", () => {
    const msg = coverageMessage({ coverageType: "medicare", justiceInvolvement: "yes" });
    expect(msg.title).toBe("We'll bill Medicare.");
    expect(msg.reentrySafetyNet).toBeTruthy();
  });

  it("asks the CalAIM ECM follow-up only under Medi-Cal or dual", () => {
    const applies: CoverageType[] = ["medi_cal", "dual"];
    const doesNot: CoverageType[] = ["medicare", "private", "self_pay", "unknown"];
    applies.forEach((c) => expect(ecmQuestionApplies(c)).toBe(true));
    doesNot.forEach((c) => expect(ecmQuestionApplies(c)).toBe(false));
  });
});

describe("reentry-messaging bug fix", () => {
  it("does NOT promise free sessions to private-pay + never justice-involved", () => {
    const msg = coverageMessage({ coverageType: "private", justiceInvolvement: "no" });
    expect(msg.reentrySafetyNet).toBeUndefined();
    expect(msg.billingNote).toMatch(/sliding scale/i);
  });

  it("does NOT promise free sessions to self-pay + never justice-involved", () => {
    const msg = coverageMessage({ coverageType: "self_pay", justiceInvolvement: "no" });
    expect(msg.reentrySafetyNet).toBeUndefined();
    expect(msg.billingNote).toBeTruthy();
  });

  it("layers the safety net on for private-pay + justice-involved", () => {
    const msg = coverageMessage({ coverageType: "private", justiceInvolvement: "yes" });
    expect(msg.reentrySafetyNet).toMatch(/reentry program/i);
    expect(msg.billingNote).toBeUndefined();
  });

  it("hedges rather than promising or denying when justice involvement is unsure", () => {
    const msg = coverageMessage({ coverageType: "private", justiceInvolvement: "unsure" });
    expect(msg.reentrySafetyNet).toMatch(/may also qualify/i);
    expect(msg.billingNote).toBeTruthy();
  });
});

describe("how-did-you-hear gate", () => {
  const base = {
    seekingCareForSelf: true,
    existingCare: "no" as const,
    hasReferralRecord: false,
    hasPreReleaseEpisode: false,
  };

  it("asks on the general-population path", () => {
    expect(shouldAskHeardAbout(base)).toBe(true);
    expect(shouldAskHeardAbout({ ...base, existingCare: "unsure" })).toBe(true);
  });

  it("skips populations with a known source", () => {
    expect(shouldAskHeardAbout({ ...base, hasReferralRecord: true })).toBe(false);
    expect(shouldAskHeardAbout({ ...base, hasPreReleaseEpisode: true })).toBe(false);
    expect(shouldAskHeardAbout({ ...base, existingCare: "yes" })).toBe(false);
    expect(shouldAskHeardAbout({ ...base, seekingCareForSelf: false })).toBe(false);
  });
});