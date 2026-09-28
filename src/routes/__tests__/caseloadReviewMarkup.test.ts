import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Demo sweep: <Badge> renders a <div>; a <div> inside <p> breaks hydration.
describe("caseload review markup", () => {
  it("never nests a Badge inside a <p>", () => {
    const src = readFileSync(resolve(__dirname, "../caseload-review.tsx"), "utf8");
    const paragraphs = src.match(/<p[\s>][\s\S]*?<\/p>/g) ?? [];
    for (const p of paragraphs) expect(p).not.toMatch(/<Badge/);
  });
});
