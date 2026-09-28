import { describe, expect, it } from "vitest";
import { isTapOnlyStep, isValidatedScreener, pickVoice } from "@/lib/adelVoice";
import { INTAKE_VOICE_COPY } from "@/lib/intakeVoiceCopy";
import { AdelanteEHR } from "@/lib/ehr";
import { listLegalDisclosures, recordLegalDisclosureConsent, revokeLegalDisclosure } from "@/lib/outpatientCare";

const ACTOR = { name: "Dr. Test", role: "therapist" };

describe("E5A voice layer", () => {
  it("sensitive steps are tap-only", () => {
    expect(isTapOnlyStep("c-ssrs")).toBe(true);
    expect(isTapOnlyStep("dast-10")).toBe(true);
    expect(isTapOnlyStep("history")).toBe(true);
    expect(isTapOnlyStep("anything", { isSud: true })).toBe(true);
    expect(isTapOnlyStep("needs")).toBe(false);
    expect(isTapOnlyStep("phq-9")).toBe(false);
  });
  it("validated screeners are recognised (read verbatim, not rewritten)", () => {
    for (const k of ["phq-9", "gad-7", "audit-c", "dast-10", "pc-ptsd-5", "ahc-hrsn", "c-ssrs"]) expect(isValidatedScreener(k)).toBe(true);
    expect(isValidatedScreener("needs")).toBe(false);
  });
  it("plain-language copy exists in EN and ES for every step", () => {
    expect(Object.keys(INTAKE_VOICE_COPY.es.steps).sort()).toEqual(Object.keys(INTAKE_VOICE_COPY.en.steps).sort());
  });
  it("picks a Spanish voice when available", () => {
    const voices = [{ lang: "en-US" }, { lang: "es-MX" }] as unknown as SpeechSynthesisVoice[];
    expect(pickVoice("es", voices)?.lang).toBe("es-MX");
  });
  it("intake stores only confirmed text (no audio)", () => {
    const p = AdelanteEHR.createPatient({ firstName: "Voz", lastName: "Test" } as never);
    AdelanteEHR.completeIntake(p.id, { needs: {} as never, hipaa: true, part2Sud: false, intakeNote: "I need a ride" });
    expect(AdelanteEHR.getPatient(p.id)?.intakeNote).toBe("I need a ride");
  });
});

describe("Legal / Part 2 disclosure card", () => {
  it("a disclosure recorded on a referral is listed and revocable", () => {
    const p = AdelanteEHR.createPatient({ firstName: "Disc", lastName: "Losure" } as never);
    recordLegalDisclosureConsent(p.id, ACTOR, "Disc Losure", { recipient: "Recovery House", purpose: "Referral — Residential" });
    expect(AdelanteEHR.hasLegalDisclosureConsent(p.id)).toBe(true);
    const [d] = listLegalDisclosures(p.id);
    expect(d.recipient).toBe("Recovery House");
    expect(() => revokeLegalDisclosure(d.id, ACTOR, "")).toThrow();
    revokeLegalDisclosure(d.id, ACTOR, "Patient asked to stop");
    expect(listLegalDisclosures(p.id)[0].revokedAt).toBeTruthy();
    expect(AdelanteEHR.hasLegalDisclosureConsent(p.id)).toBe(false);
  });
});
