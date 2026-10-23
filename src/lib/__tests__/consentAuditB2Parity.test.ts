// §B2-6 parity proof — Date pinned and Math.random seeded before ANY store
// module loads. The fixture was produced by running this same file against the
// rollback archive 5c335b7e (B26_PARITY_WRITE=1). Every disclosure decision,
// every disclosure entry's existing fields, every disclosure audit's existing
// detail and every existing gate read must match; only the new B2-6 fields are
// stripped before comparison (see src/test/consentAuditB2Scenario.ts).
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
import { paritySnapshot } from "@/test/consentAuditB2Scenario";
import { applyDelta, type DeltaEntry } from "@/test/b25ExpectedDelta";

function canon(text: string): string {
  const seen = new Map<string, string>();
  return text.replace(/\b(?=[a-z]*\d)[a-z0-9]{8}\b/g, (t) => {
    if (!seen.has(t)) seen.set(t, `<id${seen.size}>`);
    return seen.get(t)!;
  });
}

const FIXTURE = "src/lib/__tests__/fixtures/consentAuditB2-rollback-5c335b7e.json";
const DELTA = "src/lib/__tests__/fixtures/b25-expected-delta.json";

describe("B2-6 parity against rollback 5c335b7e", () => {
  it("disclosure decisions, entries, audits and gate reads are byte-identical (new fields stripped)", () => {
    const snap = JSON.stringify(paritySnapshot(), null, 1);
    if (process.env.B26_PARITY_WRITE) {
      writeFileSync(process.env.B26_PARITY_WRITE, snap);
      return;
    }
    // Random 8-char record tokens are canonicalised by first appearance: async
    // module loads can shift the PRNG sequence between runs; everything else
    // is compared byte-for-byte.
    // B2-5: the immutable baseline with EXACTLY the listed transforms i–iv applied.
    const delta = JSON.parse(readFileSync(DELTA, "utf8")).audit as DeltaEntry[];
    expect(delta.length).toBe(81);
    const expected = applyDelta(JSON.parse(readFileSync(FIXTURE, "utf8")), delta);
    expect(canon(snap)).toBe(canon(JSON.stringify(expected, null, 1)));
  });
});
