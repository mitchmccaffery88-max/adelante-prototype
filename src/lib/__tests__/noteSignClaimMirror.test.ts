import { describe, it, expect } from "vitest";
import { AdelanteEHRExt } from "@/lib/ehr-ext";
import { mirrorNoteSignatureToLedger } from "@/lib/noteSignFlow";

/**
 * §EHR audit Phase 1e — the chart signing panel and the notes queue share one
 * mirror into the encounter signature ledger, so a signed note linked to a
 * visit advances that visit's claim `documented → signed`.
 */
describe("mirrorNoteSignatureToLedger", () => {
  it("does nothing for a note with no linked visit", () => {
    const before = AdelanteEHRExt.listClaims().map((c) => `${c.encounterId}:${c.state}`);
    mirrorNoteSignatureToLedger({}, "c1");
    expect(AdelanteEHRExt.listClaims().map((c) => `${c.encounterId}:${c.state}`)).toEqual(before);
  });

  it("advances the linked claim documented -> signed", () => {
    const claim = AdelanteEHRExt.listClaims().find(
      (c) => c.state === "documented" && !AdelanteEHRExt.isNoteSigned(c.encounterId),
    );
    expect(claim).toBeTruthy();
    mirrorNoteSignatureToLedger({ appointmentId: claim!.encounterId }, "c1");
    expect(
      AdelanteEHRExt.listClaims().find((c) => c.encounterId === claim!.encounterId)!.state,
    ).toBe("signed");
  });
});
