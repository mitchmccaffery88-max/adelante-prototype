// TEMPORARY proof for the Mitch-approved test edit (Oct 24) in
// batchBIntake.test.ts "uses neutral wording in task, notification and audit
// text". This file is run once for evidence and deleted; it is not a batch
// deliverable.
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { runAction } from "@/lib/actions/runAction";
import { chaseRowsFor, CHASE_FIELD_LABEL } from "@/lib/referralChase";
import type { StaffRole } from "@/lib/roles";

const coord = { role: "clinical_coordinator" as StaffRole, staffId: "s-coord-test", name: "Priya" };
const banned = /charge|substance|sud|opioid|alcohol|treatment|2026-10-01/i;

afterEach(() => vi.restoreAllMocks());

describe("proof: seeded random id containing 'sud'", () => {
  it("passes with the exact id 317ksud2 that failed post-restart", () => {
    // Seed Math.random so uid() = Math.random().toString(36).slice(2, 10)
    // yields "317ksud2" — the literal id that collided with the banned regex.
    vi.spyOn(Math, "random").mockReturnValue(0.08426735706599142);
    const r = AdelanteEHR.createReferral({
      firstName: "Chase",
      lastName: `Test${Math.random().toString(36).slice(2, 6)}`,
      dob: "1990-01-01",
      referringAgency: "County Probation",
      referrerName: "Officer Diaz",
      referrerPhone: "5595550100",
      referralSource: "probation",
      consentToContact: false,
      channel: "public",
      justiceInvolved: "yes",
      substanceUseNeed: true,
    } as never);
    expect(r.id).toBe("317ksud2");
    const row = chaseRowsFor(coord).find((x) => x.referral.id === r.id)!;
    expect(row.text).toContain(`Missing: ${CHASE_FIELD_LABEL.cin}`);
    expect(row.text).toContain("custody detail");
    runAction("referral_chase_fill", { role: "community_health_worker" }, undefined, { args: [{ role: "community_health_worker", name: "Kayla" }, r.id, { pendingCharges: "yes", releaseDate: "2026-10-01" }] });
    const audits = AdelanteEHR.listAuditEvents().filter((e) => (e.detail as { referralId?: string } | undefined)?.referralId === r.id && /chase|referral_chase/.test(`${e.action} ${JSON.stringify(e.detail)}`));
    expect(audits.length).toBeGreaterThan(0);
    // The exact scan logic from the edited test:
    const stripId = (s: string) => s.split(r.id).join("");
    for (const e of audits) {
      const scanned = stripId(JSON.stringify(e.detail));
      expect(scanned.length).toBeGreaterThan(0);
      expect(scanned).not.toMatch(banned);
    }
    const notes = AdelanteEHR.listNotifications().filter((n) => n.subject === "Referral details to follow up");
    expect(notes.length).toBeGreaterThan(0);
    for (const n of notes) {
      const scanned = stripId(`${n.subject} ${n.body}`);
      expect(scanned.length).toBeGreaterThan(0);
      expect(scanned).not.toMatch(banned);
    }
  });

  it("still fails the check when real SUD text is in the scanned output", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.08426735706599142);
    const r = AdelanteEHR.createReferral({
      firstName: "Chase",
      lastName: "Testproof",
      dob: "1990-01-01",
      referringAgency: "County Probation",
      referrerName: "Officer Diaz",
      referrerPhone: "5595550100",
      referralSource: "probation",
      consentToContact: false,
      channel: "public",
    } as never);
    expect(r.id).toBe("317ksud2");
    const stripId = (s: string) => s.split(r.id).join("");
    // Real SUD text in the scanned output must still be caught after the id
    // is stripped — the edit only removes the literal id, nothing else.
    const withRealSud = stripId(JSON.stringify({ referralId: r.id, note: "SUD assessment due" }));
    expect(withRealSud).not.toContain(r.id);
    expect(withRealSud).toMatch(banned);
    const withRealSubstance = stripId(`Referral details to follow up — substance use history`);
    expect(withRealSubstance).toMatch(banned);
  });
});
