import { describe, it, expect } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { AdelanteEHRExt } from "@/lib/ehr-ext";
import { mirrorNoteSignatureToLedger } from "@/lib/noteSignFlow";
import { signClaimViaNote } from "@/test/claimSigning";

describe("mirrorNoteSignatureToLedger", () => {
  it("does nothing for a note with no linked visit", () => {
    const before = AdelanteEHRExt.listClaims().map((c) => `${c.encounterId}:${c.state}`);
    const p = AdelanteEHR.listPatients()[0]!.id;
    const n = AdelanteEHR.addProgressNote(p, {
      clinicianId: "c1", date: new Date().toISOString(), sessionType: "individual",
      subjective: "s", objective: "", assessment: "", plan: "", authorSource: "human", status: "draft",
    })!;
    expect(mirrorNoteSignatureToLedger(p, n.id).ok).toBe(true);
    expect(AdelanteEHRExt.listClaims().map((c) => `${c.encounterId}:${c.state}`)).toEqual(before);
  });

  it("a signed, attested note linked to the visit advances documented -> signed", () => {
    const claim = AdelanteEHRExt.listClaims().find(
      (c) => c.state === "documented" && !AdelanteEHRExt.isNoteSigned(c.encounterId),
    )!;
    signClaimViaNote(claim);
    expect(AdelanteEHRExt.claimForEncounter(claim.encounterId)!.state).toBe("signed");
  });
});
