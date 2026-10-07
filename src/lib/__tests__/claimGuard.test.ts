// §B3 — one claim guardrail. Enumerates every claim-creation entry point and
// proves each refuses a non-billable service. A new entry point that mints a
// claim without calling the guard fails the static check below.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AdelanteEHR } from "@/lib/ehr";
import { AdelanteEHRExt } from "@/lib/ehr-ext";
import { CLAIM_ENTRY_POINTS, claimRefusal } from "@/lib/claimGuard";

const SRC = readFileSync(join(__dirname, "..", "ehr-ext.ts"), "utf8");

/** Every store method whose body pushes into the claims array. */
function claimMinters(): { name: string; body: string }[] {
  const out: { name: string; body: string }[] = [];
  const re = /\n  ([a-zA-Z_]+)\(/g;
  const starts: { name: string; at: number }[] = [];
  for (let m; (m = re.exec(SRC)); ) starts.push({ name: m[1]!, at: m.index });
  starts.forEach((s, i) => {
    const body = SRC.slice(s.at, starts[i + 1]?.at ?? SRC.length);
    if (/\bclaims\.(push|unshift|splice)\(/.test(body)) out.push({ name: s.name, body });
  });
  return out;
}

describe("B3 claim guard — entry-point enumeration", () => {
  it("every method that mints a claim is a registered entry point and calls the guard", () => {
    const minters = claimMinters();
    expect(minters.length).toBeGreaterThanOrEqual(CLAIM_ENTRY_POINTS.length);
    for (const m of minters) {
      expect([m.name, (CLAIM_ENTRY_POINTS as readonly string[]).includes(m.name)]).toEqual([m.name, true]);
      expect([m.name, /assertClaimable\(|isClaimable\(/.test(m.body)]).toEqual([m.name, true]);
    }
    // and nothing in the registered list has gone missing
    for (const name of CLAIM_ENTRY_POINTS) expect(minters.map((m) => m.name)).toContain(name);
  });

  it("the static check catches a minter that skips the guard (fixture)", () => {
    const fixture = `\n  sneakyClaim(x) {\n    claims.push(x);\n  },\n`;
    expect(/assertClaimable\(|isClaimable\(/.test(fixture)).toBe(false);
  });
});

describe("B3 claim guard — each entry point refuses a non-billable service", () => {
  const p = AdelanteEHR.listPatients()[0]!;
  const ADVOCATE = "adv-link-self";
  it("upsertClaimFromEncounter: visit tagged non-billable", () => {
    const appt = AdelanteEHR.listAppointments().find((a) => (a.status === "attended" || a.status === "scheduled") && !AdelanteEHRExt.listClaims().some((c) => c.encounterId === a.id))!;
    const prev = appt.fundingLane;
    appt.fundingLane = "non_billable";
    try {
      expect(() => AdelanteEHRExt.upsertClaimFromEncounter(appt.id)).toThrow(/non-billable/);
    } finally {
      appt.fundingLane = prev;
    }
  });
  it("createAsamClaim: advocate self-claim", () => {
    expect(() => AdelanteEHRExt.createAsamClaim({ asamId: "asam-guard-1", patientId: p.id, clinicianId: ADVOCATE, serviceDate: "2026-10-01" })).toThrow(/Only staff/);
  });
  it("upsertClaimFromGroupAttendee: advocate rendering", () => {
    expect(AdelanteEHRExt.upsertClaimFromGroupAttendee({ sessionId: "no-such", occurrenceStart: "2026-10-01T17:00:00Z", patientId: p.id, facilitatorId: ADVOCATE, noteId: "n-guard" })).toBeNull();
  });
  it("upsertClaimFromPeerNote: advocate self-claim", () => {
    expect(AdelanteEHRExt.upsertClaimFromPeerNote({ patientId: p.id, peerNoteId: "pn-guard", staffId: ADVOCATE, clinicianId: ADVOCATE, minutes: 30 })).toBeNull();
  });
  it("upsertClaimFromChwNote: non-billing staff role", () => {
    expect(AdelanteEHRExt.upsertClaimFromChwNote({ patientId: p.id, noteId: "chw-guard", staffId: "s-admin1", clinicianId: "s-admin1", dateISO: "2026-10-01T17:00:00Z", minutes: 30 })).toBeNull();
  });
  it("AFBI, cancelled / no-show and non-billing staff are refused by the one function", () => {
    expect(claimRefusal({ entry: "upsertClaimFromEncounter", sourceIds: ["afbi-1"] })).toMatch(/AFBI/);
    expect(claimRefusal({ entry: "upsertClaimFromEncounter", sourceIds: ["a"], appointment: { status: "no_show", clinicianId: "c1" } })).toMatch(/cancelled or missed/);
    expect(claimRefusal({ entry: "upsertClaimFromEncounter", sourceIds: ["a"], appointment: { status: "cancelled", clinicianId: "c1" } })).toMatch(/cancelled or missed/);
    expect(claimRefusal({ entry: "upsertClaimFromChwNote", sourceIds: ["a"], renderingId: "s-admin1" })).toMatch(/never renders/);
    expect(claimRefusal({ entry: "upsertClaimFromEncounter", sourceIds: ["a"], appointment: { status: "attended", clinicianId: "c1" } })).toBeUndefined();
  });
});
