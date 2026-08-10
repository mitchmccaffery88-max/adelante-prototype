import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { matchExistingRecord, shouldRunSafetyNetLookup } from "@/lib/missedHandoff";

function mk(lastName: string, patch: Partial<{ dob: string; phone: string; cin: string }> = {}) {
  const p = AdelanteEHR.createPatient({ firstName: "Test", lastName });
  AdelanteEHR.updateProfile(p.id, { phone: patch.phone ?? "", cin: patch.cin });
  const rec = AdelanteEHR.getPatient(p.id)!;
  rec.dob = patch.dob ?? "1985-04-02";
  return rec.id;
}

describe("safety-net lookup gating", () => {
  it("runs for the Phase 1 'not sure' flag", () => {
    expect(shouldRunSafetyNetLookup({ recordLookupPending: true, justiceInvolvement: "no" })).toBe(true);
  });
  it("runs for yes and not-sure justice involvement", () => {
    expect(shouldRunSafetyNetLookup({ justiceInvolvement: "yes" })).toBe(true);
    expect(shouldRunSafetyNetLookup({ justiceInvolvement: "unsure" })).toBe(true);
  });
  it("does not run with no trigger, or when a plan is already found", () => {
    expect(shouldRunSafetyNetLookup({ justiceInvolvement: "no" })).toBe(false);
    expect(
      shouldRunSafetyNetLookup({ recordLookupPending: true, existingPlanFound: true }),
    ).toBe(false);
  });
});

describe("deterministic matching", () => {
  const subject = { id: "s", dob: "1985-04-02", cin: "99887766A", phone: "559-555-1234", lastName: "Reyes" };
  it("matches on DOB + CIN", () => {
    const r = matchExistingRecord(subject, [{ id: "a", dob: "1985-04-02", cin: "99887766a" }]);
    expect(r.status).toBe("match");
    expect(r.basis).toBe("dob_cin");
  });
  it("falls back to DOB + phone last-4 + last name when no CIN", () => {
    const r = matchExistingRecord({ ...subject, cin: undefined }, [
      { id: "a", dob: "1985-04-02", phone: "(559) 000-1234", lastName: "reyes" },
    ]);
    expect(r.status).toBe("match");
    expect(r.basis).toBe("dob_phone4_name");
  });
  it("reports ambiguity rather than guessing", () => {
    const r = matchExistingRecord(subject, [
      { id: "a", dob: "1985-04-02", cin: "99887766A" },
      { id: "b", dob: "1985-04-02", cin: "99887766A" },
    ]);
    expect(r.status).toBe("ambiguous");
  });
  it("returns none on a near-miss DOB", () => {
    expect(matchExistingRecord(subject, [{ id: "a", dob: "1985-04-03", cin: "99887766A" }]).status).toBe("none");
  });
});

describe("catch-up task list reuses the CF Care Manager pre-release functions", () => {
  it("generates a day-one episode, flags the record, and forces Medi-Cal follow-up", () => {
    const id = mk("Missed", { cin: "111222333B", dob: "1979-01-05" });
    AdelanteEHR.recordFrontDoorEntry(id, { existingCare: "unsure" });
    AdelanteEHR.setCoverage(id, {
      status: "none_unsure",
      verified: "not_found",
      coverageType: "unknown",
      justiceInvolvement: "yes",
    });

    const result = AdelanteEHR.runSafetyNetRecordLookup(id);
    expect(result.ran).toBe(true);
    expect(result.status).toBe("none");

    const flag = AdelanteEHR.generateMissedHandoffCatchUp({
      patientId: id,
      ownerName: "Intake staff",
      ownerRole: "ecm_provider",
      trigger: "record_lookup_pending",
    })!;
    expect(flag.mediCalFollowUpRequired).toBe(true);
    expect(AdelanteEHR.getPatient(id)?.missedPreReleaseCoordination?.episodeId).toBe(flag.episodeId);
    expect(AdelanteEHR.getPatient(id)?.coverage?.mediCalReactivationFollowUp).toBe(true);

    // Same episode + form checklist the CF Care Manager works from.
    const ep = AdelanteEHR.getPreReleaseEpisode(flag.episodeId)!;
    expect(ep.missedHandoff).toBe(true);
    expect(AdelanteEHR.preReleaseChecklist(ep.id).length).toBeGreaterThan(3);

    const tasks = AdelanteEHR.listCaseTasks().filter((t) => t.patientId === id);
    expect(tasks.some((t) => t.taskType === "missed_handoff_catch_up")).toBe(true);
    expect(tasks.some((t) => /Medi-Cal reactivation check/i.test(t.title))).toBe(true);

    // Idempotent.
    const again = AdelanteEHR.generateMissedHandoffCatchUp({
      patientId: id,
      ownerName: "Someone else",
      ownerRole: "cf_care_manager",
      trigger: "justice_involvement",
    })!;
    expect(again.episodeId).toBe(flag.episodeId);
  });
});
