import { describe, it, expect } from "vitest";
import { AdelanteEHRExt } from "@/lib/ehr-ext";
import { mirrorNoteSignatureToLedger } from "@/lib/noteSignFlow";
describe("mirror", () => {
  it("advances", () => {
    const before = AdelanteEHRExt.listClaims().map((c) => [c.encounterId, c.state]);
    console.log(before);
    mirrorNoteSignatureToLedger({ appointmentId: "a6" }, "c1");
    console.log(AdelanteEHRExt.listClaims().map((c) => [c.encounterId, c.state]));
    expect(AdelanteEHRExt.listClaims().find((c) => c.encounterId === "a6")!.state).toBe("signed");
  });
});
