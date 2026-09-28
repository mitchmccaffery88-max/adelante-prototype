import { describe, expect, it } from "vitest";
import { createSpeakGuard } from "@/lib/adelVoice";

describe("speak-once guard", () => {
  it("drops an immediate duplicate, allows new text and later repeats", () => {
    const g = createSpeakGuard(800);
    expect(g("Question 1", "en", 1000)).toBe(true);
    expect(g("Question 1", "en", 1005)).toBe(false);
    expect(g("Question 2", "en", 1010)).toBe(true);
    expect(g("Question 2", "es", 1015)).toBe(true);
    expect(g("Question 2", "es", 2000)).toBe(true);
  });
});
