// Privacy P3 — the production build must not contain the test-only inspection hook.
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const FORBIDDEN = ["installDevInspect", "window.__adelante", "__adelante =", "__adelante:", "checkAllBriefs", "devJourneys", "setInFacilityEnabled"];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(m?js|html)$/.test(n) ? [p] : [];
  });
}

describe("Privacy P3 — production bundle", () => {
  it("contains no inspection hook names or symbols", () => {
    execSync("npx vite build", { stdio: "ignore", timeout: 590_000, env: { ...process.env, NODE_ENV: "production", npm_lifecycle_event: "build" } });
    const hits: string[] = [];
    for (const f of files("dist")) {
      const text = readFileSync(f, "utf8");
      for (const s of FORBIDDEN) if (text.includes(s)) hits.push(`${f}: ${s}`);
    }
    expect(hits).toEqual([]);
  }, 600_000);
});
