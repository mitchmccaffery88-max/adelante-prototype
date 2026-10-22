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

function canon(text: string): string {
  const seen = new Map<string, string>();
  return text.replace(/\b(?=[a-z]*\d)[a-z0-9]{8}\b/g, (t) => {
    if (!seen.has(t)) seen.set(t, `<id${seen.size}>`);
    return seen.get(t)!;
  });
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
