import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { blankIntakeHistory, hasExistingHistory, seedIntakeHistory } from "@/lib/intakeHistory";
import { resolveAutofill, DISCHARGE_RECORD_POINTER } from "@/lib/noteAutofill";
import type { TemplateSection } from "@/lib/templateSchema";

describe("intake History pre-fill", () => {
  it("is blank for a patient with nothing on file", () => {
    const p = AdelanteEHR.createPatient({ firstName: "Blank", lastName: "H" });
    const seed = seedIntakeHistory(AdelanteEHR.getPatient(p.id));
    expect(seed).toEqual(blankIntakeHistory());
    expect(hasExistingHistory(AdelanteEHR.getPatient(p.id))).toBe(false);
    expect(seedIntakeHistory(undefined)).toEqual(blankIntakeHistory());
  });

  it("pre-fills every structured field already on file, at chart fidelity", () => {
    const p = AdelanteEHR.createPatient({ firstName: "Pre", lastName: "Fill" });
    AdelanteEHR.setSubstanceUseProfile(p.id, {
      entries: [
        {
          rank: "primary",
          substance: "methamphetamine",
          route: "smoking",
          frequency: "daily",
          ageAtFirstUse: 19,
        },
      ],
      source: "self_report",
    });
    AdelanteEHR.setPriorTreatmentHistory(p.id, {
      priorEpisodes: "two_to_four",
      lastTreatmentType: "residential",
      source: "self_report",
    });
    AdelanteEHR.setJusticeSelfReport(p.id, {
      arrestsPast12Months: 2,
      timeInCustodyMonths: 8,
      justiceReferralSource: "probation",
    });
    const seed = seedIntakeHistory(AdelanteEHR.getPatient(p.id));
    expect(seed).toEqual({
      substance: "methamphetamine",
      route: "smoking",
      frequency: "daily",
      ageAtFirstUse: "19",
      priorEpisodes: "two_to_four",
      lastTreatmentType: "residential",
      arrestsPast12Months: "2",
      timeInCustodyMonths: "8",
      justiceReferralSource: "probation",
    });
    expect(hasExistingHistory(AdelanteEHR.getPatient(p.id))).toBe(true);
  });
});

describe("discharge summary reads the structured record", () => {
  const section: TemplateSection = {
    id: "ds_discharge",
    title: "Discharge status and reason",
    type: "autofill_section",
    fields: [],
    autofill: { source: "discharge_record" },
  };
  const base = {
    orders: [],
    allergies: [],
    problems: [],
    administrations: [],
    notes: [],
    sudLocked: false,
  } as const;

  it("points at the structured field when nothing is recorded", () => {
    const out = resolveAutofill(section, { ...base });
    expect(out.lines).toHaveLength(0);
    expect(out.notice).toContain(DISCHARGE_RECORD_POINTER);
  });

  it("renders the current structured discharge instead of free text", () => {
    const p = AdelanteEHR.createPatient({ firstName: "Dis", lastName: "Charge" });
    AdelanteEHR.recordDischarge(p.id, {
      status: "completed_treatment",
      reason: "goals_met",
      dischargedOn: "2026-05-04",
      source: "internal",
    });
    const out = resolveAutofill(section, {
      ...base,
      discharges: AdelanteEHR.getPatient(p.id)?.calomsProfile?.discharges ?? [],
    });
    expect(out.lines[0]!.primary).toBe("Completed treatment");
    expect(out.lines[1]!.primary).toBe("Treatment goals met");
  });

  it("no longer asks discharge reason or condition as free-text fields", () => {
    const tpl = AdelanteEHR.listNoteTemplates().find((t) => t.id.includes("discharge"));
    const keys = (tpl?.schema?.sections ?? []).flatMap((s) => s.fields.map((f) => f.key));
    expect(keys).not.toContain("discharge_reason");
    expect(keys).not.toContain("condition_at_discharge");
  });
});
