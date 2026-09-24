import { describe, expect, it } from "vitest";
import { distressChipDecision, isDistressMessage, isMeetingRequest } from "@/lib/adelDistress";
import { detectCrisisLanguage } from "@/lib/crisisTextDetection";
import { resolveAdelAction } from "@/lib/adelPrompt";

describe("Adel distress chips", () => {
  it("no distress → no chips", () => {
    expect(distressChipDecision(["hi", "how does the app work"])).toEqual({ inDistress: false, offerInline: false });
  });
  it("offers at first distress turn, then every 3 turns", () => {
    const base = ["hi", "I feel so anxious"];
    expect(distressChipDecision(base).offerInline).toBe(true);
    expect(distressChipDecision([...base, "ok"]).offerInline).toBe(false);
    expect(distressChipDecision([...base, "ok", "yeah"]).offerInline).toBe(false);
    expect(distressChipDecision([...base, "ok", "yeah", "hm"]).offerInline).toBe(true);
    expect(distressChipDecision([...base, "ok"]).inDistress).toBe(true);
  });
  it("Spanish distress detected", () => {
    expect(isDistressMessage("tengo mucha ansiedad")).toBe(true);
  });
  it("crisis language is still caught by the crisis detector independently", () => {
    expect(detectCrisisLanguage("I want to kill myself").matched).toBe(true);
  });
  it("meeting intent resolves to the filtered directory", () => {
    expect(isMeetingRequest("find me a meeting")).toBe(true);
    expect(resolveAdelAction("resources:recovery_meetings")?.search).toEqual({ category: "recovery_meetings" });
  });
});
