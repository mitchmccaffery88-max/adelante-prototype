// §B2-4 matrix parity — Date pinned and Math.random seeded before ANY store
// module loads. The fixture was produced by running this same file against
// the rollback archive 0089ca4f (B24_MATRIX_WRITE=<path>). Every seeded
// patient x role x surface, in the default seed, after the billing lifecycle
// QA scenario, after external-recipient typed records, and every emergency
// grant state must be byte-identical. No field is stripped.
import { vi, describe, expect, it } from "vitest";

vi.hoisted(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-22T12:00:00.000Z"));
  let a = 42 >>> 0;
  Math.random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
});

import { readFileSync, writeFileSync } from "node:fs";
import { enforcementMatrix } from "@/test/consentEnforcementB2Scenario";

// IDs are canonicalized BY KEY, never by pattern: a value under an id / pid /
// *Id / *Ids key (including every element of an *Ids array), and the record ID
// in the disclosure ref "Consent record <id>" (part2Disclosure.ts), becomes a
// placeholder in order of first appearance. Every other value stays literal.
// Why: generated IDs vary run to run (a real-time simulated SMS timer draws
// Math.random — ehr.ts), so a regex over token shapes is unreliable.
const isIdKey = (k: string) => k === "id" || k === "pid" || k.endsWith("Id") || k.endsWith("Ids");
function canon(text: string): string {
  const seen = new Map<string, string>();
  const ph = (v: unknown) => {
    const s = JSON.stringify(v);
    if (!seen.has(s)) seen.set(s, `<id${seen.size}>`);
    return seen.get(s)!;
  };
  const walk = (v: unknown, idCtx: boolean): unknown => {
    if (Array.isArray(v)) return v.map((x) => walk(x, idCtx));
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, isIdKey(k))]));
    if (idCtx && v !== null) return ph(v);
    if (typeof v === "string") return v.replace(/^Consent record (\S+)/, (_m, id: string) => `Consent record ${ph(id)}`);
    return v;
  };
  return JSON.stringify(walk(JSON.parse(text), false), null, 1);
}

const FIXTURE = "src/lib/__tests__/fixtures/consentEnforcementB2-rollback-0089ca4f.json";

describe("B2-4 access matrix against rollback 0089ca4f", () => {
  it("every patient x role x surface is identical (default seed, QA scenario, external records, emergency states)", () => {
    const snap = JSON.stringify(enforcementMatrix(), null, 1);
    if (process.env.B24_MATRIX_WRITE) {
      writeFileSync(process.env.B24_MATRIX_WRITE, snap);
      return;
    }
    expect(canon(snap)).toBe(canon(readFileSync(FIXTURE, "utf8")));
  });
});
