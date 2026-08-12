import { describe, expect, it } from "vitest";
import { buildAdelSystemPrompt, resolveAdelAction, splitAdelActions } from "@/lib/adelPrompt";
import { EXERCISES, LIBRARY_ITEMS } from "@/lib/library";

describe("Adel ACTION mechanism", () => {
  it("resolves real lesson, exercise, resource and page tokens", () => {
    expect(resolveAdelAction("exercise:urge-surfing-timer")).toMatchObject({
      to: "/library",
      search: { exercise: "urge-surfing-timer" },
    });
    expect(resolveAdelAction("lesson:ss-restoring-sleep")).toMatchObject({
      to: "/library",
      search: { item: "ss-restoring-sleep" },
    });
    expect(resolveAdelAction("resources:housing")?.to).toBe("/resources");
    expect(resolveAdelAction("page:naloxone")?.to).toBe("/naloxone");
  });

  it("drops tokens with no real destination", () => {
    expect(resolveAdelAction("lesson:cathy-module-3")).toBeUndefined();
    expect(resolveAdelAction("page:journal")).toBeUndefined();
    const { body, actions } = splitAdelActions("Try this.\nACTION: exercise:not-a-real-exercise");
    expect(body).toBe("Try this.");
    expect(actions).toHaveLength(0);
  });

  it("strips the ACTION line from the visible body", () => {
    const { body, actions } = splitAdelActions(
      "That sounds heavy.\nACTION: exercise:box-breathing\n",
    );
    expect(body).toBe("That sounds heavy.");
    expect(actions).toHaveLength(1);
    expect(actions[0]!.label).toBe("Box Breathing");
  });

  it("only advertises tokens this build can actually open", () => {
    const prompt = buildAdelSystemPrompt();
    for (const i of LIBRARY_ITEMS) expect(prompt).toContain(`lesson:${i.id}`);
    for (const e of EXERCISES) expect(prompt).toContain(`exercise:${e.id}`);
    for (const m of prompt.matchAll(/^- (\S+?) —/gm)) {
      expect(resolveAdelAction(m[1]!), m[1]).toBeTruthy();
    }
  });

  it("forbids clinical/scored language in the prompt's own voice rules", () => {
    const prompt = buildAdelSystemPrompt();
    expect(prompt).toContain("120 words");
    expect(prompt).toContain("5th-grade");
    expect(prompt).toMatch(/never diagnose/i);
    expect(prompt).toMatch(/"elevated"/);
  });
});
