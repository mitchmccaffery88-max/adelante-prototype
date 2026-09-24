import { describe, it, expect } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import {
  ADEL_QUESTIONS,
  hasKnownValue,
  matchChoice,
  nextQuestionIndex,
  type AdelIntakeState,
} from "@/lib/adelIntakeScript";
import { blankIntakeProfile, profilePatch } from "@/lib/intakeProfile";
import { EMPTY_BENEFITS, benefitsAnswers, recordIntakeBenefits } from "@/lib/intakeBenefits";

const q = (id: string) => ADEL_QUESTIONS.find((x) => x.id === id)!;
const base = (): AdelIntakeState => ({ profile: blankIntakeProfile(), benefits: { ...EMPTY_BENEFITS } });

describe("Adel-guided intake script", () => {
  it("matches typed answers only to the form's allowed choices", () => {
    const choices = q("benefitsChoice").choices!("en", []);
    expect(matchChoice("I have medi-cal", choices)).toBe("medi_cal");
    expect(matchChoice("Medi-Cal and Medicare", choices)).toBe("dual");
    expect(matchChoice("no insurance", choices)).toBe("no_insurance");
    expect(matchChoice("banana", choices)).toBeUndefined();
    expect(matchChoice("tengo medi-cal", q("benefitsChoice").choices!("es", []))).toBe("medi_cal");
  });

  it("asks Medi-Cal questions only for Medi-Cal/dual", () => {
    const s = base();
    const cinIdx = ADEL_QUESTIONS.findIndex((x) => x.id === "cin");
    expect(ADEL_QUESTIONS[nextQuestionIndex(s, cinIdx)]?.id ?? "done").not.toBe("cin");
    const mc = q("benefitsChoice").set(s, "medi_cal");
    expect(ADEL_QUESTIONS[nextQuestionIndex(mc, cinIdx)].id).toBe("cin");
  });

  it("rejects an invalid CIN and treats blank defaults as unknown", () => {
    expect(q("cin").validate!("123")).toBe("cinInvalid");
    expect(q("cin").validate!("91234567A")).toBeUndefined();
    expect(hasKnownValue(q("contactChannel"), base())).toBe(false);
    expect(hasKnownValue(q("phone"), { ...base(), profile: { ...blankIntakeProfile(), phone: "5595550100" } })).toBe(true);
  });

  it("saves through the existing writes, audited as via Adel, source patient_reported", () => {
    const p = AdelanteEHR.createPatient({ firstName: "Adel", lastName: "Tester" });
    const profile = { ...blankIntakeProfile(), phone: "5595550199", preferredName: "Addy" };
    AdelanteEHR.saveIntakeProfileViaAdel(p.id, profilePatch(profile), ["phone", "preferredName"]);
    expect(AdelanteEHR.getPatient(p.id)?.phone).toBe("5595550199");
    const answers = benefitsAnswers(
      { ...EMPTY_BENEFITS, choice: "medi_cal", cin: "91234567B", planId: "mcp-anthem" },
      { id: "mcp-anthem", name: "Anthem Blue Cross", kind: "plan" },
    )!;
    const r = recordIntakeBenefits(p.id, answers, {
      source: "patient_reported",
      via: "adel_guided_intake",
      actorId: p.id,
      actorName: "Adel Tester",
      actorRole: "patient",
    });
    expect(r.ok).toBe(true);
    const spans = AdelanteEHR.getPatient(p.id)?.coverage?.plans ?? [];
    expect(spans.some((s) => (s as { source?: string }).source === "patient_reported")).toBe(true);
    expect(AdelanteEHR.getPatient(p.id)?.intakeCompletedAt).toBeFalsy();
  });
});
