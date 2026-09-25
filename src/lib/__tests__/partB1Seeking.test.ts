import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { SCREENERS } from "@/lib/screeners";
import { intakeScreeners, recoveryJourneyVisible, visibleSeekingSubstanceUse } from "@/lib/seeking";

function fresh() {
  return AdelanteEHR.createPatient({
    firstName: "Seek",
    lastName: `Test${Math.random().toString(36).slice(2, 6)}`,
    dob: "1990-01-01",
  } as Parameters<typeof AdelanteEHR.createPatient>[0]);
}

describe("Part B1 — looking for", () => {
  it("screener offering is unchanged: depends only on Part 2 consent", () => {
    const all = SCREENERS.map((s) => s.key);
    const nonSud = SCREENERS.filter((s) => !s.isSud).map((s) => s.key);
    expect(intakeScreeners(true).map((s) => s.key)).toEqual(all);
    expect(intakeScreeners(false).map((s) => s.key)).toEqual(nonSud);
    expect(intakeScreeners(null).map((s) => s.key)).toEqual(nonSud);
    // The function takes no "looking for" input at all.
    expect(intakeScreeners.length).toBe(1);
  });

  it("never adds a care-plan goal without clinician acceptance", () => {
    const p = fresh();
    const before = (AdelanteEHR.getPatient(p.id)?.goals ?? []).length;
    AdelanteEHR.recordSeeking(p.id, { mentalHealth: true, medication: true, substanceUse: false }, { id: p.id, role: "patient" });
    const after = AdelanteEHR.getPatient(p.id)!;
    expect((after.goals ?? []).length).toBe(before);
    expect(after.suggestedGoals?.filter((g) => g.status === "suggested")).toHaveLength(2);

    const sg = after.suggestedGoals![0]!;
    AdelanteEHR.acceptSuggestedGoal(p.id, sg.id, { name: "Dr. Test", role: "therapist" });
    const accepted = AdelanteEHR.getPatient(p.id)!;
    expect((accepted.goals ?? []).length).toBe(before + 1);
    expect(accepted.suggestedGoals![0]!.decidedBy).toBe("Dr. Test");
    const audit = AdelanteEHR.listAuditEvents({ patientId: p.id }).map((e) => e.action);
    expect(audit).toContain("suggested_goal_accepted");

    AdelanteEHR.dismissSuggestedGoal(p.id, accepted.suggestedGoals![1]!.id, { name: "Dr. Test", role: "therapist" });
    expect((AdelanteEHR.getPatient(p.id)!.goals ?? []).length).toBe(before + 1);
  });

  it("drops the substance-use selection without Part 2 consent", () => {
    const p = fresh();
    AdelanteEHR.recordSeeking(p.id, { mentalHealth: false, medication: false, substanceUse: true }, { id: p.id, role: "patient" });
    expect(AdelanteEHR.getPatient(p.id)!.needs.substanceUse).toBeFalsy();
  });

  it("Part 2 masking: substance use hidden from advocates and gated staff", () => {
    const p = fresh();
    AdelanteEHR.recordSeeking(
      p.id,
      { mentalHealth: false, medication: false, substanceUse: true },
      { id: p.id, role: "patient" },
      { sudConsentGiven: true },
    );
    const rec = AdelanteEHR.getPatient(p.id)!;
    expect(rec.needs.substanceUse).toBe(true);
    expect(visibleSeekingSubstanceUse(rec, { kind: "advocate" })).toBeUndefined();
    // Consent-gated role with no ledger consent → masked.
    expect(visibleSeekingSubstanceUse(rec, { kind: "staff", role: "peer_specialist" })).toBeUndefined();
    // Treating clinician → visible.
    expect(visibleSeekingSubstanceUse(rec, { kind: "staff", role: "therapist" })).toBe(true);
    // Audit never carries the SUD answer itself.
    const ev = AdelanteEHR.listAuditEvents({ patientId: p.id }).find((e) => e.action === "seeking_recorded");
    expect(JSON.stringify(ev?.detail ?? {})).not.toMatch(/substanceUse/);
  });

  it("Recovery Journey hidden only when answered without substance use", () => {
    expect(recoveryJourneyVisible({ needs: { housing: false, food: false, employment: false, transport: false } })).toBe(true);
    expect(recoveryJourneyVisible({ seeking: { mentalHealth: true, medication: false, answeredAt: "x" }, needs: { housing: false, food: false, employment: false, transport: false } })).toBe(false);
    expect(recoveryJourneyVisible({ seeking: { mentalHealth: false, medication: false, answeredAt: "x" }, needs: { housing: false, food: false, employment: false, transport: false, substanceUse: true } })).toBe(true);
  });
});
