// §B2-5 — the billing QA scenario's DMC-ODS patient: the flag alone grants
// nothing; one signed treatment-only capture opens the ASAM path; the
// coordinator cohort is unchanged.
import "@/test/freezeClock";
import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { runAction } from "@/lib/actions/runAction";
import { buildBillingLifecycleScenario } from "@/lib/billingLifecycleScenario";
import { coordinatorConsentedPatients } from "@/lib/asamReporting";
import { ASAM_DIMENSIONS } from "@/lib/asam";

describe("B2-5 billing QA consent", () => {
  it("a scenario-style patient with only the Part 2 flag gets no SUD access and no ASAM draft", () => {
    const cf = { role: "cf_care_manager" as const, staffId: "s-cf2" };
    const p = runAction<ReturnType<typeof AdelanteEHR.createPatient>>("patient_create_anyway", cf, undefined, { via: "createPatient", args: [{ firstName: "Fictional QA", lastName: "Flag only", matchSource: "seed" }] });
    if (!p.ok) throw new Error(p.reason);
    const ecm = { role: "ecm_provider" as const, staffId: "s-cm1" };
    expect(runAction("consent_purpose_set", ecm, p.value, { via: "staffSetConsent", args: [p.value.id, "part2Sud", true, { role: "ecm_provider", staffId: "s-cm1", staffName: "Luz Herrera" }, "Simulated QA consent"] }).ok).toBe(true);
    expect(AdelanteEHR.getPatient(p.value.id)?.consents.part2Sud).toBe(true);
    expect(AdelanteEHR.isConsentCategoryAuthorized(p.value.id, "sud_treatment")).toBe(false);
    const draft = runAction("asam", { role: "clinical_trainee", staffId: "s-tr1" }, AdelanteEHR.getPatient(p.value.id), {
      via: "saveAsamDraft",
      args: [p.value.id, { dimensions: ASAM_DIMENSIONS.map((d) => ({ key: d.key, documentation: "Simulated.", rating: 1 })), recommendedLevel: "outpatient", actualLevel: "outpatient", diagnosisCodes: ["F15.20"] }, { staffId: "s-tr1", name: "Trainee", role: "clinical_trainee" }],
    });
    expect(draft.ok).toBe(false);
  });

  it("the DMC-ODS scenario patient holds exactly one signed program-treatment record and stays out of the coordinator cohort", () => {
    const s = buildBillingLifecycleScenario();
    const pid = s.dmc_ods.patientId;
    const typed = AdelanteEHR.listConsentRecords(pid).filter((r) => r.consentType);
    expect(typed).toHaveLength(1);
    expect(typed[0]).toMatchObject({ consentType: "part2_tpo_single", purpose: "treatment", purposeCode: "treatment", items: ["SUD treatment information"] });
    expect(typed[0].recipients).toEqual([{ kind: "org", name: "Adelante", directoryRef: "adelante-program" }]);
    expect(typed[0].signature?.method).toBe("e_sign");
    expect(AdelanteEHR.getPatient(pid)?.consents.part2Sud).toBe(false);
    expect(coordinatorConsentedPatients().map((p) => p.id)).not.toContain(pid);
    for (const key of ["paid", "receipt_balance", "denied", "writeoff_reversed", "blocked", "sliding_fee"] as const)
      expect(AdelanteEHR.listConsentRecords(s[key].patientId)).toHaveLength(0);
  });
});
